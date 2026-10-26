<?php
/**
 * Copias de seguridad por pasos (aptas para hostings con límites de tiempo).
 *
 * Una copia es una carpeta con:
 *   manifest.json   Metadatos, componentes incluidos y sumas SHA-256.
 *   database.sql    Volcado completo de las tablas del sitio (una sentencia por línea).
 *   files-NNN.zip   Archivos de los componentes, repartidos en partes.
 *
 * El panel llama a /backups/{id}/step hasta que el estado sea "complete".
 *
 * @package Centinela
 */

defined( 'ABSPATH' ) || exit;

class Centinela_Backup {

	const ROWS_PER_QUERY   = 500;
	const ROWS_PER_INSERT  = 100;
	const PART_MAX_BYTES   = 104857600; // 100 MB sin comprimir por parte.
	const PART_MAX_FILES   = 4000;
	const DEFAULT_KEEP     = 5;
	const OPTION_KEEP      = 'centinela_keep_backups';

	/**
	 * Inicia una copia.
	 *
	 * @param array $args scope (components|full), components[], include_uploads, include_db, label, reason.
	 * @return array|WP_Error Manifest público.
	 */
	public static function create( array $args ) {
		Centinela_Inventory::load_admin_includes();
		global $wp_version;

		$scope      = isset( $args['scope'] ) && 'full' === $args['scope'] ? 'full' : 'components';
		$components = self::resolve_components( $scope, isset( $args['components'] ) ? (array) $args['components'] : array(), ! empty( $args['include_uploads'] ) );
		if ( is_wp_error( $components ) ) {
			return $components;
		}

		$id  = gmdate( 'Ymd-His' ) . '-' . strtolower( wp_generate_password( 6, false, false ) );
		$dir = Centinela_Storage::backup_dir( $id );
		if ( ! wp_mkdir_p( $dir ) ) {
			return new WP_Error( 'centinela_backup_dir', 'No se pudo crear la carpeta de la copia. Revisá permisos de escritura.', array( 'status' => 500 ) );
		}

		$manifest = array(
			'id'          => $id,
			'format'      => 1,
			'status'      => 'running',
			'scope'       => $scope,
			'label'       => isset( $args['label'] ) ? sanitize_text_field( $args['label'] ) : '',
			'reason'      => isset( $args['reason'] ) ? sanitize_text_field( $args['reason'] ) : 'manual',
			'created_gmt' => gmdate( 'c' ),
			'site_url'    => home_url(),
			'wp_version'  => $wp_version,
			'php_version' => PHP_VERSION,
			'include_db'  => ! isset( $args['include_db'] ) || (bool) $args['include_db'],
			'components'  => $components,
			'parts'       => array(),
			'artifacts'   => array(),
			'stats'       => array(
				'tables' => 0,
				'rows'   => 0,
				'files'  => 0,
				'bytes'  => 0,
			),
			'errors'      => array(),
		);
		self::save_manifest( $dir, $manifest );

		$job = array(
			'phase'       => $manifest['include_db'] ? 'db' : 'scan',
			'tables'      => $manifest['include_db'] ? self::tables() : array(),
			't_index'     => 0,
			'row_offset'  => 0,
			'list_offset' => 0,
			'list_total'  => 0,
			'part'        => 0,
		);
		self::save_job( $dir, $job );

		return Centinela_Storage::public_manifest( $manifest );
	}

	/**
	 * Avanza la copia durante un tramo de tiempo seguro.
	 *
	 * @param string $id Id de la copia.
	 * @return array|WP_Error Progreso.
	 */
	public static function step( $id ) {
		$dir      = Centinela_Storage::backup_dir( $id );
		$manifest = $dir ? Centinela_Restore_Engine::read_manifest( $dir ) : null;
		$job      = $dir ? self::read_job( $dir ) : null;
		if ( ! $manifest ) {
			return new WP_Error( 'centinela_not_found', 'Copia no encontrada.', array( 'status' => 404 ) );
		}
		if ( 'complete' === $manifest['status'] || ! $job ) {
			return self::progress( $manifest, $job );
		}

		@set_time_limit( 120 ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
		$deadline = microtime( true ) + self::time_budget();

		try {
			while ( microtime( true ) < $deadline && 'done' !== $job['phase'] ) {
				switch ( $job['phase'] ) {
					case 'db':
						self::step_db( $dir, $manifest, $job, $deadline );
						break;
					case 'scan':
						self::step_scan( $dir, $manifest, $job );
						break;
					case 'files':
						self::step_files( $dir, $manifest, $job );
						break 2; // Una parte por petición: el zip se escribe al cerrar.
					case 'finalize':
						self::finalize( $dir, $manifest );
						$job['phase'] = 'done';
						break;
				}
			}
		} catch ( Throwable $e ) {
			$manifest['status']   = 'failed';
			$manifest['errors'][] = $e->getMessage();
			self::save_manifest( $dir, $manifest );
			return new WP_Error( 'centinela_backup_failed', 'La copia falló: ' . $e->getMessage(), array( 'status' => 500 ) );
		}

		self::save_job( $dir, $job );
		self::save_manifest( $dir, $manifest );
		return self::progress( $manifest, $job );
	}

	/**
	 * Resume el progreso para el panel.
	 */
	private static function progress( array $manifest, $job ) {
		$percent = 100;
		if ( $job && 'done' !== $job['phase'] ) {
			$tables = max( 1, count( $job['tables'] ) );
			$db     = $manifest['include_db'] ? min( 1, $job['t_index'] / $tables ) : 1;
			$files  = $job['list_total'] ? min( 1, $job['list_offset'] / $job['list_total'] ) : 0;
			$percent = (int) floor( ( $manifest['include_db'] ? 0.4 * $db + 0.6 * $files : $files ) * 100 );
			$percent = min( 99, $percent );
		}
		return array(
			'id'       => $manifest['id'],
			'status'   => $manifest['status'],
			'phase'    => $job ? $job['phase'] : 'done',
			'percent'  => $percent,
			'manifest' => Centinela_Storage::public_manifest( $manifest ),
		);
	}

	/**
	 * Margen de tiempo por petición según max_execution_time del servidor.
	 */
	private static function time_budget() {
		$max = (int) ini_get( 'max_execution_time' );
		if ( $max <= 0 ) {
			return 20.0;
		}
		return max( 5.0, min( 20.0, $max * 0.5 ) );
	}

	/**
	 * Tablas del sitio (todas las que usan el prefijo, incluido multisitio).
	 */
	private static function tables() {
		global $wpdb;
		$tables = array();
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		foreach ( (array) $wpdb->get_results( 'SHOW FULL TABLES', ARRAY_N ) as $row ) {
			$name = (string) $row[0];
			$type = isset( $row[1] ) ? $row[1] : 'BASE TABLE';
			if ( 'BASE TABLE' === $type && 0 === strpos( $name, $wpdb->base_prefix ) ) {
				$tables[] = $name;
			}
		}
		return $tables;
	}

	/**
	 * Conexión mysqli subyacente de $wpdb (evita los filtros de wpdb::query que alteran datos).
	 *
	 * @return mysqli
	 */
	private static function mysqli() {
		global $wpdb;
		$dbh = $wpdb->dbh;
		if ( ! ( $dbh instanceof mysqli ) ) {
			throw new RuntimeException( 'Se requiere la extensión mysqli para la copia de base de datos.' );
		}
		return $dbh;
	}

	/**
	 * Fase 1: volcado de base de datos.
	 */
	private static function step_db( $dir, array &$manifest, array &$job, $deadline ) {
		$db   = self::mysqli();
		$file = $dir . '/database.sql';
		$out  = fopen( $file, 'ab' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
		if ( ! $out ) {
			throw new RuntimeException( 'No se pudo escribir database.sql.' );
		}

		if ( 0 === $job['t_index'] && 0 === $job['row_offset'] ) {
			fwrite( $out, '-- Centinela WP backup ' . $manifest['id'] . ' ' . gmdate( 'c' ) . "\n" ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite
		}

		while ( $job['t_index'] < count( $job['tables'] ) && microtime( true ) < $deadline ) {
			$table  = $job['tables'][ $job['t_index'] ];
			$quoted = '`' . str_replace( '`', '``', $table ) . '`';

			if ( 0 === $job['row_offset'] ) {
				$res = $db->query( 'SHOW CREATE TABLE ' . $quoted );
				$row = $res ? $res->fetch_row() : null;
				if ( ! $row ) {
					throw new RuntimeException( 'No se pudo leer la estructura de ' . $table . ': ' . $db->error );
				}
				fwrite( $out, 'DROP TABLE IF EXISTS ' . $quoted . ";\n" ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite
				fwrite( $out, str_replace( array( "\r", "\n" ), ' ', $row[1] ) . ";\n" ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite
				++$manifest['stats']['tables'];
			}

			$res = $db->query( 'SELECT * FROM ' . $quoted . ' LIMIT ' . (int) $job['row_offset'] . ', ' . self::ROWS_PER_QUERY );
			if ( ! $res ) {
				throw new RuntimeException( 'No se pudo leer ' . $table . ': ' . $db->error );
			}
			$fields = $res->fetch_fields();
			$binary = array();
			foreach ( $fields as $i => $field ) {
				$binary[ $i ] = 63 === (int) $field->charsetnr && in_array( (int) $field->type, array( 249, 250, 251, 252, 253, 254 ), true );
			}

			$values = array();
			$count  = 0;
			while ( $row = $res->fetch_row() ) { // phpcs:ignore WordPress.CodeAnalysis.AssignmentInCondition
				$cells = array();
				foreach ( $row as $i => $value ) {
					if ( null === $value ) {
						$cells[] = 'NULL';
					} elseif ( $binary[ $i ] ) {
						$cells[] = '' === $value ? "''" : '0x' . bin2hex( $value );
					} else {
						$cells[] = "'" . $db->real_escape_string( $value ) . "'";
					}
				}
				$values[] = '(' . implode( ',', $cells ) . ')';
				++$count;
				if ( count( $values ) >= self::ROWS_PER_INSERT ) {
					fwrite( $out, 'INSERT INTO ' . $quoted . ' VALUES ' . implode( ',', $values ) . ";\n" ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite
					$values = array();
				}
			}
			$res->free();
			if ( $values ) {
				fwrite( $out, 'INSERT INTO ' . $quoted . ' VALUES ' . implode( ',', $values ) . ";\n" ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite
			}
			$manifest['stats']['rows'] += $count;

			if ( $count < self::ROWS_PER_QUERY ) {
				++$job['t_index'];
				$job['row_offset'] = 0;
			} else {
				$job['row_offset'] += $count;
			}
		}
		fclose( $out ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

		if ( $job['t_index'] >= count( $job['tables'] ) ) {
			$job['phase'] = 'scan';
		}
	}

	/**
	 * Fase 2: lista de archivos a copiar.
	 */
	private static function step_scan( $dir, array &$manifest, array &$job ) {
		$list    = fopen( $dir . '/files.list', 'wb' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
		$total   = 0;
		$exclude = self::exclusions( $manifest );

		foreach ( $manifest['components'] as $component ) {
			$target = $component['target'];
			$prefix = $component['prefix'];

			if ( empty( $component['existed'] ) ) {
				continue;
			}
			if ( ! empty( $component['is_file'] ) ) {
				fwrite( $list, $prefix . basename( $target ) . "\t" . $target . "\n" ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite
				++$total;
				continue;
			}

			$roots = array( $target );
			if ( 'core' === $component['type'] ) {
				$roots = array( $target . '/wp-admin', $target . '/wp-includes' );
				foreach ( (array) glob( $target . '/*' ) as $root_file ) {
					$name = basename( $root_file );
					if ( is_file( $root_file ) && 'wp-config.php' !== $name && preg_match( '/\.(php|txt|html)$/', $name ) ) {
						fwrite( $list, $prefix . $name . "\t" . $root_file . "\n" ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite
						++$total;
					}
				}
			}

			foreach ( $roots as $root ) {
				if ( ! is_dir( $root ) ) {
					continue;
				}
				$iterator = new RecursiveIteratorIterator(
					new RecursiveCallbackFilterIterator(
						new RecursiveDirectoryIterator( $root, FilesystemIterator::SKIP_DOTS ),
						static function ( $current ) use ( $exclude ) {
							if ( $current->isLink() ) {
								return false;
							}
							$path = wp_normalize_path( $current->getPathname() );
							foreach ( $exclude as $pattern ) {
								if ( 0 === strpos( $path, $pattern ) ) {
									return false;
								}
							}
							return true;
						}
					)
				);
				foreach ( $iterator as $file ) {
					if ( ! $file->isFile() || ! $file->isReadable() ) {
						continue;
					}
					$rel = ltrim( substr( wp_normalize_path( $file->getPathname() ), strlen( wp_normalize_path( $target ) ) ), '/' );
					fwrite( $list, $prefix . $rel . "\t" . $file->getPathname() . "\n" ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite
					++$total;
				}
			}
		}
		fclose( $list ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

		$job['list_total']  = $total;
		$job['list_offset'] = 0;
		$job['list_byte']   = 0;
		$job['phase']       = $total > 0 ? 'files' : 'finalize';
	}

	/**
	 * Carpetas que nunca se copian (cachés, otras copias, la propia carpeta de copias).
	 */
	private static function exclusions( array $manifest ) {
		$content = wp_normalize_path( WP_CONTENT_DIR );
		$list    = array(
			wp_normalize_path( Centinela_Storage::root() ),
			$content . '/cache/',
			$content . '/upgrade/',
			$content . '/upgrade-temp-backup/',
			$content . '/updraft/',
			$content . '/ai1wm-backups/',
			$content . '/backups-dup-lite/',
			$content . '/wpvividbackups/',
			$content . '/et-cache/',
			$content . '/litespeed/',
			$content . '/debug.log',
			$content . '/centinela-pointer.php',
		);
		foreach ( $manifest['components'] as $component ) {
			if ( 'content' === $component['type'] && empty( $component['uploads'] ) ) {
				$uploads = wp_upload_dir( null, false );
				$list[]  = trailingslashit( wp_normalize_path( $uploads['basedir'] ) );
			}
		}
		return apply_filters( 'centinela_backup_exclusions', $list );
	}

	/**
	 * Fase 3: una parte zip por petición.
	 */
	private static function step_files( $dir, array &$manifest, array &$job ) {
		if ( ! class_exists( 'ZipArchive' ) ) {
			throw new RuntimeException( 'La extensión ZipArchive de PHP no está disponible.' );
		}
		++$job['part'];
		$part = sprintf( 'files-%03d.zip', $job['part'] );
		$zip  = new ZipArchive();
		if ( true !== $zip->open( $dir . '/' . $part, ZipArchive::CREATE | ZipArchive::OVERWRITE ) ) {
			throw new RuntimeException( 'No se pudo crear ' . $part . '.' );
		}

		$list = fopen( $dir . '/files.list', 'rb' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
		fseek( $list, (int) $job['list_byte'] );
		$bytes = 0;
		$files = 0;
		while ( $files < self::PART_MAX_FILES && $bytes < self::PART_MAX_BYTES ) {
			$line = fgets( $list );
			if ( false === $line ) {
				break;
			}
			$parts = explode( "\t", rtrim( $line, "\r\n" ), 2 );
			if ( 2 !== count( $parts ) ) {
				continue;
			}
			list( $entry, $abs ) = $parts;
			if ( is_readable( $abs ) && $zip->addFile( $abs, $entry ) ) {
				$bytes += (int) filesize( $abs );
				++$files;
			} else {
				$manifest['errors'][] = 'No se pudo leer ' . $entry;
			}
			++$job['list_offset'];
		}
		$job['list_byte'] = ftell( $list );
		$eof              = false === fgets( $list );
		fclose( $list ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

		if ( ! $zip->close() ) {
			throw new RuntimeException( 'No se pudo escribir ' . $part . ' (¿espacio en disco?).' );
		}

		$manifest['parts'][]           = $part;
		$manifest['stats']['files']   += $files;
		$manifest['stats']['bytes']   += $bytes;

		if ( $eof || $job['list_offset'] >= $job['list_total'] ) {
			$job['phase'] = 'finalize';
		}
	}

	/**
	 * Fase final: sumas de verificación y limpieza.
	 */
	private static function finalize( $dir, array &$manifest ) {
		$artifacts = array();
		$files     = $manifest['parts'];
		if ( $manifest['include_db'] ) {
			array_unshift( $files, 'database.sql' );
		}
		foreach ( $files as $name ) {
			$path = $dir . '/' . $name;
			if ( is_file( $path ) ) {
				$artifacts[] = array(
					'name'   => $name,
					'size'   => filesize( $path ),
					'sha256' => hash_file( 'sha256', $path ),
				);
			}
		}
		$manifest['artifacts']    = $artifacts;
		$manifest['status']       = 'complete';
		$manifest['finished_gmt'] = gmdate( 'c' );

		if ( is_file( $dir . '/files.list' ) ) {
			unlink( $dir . '/files.list' );
		}
		if ( is_file( $dir . '/job.json' ) ) {
			unlink( $dir . '/job.json' );
		}
		self::save_manifest( $dir, $manifest );
		Centinela_Storage::prune( (int) get_option( self::OPTION_KEEP, self::DEFAULT_KEEP ) );
	}

	/**
	 * Traduce la lista pedida por el panel a componentes con rutas absolutas.
	 *
	 * @return array|WP_Error
	 */
	private static function resolve_components( $scope, array $requested, $include_uploads ) {
		$components = array();

		if ( 'full' === $scope ) {
			$components[] = self::core_component();
			$components[] = array(
				'type'    => 'content',
				'slug'    => 'wp-content',
				'target'  => untrailingslashit( WP_CONTENT_DIR ),
				'prefix'  => 'content/',
				'existed' => true,
				'uploads' => (bool) $include_uploads,
			);
			return $components;
		}

		$plugins = get_plugins();
		foreach ( $requested as $item ) {
			$type = isset( $item['type'] ) ? $item['type'] : '';
			$slug = isset( $item['slug'] ) ? sanitize_file_name( $item['slug'] ) : '';
			if ( 'core' === $type ) {
				$components[] = self::core_component();
			} elseif ( 'plugin' === $type && '' !== $slug ) {
				$file = null;
				foreach ( array_keys( $plugins ) as $plugin_file ) {
					if ( dirname( $plugin_file ) === $slug || basename( $plugin_file, '.php' ) === $slug ) {
						$file = $plugin_file;
						break;
					}
				}
				$is_file      = $file && false === strpos( $file, '/' );
				$components[] = array(
					'type'    => 'plugin',
					'slug'    => $slug,
					'file'    => $file,
					'version' => $file ? $plugins[ $file ]['Version'] : null,
					'target'  => untrailingslashit( WP_PLUGIN_DIR ) . '/' . ( $is_file ? $file : $slug ),
					'prefix'  => ( $is_file ? 'pluginfile/' : 'plugin/' ) . $slug . '/',
					'is_file' => $is_file,
					'existed' => (bool) $file,
				);
			} elseif ( 'theme' === $type && '' !== $slug ) {
				$theme        = wp_get_theme( $slug );
				$components[] = array(
					'type'    => 'theme',
					'slug'    => $slug,
					'version' => $theme->exists() ? $theme->get( 'Version' ) : null,
					'target'  => untrailingslashit( get_theme_root( $slug ) ) . '/' . $slug,
					'prefix'  => 'theme/' . $slug . '/',
					'existed' => $theme->exists(),
				);
			} elseif ( 'translations' === $type ) {
				$components[] = array(
					'type'    => 'translations',
					'slug'    => 'languages',
					'target'  => untrailingslashit( WP_LANG_DIR ),
					'prefix'  => 'languages/',
					'existed' => is_dir( WP_LANG_DIR ),
				);
			}
		}
		return $components;
	}

	/**
	 * Componente "núcleo" (wp-admin, wp-includes y archivos raíz).
	 */
	private static function core_component() {
		global $wp_version;
		return array(
			'type'    => 'core',
			'slug'    => 'wordpress',
			'version' => $wp_version,
			'target'  => untrailingslashit( ABSPATH ),
			'prefix'  => 'core/',
			'existed' => true,
		);
	}

	private static function save_manifest( $dir, array $manifest ) {
		file_put_contents( $dir . '/manifest.json', wp_json_encode( $manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ), LOCK_EX ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
	}

	private static function save_job( $dir, array $job ) {
		if ( 'done' === $job['phase'] ) {
			return;
		}
		file_put_contents( $dir . '/job.json', wp_json_encode( $job ), LOCK_EX ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
	}

	private static function read_job( $dir ) {
		$file = $dir . '/job.json';
		if ( ! is_file( $file ) ) {
			return null;
		}
		$job = json_decode( (string) file_get_contents( $file ), true );
		return is_array( $job ) ? $job : null;
	}
}
