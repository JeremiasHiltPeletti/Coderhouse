<?php
/**
 * Pantalla informativa en Herramientas → Centinela.
 *
 * @package Centinela
 */

defined( 'ABSPATH' ) || exit;

class Centinela_Admin {

	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'menu' ) );
		add_action( 'admin_post_centinela_rotate_key', array( __CLASS__, 'rotate_key' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( CENTINELA_FILE ), array( __CLASS__, 'action_links' ) );
	}

	public static function menu() {
		add_management_page( 'Centinela WP', 'Centinela WP', 'manage_options', 'centinela', array( __CLASS__, 'render' ) );
	}

	public static function action_links( $links ) {
		$links[] = '<a href="' . esc_url( admin_url( 'tools.php?page=centinela' ) ) . '">' . esc_html__( 'Conectar', 'centinela-connector' ) . '</a>';
		return $links;
	}

	public static function rotate_key() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'No tenés permisos para esto.', 'centinela-connector' ), 403 );
		}
		check_admin_referer( 'centinela_rotate_key' );
		Centinela_Storage::write_pointer( true );
		wp_safe_redirect( add_query_arg( 'centinela_rotated', '1', admin_url( 'tools.php?page=centinela' ) ) );
		exit;
	}

	public static function render() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		Centinela_Inventory::load_admin_includes();
		$env     = Centinela_Inventory::environment();
		$backups = Centinela_Storage::list_backups();
		$checks  = array(
			array( 'HTTPS', is_ssl() || 0 === strpos( home_url(), 'https://' ), 'Las contraseñas de aplicación viajan en cada petición: usá HTTPS.' ),
			array( 'Contraseñas de aplicación', wp_is_application_passwords_available(), 'Están desactivadas por un plugin de seguridad o por falta de HTTPS.' ),
			array( 'Escritura directa de archivos', 'direct' === $env['filesystem_method'], 'WordPress pide FTP: no se podrá actualizar sin intervención.' ),
			array( 'ZipArchive', $env['php_extensions']['zip'], 'Necesario para las copias de archivos.' ),
			array( 'Carpeta de copias escribible', is_writable( Centinela_Storage::root() ), 'Revisá permisos de wp-content/uploads.' ),
		);
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Centinela WP', 'centinela-connector' ); ?></h1>
			<?php if ( isset( $_GET['centinela_rotated'] ) ) : // phpcs:ignore WordPress.Security.NonceVerification.Recommended ?>
				<div class="notice notice-success"><p><?php esc_html_e( 'Clave de rescate regenerada. Volvé a conectar el sitio desde el panel.', 'centinela-connector' ); ?></p></div>
			<?php endif; ?>

			<h2><?php esc_html_e( 'Cómo conectar este sitio', 'centinela-connector' ); ?></h2>
			<ol>
				<li><?php esc_html_e( 'En el panel Centinela, pulsá "Agregar sitio" e ingresá esta URL:', 'centinela-connector' ); ?> <code><?php echo esc_html( home_url() ); ?></code></li>
				<li><?php esc_html_e( 'El panel te llevará a autorizar la conexión (contraseña de aplicación). También podés crearla manualmente en', 'centinela-connector' ); ?>
					<a href="<?php echo esc_url( admin_url( 'profile.php#application-passwords-section' ) ); ?>"><?php esc_html_e( 'tu perfil', 'centinela-connector' ); ?></a>.</li>
			</ol>

			<h2><?php esc_html_e( 'Requisitos', 'centinela-connector' ); ?></h2>
			<table class="widefat striped" style="max-width:720px">
				<tbody>
				<?php foreach ( $checks as $check ) : ?>
					<tr>
						<td><?php echo esc_html( $check[0] ); ?></td>
						<td><?php echo $check[1] ? '<span style="color:#008a20">✔ OK</span>' : '<span style="color:#b32d2e">✖ ' . esc_html( $check[2] ) . '</span>'; ?></td>
					</tr>
				<?php endforeach; ?>
				</tbody>
			</table>

			<h2><?php esc_html_e( 'Copias guardadas en este servidor', 'centinela-connector' ); ?></h2>
			<?php if ( empty( $backups ) ) : ?>
				<p><?php esc_html_e( 'Todavía no hay copias.', 'centinela-connector' ); ?></p>
			<?php else : ?>
				<table class="widefat striped" style="max-width:720px">
					<thead><tr><th>ID</th><th><?php esc_html_e( 'Motivo', 'centinela-connector' ); ?></th><th><?php esc_html_e( 'Estado', 'centinela-connector' ); ?></th><th><?php esc_html_e( 'Tamaño', 'centinela-connector' ); ?></th></tr></thead>
					<tbody>
					<?php foreach ( $backups as $backup ) : ?>
						<?php $size = array_sum( wp_list_pluck( isset( $backup['artifacts'] ) ? $backup['artifacts'] : array(), 'size' ) ); ?>
						<tr>
							<td><code><?php echo esc_html( $backup['id'] ); ?></code></td>
							<td><?php echo esc_html( $backup['label'] ? $backup['label'] : $backup['reason'] ); ?></td>
							<td><?php echo esc_html( $backup['status'] ); ?></td>
							<td><?php echo esc_html( size_format( $size ) ); ?></td>
						</tr>
					<?php endforeach; ?>
					</tbody>
				</table>
			<?php endif; ?>

			<h2><?php esc_html_e( 'Rescate', 'centinela-connector' ); ?></h2>
			<p><?php esc_html_e( 'Si una actualización provoca un error fatal, el panel usa un acceso de rescate firmado que funciona sin cargar WordPress para restaurar la copia previa.', 'centinela-connector' ); ?></p>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="centinela_rotate_key">
				<?php wp_nonce_field( 'centinela_rotate_key' ); ?>
				<?php submit_button( __( 'Regenerar clave de rescate', 'centinela-connector' ), 'secondary', 'submit', false ); ?>
			</form>
		</div>
		<?php
	}
}
