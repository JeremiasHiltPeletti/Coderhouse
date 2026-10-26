<?php
/**
 * Inventario del "stack" del sitio y de las actualizaciones pendientes.
 *
 * @package Centinela
 */

defined( 'ABSPATH' ) || exit;

class Centinela_Inventory {

	/**
	 * Carga los archivos de wp-admin necesarios fuera del escritorio.
	 */
	public static function load_admin_includes() {
		require_once ABSPATH . 'wp-admin/includes/plugin.php';
		require_once ABSPATH . 'wp-admin/includes/theme.php';
		require_once ABSPATH . 'wp-admin/includes/update.php';
		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/misc.php';
	}

	/**
	 * Inventario completo.
	 *
	 * @param bool $refresh Forzar consulta a WordPress.org/proveedores de actualizaciones.
	 * @return array
	 */
	public static function collect( $refresh ) {
		global $wpdb, $wp_version;
		self::load_admin_includes();

		if ( $refresh ) {
			wp_clean_update_cache();
			wp_version_check( array(), true );
			wp_update_plugins();
			wp_update_themes();
		}

		return array(
			'site'         => array(
				'url'         => home_url(),
				'name'        => get_bloginfo( 'name' ),
				'multisite'   => is_multisite(),
				'locale'      => get_locale(),
				'environment' => wp_get_environment_type(),
			),
			'environment'  => self::environment(),
			'core'         => array(
				'version' => $wp_version,
				'update'  => self::core_update(),
			),
			'plugins'      => self::plugins(),
			'themes'       => self::themes(),
			'translations' => count( wp_get_translation_updates() ),
			'db'           => array(
				'server'  => $wpdb->db_server_info(),
				'version' => $wpdb->db_version(),
				'prefix'  => $wpdb->prefix,
				'size_mb' => self::db_size_mb(),
			),
			'connector'    => CENTINELA_VERSION,
			'generated'    => gmdate( 'c' ),
		);
	}

	/**
	 * Información del servidor relevante para decidir si es seguro actualizar.
	 */
	public static function environment() {
		$method   = function_exists( 'get_filesystem_method' ) ? get_filesystem_method() : 'unknown';
		$free     = function_exists( 'disk_free_space' ) ? @disk_free_space( WP_CONTENT_DIR ) : false; // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
		$debuglog = self::debug_log_path();

		return array(
			'php'                => PHP_VERSION,
			'php_extensions'     => array(
				'zip'     => class_exists( 'ZipArchive' ),
				'mysqli'  => class_exists( 'mysqli' ),
				'openssl' => extension_loaded( 'openssl' ),
				'curl'    => extension_loaded( 'curl' ),
				'imagick' => extension_loaded( 'imagick' ),
			),
			'memory_limit'       => ini_get( 'memory_limit' ),
			'wp_memory_limit'    => WP_MEMORY_LIMIT,
			'max_execution_time' => (int) ini_get( 'max_execution_time' ),
			'filesystem_method'  => $method,
			'can_update'         => 'direct' === $method && wp_is_file_mod_allowed( 'centinela_update' ),
			'disk_free_mb'       => false === $free ? null : (int) round( $free / 1048576 ),
			'server_software'    => isset( $_SERVER['SERVER_SOFTWARE'] ) ? sanitize_text_field( wp_unslash( $_SERVER['SERVER_SOFTWARE'] ) ) : '',
			'wp_debug'           => defined( 'WP_DEBUG' ) && WP_DEBUG,
			'debug_log'          => (bool) $debuglog,
			'object_cache'       => (bool) wp_using_ext_object_cache(),
			'auto_updates_core'  => defined( 'WP_AUTO_UPDATE_CORE' ) ? WP_AUTO_UPDATE_CORE : null,
			'disallow_file_mods' => defined( 'DISALLOW_FILE_MODS' ) && DISALLOW_FILE_MODS,
			'rescue_url'         => plugins_url( 'rescue.php', CENTINELA_FILE ),
		);
	}

	/**
	 * Actualización de núcleo disponible (si hay).
	 */
	private static function core_update() {
		$updates = get_core_updates( array( 'dismissed' => false ) );
		if ( empty( $updates ) || ! is_array( $updates ) ) {
			return null;
		}
		foreach ( $updates as $update ) {
			if ( isset( $update->response ) && 'upgrade' === $update->response ) {
				return array(
					'version'     => $update->current,
					'locale'      => $update->locale,
					'php_version' => isset( $update->php_version ) ? $update->php_version : null,
					'package'     => ! empty( $update->packages->full ) || ! empty( $update->download ),
				);
			}
		}
		return null;
	}

	/**
	 * Plugins instalados con su estado de actualización.
	 */
	private static function plugins() {
		$all     = get_plugins();
		$updates = get_site_transient( 'update_plugins' );
		$auto    = (array) get_site_option( 'auto_update_plugins', array() );
		$list    = array();

		foreach ( $all as $file => $data ) {
			$slug   = false !== strpos( $file, '/' ) ? dirname( $file ) : basename( $file, '.php' );
			$update = null;
			if ( isset( $updates->response[ $file ] ) ) {
				$u      = $updates->response[ $file ];
				$update = array(
					'version'      => isset( $u->new_version ) ? $u->new_version : null,
					'package'      => ! empty( $u->package ),
					'tested'       => isset( $u->tested ) ? $u->tested : null,
					'requires_php' => isset( $u->requires_php ) ? $u->requires_php : null,
					'requires'     => isset( $u->requires ) ? $u->requires : null,
					'url'          => isset( $u->url ) ? $u->url : null,
					'source'       => ( isset( $u->id ) && false !== strpos( (string) $u->id, 'w.org' ) ) ? 'wordpress.org' : 'externo',
				);
			}
			$list[] = array(
				'file'         => $file,
				'slug'         => $slug,
				'name'         => wp_strip_all_tags( $data['Name'] ),
				'version'      => $data['Version'],
				'author'       => wp_strip_all_tags( $data['Author'] ),
				'uri'          => $data['PluginURI'],
				'requires_php' => isset( $data['RequiresPHP'] ) ? $data['RequiresPHP'] : '',
				'requires_wp'  => isset( $data['RequiresWP'] ) ? $data['RequiresWP'] : '',
				'active'       => is_plugin_active( $file ),
				'network'      => is_multisite() && is_plugin_active_for_network( $file ),
				'auto_update'  => in_array( $file, $auto, true ),
				'is_connector' => CENTINELA_SLUG === $slug,
				'update'       => $update,
			);
		}

		// Los mu-plugins no se actualizan, pero son parte del stack.
		foreach ( get_mu_plugins() as $file => $data ) {
			$list[] = array(
				'file'    => $file,
				'slug'    => basename( $file, '.php' ),
				'name'    => wp_strip_all_tags( $data['Name'] ),
				'version' => $data['Version'],
				'active'  => true,
				'mu'      => true,
				'update'  => null,
			);
		}
		return $list;
	}

	/**
	 * Temas instalados.
	 */
	private static function themes() {
		$updates = get_site_transient( 'update_themes' );
		$active  = wp_get_theme();
		$list    = array();
		foreach ( wp_get_themes() as $slug => $theme ) {
			$update = null;
			if ( isset( $updates->response[ $slug ] ) ) {
				$u      = (array) $updates->response[ $slug ];
				$update = array(
					'version'      => isset( $u['new_version'] ) ? $u['new_version'] : null,
					'package'      => ! empty( $u['package'] ),
					'requires_php' => isset( $u['requires_php'] ) ? $u['requires_php'] : null,
					'requires'     => isset( $u['requires'] ) ? $u['requires'] : null,
					'url'          => isset( $u['url'] ) ? $u['url'] : null,
				);
			}
			$list[] = array(
				'slug'    => $slug,
				'name'    => wp_strip_all_tags( $theme->get( 'Name' ) ),
				'version' => $theme->get( 'Version' ),
				'parent'  => $theme->parent() ? $theme->get_template() : null,
				'active'  => $active->get_stylesheet() === $slug || $active->get_template() === $slug,
				'block'   => method_exists( $theme, 'is_block_theme' ) ? $theme->is_block_theme() : false,
				'update'  => $update,
			);
		}
		return $list;
	}

	/**
	 * Tamaño aproximado de las tablas del sitio.
	 */
	private static function db_size_mb() {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$size = $wpdb->get_var(
			$wpdb->prepare(
				'SELECT SUM(data_length + index_length) FROM information_schema.TABLES WHERE table_schema = %s AND table_name LIKE %s',
				DB_NAME,
				$wpdb->esc_like( $wpdb->base_prefix ) . '%'
			)
		);
		return $size ? round( $size / 1048576, 1 ) : null;
	}

	/**
	 * Ruta del debug.log si está activo.
	 */
	public static function debug_log_path() {
		if ( ! defined( 'WP_DEBUG_LOG' ) || ! WP_DEBUG_LOG ) {
			return null;
		}
		$path = is_string( WP_DEBUG_LOG ) ? WP_DEBUG_LOG : WP_CONTENT_DIR . '/debug.log';
		return is_file( $path ) ? $path : null;
	}

	/**
	 * Líneas nuevas del debug.log desde un byte dado (para detectar errores tras actualizar).
	 *
	 * @param int $since Offset en bytes.
	 * @return array
	 */
	public static function debug_log_since( $since ) {
		$path = self::debug_log_path();
		if ( ! $path ) {
			return array(
				'enabled' => false,
				'size'    => 0,
				'lines'   => array(),
			);
		}
		clearstatcache( true, $path );
		$size  = filesize( $path );
		$since = max( 0, (int) $since );
		if ( $since > $size ) {
			$since = 0; // El log fue rotado.
		}
		$lines = array();
		if ( $size > $since ) {
			$fh = fopen( $path, 'rb' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
			fseek( $fh, max( $since, $size - 200000 ) );
			$chunk = (string) fread( $fh, 200000 ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fread
			fclose( $fh ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
			foreach ( preg_split( '/\r?\n/', $chunk ) as $line ) {
				if ( preg_match( '/PHP (Fatal|Parse|Warning|Deprecated|Notice)|WordPress database error/i', $line ) ) {
					$lines[] = substr( $line, 0, 500 );
				}
			}
		}
		return array(
			'enabled' => true,
			'size'    => $size,
			'lines'   => array_slice( $lines, -100 ),
		);
	}
}
