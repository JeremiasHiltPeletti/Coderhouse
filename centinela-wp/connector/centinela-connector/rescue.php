<?php
/**
 * Acceso de rescate de Centinela WP.
 *
 * Se ejecuta SIN cargar WordPress, para poder restaurar una copia cuando una
 * actualización dejó el sitio con un error fatal (pantalla blanca, error 500).
 *
 * Seguridad:
 *  - Solo acepta POST con JSON firmado (HMAC-SHA256) con la clave de rescate que
 *    el panel recibió al conectarse (guardada en wp-content/centinela-pointer.php).
 *  - Rechaza firmas viejas (más de 5 minutos) y nonces repetidos.
 *  - Solo ofrece acciones de recuperación; nunca ejecuta código arbitrario.
 *
 * @package Centinela
 */

define( 'CENTINELA_RESCUE', true );

header( 'Content-Type: application/json; charset=utf-8' );
header( 'X-Robots-Tag: noindex, nofollow' );
header( 'Cache-Control: no-store' );

/**
 * Responde y termina.
 */
function centinela_rescue_reply( $code, array $data ) {
	http_response_code( $code );
	echo json_encode( $data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
	exit;
}

if ( 'POST' !== ( isset( $_SERVER['REQUEST_METHOD'] ) ? $_SERVER['REQUEST_METHOD'] : '' ) ) {
	centinela_rescue_reply( 405, array( 'error' => 'method_not_allowed' ) );
}

$pointer_file = dirname( __DIR__, 2 ) . '/centinela-pointer.php';
if ( ! is_file( $pointer_file ) ) {
	centinela_rescue_reply( 503, array( 'error' => 'not_configured' ) );
}
$raw_pointer = (string) file_get_contents( $pointer_file );
$pointer     = json_decode( substr( $raw_pointer, strpos( $raw_pointer, "\n" ) + 1 ), true );
if ( ! is_array( $pointer ) || empty( $pointer['key'] ) || empty( $pointer['root'] ) ) {
	centinela_rescue_reply( 503, array( 'error' => 'not_configured' ) );
}

$body      = (string) file_get_contents( 'php://input', false, null, 0, 65536 );
$signature = isset( $_SERVER['HTTP_X_CENTINELA_SIGNATURE'] ) ? (string) $_SERVER['HTTP_X_CENTINELA_SIGNATURE'] : '';
$expected  = hash_hmac( 'sha256', $body, $pointer['key'] );
if ( '' === $signature || ! hash_equals( $expected, $signature ) ) {
	centinela_rescue_reply( 401, array( 'error' => 'bad_signature' ) );
}

$request = json_decode( $body, true );
if ( ! is_array( $request ) || ! isset( $request['ts'], $request['nonce'], $request['action'] ) ) {
	centinela_rescue_reply( 400, array( 'error' => 'bad_request' ) );
}
if ( abs( time() - (int) $request['ts'] ) > 300 ) {
	centinela_rescue_reply( 401, array( 'error' => 'expired' ) );
}

// Protección contra repetición.
$nonce_file = rtrim( $pointer['root'], '/' ) . '/rescue-nonces.json';
$nonces     = is_file( $nonce_file ) ? (array) json_decode( (string) file_get_contents( $nonce_file ), true ) : array();
$nonce      = (string) $request['nonce'];
if ( isset( $nonces[ $nonce ] ) ) {
	centinela_rescue_reply( 409, array( 'error' => 'replayed' ) );
}
$now = time();
$nonces = array_filter(
	$nonces,
	static function ( $t ) use ( $now ) {
		return $now - (int) $t < 600;
	}
);
$nonces[ $nonce ] = $now;
file_put_contents( $nonce_file, json_encode( $nonces ), LOCK_EX );

require_once __DIR__ . '/includes/class-restore-engine.php';

$params = isset( $request['params'] ) && is_array( $request['params'] ) ? $request['params'] : array();
$root   = rtrim( $pointer['root'], '/' );

@set_time_limit( 300 ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged

switch ( $request['action'] ) {
	case 'ping':
		centinela_rescue_reply(
			200,
			array(
				'ok'          => true,
				'php'         => PHP_VERSION,
				'maintenance' => is_file( $pointer['abspath'] . '/.maintenance' ),
				'wp_present'  => is_file( $pointer['abspath'] . '/wp-load.php' ),
				'backups'     => count( (array) glob( $root . '/*/manifest.json' ) ),
			)
		);
		break;

	case 'clear_maintenance':
		$file = $pointer['abspath'] . '/.maintenance';
		if ( is_file( $file ) ) {
			unlink( $file );
		}
		centinela_rescue_reply( 200, array( 'ok' => true ) );
		break;

	case 'disable_plugin':
		$slug = isset( $params['slug'] ) ? (string) $params['slug'] : '';
		if ( ! preg_match( '/^[a-zA-Z0-9._-]+$/', $slug ) || 'centinela-connector' === $slug ) {
			centinela_rescue_reply( 400, array( 'error' => 'bad_slug' ) );
		}
		$path = rtrim( $pointer['plugin_dir'], '/' ) . '/' . $slug;
		if ( ! is_dir( $path ) ) {
			centinela_rescue_reply( 404, array( 'error' => 'not_found' ) );
		}
		$ok = rename( $path, $path . '.centinela-disabled-' . time() );
		centinela_rescue_reply( $ok ? 200 : 500, array( 'ok' => $ok ) );
		break;

	case 'list_backups':
		$list = array();
		foreach ( (array) glob( $root . '/*', GLOB_ONLYDIR ) as $dir ) {
			$manifest = Centinela_Restore_Engine::read_manifest( $dir );
			if ( $manifest ) {
				$list[] = array(
					'id'          => $manifest['id'],
					'status'      => $manifest['status'],
					'created_gmt' => $manifest['created_gmt'],
					'reason'      => $manifest['reason'],
				);
			}
		}
		centinela_rescue_reply( 200, array( 'backups' => $list ) );
		break;

	case 'restore':
		$id = isset( $params['id'] ) ? (string) $params['id'] : '';
		if ( ! Centinela_Restore_Engine::valid_id( $id ) ) {
			centinela_rescue_reply( 400, array( 'error' => 'bad_id' ) );
		}
		$dir      = $root . '/' . $id;
		$manifest = Centinela_Restore_Engine::read_manifest( $dir );
		if ( ! $manifest || 'complete' !== $manifest['status'] ) {
			centinela_rescue_reply( 404, array( 'error' => 'backup_not_found' ) );
		}
		$phase = isset( $params['phase'] ) ? $params['phase'] : 'files';

		if ( 'files' === $phase ) {
			$maintenance = $pointer['abspath'] . '/.maintenance';
			if ( is_file( $maintenance ) ) {
				unlink( $maintenance ); // Una actualización interrumpida deja el sitio en mantenimiento.
			}
			centinela_rescue_reply( 200, Centinela_Restore_Engine::restore_files( $dir, $manifest, array( 'centinela-connector' ) ) );
		}

		$creds = Centinela_Restore_Engine::parse_wp_config( $pointer['wp_config'] );
		if ( ! $creds ) {
			centinela_rescue_reply( 500, array( 'error' => 'No se pudieron leer las credenciales de wp-config.php.' ) );
		}
		$db = Centinela_Restore_Engine::connect( $creds );
		if ( is_string( $db ) ) {
			centinela_rescue_reply( 500, array( 'error' => $db ) );
		}
		$offset = isset( $params['offset'] ) ? (int) $params['offset'] : 0;
		centinela_rescue_reply( 200, Centinela_Restore_Engine::restore_db( $dir, $offset, $db, microtime( true ) + 15 ) );
		break;

	default:
		centinela_rescue_reply( 400, array( 'error' => 'unknown_action' ) );
}
