<?php
/**
 * Ejecuta actualizaciones usando las clases oficiales de WordPress (WP_Upgrader).
 *
 * @package Centinela
 */

defined( 'ABSPATH' ) || exit;

class Centinela_Updater {

	/**
	 * Actualiza un componente.
	 *
	 * @param string $type    plugin|theme|core|translations.
	 * @param string $slug    Slug del plugin o tema.
	 * @param string $version Versión objetivo esperada (opcional, para validar).
	 * @return array|WP_Error
	 */
	public static function run( $type, $slug, $version = '' ) {
		Centinela_Inventory::load_admin_includes();
		require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';

		if ( ! wp_is_file_mod_allowed( 'centinela_update' ) ) {
			return new WP_Error( 'centinela_file_mods', 'DISALLOW_FILE_MODS está activo: WordPress no permite modificar archivos.', array( 'status' => 409 ) );
		}
		if ( 'direct' !== get_filesystem_method() || ! WP_Filesystem() ) {
			return new WP_Error( 'centinela_filesystem', 'WordPress necesita credenciales FTP para escribir archivos. Configurá FS_METHOD "direct" o permisos de escritura.', array( 'status' => 409 ) );
		}

		@set_time_limit( 300 ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
		$skin = new WP_Ajax_Upgrader_Skin();

		switch ( $type ) {
			case 'plugin':
				$result = self::plugin( $slug, $version, $skin );
				break;
			case 'theme':
				$result = self::theme( $slug, $version, $skin );
				break;
			case 'core':
				$result = self::core( $version, $skin );
				break;
			case 'translations':
				$upgrader = new Language_Pack_Upgrader( $skin );
				$res      = $upgrader->bulk_upgrade( wp_get_translation_updates() );
				$result   = array(
					'ok'   => false !== $res && ! is_wp_error( $res ),
					'from' => null,
					'to'   => null,
				);
				break;
			default:
				return new WP_Error( 'centinela_type', 'Tipo de actualización no soportado.', array( 'status' => 400 ) );
		}

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$result['messages'] = array_values( array_map( 'wp_strip_all_tags', (array) $skin->get_upgrade_messages() ) );
		$errors             = $skin->get_errors();
		$result['errors']   = is_wp_error( $errors ) ? $errors->get_error_messages() : array();
		if ( $result['errors'] ) {
			$result['ok'] = false;
		}
		return $result;
	}

	/**
	 * Busca el archivo principal de un plugin por slug.
	 */
	public static function plugin_file( $slug ) {
		foreach ( array_keys( get_plugins() ) as $file ) {
			if ( dirname( $file ) === $slug || ( false === strpos( $file, '/' ) && basename( $file, '.php' ) === $slug ) ) {
				return $file;
			}
		}
		return null;
	}

	private static function plugin( $slug, $version, $skin ) {
		$file = self::plugin_file( $slug );
		if ( ! $file ) {
			return new WP_Error( 'centinela_not_installed', 'El plugin no está instalado.', array( 'status' => 404 ) );
		}
		if ( CENTINELA_SLUG === $slug ) {
			// El conector se puede actualizar, pero nunca sin copia; el panel lo hace al final.
			$skin->feedback( 'Actualizando el propio conector.' );
		}

		wp_update_plugins();
		$updates = get_site_transient( 'update_plugins' );
		if ( empty( $updates->response[ $file ] ) ) {
			return new WP_Error( 'centinela_no_update', 'No hay actualización disponible para este plugin.', array( 'status' => 409 ) );
		}
		$new = $updates->response[ $file ]->new_version;
		if ( $version && version_compare( $new, $version, '!=' ) ) {
			return new WP_Error( 'centinela_version_changed', sprintf( 'La versión disponible cambió (%s) desde el análisis (%s). Volvé a analizar.', $new, $version ), array( 'status' => 409 ) );
		}

		$was_active  = is_plugin_active( $file );
		$was_network = is_multisite() && is_plugin_active_for_network( $file );
		$before      = get_plugins();
		$from        = $before[ $file ]['Version'];

		// bulk_upgrade mantiene el plugin activo y usa el modo mantenimiento de WordPress.
		$upgrader = new Plugin_Upgrader( $skin );
		$res      = $upgrader->bulk_upgrade( array( $file ) );
		$ok       = is_array( $res ) && ! empty( $res[ $file ] ) && ! is_wp_error( $res[ $file ] );

		wp_clean_plugins_cache();
		$after = get_plugins();
		$to    = isset( $after[ $file ] ) ? $after[ $file ]['Version'] : null;

		$reactivated = false;
		if ( $was_active && ! is_plugin_active( $file ) && isset( $after[ $file ] ) ) {
			$activated   = activate_plugin( $file, '', $was_network, true );
			$reactivated = ! is_wp_error( $activated );
		}

		return array(
			'ok'          => $ok && $to && version_compare( $to, $from, '>' ),
			'from'        => $from,
			'to'          => $to,
			'active'      => is_plugin_active( $file ),
			'reactivated' => $reactivated,
		);
	}

	private static function theme( $slug, $version, $skin ) {
		$theme = wp_get_theme( $slug );
		if ( ! $theme->exists() ) {
			return new WP_Error( 'centinela_not_installed', 'El tema no está instalado.', array( 'status' => 404 ) );
		}
		wp_update_themes();
		$updates = get_site_transient( 'update_themes' );
		if ( empty( $updates->response[ $slug ] ) ) {
			return new WP_Error( 'centinela_no_update', 'No hay actualización disponible para este tema.', array( 'status' => 409 ) );
		}
		$new = $updates->response[ $slug ]['new_version'];
		if ( $version && version_compare( $new, $version, '!=' ) ) {
			return new WP_Error( 'centinela_version_changed', sprintf( 'La versión disponible cambió (%s) desde el análisis (%s). Volvé a analizar.', $new, $version ), array( 'status' => 409 ) );
		}
		$from     = $theme->get( 'Version' );
		$upgrader = new Theme_Upgrader( $skin );
		$res      = $upgrader->bulk_upgrade( array( $slug ) );
		wp_clean_themes_cache();
		$to = wp_get_theme( $slug )->get( 'Version' );
		return array(
			'ok'   => is_array( $res ) && ! empty( $res[ $slug ] ) && ! is_wp_error( $res[ $slug ] ) && version_compare( $to, $from, '>' ),
			'from' => $from,
			'to'   => $to,
		);
	}

	private static function core( $version, $skin ) {
		global $wp_version;
		require_once ABSPATH . 'wp-admin/includes/update-core.php';

		wp_version_check( array(), true );
		$target = null;
		foreach ( (array) get_core_updates() as $update ) {
			if ( isset( $update->response ) && 'upgrade' === $update->response && ( ! $version || $update->current === $version ) ) {
				$target = $update;
				break;
			}
		}
		if ( ! $target ) {
			return new WP_Error( 'centinela_no_update', 'No hay actualización de WordPress disponible (o cambió la versión).', array( 'status' => 409 ) );
		}
		$from     = $wp_version;
		$upgrader = new Core_Upgrader( $skin );
		$res      = $upgrader->upgrade( $target, array( 'allow_relaxed_file_ownership' => true ) );
		if ( is_wp_error( $res ) ) {
			return new WP_Error( 'centinela_core_failed', $res->get_error_message(), array( 'status' => 500 ) );
		}
		return array(
			'ok'   => is_string( $res ) && '' !== $res,
			'from' => $from,
			'to'   => is_string( $res ) ? $res : null,
		);
	}

	/**
	 * Ejecuta la actualización de base de datos de WordPress (tras una actualización de núcleo).
	 * Debe correr en una petición separada para cargar el nuevo version.php.
	 */
	public static function db_upgrade() {
		global $wp_db_version;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		$before = (int) get_option( 'db_version' );
		if ( $before !== (int) $wp_db_version ) {
			wp_upgrade();
		}
		return array(
			'ok'     => (int) get_option( 'db_version' ) === (int) $wp_db_version,
			'before' => $before,
			'after'  => (int) get_option( 'db_version' ),
		);
	}
}
