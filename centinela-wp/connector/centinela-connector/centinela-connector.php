<?php
/**
 * Plugin Name:       Centinela Connector
 * Plugin URI:        https://github.com/jeremiashiltpeletti/coderhouse
 * Description:       Conecta este sitio con el panel Centinela WP: inventario, copias de seguridad restaurables, actualizaciones seguras y rescate ante errores fatales.
 * Version:           1.0.0
 * Requires at least: 5.6
 * Requires PHP:      7.4
 * Author:            Centinela WP
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       centinela-connector
 *
 * @package Centinela
 */

defined( 'ABSPATH' ) || exit;

define( 'CENTINELA_VERSION', '1.0.0' );
define( 'CENTINELA_FILE', __FILE__ );
define( 'CENTINELA_DIR', plugin_dir_path( __FILE__ ) );
define( 'CENTINELA_SLUG', 'centinela-connector' );

require_once CENTINELA_DIR . 'includes/class-restore-engine.php';
require_once CENTINELA_DIR . 'includes/class-storage.php';
require_once CENTINELA_DIR . 'includes/class-inventory.php';
require_once CENTINELA_DIR . 'includes/class-backup.php';
require_once CENTINELA_DIR . 'includes/class-updater.php';
require_once CENTINELA_DIR . 'includes/class-rest.php';
require_once CENTINELA_DIR . 'includes/class-admin.php';

register_activation_hook( __FILE__, array( 'Centinela_Storage', 'install' ) );

add_action( 'rest_api_init', array( 'Centinela_REST', 'register_routes' ) );

if ( is_admin() ) {
	Centinela_Admin::init();
}
