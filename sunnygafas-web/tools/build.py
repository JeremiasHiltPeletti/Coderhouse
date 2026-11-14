"""Genera el sitio de Sunnygafas.

  uso: python3 tools/build.py

  Entradas
    tools/store-snapshot.json  productos leídos de la tienda de origen (tools/sync_store.py)
    tools/catalog.json         productos agrupados en modelos y variantes (tools/catalog.py)
    tools/curation.json        forma, piezas de clip-on, correcciones de atributos, selección de la Home y pendientes
    tools/images-report.json   fotos preparadas por tools/images.py
    tools/templates/*.html     cuerpo de cada página

  Salidas (en la raíz del proyecto)
    js/data.js, index.html, catalogo.html y las cinco categorías, producto/<modelo>.html, carrito.html,
    checkout.html, pedido.html, guia-de-calce.html, ayuda.html, arrepentimiento.html, 404.html, demo.html,
    sitemap.xml, robots.txt, _headers

  La compra se hace dentro del sitio (carrito y checkout). La tienda de origen solo es fuente de datos.
"""
import json, pathlib, re, html, unicodedata, urllib.parse

root = pathlib.Path(__file__).resolve().parent.parent
T = root / 'tools' / 'templates'

# Cuando se conozca el dominio final, cambiá este valor y volvé a generar: actualiza canónicas, sitemap y datos estructurados.
SITE_URL = 'https://sunnygafas-home.netlify.app'
WA_NUMBER = '5493454149784'           # WhatsApp comercial publicado por la marca
INSTAGRAM = 'https://instagram.com/sunnygafas'
EMAIL = 'sunny.gafas.ch@gmail.com'
# Condiciones comerciales verificadas en la configuración pública de la tienda de origen (ver README)
TRANSFER_OFF = 0.25                   # transferencia y efectivo: 25 % de descuento
INSTALLMENTS = 3                      # tarjetas (Ualá Bis): hasta 3 cuotas sin interés
CARDS = ['Visa', 'Mastercard', 'American Express', 'Naranja', 'Cabal', 'Maestro']

S = json.load(open(root / 'tools/store-snapshot.json'))
CAT_JSON = json.load(open(root / 'tools/catalog.json'))
CU = json.load(open(root / 'tools/curation.json'))
IMG = {r['s']: r for r in json.load(open(root / 'tools/images-report.json'))}
SRC = {p['slug']: p for p in S['products']}

CATEGORIES = {'sol': 'Gafas de sol', 'pol': 'Polarizadas', 'arm': 'Armazones', 'clip': 'Clip-on 2 en 1', 'acc': 'Accesorios'}
CAT_PAGE = {'sol': 'gafas-de-sol', 'pol': 'polarizadas', 'arm': 'armazones', 'clip': 'clip-on', 'acc': 'accesorios'}
SHAPE_NAME = {'redonda': 'Redonda', 'ovalada': 'Ovalada', 'cuadrada': 'Cuadrada', 'cateye': 'Cat eye', 'aviador': 'Aviador', 'geometrica': 'Geométrica'}

def slug(t):
    t = unicodedata.normalize('NFD', t).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', t).strip('-')

def clean_desc(d):
    """Descripción de origen con ortografía pareja. No agrega información; quita los pedidos de consulta."""
    if not d or d.lower().startswith('todo el detalle'):
        return '', False
    rx = bool(re.search(r'presupuesto', d, re.I))
    d = re.split(r'\s*-\s*consult|\s*consultar por c|\s*consulte por', d, flags=re.I)[0]
    d = re.sub(r'uv\s?4000|uv\s?499|uv\s?409|uv\s?400', 'UV400', d, flags=re.I)
    d = re.sub(r'\s+([,.:!])', r'\1', d).replace(' !', '').strip(' -')
    for a, b in ((r'\barmazon\b', 'armazón'), (r'\bdegrade\b', 'degradé'), (r'\bmarron\b', 'marrón'), (r'\bco cristales\b', 'con cristales'),
                 (r'\btermoplastico\b', 'termoplástico'), (r'\bantireflex\b', 'antirreflejo'), (r'\bante reflejo\b', 'antirreflejo'), (r'\banti reflejo\b', 'antirreflejo')):
        d = re.sub(a, b, d, flags=re.I)
    if d.isupper(): d = d.capitalize()
    d = d[0].upper() + d[1:]
    if d[-1] not in '.!': d += '.'
    return d, rx

# ---------- Catálogo ----------
products = []
for m in CAT_JSON['models']:
    vars_ = []
    for v in m['vars']:
        st = SRC[v['src']]
        desc, rx = clean_desc(st['desc'])
        if v['src'] in CU.get('descs', {}): desc = CU['descs'][v['src']]
        # Atributos de lente: True = respaldado por la descripción de origen; None = sin confirmar (no se muestra ni se niega).
        # En clip-on y accesorios no se asignan a la variante: en clip-on cada pieza tiene los suyos («parts»).
        src_txt = st['desc'] + ' ' + st['name']
        lens = {'uv': True if re.search(r'uv\s?4', st['desc'], re.I) else None,
                'polar': True if re.search(r'polari', src_txt, re.I) else None,
                'photo': True if re.search(r'fotocrom', src_txt, re.I) else None}
        if m['cat'] in ('clip', 'acc', 'arm'): lens = {'uv': None, 'polar': None, 'photo': None}
        lens.update(CU.get('lens', {}).get(m['id'], {}))
        gal = IMG[v['src']]['gal']
        vars_.append({'sku': v['src'], 'label': v['label'], 'slug': slug(v['label']), 'fam': v['family'], 'img': v['src'], 'gal': gal,
                      'price': st['price'], 'stock': st['stock'], 'qty': st['qty'], 'desc': desc, 'rx': rx, **lens})
    p = {'id': m['id'], 'name': m['name'], 'cat': m['cat'], 'col': m['col'], 'shape': CU['shapes'].get(m['id']),
         'rx': any(x['rx'] for x in vars_), 'vars': vars_}
    for x in vars_: del x['rx']
    if m['id'] in CU.get('parts', {}): p['parts'] = CU['parts'][m['id']]
    if m['id'] in CU.get('accessory', {}): p['acc'] = CU['accessory'][m['id']]
    products.append(p)
BY = {p['id']: p for p in products}
assert sum(len(p['vars']) for p in products) == S['count'], 'el catálogo no cubre todos los productos de origen'

money = lambda n: '$' + f'{round(n):,}'.replace(',', '.')
transfer = lambda n: round(n * (1 - TRANSFER_OFF))
def type_label(p): return ('Colección ' + p['col']) if p['cat'] == 'sol' and p['col'] else CATEGORIES[p['cat']]
def product_url(p, vi=0): return '/producto/' + p['id'] + '.html' + ('?color=' + p['vars'][vi]['slug'] if vi else '')
def first_stock(p): return next((i for i, v in enumerate(p['vars']) if v['stock']), 0)
def wa(text): return 'https://wa.me/' + WA_NUMBER + '?text=' + urllib.parse.quote(text)

DATA_JS = (T / 'data.tpl.js').read_text()
STORE = {'transferOff': TRANSFER_OFF, 'installments': INSTALLMENTS, 'cards': CARDS, 'waNumber': WA_NUMBER, 'instagram': INSTAGRAM, 'email': EMAIL,
         'synced': S['fetched'], 'demo': True}
DATA_JS = (DATA_JS.replace('/*STORE*/', json.dumps(STORE, ensure_ascii=False))
                  .replace('/*PRODUCTS*/', json.dumps(products, ensure_ascii=False, separators=(',', ':')))
                  .replace('/*FEATURED*/', json.dumps([f for f in CU['featured'] if f in BY])))
(root / 'js/data.js').write_text(DATA_JS)

# ---------- Partes compartidas ----------
PARTS = {n: (T / f'_{n}.html').read_text() for n in ('sprite', 'header', 'footer')}

def nav_items(active, drawer=False):
    out = []
    pages = [('all', 'catalogo', 'Catálogo')] + [(k, CAT_PAGE[k], CATEGORIES[k]) for k in ('sol', 'pol', 'arm', 'clip', 'acc')]
    for k, slug_, name in pages:
        cur = ' aria-current="page"' if active == k else ''
        if drawer:
            out.append(f'<li><a href="/{slug_}.html"{cur}>{name} <svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg></a></li>')
        else:
            out.append(f'<li><a href="/{slug_}.html"{cur}>{name}</a></li>')
    return '\n        '.join(out)

def page(path, title, desc, body, css=('pages',), js=(), active=None, jsonld=None, preload='', robots=None, og_image='/assets/img/hero-ink-desk.webp', chrome=True):
    canonical = SITE_URL + ('/' if path == 'index.html' else '/' + path)
    head = f'''<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
''' + (f'<meta name="robots" content="{robots}">\n' if robots else f'<link rel="canonical" href="{canonical}">\n') + f'''<meta property="og:site_name" content="Sunnygafas">
<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:image" content="{SITE_URL}{og_image}">
<meta property="og:locale" content="es_AR">
<meta name="theme-color" content="#1E1A16">
<link rel="icon" href="/assets/img/isotipo-sunnygafas.png">
<link rel="preload" href="/fonts/bodoni-moda-latin-opsz.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/hanken-grotesk-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
{preload}<link rel="stylesheet" href="/css/tokens.css">
<link rel="stylesheet" href="/css/site.css">
''' + ''.join(f'<link rel="stylesheet" href="/css/{c}.css">\n' for c in css) + (f'<script type="application/ld+json">{json.dumps(jsonld, ensure_ascii=False)}</script>\n' if jsonld else '') + '</head>\n<body>\n'
    header = PARTS['header'].replace('{{NAV}}', nav_items(active)).replace('{{DRAWER_NAV}}', nav_items(active, True))
    scripts = '<script src="/js/data.js"></script>\n<script src="/js/site.js"></script>\n' + ''.join(f'<script src="/js/{j}.js"></script>\n' for j in js)
    out = head + PARTS['sprite'] + header + body + PARTS['footer'] + scripts + '</body>\n</html>\n'
    out = (out.replace('{{WA}}', 'https://wa.me/' + WA_NUMBER).replace('{{WA_HOLA}}', wa('Hola, quiero hacer una consulta.'))
              .replace('{{WA_CAMBIO}}', wa('Hola, quiero pedir un cambio. Mi número de pedido es: '))
              .replace('{{WA_MEDIDAS}}', wa('Hola, quiero ayuda con el tamaño. Estoy mirando el modelo: '))
              .replace('{{WA_ENVIO}}', wa('Hola, quiero consultar por el envío a mi código postal: '))
              .replace('{{WA_ELEGIR}}', wa('Hola, quiero ayuda para elegir unas gafas.'))
              .replace('{{INSTAGRAM}}', INSTAGRAM).replace('{{EMAIL}}', EMAIL)
              .replace('{{CARDS}}', ', '.join(CARDS[:-1]) + ' y ' + CARDS[-1]).replace('{{N_MODELS}}', str(len(products)))
              .replace('{{N_VARIANTS}}', str(sum(len(p['vars']) for p in products))))
    left = re.findall(r'\{\{[A-Z_]+\}\}', out)
    assert not left, (path, left)
    f = root / path
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(out)

ORG = {'@context': 'https://schema.org', '@type': 'Organization', 'name': 'Sunnygafas', 'url': SITE_URL,
       'logo': SITE_URL + '/assets/img/isotipo-sunnygafas.png', 'sameAs': [INSTAGRAM],
       'contactPoint': {'@type': 'ContactPoint', 'contactType': 'customer service', 'telephone': '+' + WA_NUMBER, 'availableLanguage': 'es'}}

FAQ = json.load(open(T / 'faq.json'))
def faq_html(prefix):
    out = []
    for i, q in enumerate(FAQ, 1):
        out.append(f'''        <div class="faq__item">
          <h3 class="faq__q"><button type="button" aria-expanded="false" aria-controls="{prefix}{i}" id="{prefix}{i}b">{q['q']}<svg class="icon" aria-hidden="true"><use href="#i-plus"/></svg></button></h3>
          <div class="faq__a" id="{prefix}{i}" role="region" aria-labelledby="{prefix}{i}b" hidden><div><p>{q['a']}</p></div></div>
        </div>''')
    return '\n'.join(out)

# ---------- Home ----------
COUNTS = {k: sum(1 for p in products if p['cat'] == k) for k in CATEGORIES}
home = (T / 'home.html').read_text()
for k, n in COUNTS.items(): home = home.replace('{{N_' + k.upper() + '}}', f'{n} modelo' + ('s' if n != 1 else ''))
home = home.replace('{{FAQ}}', faq_html('faq'))
page('index.html', 'Sunnygafas · Gafas de sol, polarizadas, armazones y clip-on',
     'Gafas de sol, polarizadas, armazones, clip-on 2 en 1 y accesorios. Mirá cómo quedan puestas, elegí modelo y color, y comprá en Sunnygafas.',
     home, css=('home', 'compare'), js=('home', 'compare'), jsonld=[ORG, {'@context': 'https://schema.org', '@type': 'WebSite', 'name': 'Sunnygafas', 'url': SITE_URL}],
     preload='<link rel="preload" href="/assets/img/hero-ink-desk.webp" as="image" media="(min-width: 761px)">\n<link rel="preload" href="/assets/img/hero-ink-mob.webp" as="image" media="(max-width: 760px)">\n')

# ---------- Catálogo ----------
CAT_TPL = (T / 'catalogo.html').read_text()
CAT_COPY = {
 'sol': ('Gafas de sol', 'Gafas de sol por forma, color y colección: Básica, Esencial, Superior y Élite.',
         'Cuatro colecciones con precio por colección. Filtrá por forma, color o colección y abrí cada modelo para ver sus fotos y colores.'),
 'pol': ('Gafas polarizadas', 'Gafas con lentes polarizados, que reducen el reflejo del agua y el asfalto.',
         'Los lentes polarizados reducen el reflejo de superficies como el agua y el asfalto. En cada ficha figura el tipo de lente de ese modelo.'),
 'arm': ('Armazones', 'Armazones para lentes con graduación, en acetato, policarbonato, metal y TR90.',
         'Armazones para tus lentes con graduación. Si querés que te presupuestemos los cristales, consultanos desde la ficha del modelo.'),
 'clip': ('Clip-on 2 en 1', 'Armazones con clip de sol: el mismo par sirve para ver y para el sol.',
          'Un armazón para tus lentes y un clip de sol que se coloca encima. En cada ficha figura qué incluye el modelo y qué característica tiene cada pieza.'),
 'acc': ('Accesorios', 'Cadenas para gafas y un organizador portátil.',
         'Cadenas para llevar tus gafas cuando no las usás y un organizador para guardarlas.'),
}
SYNCED = S['fetched'].split(' ')[0]; SYNCED = '/'.join(reversed(SYNCED.split('-')))
def catalog_page(path, cat, title, desc, intro, robots=None):
    extra = (T / '_compare.html').read_text() if cat == 'pol' else ''
    body = (CAT_TPL.replace('{{CAT}}', cat or '').replace('{{H1}}', title).replace('{{INTRO}}', intro).replace('{{EXTRA}}', extra)
            .replace('{{CRUMB}}', title).replace('{{SYNCED}}', SYNCED))
    items = [p for p in products if not cat or p['cat'] == cat]
    ld = {'@context': 'https://schema.org', '@type': 'CollectionPage', 'name': title, 'url': SITE_URL + '/' + path,
          'mainEntity': {'@type': 'ItemList', 'numberOfItems': len(items), 'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'url': SITE_URL + product_url(p)} for i, p in enumerate(items[:60])]},
          'breadcrumb': {'@type': 'BreadcrumbList', 'itemListElement': [
              {'@type': 'ListItem', 'position': 1, 'name': 'Inicio', 'item': SITE_URL + '/'},
              {'@type': 'ListItem', 'position': 2, 'name': title, 'item': SITE_URL + '/' + path}]}}
    page(path, title + ' · Sunnygafas', desc, body, css=('pages', 'compare') if cat == 'pol' else ('pages',), js=('catalog', 'compare') if cat == 'pol' else ('catalog',),
         active=cat or 'all', jsonld=ld, robots=robots)
for cat, (t, d, intro) in CAT_COPY.items():
    catalog_page(CAT_PAGE[cat] + '.html', cat, t, d, intro)
catalog_page('catalogo.html', None, 'Catálogo', f'Todo el catálogo de Sunnygafas: {len(products)} modelos de gafas de sol, polarizadas, armazones, clip-on y accesorios.',
             f'{len(products)} modelos y {sum(len(p["vars"]) for p in products)} colores. Filtrá por tipo, forma, color o disponibilidad.')

# ---------- Fichas ----------
PDP_TPL = (T / 'producto.html').read_text()
for p in products:
    vi = first_stock(p); v = p['vars'][vi]
    acc = p['cat'] == 'acc'
    colors = ', '.join(x['label'].lower() for x in p['vars'])
    kind = type_label(p)
    title = f"{p['name']} · {kind} · Sunnygafas"
    desc = (f"{p['name']} en {colors}. " if len(p['vars']) > 1 else f"{p['name']}. ") + \
           f"{money(transfer(v['price']))} con transferencia o efectivo, {money(v['price'])} de lista. " + (v['desc'] or '')
    desc = desc[:158].rsplit(' ', 1)[0] + '…' if len(desc) > 158 else desc.strip()
    ld = [{'@context': 'https://schema.org', '@type': 'ProductGroup', 'name': p['name'], 'category': CATEGORIES[p['cat']],
           'brand': {'@type': 'Brand', 'name': 'Sunnygafas'}, 'url': SITE_URL + product_url(p), 'productGroupID': p['id'], 'variesBy': ['https://schema.org/color'],
           'hasVariant': [{'@type': 'Product', 'name': p['name'] + ' ' + x['label'], 'sku': x['sku'], 'color': x['label'],
                           'image': SITE_URL + '/assets/img/p/' + x['gal'][0]['f'] + '.webp', **({'description': x['desc']} if x['desc'] else {}),
                           'offers': {'@type': 'Offer', 'price': x['price'], 'priceCurrency': 'ARS', 'url': SITE_URL + product_url(p, i),
                                      'availability': 'https://schema.org/' + ('InStock' if x['stock'] else 'OutOfStock'), 'itemCondition': 'https://schema.org/NewCondition'}}
                          for i, x in enumerate(p['vars'])]},
          {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
              {'@type': 'ListItem', 'position': 1, 'name': 'Inicio', 'item': SITE_URL + '/'},
              {'@type': 'ListItem', 'position': 2, 'name': CATEGORIES[p['cat']], 'item': SITE_URL + '/' + CAT_PAGE[p['cat']] + '.html'},
              {'@type': 'ListItem', 'position': 3, 'name': p['name'], 'item': SITE_URL + product_url(p)}]}]
    g0 = v['gal'][0]
    body = (PDP_TPL.replace('{{ID}}', p['id']).replace('{{NAME}}', html.escape(p['name'])).replace('{{KIND}}', html.escape(kind))
            .replace('{{CAT_NAME}}', CATEGORIES[p['cat']]).replace('{{CAT_URL}}', '/' + CAT_PAGE[p['cat']] + '.html')
            .replace('{{VARIANT}}', html.escape(v['label'])).replace('{{PRICE_T}}', money(transfer(v['price']))).replace('{{PRICE_L}}', money(v['price'])))
    # Precarga solo la foto que se va a ver: con ?color= en la URL, la de esa variante (no la del primer color)
    if len(p['vars']) > 1:
        first = json.dumps({x['slug']: x['gal'][0]['f'] for x in p['vars']}, ensure_ascii=False, separators=(',', ':'))
        preload = ('<script>(function(){var m=' + first + ',c=(new URLSearchParams(location.search).get("color")||"").toLowerCase(),l=document.createElement("link");'
                   'l.rel="preload";l.as="image";l.fetchPriority="high";l.href="/assets/img/p/"+(m[c]||"' + v['gal'][0]['f'] + '")+".webp";document.head.appendChild(l)})()</script>\n')
    else:
        preload = f'<link rel="preload" href="/assets/img/p/{g0["f"]}.webp" as="image" fetchpriority="high">\n'
    page('producto/' + p['id'] + '.html', title, desc, body, js=('product',), active=p['cat'], jsonld=ld,
         preload=preload, og_image='/assets/img/p/' + g0['f'] + '.webp')

# Fichas de modelos que ya no están en el catálogo: se retiran para que respondan 404
for f in (root / 'producto').glob('*.html'):
    if f.stem not in BY: f.unlink()

# ---------- Carrito, checkout y confirmación ----------
page('carrito.html', 'Carrito · Sunnygafas', 'Revisá los productos de tu carrito.', (T / 'carrito.html').read_text(), css=('pages', 'checkout'), js=('cart',), robots='noindex')
page('checkout.html', 'Finalizar compra · Sunnygafas', 'Datos de contacto, entrega y pago.', (T / 'checkout.html').read_text(), css=('pages', 'checkout'), js=('checkout',), robots='noindex')
page('pedido.html', 'Pedido de prueba · Sunnygafas', 'Resumen del pedido.', (T / 'pedido.html').read_text(), css=('pages', 'checkout'), js=('order',), robots='noindex')

# ---------- Guía, ayuda, arrepentimiento, 404 y compatibilidad ----------
page('guia-de-calce.html', 'Guía de calce · Sunnygafas', 'Cómo leer las tres medidas de una montura (lente, puente y varilla) y compararlas con unas gafas que ya te queden cómodas.',
     (T / 'guia.html').read_text(), js=('guide',))
page('ayuda.html', 'Ayuda · Sunnygafas', 'Cómo comprar, envíos, medios de pago, cambios y arrepentimiento en Sunnygafas.', (T / 'ayuda.html').read_text().replace('{{FAQ}}', faq_html('aq')),
     jsonld={'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': q['q'], 'acceptedAnswer': {'@type': 'Answer', 'text': re.sub('<[^>]+>', '', q['a']).replace('{{CARDS}}', ', '.join(CARDS[:-1]) + ' y ' + CARDS[-1])}} for q in FAQ]})
page('arrepentimiento.html', 'Botón de arrepentimiento · Sunnygafas', 'Solicitá la revocación de tu compra.', (T / 'arrepentimiento.html').read_text(), css=('pages', 'checkout'), js=('regret',))
page('404.html', 'No encontramos esta página · Sunnygafas', 'No encontramos esta página.', (T / '404.html').read_text(), robots='noindex')
(root / 'demo.html').write_text((T / 'demo.html').read_text())

# ---------- Publicación ----------
urls = ['', 'catalogo.html', 'guia-de-calce.html', 'ayuda.html', 'arrepentimiento.html'] + [CAT_PAGE[c] + '.html' for c in CAT_PAGE] + ['producto/' + p['id'] + '.html' for p in products]
day = S['fetched'].split(' ')[0]
(root / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    ''.join(f'  <url><loc>{SITE_URL}/{u}</loc><lastmod>{day}</lastmod></url>\n' for u in urls) + '</urlset>\n')
(root / 'robots.txt').write_text(f'User-agent: *\nAllow: /\nDisallow: /demo.html\nDisallow: /carrito.html\nDisallow: /checkout.html\nDisallow: /pedido.html\nSitemap: {SITE_URL}/sitemap.xml\n')
# Redirecciones de fichas con identificador anterior (enlaces ya compartidos)
OLD = {'saturday': 'saturday-xl', 'ambar': 'ambar-clip-on', 'aviador-pol': 'aviador-polarizado', 'cateye6': 'cat-eye-6-en-1', 'ciclismo': 'ciclismo-fotocromaticos',
       'greyjack': 'grey-jack', 'lennon': 'lennon-clip-on', 'cadena-beige': 'cadena-de-acrilico', 'cadena-caramel': 'cadena-de-acrilico?color=caramelo',
       'cadena-black': 'cadena-de-acrilico?color=negro', 'cadena-gold': 'cadena-metalica', 'cadena-silver': 'cadena-metalica?color=plateado',
       'cadena-rose': 'cadena-metalica?color=rose', 'cadena-gris': 'cadena-metalica?color=gris'}
def to_url(t):
    i, _, q = t.partition('?'); assert i in BY, t
    return '/producto/' + i + '.html' + ('?' + q if q else '')
(root / '_redirects').write_text(''.join(f'/producto/{a}.html  {to_url(b)}  301\n/producto/{a}  {to_url(b)}  301\n' for a, b in OLD.items()))
(root / '_headers').write_text('/assets/*\n  Cache-Control: public, max-age=604800\n/fonts/*\n  Cache-Control: public, max-age=31536000, immutable\n')

nv = sum(len(p['vars']) for p in products)
print(len(products), 'modelos,', nv, 'variantes,', sum(1 for p in products for v in p['vars'] if not v['stock']), 'sin stock ·', COUNTS)
