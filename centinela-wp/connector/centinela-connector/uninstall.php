<?php
/**
 * Limpieza al desinstalar: borra la clave de rescate y la opción interna.
 * Las copias de seguridad NO se borran automáticamente (pueden ser tu única copia);
 * eliminalas desde el panel o manualmente si ya no las necesitás.
 *
 * @package Centinela
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

$centinela_pointer = dirname( WP_PLUGIN_DIR ) . '/centinela-pointer.php';
if ( is_file( $centinela_pointer ) ) {
	unlink( $centinela_pointer ); // phpcs:ignore WordPress.WP.AlternativeFunctions.unlink_unlink
}
delete_option( 'centinela_keep_backups' );
