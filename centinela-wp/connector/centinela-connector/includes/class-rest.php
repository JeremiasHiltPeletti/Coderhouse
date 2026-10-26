<?php
/**
 * API REST del conector: /wp-json/centinela/v1/...
 *
 * Autenticación: Contraseñas de aplicación de WordPress (núcleo, 5.6+) sobre HTTPS.
 * Todas las rutas exigen un administrador con permiso para actualizar.
 *
 * @package Centinela
 */

defined( 'ABSPATH' ) || exit;

class Centinela_REST {

	const NS = 'centinela/v1';

	public static function register_routes() {
		$admin   = array( __CLASS__, 'can_manage' );
		$id_arg  = array(
			'id' => array(
				'type'              => 'string',
				'required'          => true,
				'validate_callback' => array( 'Centinela_Restore_Engine', 'valid_id' ),
			),
		);
		$id_rx   = '(?P<id>[a-z0-9-]{8,64})';

		register_rest_route(
			self::NS,
			'/status',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'status' ),
				'permission_callback' => $admin,
			)
		);

		register_rest_route(
			self::NS,
			'/handshake',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'handshake' ),
				'permission_callback' => $admin,
				'args'                => array(
					'rotate' => array(
						'type'    => 'boolean',
						'default' => false,
					),
				),
			)
		);

		register_rest_route(
			self::NS,
			'/inventory',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'inventory' ),
				'permission_callback' => $admin,
				'args'                => array(
					'refresh' => array(
						'type'    => 'boolean',
						'default' => false,
					),
				),
			)
		);

		register_rest_route(
			self::NS,
			'/backups',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( __CLASS__, 'list_backups' ),
					'permission_callback' => $admin,
				),
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( __CLASS__, 'create_backup' ),
					'permission_callback' => $admin,
					'args'                => array(
						'scope'           => array(
							'type'    => 'string',
							'enum'    => array( 'components', 'full' ),
							'default' => 'components',
						),
						'components'      => array(
							'type'    => 'array',
							'default' => array(),
							'items'   => array(
								'type'       => 'object',
								'properties' => array(
									'type' => array(
										'type' => 'string',
										'enum' => array( 'plugin', 'theme', 'core', 'translations' ),
									),
									'slug' => array( 'type' => 'string' ),
								),
							),
						),
						'include_uploads' => array(
							'type'    => 'boolean',
							'default' => false,
						),
						'include_db'      => array(
							'type'    => 'boolean',
							'default' => true,
						),
						'label'           => array(
							'type'              => 'string',
							'default'           => '',
							'sanitize_callback' => 'sanitize_text_field',
						),
						'reason'          => array(
							'type'              => 'string',
							'default'           => 'manual',
							'sanitize_callback' => 'sanitize_key',
						),
					),
				),
			)
		);

		register_rest_route(
			self::NS,
			'/backups/' . $id_rx,
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( __CLASS__, 'get_backup' ),
					'permission_callback' => $admin,
					'args'                => $id_arg,
				),
				array(
					'methods'             => WP_REST_Server::DELETABLE,
					'callback'            => array( __CLASS__, 'delete_backup' ),
					'permission_callback' => $admin,
					'args'                => $id_arg,
				),
			)
		);

		register_rest_route(
			self::NS,
			'/backups/' . $id_rx . '/step',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'step_backup' ),
				'permission_callback' => $admin,
				'args'                => $id_arg,
			)
		);

		register_rest_route(
			self::NS,
			'/backups/' . $id_rx . '/download',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'download' ),
				'permission_callback' => $admin,
				'args'                => array_merge(
					$id_arg,
					array(
						'file' => array(
							'type'     => 'string',
							'required' => true,
							'pattern'  => '^(manifest\.json|database\.sql|files-\d{3}\.zip)$',
						),
					)
				),
			)
		);

		register_rest_route(
			self::NS,
			'/backups/' . $id_rx . '/restore',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'restore' ),
				'permission_callback' => $admin,
				'args'                => array_merge(
					$id_arg,
					array(
						'phase'  => array(
							'type'     => 'string',
							'enum'     => array( 'files', 'db' ),
							'required' => true,
						),
						'offset' => array(
							'type'    => 'integer',
							'default' => 0,
							'minimum' => 0,
						),
					)
				),
			)
		);

		register_rest_route(
			self::NS,
			'/update',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'update' ),
				'permission_callback' => $admin,
				'args'                => array(
					'type'    => array(
						'type'     => 'string',
						'enum'     => array( 'plugin', 'theme', 'core', 'translations' ),
						'required' => true,
					),
					'slug'    => array(
						'type'              => 'string',
						'default'           => '',
						'sanitize_callback' => 'sanitize_file_name',
					),
					'version' => array(
						'type'              => 'string',
						'default'           => '',
						'sanitize_callback' => 'sanitize_text_field',
					),
				),
			)
		);

		register_rest_route(
			self::NS,
			'/maintenance/db-upgrade',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'db_upgrade' ),
				'permission_callback' => $admin,
			)
		);

		register_rest_route(
			self::NS,
			'/logs/debug',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'debug_log' ),
				'permission_callback' => $admin,
				'args'                => array(
					'since' => array(
						'type'    => 'integer',
						'default' => 0,
						'minimum' => 0,
					),
				),
			)
		);
	}

	/**
	 * Solo administradores que pueden actualizar (en multisitio, superadministradores).
	 */
	public static function can_manage() {
		if ( ! current_user_can( 'manage_options' ) || ! current_user_can( 'update_plugins' ) ) {
			return new WP_Error( 'centinela_forbidden', 'Se requiere un administrador con permiso para actualizar.', array( 'status' => rest_authorization_required_code() ) );
		}
		return true;
	}

	public static function status() {
		global $wp_version;
		Centinela_Inventory::load_admin_includes();
		return rest_ensure_response(
			array(
				'connector'   => CENTINELA_VERSION,
				'wp_version'  => $wp_version,
				'php_version' => PHP_VERSION,
				'site_url'    => home_url(),
				'environment' => Centinela_Inventory::environment(),
				'backups_dir' => is_writable( Centinela_Storage::root() ),
				'time'        => gmdate( 'c' ),
			)
		);
	}

	public static function handshake( WP_REST_Request $request ) {
		$key  = Centinela_Storage::write_pointer( (bool) $request->get_param( 'rotate' ) );
		$user = wp_get_current_user();
		return rest_ensure_response(
			array(
				'connector'  => CENTINELA_VERSION,
				'site_url'   => home_url(),
				'name'       => get_bloginfo( 'name' ),
				'user'       => $user->user_login,
				'rescue_url' => plugins_url( 'rescue.php', CENTINELA_FILE ),
				'rescue_key' => $key,
			)
		);
	}

	public static function inventory( WP_REST_Request $request ) {
		return rest_ensure_response( Centinela_Inventory::collect( (bool) $request->get_param( 'refresh' ) ) );
	}

	public static function list_backups() {
		return rest_ensure_response( Centinela_Storage::list_backups() );
	}

	public static function create_backup( WP_REST_Request $request ) {
		$result = Centinela_Backup::create(
			array(
				'scope'           => $request->get_param( 'scope' ),
				'components'      => $request->get_param( 'components' ),
				'include_uploads' => $request->get_param( 'include_uploads' ),
				'include_db'      => $request->get_param( 'include_db' ),
				'label'           => $request->get_param( 'label' ),
				'reason'          => $request->get_param( 'reason' ),
			)
		);
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return new WP_REST_Response( $result, 201 );
	}

	public static function get_backup( WP_REST_Request $request ) {
		$dir      = Centinela_Storage::backup_dir( $request['id'] );
		$manifest = $dir ? Centinela_Restore_Engine::read_manifest( $dir ) : null;
		if ( ! $manifest ) {
			return new WP_Error( 'centinela_not_found', 'Copia no encontrada.', array( 'status' => 404 ) );
		}
		return rest_ensure_response( Centinela_Storage::public_manifest( $manifest ) );
	}

	public static function delete_backup( WP_REST_Request $request ) {
		$dir = Centinela_Storage::backup_dir( $request['id'] );
		if ( ! $dir || ! is_dir( $dir ) ) {
			return new WP_Error( 'centinela_not_found', 'Copia no encontrada.', array( 'status' => 404 ) );
		}
		Centinela_Restore_Engine::rrmdir( $dir );
		return rest_ensure_response( array( 'deleted' => true ) );
	}

	public static function step_backup( WP_REST_Request $request ) {
		return rest_ensure_response( Centinela_Backup::step( $request['id'] ) );
	}

	/**
	 * Descarga un archivo de la copia (streaming, sin cargarlo en memoria).
	 */
	public static function download( WP_REST_Request $request ) {
		$dir  = Centinela_Storage::backup_dir( $request['id'] );
		$name = (string) $request->get_param( 'file' );
		$path = $dir ? $dir . '/' . $name : '';
		if ( ! $dir || ! preg_match( '/^(manifest\.json|database\.sql|files-\d{3}\.zip)$/', $name ) || ! is_file( $path ) ) {
			return new WP_Error( 'centinela_not_found', 'Archivo no encontrado.', array( 'status' => 404 ) );
		}
		while ( ob_get_level() ) {
			ob_end_clean();
		}
		nocache_headers();
		header( 'Content-Type: application/octet-stream' );
		header( 'Content-Length: ' . filesize( $path ) );
		header( 'Content-Disposition: attachment; filename="' . $request['id'] . '-' . $name . '"' );
		header( 'X-Content-Type-Options: nosniff' );
		readfile( $path ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_readfile
		exit;
	}

	/**
	 * Restauración por fases: "files" (una petición) y luego "db" (reanudable con offset).
	 */
	public static function restore( WP_REST_Request $request ) {
		global $wpdb;
		$dir      = Centinela_Storage::backup_dir( $request['id'] );
		$manifest = $dir ? Centinela_Restore_Engine::read_manifest( $dir ) : null;
		if ( ! $manifest || 'complete' !== $manifest['status'] ) {
			return new WP_Error( 'centinela_not_found', 'Copia no encontrada o incompleta.', array( 'status' => 404 ) );
		}
		@set_time_limit( 300 ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged

		if ( 'files' === $request['phase'] ) {
			$result = Centinela_Restore_Engine::restore_files( $dir, $manifest, array( CENTINELA_SLUG ) );
			wp_clean_plugins_cache();
			wp_clean_themes_cache();
			return rest_ensure_response( $result );
		}

		if ( ! ( $wpdb->dbh instanceof mysqli ) ) {
			return new WP_Error( 'centinela_mysqli', 'Se requiere mysqli para restaurar la base de datos.', array( 'status' => 500 ) );
		}
		$result = Centinela_Restore_Engine::restore_db( $dir, (int) $request['offset'], $wpdb->dbh, microtime( true ) + 15 );
		if ( $result['done'] ) {
			wp_cache_flush();
		}
		return rest_ensure_response( $result );
	}

	public static function update( WP_REST_Request $request ) {
		$result = Centinela_Updater::run( $request['type'], (string) $request['slug'], (string) $request['version'] );
		return is_wp_error( $result ) ? $result : rest_ensure_response( $result );
	}

	public static function db_upgrade() {
		return rest_ensure_response( Centinela_Updater::db_upgrade() );
	}

	public static function debug_log( WP_REST_Request $request ) {
		return rest_ensure_response( Centinela_Inventory::debug_log_since( (int) $request['since'] ) );
	}
}
