<?php
/**
 * Ubicación protegida de las copias y del "puntero" que usa rescue.php.
 *
 * @package Centinela
 */

defined( 'ABSPATH' ) || exit;

class Centinela_Storage {

	const OPTION_DIR = 'centinela_backup_dir';

	/**
	 * Crea la carpeta de copias y el puntero de rescate al activar.
	 */
	public static function install() {
		self::root();
		self::write_pointer( false );
	}

	/**
	 * Carpeta raíz de copias (con nombre aleatorio para que no sea adivinable).
	 *
	 * Se puede fijar fuera del directorio público con la constante CENTINELA_BACKUP_DIR
	 * en wp-config.php, que es lo más seguro.
	 *
	 * @return string
	 */
	public static function root() {
		if ( defined( 'CENTINELA_BACKUP_DIR' ) && CENTINELA_BACKUP_DIR ) {
			$dir = CENTINELA_BACKUP_DIR;
		} else {
			$dir = get_option( self::OPTION_DIR );
			if ( ! $dir ) {
				$uploads = wp_upload_dir( null, false );
				$dir     = trailingslashit( $uploads['basedir'] ) . 'centinela-' . strtolower( wp_generate_password( 20, false, false ) );
				update_option( self::OPTION_DIR, $dir, false );
			}
		}
		$dir = untrailingslashit( $dir );
		if ( ! is_dir( $dir ) ) {
			wp_mkdir_p( $dir );
		}
		self::protect( $dir );
		return $dir;
	}

	/**
	 * Bloquea el acceso web directo a la carpeta (Apache, LiteSpeed, IIS).
	 * En Nginx la protección es el nombre aleatorio; se recomienda CENTINELA_BACKUP_DIR.
	 */
	private static function protect( $dir ) {
		$files = array(
			'.htaccess'  => "Require all denied\nDeny from all\n",
			'index.php'  => "<?php\n// Silence is golden.\n",
			'web.config' => '<?xml version="1.0"?><configuration><system.webServer><authorization><deny users="*" /></authorization></system.webServer></configuration>',
		);
		foreach ( $files as $name => $content ) {
			$path = $dir . '/' . $name;
			if ( ! file_exists( $path ) ) {
				file_put_contents( $path, $content ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
			}
		}
	}

	/**
	 * Carpeta de una copia concreta.
	 */
	public static function backup_dir( $id ) {
		if ( ! Centinela_Restore_Engine::valid_id( $id ) ) {
			return null;
		}
		return self::root() . '/' . $id;
	}

	/**
	 * Ruta del puntero: wp-content/centinela-pointer.php (o el padre de la carpeta de plugins).
	 * rescue.php lo encuentra sin cargar WordPress.
	 */
	public static function pointer_path() {
		return dirname( dirname( CENTINELA_DIR ) ) . '/centinela-pointer.php';
	}

	/**
	 * Lee el puntero.
	 *
	 * @return array
	 */
	public static function read_pointer() {
		$path = self::pointer_path();
		if ( ! is_file( $path ) ) {
			return array();
		}
		$raw  = (string) file_get_contents( $path );
		$json = substr( $raw, strpos( $raw, "\n" ) + 1 );
		$data = json_decode( $json, true );
		return is_array( $data ) ? $data : array();
	}

	/**
	 * Escribe el puntero y devuelve la clave de rescate.
	 *
	 * @param bool $rotate Generar una clave nueva.
	 * @return string
	 */
	public static function write_pointer( $rotate ) {
		$current = self::read_pointer();
		$key     = ( ! $rotate && ! empty( $current['key'] ) ) ? $current['key'] : bin2hex( random_bytes( 32 ) );
		$data    = array(
			'key'        => $key,
			'root'       => self::root(),
			'abspath'    => untrailingslashit( ABSPATH ),
			'wp_config'  => self::wp_config_path(),
			'plugin_dir' => untrailingslashit( WP_PLUGIN_DIR ),
			'theme_root' => untrailingslashit( get_theme_root() ),
			'updated'    => time(),
		);
		$body    = "<?php exit; ?>\n" . wp_json_encode( $data );
		file_put_contents( self::pointer_path(), $body, LOCK_EX ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
		@chmod( self::pointer_path(), 0640 ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
		return $key;
	}

	/**
	 * wp-config.php puede estar un nivel por encima de ABSPATH.
	 */
	public static function wp_config_path() {
		if ( file_exists( ABSPATH . 'wp-config.php' ) ) {
			return ABSPATH . 'wp-config.php';
		}
		return dirname( ABSPATH ) . '/wp-config.php';
	}

	/**
	 * Lista las copias existentes (más nuevas primero).
	 *
	 * @return array
	 */
	public static function list_backups() {
		$root = self::root();
		$list = array();
		foreach ( (array) glob( $root . '/*', GLOB_ONLYDIR ) as $dir ) {
			$manifest = Centinela_Restore_Engine::read_manifest( $dir );
			if ( $manifest ) {
				$list[] = self::public_manifest( $manifest );
			}
		}
		usort(
			$list,
			static function ( $a, $b ) {
				return strcmp( (string) $b['created_gmt'], (string) $a['created_gmt'] );
			}
		);
		return $list;
	}

	/**
	 * Quita rutas absolutas del manifest antes de enviarlo fuera.
	 */
	public static function public_manifest( array $manifest ) {
		if ( isset( $manifest['components'] ) ) {
			foreach ( $manifest['components'] as &$component ) {
				unset( $component['target'] );
			}
		}
		return $manifest;
	}

	/**
	 * Conserva solo las N copias completas más recientes.
	 */
	public static function prune( $keep ) {
		$keep    = max( 1, (int) $keep );
		$backups = self::list_backups();
		foreach ( array_slice( $backups, $keep ) as $old ) {
			if ( ! empty( $old['pinned'] ) ) {
				continue;
			}
			$dir = self::backup_dir( $old['id'] );
			if ( $dir ) {
				Centinela_Restore_Engine::rrmdir( $dir );
			}
		}
	}
}
