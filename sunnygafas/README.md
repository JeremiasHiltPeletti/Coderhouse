# Sunnygafas · diseño de la tienda nueva

Mockups y prototipo navegable de la tienda en WordPress + WooCommerce (Elementor Pro sobre Hello Elementor).

## Ver el sitio en tu máquina

```bash
python3 -m http.server 8080 --directory sunnygafas/dist
```

Después abrí http://localhost:8080. `etapa-4.html` (en la misma carpeta) tiene la tabla SEO, los atributos y las notas de implementación.

## Qué hay en cada carpeta

| Ruta | Contenido |
|---|---|
| `PRODUCT.md`, `DESIGN.md` | Producto, voz y sistema de diseño |
| `etapa-1-home-mobile.html` … `etapa-4.html` | Entregas de cada etapa con su control de calidad |
| `dist/` | Sitio navegable listo para servir (15 páginas) |
| `prototipo/` | Fuentes del prototipo: `app.src.js`, `app4.src.js`, CSS y `build.py` |
| `assets/` | Tokens y componentes (`sunny.css`), estilos de pantallas (`proto.css`), logo y fotos de producto en WebP |
| `seo/` | Tabla SEO validada (`seo.py`) y `rank-math-seo.csv` |

## Reconstruir

```bash
python3 sunnygafas/prototipo/build.py
python3 sunnygafas/seo/seo.py
python3 sunnygafas/seo/build_etapa4.py
```

Los datos entre corchetes faltan: la lista completa está al final de `etapa-4.html`.
