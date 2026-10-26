=== Centinela Connector ===
Contributors: centinela
Requires at least: 5.6
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later

Conecta el sitio con el panel Centinela WP para actualizar de forma segura.

== Description ==

* Inventario del stack (WordPress, PHP, base de datos, plugins, temas y actualizaciones).
* Copias de seguridad por pasos (base de datos + archivos), descargables y restaurables.
* Actualizaciones con las clases oficiales de WordPress (WP_Upgrader).
* Acceso de rescate firmado que restaura la copia previa aunque WordPress no arranque.

Autenticación mediante Contraseñas de aplicación (núcleo de WordPress). Requiere HTTPS.
Para máxima seguridad, definí en wp-config.php una carpeta fuera del directorio público:

    define( 'CENTINELA_BACKUP_DIR', '/home/usuario/centinela-backups' );
