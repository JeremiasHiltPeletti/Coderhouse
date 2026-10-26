# Centinela WP

Sistema para **actualizar sitios WordPress sin romper nada**, desde un solo panel.

Para cada actualización pendiente (núcleo, plugins, temas, traducciones), Centinela:

1. **Lee el stack** del sitio: versión de WordPress, PHP, base de datos, servidor, plugins activos, tema.
2. **Investiga** si la versión nueva trae problemas:
   - Ficha oficial en WordPress.org (compatibilidad, PHP requerido, valoración, fecha de publicación, changelog).
   - Foros de soporte y reseñas **publicados desde el lanzamiento**, marcando los que hablan de errores fatales, pantallas blancas o conflictos, y los que **mencionan componentes de tu stack**.
   - Bases de vulnerabilidades (WPScan y Wordfence Intelligence, opcionales): ¿la versión instalada es vulnerable? ¿la nueva lo es?
   - **Claude** (opcional, recomendado): busca en foros, GitHub, Reddit, Wordfence, Patchstack, WPScan, etc. con tu stack exacto y redacta la decisión en lenguaje claro, con fuentes.
3. **Decide y explica**: *Actualizar*, *Esperar* (versión muy reciente) o *No actualizar*, con riesgo, razones, conflictos con tu stack, estado de seguridad, qué revisar después y fuentes. Explica tanto si actualiza como si no.
4. **Siempre copia antes de tocar**: base de datos completa + archivos del componente, descargada al panel y verificada con SHA-256.
5. **Actualiza** con el instalador oficial de WordPress (`WP_Upgrader`).
6. **Verifica** como un visitante: portada, login, API, páginas que elijas, más el `debug.log`. Compara con la foto previa (códigos HTTP, pantalla de error crítico, página vacía o cortada, avisos de PHP, lentitud).
7. **Si algo se rompió, restaura solo** y detiene el resto del lote. Si WordPress ni siquiera arranca (error fatal), usa un **acceso de rescate** que funciona sin cargar WordPress. Esa versión queda marcada para no reintentarla.

Siempre podés descargar cualquier copia (`database.sql` + `files-NNN.zip` + `manifest.json`) y restaurarla vos mismo.

```
centinela-wp/
├── connector/centinela-connector/   Plugin que se instala en cada sitio WordPress
└── panel/                           Panel central (Node.js, sin base de datos externa)
```

---

## 1. Instalar el panel

Requisitos: Node.js 22.2 o superior.

```bash
cd centinela-wp/panel
npm install
cp .env.example .env      # completá PANEL_PASSWORD y, si querés, ANTHROPIC_API_KEY
npm start                 # http://127.0.0.1:4747
```

Variables de `.env`:

| Variable | Para qué |
|---|---|
| `PANEL_PASSWORD` | Contraseña de acceso (si la dejás vacía, el panel te pide crearla la primera vez). |
| `ANTHROPIC_API_KEY` | Activa la investigación y explicación con Claude (`CLAUDE_MODEL`, por defecto `claude-opus-5-5`). |
| `WPSCAN_API_TOKEN` | Vulnerabilidades por versión (token gratuito en wpscan.com). |
| `WORDFENCE_API_KEY` | Feed de Wordfence Intelligence. |
| `PANEL_PUBLIC_URL` | Si publicás el panel con HTTPS, la autorización en WordPress vuelve sola al panel. |
| `CENTINELA_SECRET` | Clave para cifrar credenciales (si falta se genera `data/.secret`). |

Los datos quedan en `panel/data/` (credenciales cifradas con AES-256-GCM, informes y **copias descargadas** en `data/backups/<sitio>/<copia>/`). Hacé copia de esa carpeta.

> Por seguridad el panel escucha solo en `127.0.0.1`. Si lo exponés a internet, ponelo detrás de HTTPS (Caddy, Nginx) y definí `PANEL_PUBLIC_URL`.

## 2. Conectar un sitio

1. En el panel: **Sitios → Descargar conector** e instalalo en WordPress (*Plugins → Añadir nuevo → Subir plugin*), luego activalo.
2. **Agregar sitio** → pegá la URL.
3. **Autorizar en WordPress**: se abre la pantalla oficial de *Contraseñas de aplicación*; aprobá y copiá la contraseña (o vuelve sola si configuraste `PANEL_PUBLIC_URL`).
4. Ingresá usuario y contraseña de aplicación → **Conectar**.

El usuario debe ser administrador con permiso para actualizar. La contraseña de aplicación se puede revocar en cualquier momento desde el perfil de WordPress. WordPress exige HTTPS para estas contraseñas (salvo entornos locales).

En **Herramientas → Centinela WP** dentro de WordPress verás los requisitos (HTTPS, escritura directa de archivos, ZipArchive) y las copias guardadas.

## 3. Uso diario

- **Buscar y analizar**: lista cada actualización con su decisión y el *por qué*.
- **Actualizar seleccionadas**: se preseleccionan solo las recomendadas. Podés forzar otras bajo tu responsabilidad (los bloqueos duros, como PHP incompatible, nunca se fuerzan).
- **Copia completa**: base de datos + WordPress + `wp-content` (las imágenes subidas son opcionales).
- **Copias de seguridad**: descargar, restaurar (archivos y opcionalmente base de datos) o borrar.
- **Ajustes por sitio**: modo manual o automático, revisión diaria/semanal, días de espera para versiones nuevas, páginas extra a verificar (`/tienda`, `/carrito`…), plugins que nunca se tocan, y si al restaurar se vuelve también la base de datos.

### Cómo decide

Reglas que **siempre** se aplican (Claude puede ser más prudente, nunca menos):

| Situación | Decisión |
|---|---|
| Requiere una versión de PHP o WordPress que el sitio no tiene · sin paquete descargable (licencia vencida) · WordPress no puede escribir archivos · excluido en ajustes | **No actualizar** (bloqueo) |
| La versión nueva figura como vulnerable | **No actualizar** |
| La instalada es vulnerable y la nueva lo corrige | **Actualizar** (aunque sea reciente) |
| Publicada hace menos de N días (por defecto 3) | **Esperar** y reevaluar |
| Ya rompió este mismo sitio antes | **No actualizar** hasta que salga otra versión |
| Puntaje de riesgo alto (salto mayor, reportes de rotura, reportes con tu stack, malas reseñas recientes, no probada con tu versión de WordPress, componente crítico) | **No actualizar** |
| Resto | **Actualizar**, de menor a mayor riesgo, el núcleo al final |

### Restaurar a mano (si todo lo demás falla)

Cada copia tiene un `manifest.json` que describe qué contiene.

1. Importá `database.sql` en la base de datos del sitio (phpMyAdmin o `mysql bd < database.sql`). Reemplaza las tablas del sitio.
2. Descomprimí los `files-NNN.zip`. Cada carpeta indica el destino: `plugin/<slug>` → `wp-content/plugins/<slug>`, `theme/<slug>` → `wp-content/themes/<slug>`, `core/` → raíz de WordPress (sin tocar `wp-config.php`), `content/` → `wp-content`, `languages/` → `wp-content/languages`.

## 4. Seguridad

- Autenticación con **Contraseñas de aplicación** del núcleo de WordPress; toda la API del conector exige un administrador con `manage_options` y `update_plugins`.
- Las copias se guardan en una carpeta con nombre aleatorio y bloqueada para Apache/LiteSpeed/IIS. En Nginx (o para máxima seguridad) definí una carpeta fuera del directorio público en `wp-config.php`:
  ```php
  define( 'CENTINELA_BACKUP_DIR', '/home/usuario/centinela-backups' );
  ```
- El **acceso de rescate** (`rescue.php`) solo acepta peticiones POST firmadas con HMAC-SHA256, con marca de tiempo (5 min) y protección contra repetición; solo ofrece acciones de recuperación. La clave se regenera desde el panel o desde *Herramientas → Centinela WP*. Algunos hostings bloquean la ejecución directa de PHP en `wp-content/plugins`: el panel lo detecta y lo indica como «Rescate no disponible» (las restauraciones por la API siguen funcionando mientras WordPress arranque).
- El panel guarda las credenciales cifradas, usa sesión `HttpOnly`, protección CSRF por encabezado y limita los intentos de acceso.
- El contenido de foros y webs se trata como dato: se escapa en la interfaz y se le indica a Claude que no lo siga como instrucciones.

## 5. Limitaciones conocidas

- Plugins premium: si su sistema de actualización no usa el mecanismo estándar de WordPress, no aparecen como actualizables; si aparecen sin paquete, se bloquean (suele ser licencia vencida).
- La restauración de base de datos vuelve todo al momento de la copia: en tiendas, los pedidos de esos minutos se perderían. Podés desactivarla en los ajustes del sitio (solo se restauran archivos).
- Las restauraciones de núcleo y de copias completas sobrescriben archivos; no borran archivos nuevos fuera de `wp-admin` y `wp-includes`.
- Con `DISALLOW_FILE_MODS` o sin escritura directa de archivos (FTP), WordPress no permite actualizar sin intervención: el panel lo marca como bloqueo.
- La revisión programada solo corre mientras el panel está encendido.

## 6. Desarrollo

```bash
cd panel && npm test          # lógica de decisión, verificación, RSS, cifrado, zip
npm run check                 # sintaxis
for f in $(find ../connector -name '*.php'); do php -l "$f"; done
```

Probado de punta a punta contra WordPress 6.7 + MariaDB 10.11 + PHP 8.3: inventario, análisis, copia por componente y completa, descarga verificada, actualización de plugins, tema y núcleo (6.7 → 7.1.3 con migración de base de datos), detección de una versión rota a propósito (error fatal), **restauración automática por el acceso de rescate** con WordPress caído, y restauración manual del núcleo.
