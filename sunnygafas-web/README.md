# Sunnygafas · sitio con compra propia

Sitio estático (HTML, CSS y JavaScript sin dependencias) generado con Python. La navegación y la compra se hacen dentro del sitio: catálogo, fichas, carrito y checkout. La tienda de origen (Empretienda) se usa solo como **fuente de datos**; el sitio no enlaza compras hacia ella.

## Cómo verlo

```bash
python3 -m http.server 8090 --bind 127.0.0.1
```

Abrí http://127.0.0.1:8090. Las rutas son absolutas (`/css/...`), así que hace falta un servidor.

## Datos: de la tienda de origen al sitio

```bash
python3 tools/sync_store.py                 # 1. lee todos los productos publicados (sitemap + fichas públicas)
```

```bash
python3 tools/catalog.py                    # 2. agrupa los colores de cada modelo en variantes
```

```bash
python3 -W ignore tools/images.py <carpeta_de_fotos>   # 3. prepara galerías y tarjetas
```

```bash
python3 tools/build.py                      # 4. genera páginas, datos, sitemap y redirecciones
```

- `tools/store-snapshot.json`: un registro por producto de origen (nombre, categoría, precio, stock y cantidad, descripción, fotos). Se descartan las imágenes de plantilla de la tienda (logo y banner).
- `tools/catalog.json`: modelos con sus variantes. En la tienda cada color es un producto; acá se agrupan por nombre base y colección, y cada variante conserva su SKU, precio, stock y fotos.
- `tools/curation.json`: correcciones de agrupamiento y color, forma de cada modelo, piezas de los clip-on, correcciones de atributos de lente, datos de accesorios, selección de la Home y **datos pendientes de validar**.

Atributos de lente (protección UV, polarización, fotocromía) son independientes y tienen tres estados: `true` respaldado por la descripción de origen, `false` negado por la fuente, `null` sin confirmar (no se muestra ni se niega). En clip-on cada característica se asigna a su pieza (armazón o clip).

## Cobertura del catálogo (sincronizado 2026-11-14 16:06)

219 productos publicados en la fuente → **113 modelos con 219 variantes** (28 sin stock). Ningún producto quedó afuera (`catalog.py` lo verifica).

| Categoría | Modelos | Variantes |
| --- | --- | --- |
| Gafas de sol | 65 | 132 |
| Polarizadas | 16 | 26 |
| Armazones | 21 | 42 |
| Clip-on 2 en 1 | 8 | 11 |
| Accesorios | 3 | 8 |

## Compra

- **Carrito** (`/carrito.html`): se guarda en el navegador. Cantidades limitadas al stock informado por la fuente; quitar productos; seguir comprando.
- **Checkout** (`/checkout.html`): contacto, entrega (Correo Argentino, retiro o entrega a acordar) y pago (transferencia o efectivo con 25% off; tarjetas por Ualá Bis en hasta 3 cuotas sin interés). Validación por campo y resumen de errores.
- **Modo de prueba**: al confirmar no se registra un pedido ni se cobra. La condición se indica antes del botón final y en la confirmación (`/pedido.html`).
- **Botón de arrepentimiento** (`/arrepentimiento.html`): formulario en modo de prueba, con alternativa por WhatsApp y email.

Condiciones comerciales mostradas: verificadas en la configuración pública de la tienda de origen (medios de pago activos, descuento de 25% en transferencia y efectivo, 3 cuotas sin interés, tarjetas de Ualá Bis y medios de envío activos: Correo Argentino, envío personalizado, retiro y a acordar).

## Pendiente para operar

Integraciones:
- Procesador de pagos (Ualá Bis u otro) y sistema de pedidos con stock en línea.
- Cotización de envío por código postal (Correo Argentino).
- Envío de emails (confirmación de pedido y constancia de arrepentimiento).
- Dominio definitivo (`SITE_URL` en `tools/build.py`).

Datos que la marca debe validar:
- **Medidas**: Ningún producto tiene lente, puente y varilla publicados.
- **Estuche y liquido**: No figura en las fichas de la tienda (solo Cat eye 6 en 1 declara estuche).
- **Costo y plazo de envio**: La tienda calcula el costo por código postal con Correo Argentino; falta integrar esa cotización.
- **Retiro en local**: La tienda tiene retiro en local activo, pero no publica la dirección ni horarios.
- **Politica de cambios**: Plazos y condiciones de cambio sin publicar.
- **Ciclismo polarizado**: La tienda describe cristales fotocromáticos; no confirma polarización.
- **Cadena dorada**: La tienda describe la cadena gold como «plata claro».
- **Largo y enganche de cadenas**: Sin publicar.
- **Presupuesto de cristales**: Lo ofrecen por consulta; precio y plazos sin publicar.
- **Pagos y pedidos**: Falta conectar un procesador de pagos (Ualá Bis u otro) y un sistema de pedidos y stock en línea.

## Pruebas

```bash
node tools/test_site.js [base]
```

Recorre en Chromium, a 1440, 768, 390 y 360 px: cobertura del catálogo, ausencia de enlaces a la tienda de origen, Home, filtros combinados, fichas y variantes agotadas, carrito, checkout con errores y confirmación, teclado, foco visible, contraste, objetivos táctiles, desbordes y elementos fijos.

## Vista previa sin publicar

```bash
python3 tools/preview_deploy.py <site_id> "Título"
```

Sube un deploy en borrador a Netlify con URL propia. Producción no cambia hasta publicar ese deploy desde el panel.
