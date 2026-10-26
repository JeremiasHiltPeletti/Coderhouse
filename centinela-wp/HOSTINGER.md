# Instalar Centinela WP en Hostinger (plan Business)

Guía para dejar el panel funcionando en tu hosting, sin depender de tu PC.

> El plan Business permite "Web Apps" de Node.js. Si tu panel de Hostinger no muestra esa opción, consultá al soporte si está habilitada para tu plan.

## Antes de empezar

Vas a necesitar:

- Un **subdominio** para el panel, por ejemplo `panel.tudominio.com`. No uses el dominio principal de un sitio.
- El archivo **`centinela-panel-hostinger.zip`**: está en la carpeta `centinela-wp/dist/` del repositorio.
- Dos claves largas inventadas por vos (pueden ser 30 letras y números al azar): una para `CRON_TOKEN` y otra para `CENTINELA_SECRET`. **Guardalas** en tu gestor de contraseñas.

## 1. Crear la app

1. En **hPanel → Sitios web → Agregar sitio web**, elegí **Node.js Web App**. El texto exacto del menú puede variar.
2. Elegí **Subir archivo** y subí `centinela-panel-hostinger.zip`.
3. Asignale el subdominio, por ejemplo `panel.tudominio.com`.
4. En la configuración de compilación:
   - **Framework**: `Other` / Otro.
   - **Versión de Node.js**: **22** (o 24).
   - **Archivo de entrada**: `server.js`.
   - **Comando de compilación**: dejalo vacío. Si es obligatorio, poné `npm run check`.

## 2. Variables de entorno

Antes de desplegar (o después, en **Variables de entorno** de la app), cargá estas variables. También podés importar el archivo `.env.example` y completarlo.

| Variable | Valor |
|---|---|
| `PANEL_PASSWORD` | La contraseña para entrar al panel (mínimo 10 caracteres). **Obligatoria.** |
| `PANEL_PUBLIC_URL` | `https://panel.tudominio.com` |
| `CRON_TOKEN` | Una de tus claves largas |
| `CENTINELA_SECRET` | La otra clave larga (cifra las contraseñas de tus sitios) |
| `ANTHROPIC_API_KEY` | Opcional: activa el análisis con Claude |
| `WPSCAN_API_TOKEN` | Opcional: vulnerabilidades por versión |

**No definas `PORT` ni `HOST`**: el hosting los maneja.

Guardá y desplegá. Cuando termine, abrí `https://panel.tudominio.com` y entrá con tu `PANEL_PASSWORD`.

## 3. Activar HTTPS

En hPanel, activá el **certificado SSL** para el subdominio, si no se activó solo. El panel guarda la sesión con cookies seguras, así que **sin HTTPS no vas a poder iniciar sesión**.

## 4. Tarea cron para mantenerlo despierto

Hostinger apaga la app cuando no recibe visitas. Sin esta tarea, las revisiones programadas no se ejecutan.

1. En **hPanel → Avanzado → Cron Jobs**, creá una tarea **personalizada**.
2. Comando (reemplazá el dominio y tu `CRON_TOKEN`):
   ```
   curl -fsS "https://panel.tudominio.com/api/cron?token=TU_CRON_TOKEN" > /dev/null
   ```
3. Frecuencia: **cada 5 minutos** (`*/5 * * * *`).

Para probarla, abrí esa misma URL en el navegador. Tiene que responder algo como `{"ok":true,...}`.

## 5. Conectar tus sitios

Igual que en la PC: en el panel, **Sitios → Agregar sitio**. Como el panel ya tiene HTTPS, al aprobar la conexión en WordPress volvés solo al panel. Instalá el conector en cada sitio desde **Sitios → Descargar conector**.

Después, en **Ajustes** de cada sitio, elegí la **revisión programada** (diaria o semanal) y el **modo** (empezá en *Manual*).

## Qué pasa si Hostinger reinicia la app en medio de una actualización

El panel anota en disco qué está actualizando **antes** de tocar el sitio. Si la app se reinicia a mitad de camino, al volver a arrancar (con la próxima visita o la tarea cron):

1. Revisa el sitio.
2. Si está bien, da la actualización por terminada.
3. Si quedó roto, restaura la copia previa y deja un informe en **Actividad**.

## Dónde quedan tus datos

En la carpeta **`~/centinela-data`** de tu cuenta de hosting, fuera de la app, así no se borra al redesplegar. Ahí están:

- `db.json`: los sitios (con contraseñas cifradas), los ajustes y los informes.
- `backups/`: las copias descargadas. Se guardan las 10 últimas por sitio (cambialo con `PANEL_KEEP_BACKUPS`).

Las copias ocupan espacio del mismo plan donde están tus sitios. Revisá el uso de disco en hPanel cada tanto.

**Recomendación**: si tus sitios están en el mismo Hostinger, descargá cada tanto a tu PC o a Google Drive las copias importantes (*Copias de seguridad → Descargar*). Si el hosting tuviera un problema grave, se caerían a la vez los sitios, el panel y las copias guardadas ahí.

## Actualizar el panel

Cuando haya una versión nueva, subí el nuevo `centinela-panel-hostinger.zip` en la misma app y redesplegá. Tus datos de `~/centinela-data` se conservan.

## Si algo no funciona

| Síntoma | Qué revisar |
|---|---|
| "Falta configurar la contraseña" | Falta `PANEL_PASSWORD` en las variables de entorno. Agregala y redesplegá. |
| No te deja iniciar sesión (vuelve al login) | El subdominio no tiene SSL activo, o estás entrando por `http://`. |
| La tarea cron falla con "curl: command not found" | Usá `wget -q -O /dev/null "https://panel.tudominio.com/api/cron?token=TU_CRON_TOKEN"`. |
| `/api/cron` responde 403 | El token de la URL no coincide con `CRON_TOKEN` (debe tener 16+ caracteres). |
| La app no arranca | Revisá los registros del despliegue en hPanel y que la versión de Node.js sea 22 o 24. |
| El registro en vivo no se mueve | El panel consulta el estado cada 4 segundos de todos modos; esperá unos segundos. |
| Tuviste que reinstalar y los sitios piden reconectar | Cambió o falta `CENTINELA_SECRET`. Volvé a poner el valor original. |
