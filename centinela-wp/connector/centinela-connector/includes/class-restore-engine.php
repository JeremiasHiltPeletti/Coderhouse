<?php
/**
 * Motor de restauración independiente de WordPress.
 *
 * Este archivo NO usa funciones de WordPress a propósito: lo comparten la API REST
 * (cuando el sitio funciona) y rescue.php (cuando una actualización dejó el sitio
 * con un error fatal y WordPress ya no arranca).
 *
 * @package Centinela
 */

if ( ! defined( 'ABSPATH' ) && ! defined( 'CENTINELA_RESCUE' ) ) {
	exit;
}

class Centinela_Restore_Engine {

	/**
	 * Lee y valida el manifest.json de una copia.
	 *
	 * @param string $backup_dir Carpeta de la copia.
	 * @return array|null
	 */
	public static function read_manifest( $backup_dir ) {
		$file = rtrim( $backup_dir, '/\\' ) . '/manifest.json';
		if ( ! is_file( $file ) ) {
			return null;
		}
		$data = json_decode( (string) file_get_contents( $file ), true );
		return is_array( $data ) ? $data : null;
	}

	/**
	 * Valida un id de copia (evita path traversal).
	 *
	 * @param string $id Id recibido.
	 * @return bool
	 */
	public static function valid_id( $id ) {
		return is_string( $id ) && (bool) preg_match( '/^[a-z0-9-]{8,64}$/', $id );
	}

	/**
	 * Restaura los archivos de todos los componentes del manifest.
	 *
	 * Plugins y temas se restauran por "intercambio": se extrae la versión guardada en
	 * una carpeta temporal y luego se reemplaza la carpeta actual en un solo rename,
	 * así nunca queda un plugin a medio copiar.
	 *
	 * @param string $backup_dir Carpeta de la copia.
	 * @param array  $manifest   Manifest leído.
	 * @param array  $skip_slugs Slugs de plugin que no se tocan (el propio conector).
	 * @return array Resultado con 'ok', 'restored' y 'errors'.
	 */
	public static function restore_files( $backup_dir, array $manifest, array $skip_slugs = array() ) {
		$result = array(
			'ok'       => true,
			'restored' => array(),
			'errors'   => array(),
		);

		if ( ! class_exists( 'ZipArchive' ) ) {
			$result['ok']       = false;
			$result['errors'][] = 'La extensión ZipArchive de PHP no está disponible.';
			return $result;
		}

		$backup_dir = rtrim( $backup_dir, '/\\' );
		$parts      = isset( $manifest['parts'] ) && is_array( $manifest['parts'] ) ? $manifest['parts'] : array();
		$components = isset( $manifest['components'] ) && is_array( $manifest['components'] ) ? $manifest['components'] : array();

		foreach ( $components as $component ) {
			$type   = isset( $component['type'] ) ? $component['type'] : '';
			$slug   = isset( $component['slug'] ) ? $component['slug'] : '';
			$target = isset( $component['target'] ) ? rtrim( $component['target'], '/\\' ) : '';
			$prefix = isset( $component['prefix'] ) ? $component['prefix'] : '';

			if ( '' === $target || '' === $prefix ) {
				continue;
			}
			if ( 'plugin' === $type && in_array( $slug, $skip_slugs, true ) ) {
				continue;
			}

			$staging = $backup_dir . '/staging-' . substr( md5( $prefix . microtime() ), 0, 8 );
			$entries = self::extract_prefix( $backup_dir, $parts, $prefix, $staging );
			if ( is_string( $entries ) ) {
				$result['ok']       = false;
				$result['errors'][] = $entries;
				self::rrmdir( $staging );
				continue;
			}

			$source = $staging . '/' . rtrim( $prefix, '/' );

			if ( 'core' === $type || 'content' === $type ) {
				// Sobrescribe en el lugar (no borra uploads ni contenido nuevo).
				$copied = self::copy_tree( $source, $target );
				if ( true !== $copied ) {
					$result['ok']       = false;
					$result['errors'][] = $copied;
				} elseif ( 'core' === $type ) {
					// Quita archivos que la versión nueva agregó en wp-admin / wp-includes.
					self::remove_extras( $target, $entries, array( 'wp-admin/', 'wp-includes/' ) );
				}
				$result['restored'][] = $type;
			} else {
				$swapped = self::swap( $source, $target, ! empty( $component['existed'] ), ! empty( $component['is_file'] ) );
				if ( true !== $swapped ) {
					$result['ok']       = false;
					$result['errors'][] = $swapped;
				} else {
					$result['restored'][] = $type . ':' . $slug;
				}
			}

			self::rrmdir( $staging );
		}

		if ( function_exists( 'opcache_reset' ) ) {
			@opcache_reset(); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- puede estar restringido por el hosting.
		}

		return $result;
	}

	/**
	 * Restaura la base de datos desde database.sql de forma reanudable.
	 *
	 * Cada sentencia ocupa exactamente una línea (el volcado escapa los saltos de línea),
	 * por eso se puede reanudar desde un byte exacto en la siguiente petición.
	 *
	 * @param string $backup_dir Carpeta de la copia.
	 * @param int    $offset     Byte desde el que continuar.
	 * @param mysqli $db         Conexión.
	 * @param float  $deadline   microtime(true) límite para esta petición.
	 * @return array
	 */
	public static function restore_db( $backup_dir, $offset, $db, $deadline ) {
		$file = rtrim( $backup_dir, '/\\' ) . '/database.sql';
		if ( ! is_file( $file ) ) {
			return array(
				'done'  => true,
				'error' => 'La copia no contiene base de datos.',
			);
		}

		$size = filesize( $file );
		$fh   = fopen( $file, 'rb' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
		if ( ! $fh ) {
			return array(
				'done'  => true,
				'error' => 'No se pudo abrir database.sql.',
			);
		}
		fseek( $fh, max( 0, (int) $offset ) );

		$db->set_charset( 'utf8mb4' );
		$db->query( 'SET FOREIGN_KEY_CHECKS=0' );
		$db->query( "SET SQL_MODE='NO_AUTO_VALUE_ON_ZERO'" );

		$count = 0;
		$error = null;
		while ( ! feof( $fh ) ) {
			$line = fgets( $fh );
			if ( false === $line ) {
				break;
			}
			$sql = rtrim( $line, "\r\n" );
			if ( '' === $sql || 0 === strpos( $sql, '--' ) ) {
				continue;
			}
			if ( ! $db->query( $sql ) ) {
				$error = 'Error SQL: ' . $db->error . ' (sentencia: ' . substr( $sql, 0, 160 ) . '…)';
				break;
			}
			++$count;
			if ( microtime( true ) >= $deadline ) {
				break;
			}
		}

		$position = ftell( $fh );
		$done     = feof( $fh ) || $position >= $size;
		fclose( $fh ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

		$db->query( 'SET FOREIGN_KEY_CHECKS=1' );

		return array(
			'done'       => $done && null === $error,
			'offset'     => $position,
			'size'       => $size,
			'statements' => $count,
			'error'      => $error,
		);
	}

	/**
	 * Extrae las entradas con un prefijo dado de todas las partes zip.
	 *
	 * @return array|string Lista de rutas relativas extraídas o mensaje de error.
	 */
	private static function extract_prefix( $backup_dir, array $parts, $prefix, $staging ) {
		$entries = array();
		if ( ! is_dir( $staging ) && ! mkdir( $staging, 0755, true ) ) {
			return 'No se pudo crear la carpeta temporal de restauración.';
		}
		foreach ( $parts as $part ) {
			if ( ! preg_match( '/^files-\d{3}\.zip$/', $part ) ) {
				continue;
			}
			$zip = new ZipArchive();
			if ( true !== $zip->open( $backup_dir . '/' . $part ) ) {
				return 'No se pudo abrir ' . $part . '.';
			}
			for ( $i = 0; $i < $zip->numFiles; $i++ ) {
				$name = $zip->getNameIndex( $i );
				if ( false === $name || 0 !== strpos( $name, $prefix ) || ! self::safe_entry( $name ) ) {
					continue;
				}
				$dest = $staging . '/' . $name;
				if ( '/' === substr( $name, -1 ) ) {
					if ( ! is_dir( $dest ) ) {
						mkdir( $dest, 0755, true );
					}
					continue;
				}
				$dir = dirname( $dest );
				if ( ! is_dir( $dir ) ) {
					mkdir( $dir, 0755, true );
				}
				$stream = $zip->getStream( $name );
				if ( ! $stream ) {
					$zip->close();
					return 'No se pudo leer ' . $name . ' desde la copia.';
				}
				$out = fopen( $dest, 'wb' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
				stream_copy_to_stream( $stream, $out );
				fclose( $out ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
				fclose( $stream ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
				$entries[] = substr( $name, strlen( $prefix ) );
			}
			$zip->close();
		}
		return $entries;
	}

	/**
	 * Rechaza rutas peligrosas dentro del zip.
	 */
	private static function safe_entry( $name ) {
		if ( false !== strpos( $name, "\0" ) || false !== strpos( $name, '\\' ) ) {
			return false;
		}
		if ( '/' === $name[0] || preg_match( '#(^|/)\.\.(/|$)#', $name ) ) {
			return false;
		}
		return true;
	}

	/**
	 * Reemplaza $target por $source de forma casi atómica.
	 */
	private static function swap( $source, $target, $existed, $is_file ) {
		if ( ! $existed ) {
			// El componente no existía antes de la actualización: se elimina.
			if ( $is_file && is_file( $target ) ) {
				unlink( $target );
			} elseif ( is_dir( $target ) ) {
				self::rrmdir( $target );
			}
			return true;
		}

		if ( $is_file ) {
			// Los plugins de un solo archivo se guardan como <prefijo>/<archivo>.php.
			$file_source = $source . '/' . basename( $target );
			if ( ! is_file( $file_source ) ) {
				return 'La copia no contiene el archivo ' . basename( $target ) . '.';
			}
			return copy( $file_source, $target ) ? true : 'No se pudo escribir ' . $target . '.';
		}

		if ( ! is_dir( $source ) ) {
			return 'La copia no contiene la carpeta ' . basename( $target ) . '.';
		}

		$old = $target . '.centinela-old-' . time();
		if ( is_dir( $target ) && ! rename( $target, $old ) ) {
			return 'No se pudo mover la versión actual de ' . basename( $target ) . ' (permisos).';
		}
		if ( ! rename( $source, $target ) ) {
			// Deshace el movimiento para no dejar el sitio sin el componente.
			if ( is_dir( $old ) ) {
				rename( $old, $target );
			}
			return 'No se pudo colocar la versión restaurada de ' . basename( $target ) . '.';
		}
		if ( is_dir( $old ) ) {
			self::rrmdir( $old );
		}
		return true;
	}

	/**
	 * Copia recursiva sobrescribiendo.
	 */
	private static function copy_tree( $source, $target ) {
		if ( ! is_dir( $source ) ) {
			return 'La copia no contiene archivos para ' . $target . '.';
		}
		$iterator = new RecursiveIteratorIterator(
			new RecursiveDirectoryIterator( $source, FilesystemIterator::SKIP_DOTS ),
			RecursiveIteratorIterator::SELF_FIRST
		);
		foreach ( $iterator as $item ) {
			$rel  = substr( $item->getPathname(), strlen( $source ) + 1 );
			$dest = $target . '/' . $rel;
			if ( $item->isDir() ) {
				if ( ! is_dir( $dest ) && ! mkdir( $dest, 0755, true ) ) {
					return 'No se pudo crear ' . $dest . '.';
				}
			} elseif ( ! copy( $item->getPathname(), $dest ) ) {
				return 'No se pudo escribir ' . $dest . '.';
			}
		}
		return true;
	}

	/**
	 * Elimina archivos que no estaban en la copia dentro de ciertas carpetas.
	 */
	private static function remove_extras( $target, array $entries, array $dirs ) {
		$keep = array_flip( $entries );
		foreach ( $dirs as $dir ) {
			$base = $target . '/' . $dir;
			if ( ! is_dir( $base ) ) {
				continue;
			}
			$iterator = new RecursiveIteratorIterator(
				new RecursiveDirectoryIterator( $base, FilesystemIterator::SKIP_DOTS ),
				RecursiveIteratorIterator::CHILD_FIRST
			);
			foreach ( $iterator as $item ) {
				$rel = substr( $item->getPathname(), strlen( $target ) + 1 );
				if ( $item->isFile() && ! isset( $keep[ $rel ] ) ) {
					unlink( $item->getPathname() );
				}
			}
		}
	}

	/**
	 * Borrado recursivo.
	 */
	public static function rrmdir( $dir ) {
		if ( ! is_dir( $dir ) ) {
			return;
		}
		$iterator = new RecursiveIteratorIterator(
			new RecursiveDirectoryIterator( $dir, FilesystemIterator::SKIP_DOTS ),
			RecursiveIteratorIterator::CHILD_FIRST
		);
		foreach ( $iterator as $item ) {
			if ( $item->isDir() && ! $item->isLink() ) {
				rmdir( $item->getPathname() );
			} else {
				unlink( $item->getPathname() );
			}
		}
		rmdir( $dir );
	}

	/**
	 * Lee las credenciales de base de datos de wp-config.php sin ejecutarlo.
	 *
	 * @param string $config_file Ruta a wp-config.php.
	 * @return array|null
	 */
	public static function parse_wp_config( $config_file ) {
		if ( ! is_file( $config_file ) ) {
			return null;
		}
		$src   = (string) file_get_contents( $config_file );
		$creds = array();
		foreach ( array( 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_HOST' ) as $const ) {
			if ( preg_match( "/define\\(\\s*['\"]" . $const . "['\"]\\s*,\\s*(['\"])(.*?)(?<!\\\\)\\1\\s*\\)/s", $src, $m ) ) {
				$creds[ $const ] = stripcslashes( $m[2] );
			}
		}
		if ( preg_match( "/\\\$table_prefix\\s*=\\s*(['\"])(.*?)\\1/", $src, $m ) ) {
			$creds['table_prefix'] = $m[2];
		}
		return isset( $creds['DB_NAME'], $creds['DB_USER'], $creds['DB_HOST'] ) ? $creds : null;
	}

	/**
	 * Abre una conexión mysqli a partir de las credenciales de wp-config.
	 *
	 * @return mysqli|string Conexión o mensaje de error.
	 */
	public static function connect( array $creds ) {
		$host   = $creds['DB_HOST'];
		$port   = null;
		$socket = null;
		if ( preg_match( '/^(.+):(\d+)$/', $host, $m ) ) {
			$host = $m[1];
			$port = (int) $m[2];
		} elseif ( preg_match( '/^(.+):(\/.+)$/', $host, $m ) ) {
			$host   = $m[1];
			$socket = $m[2];
		}
		mysqli_report( MYSQLI_REPORT_OFF );
		$db = mysqli_init();
		if ( ! @$db->real_connect( $host, $creds['DB_USER'], isset( $creds['DB_PASSWORD'] ) ? $creds['DB_PASSWORD'] : '', $creds['DB_NAME'], $port, $socket ) ) { // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
			return 'No se pudo conectar a la base de datos: ' . mysqli_connect_error();
		}
		return $db;
	}
}
