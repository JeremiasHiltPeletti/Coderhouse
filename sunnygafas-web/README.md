# Sunnygafas · sitio web

Sitio estático (HTML, CSS y JavaScript sin dependencias). Publicado en https://sunnygafas-home.netlify.app.

La compra se completa en la tienda oficial, https://sunnygafas.empretienda.com.ar: cada color del sitio enlaza a la ficha oficial de ese mismo color.

## Abrirlo en tu máquina

Las rutas son absolutas (`/css/...`), así que hace falta un servidor local:

```bash
python3 -m http.server 8090 --directory sunnygafas-web
```

Después abrí http://localhost:8090.

## Publicar

Subí la carpeta `sunnygafas-web` completa a Netlify (arrastrándola al panel o con `netlify deploy --prod --dir sunnygafas-web`). No hay paso de compilación en el servidor: los HTML ya están generados.

## Actualizar precios, stock o modelos

```bash
python3 tools/sync_store.py     # lee precio, stock y descripción de cada variante en la tienda oficial
python3 tools/build.py          # regenera js/data.js y todas las páginas
node tools/test_flows.js        # recorridos de verificación en navegador (requiere Playwright y el servidor local)
```

- **Qué modelos se muestran y qué ficha oficial corresponde a cada color:** `tools/models.json`.
- **Fotos:** `python3 tools/images.py <carpeta_con_las_fotos_de_la_tienda>` prepara galerías y tarjetas con el mismo criterio.
- **Dominio final:** cambiá `SITE_URL` en `tools/build.py` y volvé a generar. Actualiza canónicas, `sitemap.xml`, `robots.txt` y datos estructurados.

## Estructura

| Ruta | Contenido |
|---|---|
| `index.html` | Home |
| `gafas-de-sol.html`, `polarizadas.html`, `armazones.html`, `clip-on.html`, `accesorios.html`, `catalogo.html` | Catálogo por categoría, completo y resultados de búsqueda |
| `producto/<modelo>.html` | Ficha de cada modelo (`?color=` elige la variante) |
| `guia-de-calce.html`, `ayuda.html`, `404.html` | Guía, ayuda y página no encontrada |
| `demo.html` | Redirige los enlaces de la versión anterior a su página definitiva |
| `css/tokens.css`, `css/site.css`, `css/home.css`, `css/pages.css` | Tokens y componentes, cabecera y pie, Home, resto de las páginas |
| `js/data.js` | Catálogo único (generado) |
| `js/site.js`, `js/home.js`, `js/catalog.js`, `js/product.js` | Lógica compartida y por página |
| `tools/` | Generador, sincronización con la tienda, fotos, plantillas y pruebas |
