# Arma el prototipo:
#   assets/app.js    = app.src.js + app4.src.js + sprite de íconos + lista de fotos sin fondo blanco
#   assets/proto.css = estilos de etapas 2-3 + extras del prototipo + etapa 4
#   páginas .html    = una por plantilla (index.html sin doctype para el artifact; dist/ con doctype para servir local)
import pathlib, json, shutil
from PIL import Image

root = pathlib.Path(__file__).resolve().parent.parent
proto = root / 'prototipo'
assets = root / 'assets'

# Fotos que no están sobre blanco: se muestran a sangre
full = []
for f in sorted((assets / 'productos').glob('*.webp')):
    im = Image.open(f).convert('RGB'); w, h = im.size
    pts = [im.getpixel((3, 3)), im.getpixel((w - 4, 3)), im.getpixel((3, h - 4)), im.getpixel((w - 4, h - 4))]
    if min(min(p) for p in pts) < 235:
        full.append(f.stem)

sprite = (assets / '_sprite.txt').read_text().replace("'", "\\'").replace('\n', ' ')
src = (proto / 'app.src.js').read_text()
src4 = (proto / 'app4.src.js').read_text()
src = src.replace('/* ---------- arranque ---------- */', src4 + '\n/* ---------- arranque ---------- */')
src = src.replace('/*SPRITE*/', sprite).replace('/*FULL*/', json.dumps(full))
(assets / 'app.js').write_text(src)
css = (assets / 'proto-base.css').read_text() + '\n' + (proto / 'proto-extra.css').read_text() + '\n' + (proto / 'proto-stage4.css').read_text()
(assets / 'proto.css').write_text(css)

HEAD = ('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gloock&family=Hanken+Grotesk:wght@400;500;600;700;800&display=swap">'
        '<link rel="stylesheet" href="assets/sunny.css"><link rel="stylesheet" href="assets/proto.css">')
PAGES = {
    'index': ('home', 'Sunnygafas · Gafas de sol avaladas por óptico'),
    'listado': ('listado', 'Gafas de sol · Sunnygafas'),
    'producto': ('producto', 'Producto · Sunnygafas'),
    'carrito': ('carrito', 'Carrito · Sunnygafas'),
    'checkout': ('checkout', 'Checkout · Sunnygafas'),
    'confirmacion': ('confirmacion', 'Pedido recibido · Sunnygafas'),
    'cuenta': ('cuenta', 'Mi cuenta · Sunnygafas'),
    'nosotros': ('nosotros', 'Quiénes somos · Sunnygafas'),
    'ayuda': ('ayuda', 'Ayuda · Sunnygafas'),
    'contacto': ('contacto', 'Contacto y venta mayorista · Sunnygafas'),
    'blog': ('blog', 'Blog · Sunnygafas'),
    'articulo': ('articulo', 'Blog · Sunnygafas'),
    'legal': ('legal', 'Legales · Sunnygafas'),
    'arrepentimiento': ('arrepentimiento', 'Botón de arrepentimiento · Sunnygafas'),
    '404': ('notfound', 'Página no encontrada · Sunnygafas'),
}
BODY = '<div class="scr" id="app"></div><script src="assets/app.js"></script>'
def full_page(pg, title):
    return ('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
            f'<title>{title}</title>{HEAD}</head><body data-page="{pg}">{BODY}</body></html>')

dist = root / 'dist'
if dist.exists():
    shutil.rmtree(dist)
(dist / 'assets' / 'productos').mkdir(parents=True)
for name, (pg, title) in PAGES.items():
    (dist / f'{name}.html').write_text(full_page(pg, title))
    if name == 'index':
        # El artifact agrega su propio esqueleto a la página principal
        (proto / 'index.html').write_text('<title>Sunnygafas · Prototipo</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n' + HEAD + '\n' + BODY)
    else:
        (proto / f'{name}.html').write_text(full_page(pg, title))
for f in ['sunny.css', 'proto.css', 'app.js', 'isotipo-sunnygafas.png']:
    shutil.copy(assets / f, dist / 'assets' / f)
for f in (assets / 'productos').glob('*.webp'):
    shutil.copy(f, dist / 'assets' / 'productos' / f.name)
old = proto / 'pendiente.html'
if old.exists():
    old.unlink()
print('ok', len(full), 'fotos a sangre;', len(PAGES), 'páginas')
