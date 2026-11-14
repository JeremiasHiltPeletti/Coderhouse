"""Genera el sitio de Sunnygafas.

  uso: python3 tools/build.py

  Entradas
    tools/models.json          curaduría: modelos, colores y ficha oficial de cada variante
    tools/store-snapshot.json  precio, stock y descripción leídos de la tienda (tools/sync_store.py)
    tools/images-report.json   fotos preparadas por tools/images.py
    tools/templates/*.html     cuerpo de cada página

  Salidas (en la raíz del proyecto)
    js/data.js                 catálogo único para Home, búsqueda, catálogo y fichas
    index.html, gafas-de-sol.html, polarizadas.html, armazones.html, clip-on.html, accesorios.html,
    catalogo.html, producto/<modelo>.html, guia-de-calce.html, ayuda.html, 404.html, demo.html,
    sitemap.xml, robots.txt
"""
import json, pathlib, re, html, unicodedata

root = pathlib.Path(__file__).resolve().parent.parent
T = root / 'tools' / 'templates'

# Cuando se conozca el dominio final, cambiá este valor y volvé a generar: actualiza canónicas, sitemap y datos estructurados.
SITE_URL = 'https://sunnygafas-home.netlify.app'
STORE_URL = 'https://sunnygafas.empretienda.com.ar'
WA_NUMBER = '5493454149784'           # destino de https://wa.link/3v8851, el enlace de WhatsApp de la tienda
INSTAGRAM = 'https://instagram.com/sunnygafas'
EMAIL = 'sunny.gafas.ch@gmail.com'
TRANSFER_OFF = 0.25                   # tienda: transfer_discount = 25 (transferencia y efectivo)
INSTALLMENTS = 3                      # tienda: 3 cuotas sin interés

M = json.load(open(root / 'tools/models.json'))
S = json.load(open(root / 'tools/store-snapshot.json'))
IMG = {r['s']: r for r in json.load(open(root / 'tools/images-report.json'))}

CATEGORIES = {'sol': 'Gafas de sol', 'pol': 'Polarizadas', 'arm': 'Armazones', 'clip': 'Clip-on 2 en 1', 'acc': 'Accesorios'}
CAT_PAGE = {'sol': 'gafas-de-sol', 'pol': 'polarizadas', 'arm': 'armazones', 'clip': 'clip-on', 'acc': 'accesorios'}
CAT_STORE = {'sol': '/gafas-de-sol', 'pol': '/gafas-polarizadas', 'arm': '/armazones', 'clip': '/2-en-1-clipon', 'acc': '/accesorios'}
COLLECTION = {'coleccion-basica': 'Básica', 'coleccion-esencial': 'Esencial', 'coleccion-superior': 'Superior', 'coleccion-elite': 'Élite'}
SHAPE_NAME = {'redonda': 'Redonda', 'ovalada': 'Ovalada', 'cuadrada': 'Cuadrada', 'cateye': 'Cat eye', 'aviador': 'Aviador'}

def slug(t):
    t = unicodedata.normalize('NFD', t).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', t).strip('-')

def clean_desc(d):
    """Descripción de la tienda con ortografía pareja. No agrega información."""
    if not d or d.lower().startswith('todo el detalle'):
        return '', False
    rx = bool(re.search(r'presupuesto', d, re.I))
    d = re.split(r'\s*-\s*consult', d, flags=re.I)[0]
    d = re.sub(r'uv\s?4000|uv\s?499|uv\s?400', 'UV400', d, flags=re.I)
    d = re.sub(r'\s+([,.:!])', r'\1', d).replace(' !', '').strip(' -')
    d = re.sub(r'\barmazon\b', 'armazón', d, flags=re.I)
    d = re.sub(r'\bdegrade\b', 'degradé', d, flags=re.I)
    d = re.sub(r'\bmarron\b', 'marrón', d, flags=re.I)
    d = re.sub(r'\bco cristales\b', 'con cristales', d)
    d = d[0].upper() + d[1:]
    if d[-1] not in '.!': d += '.'
    return d, rx

# ---------- Catálogo unificado ----------
products, removed = [], []
for m in M['models']:
    vars_ = []
    for v in m['vars']:
        st = S['variants'].get(v['s'])
        if not st or v['s'] not in IMG:
            removed.append(m['n'] + ' · ' + v.get('label', v['c'])); continue
        desc, rx = clean_desc(st['desc'])
        if v['s'] == 'cadena-gold': desc = ''   # la tienda la describe como «plata claro»: se omite hasta que el comercio la corrija
        desc = v.get('desc') or desc            # texto editorial de la curaduría, si existe
        label = v.get('label', v['c'])
        # Atributos de lente: True = respaldado por la tienda; None = sin confirmar (no se muestra ni se niega).
        # En clip-on los atributos pertenecen a una pieza (armazón o clip): van en «parts», no acá.
        src = st['desc'] + ' ' + st['name']
        lens = {'uv': True if re.search(r'uv\s?4', st['desc'], re.I) else None,
                'polar': True if re.search(r'polari', src, re.I) else None,
                'photo': True if re.search(r'fotocrom', src, re.I) else None}
        if m['cat'] in ('clip', 'acc'): lens = {'uv': None, 'polar': None, 'photo': None}
        lens.update(m.get('lens', {}))
        vars_.append({'c': v['c'], 'label': label, 'slug': slug(label), 'img': v['s'], 'gal': IMG[v['s']]['gal'],
                      'url': st['url'], 'sname': st['name'], 'price': st['price'], 'stock': st['stock'], 'desc': desc, 'rx': rx, **lens})
    if not vars_:
        continue
    col = next((COLLECTION[k] for k in COLLECTION if k in S['variants'][m['vars'][0]['s']]['path']), None)
    prod = {'id': m['id'], 'name': m['n'], 'cat': m['cat'], 'col': col, 'shape': m.get('shape'), 'isNew': bool(m.get('isNew')),
            'rx': any(x['rx'] for x in vars_),     # la tienda ofrece presupuesto de cristales para este modelo
            'vars': vars_}
    for k in ('parts', 'material', 'measures'):
        if m.get(k): prod[k] = m[k]
    for x in vars_: del x['rx']
    products.append(prod)
BY = {p['id']: p for p in products}

money = lambda n: '$' + f'{round(n):,}'.replace(',', '.')
transfer = lambda n: round(n * (1 - TRANSFER_OFF))
def type_label(p): return ('Colección ' + p['col']) if p['cat'] == 'sol' and p['col'] else CATEGORIES[p['cat']]
def product_url(p, vi=0): return '/producto/' + p['id'] + '.html' + ('?color=' + p['vars'][vi]['slug'] if vi else '')
def first_stock(p): return next((i for i, v in enumerate(p['vars']) if v['stock']), 0)
def wa(text): return 'https://wa.me/' + WA_NUMBER + '?text=' + re.sub(r'%20', '%20', __import__('urllib.parse').parse.quote(text))

DATA_JS = (T / 'data.tpl.js').read_text()
DATA_JS = (DATA_JS.replace('/*STORE*/', json.dumps({'url': STORE_URL, 'transferOff': TRANSFER_OFF, 'installments': INSTALLMENTS, 'waNumber': WA_NUMBER,
                                                     'instagram': INSTAGRAM, 'email': EMAIL, 'catStore': CAT_STORE, 'synced': S['fetched'],
                                                     'includes': M.get('pending', {}).get('includes_case_and_cleaner')}, ensure_ascii=False))
                  .replace('/*PRODUCTS*/', json.dumps(products, ensure_ascii=False, separators=(',', ':')))
                  .replace('/*FEATURED*/', json.dumps([f for f in M['featured'] if f in BY])))
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

def page(path, title, desc, body, css=('pages',), js=(), active=None, jsonld=None, preload='', robots=None, og_image='/assets/img/hero-ink-desk.webp'):
    css = tuple(css)
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
              .replace('{{WA_CAMBIO}}', wa('Hola, quiero hacer un cambio. Mi número de pedido es: '))
              .replace('{{WA_MEDIDAS}}', wa('Hola, quiero ayuda con el tamaño. Estoy mirando el modelo: '))
              .replace('{{WA_ENVIO}}', wa('Hola, quiero consultar por las opciones de envío.'))
              .replace('{{INSTAGRAM}}', INSTAGRAM).replace('{{EMAIL}}', EMAIL).replace('{{STORE}}', STORE_URL))
    left = re.findall(r'\{\{[A-Z_]+\}\}', out)
    assert not left, (path, left)
    f = root / path
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(out)

ORG = {'@context': 'https://schema.org', '@type': 'Organization', 'name': 'Sunnygafas', 'url': SITE_URL,
       'logo': SITE_URL + '/assets/img/isotipo-sunnygafas.png', 'sameAs': [INSTAGRAM, STORE_URL],
       'contactPoint': {'@type': 'ContactPoint', 'contactType': 'customer service', 'telephone': '+' + WA_NUMBER, 'availableLanguage': 'es'}}

# ---------- Home ----------
page('index.html', 'Sunnygafas · Gafas de sol, polarizadas y armazones',
     'Explorá gafas de sol, polarizadas, armazones, clip-on 2 en 1 y accesorios. Mirá cómo quedan puestos, elegí el modelo y el color, y comprá en la tienda oficial.',
     (T / 'home.html').read_text(), css=('home',), js=('home',), jsonld=[ORG, {'@context': 'https://schema.org', '@type': 'WebSite', 'name': 'Sunnygafas', 'url': SITE_URL}],
     preload='<link rel="preload" href="/assets/img/hero-ink-desk.webp" as="image" media="(min-width: 761px)">\n<link rel="preload" href="/assets/img/hero-ink-mob.webp" as="image" media="(max-width: 760px)">\n')

# ---------- Catálogo ----------
CAT_TPL = (T / 'catalogo.html').read_text()
CAT_COPY = {
 'sol': ('Gafas de sol', 'Gafas de sol por forma, color y colección: Básica, Esencial, Superior y Élite. Elegí el modelo y comprá en la tienda oficial.',
         'Filtrá por forma, color o colección para encontrar un modelo.', 'Ver todas las gafas de sol en la tienda oficial'),
 'pol': ('Gafas polarizadas', 'Gafas con lentes polarizados, que reducen el reflejo de superficies como el agua y el asfalto.',
         'Los lentes polarizados reducen el reflejo de superficies como el agua y el asfalto. Explorá los modelos y revisá el tipo de lente en cada ficha.', 'Ver todas las polarizadas en la tienda oficial'),
 'arm': ('Armazones', 'Armazones para tus lentes con graduación. Elegí el modelo y el color, y comprá en la tienda oficial.',
         'Elegí un armazón para tus lentes con graduación. Si querés que te presupuestemos los cristales, consultanos desde la ficha del modelo.', 'Ver todos los armazones en la tienda oficial'),
 'clip': ('Clip-on 2 en 1', 'Clip-on 2 en 1: un armazón con un clip de sol que se coloca encima.',
          'Un armazón con un clip de sol que se coloca encima. En cada ficha podés ver qué incluye el modelo.', 'Ver todos los clip-on en la tienda oficial'),
 'acc': ('Accesorios', 'Cadenas para llevar tus gafas cuando no las estás usando.',
         'Cadenas para llevar tus gafas cuando no las estás usando.', 'Ver todos los accesorios en la tienda oficial'),
}
SYNCED = '/'.join(reversed(S['fetched'].split('-')))
def catalog_page(path, cat, title, desc, intro, store_label, robots=None):
    extra = (T / '_compare.html').read_text() if cat == 'pol' else ''
    body = (CAT_TPL.replace('{{CAT}}', cat or '').replace('{{H1}}', title).replace('{{INTRO}}', intro).replace('{{EXTRA}}', extra)
            .replace('{{CRUMB}}', title).replace('{{STORE_CAT}}', STORE_URL + (CAT_STORE.get(cat, ''))).replace('{{STORE_LABEL}}', store_label).replace('{{SYNCED}}', SYNCED))
    n = sum(1 for p in products if not cat or p['cat'] == cat)
    ld = {'@context': 'https://schema.org', '@type': 'CollectionPage', 'name': title, 'url': SITE_URL + '/' + path,
          'breadcrumb': {'@type': 'BreadcrumbList', 'itemListElement': [
              {'@type': 'ListItem', 'position': 1, 'name': 'Inicio', 'item': SITE_URL + '/'},
              {'@type': 'ListItem', 'position': 2, 'name': title, 'item': SITE_URL + '/' + path}]}}
    page(path, title + ' · Sunnygafas', desc, body, css=('pages', 'compare') if cat == 'pol' else ('pages',), js=('catalog', 'compare') if cat == 'pol' else ('catalog',),
         active=cat or 'all', jsonld=ld, robots=robots)
    return n
for cat, (t, d, intro, sl) in CAT_COPY.items():
    catalog_page(CAT_PAGE[cat] + '.html', cat, t, d, intro, sl)
catalog_page('catalogo.html', None, 'Catálogo', 'Una selección de gafas de sol, polarizadas, armazones, clip-on 2 en 1 y accesorios de Sunnygafas.',
             'Explorá una selección de gafas de sol, polarizadas, armazones, clip-on y accesorios. Filtrá por tipo, forma o color.', 'Ver catálogo completo en la tienda oficial')

# ---------- Fichas ----------
PDP_TPL = (T / 'producto.html').read_text()
for p in products:
    vi = first_stock(p); v = p['vars'][vi]
    colors = ', '.join(x['label'].lower() for x in p['vars'])
    acc = p['cat'] == 'acc'
    kind = type_label(p)
    title = f"{p['name']} · {kind} · Sunnygafas"
    desc = (f"{p['name']} en {colors}. " if len(p['vars']) > 1 else (f"{p['name']}. " if acc else f"{p['name']} {v['label'].lower()}. ")) + \
           f"{money(transfer(v['price']))} con transferencia o efectivo, {money(v['price'])} de lista. " + (v['desc'] or 'Mirá las fotos y comprá en la tienda oficial.')
    desc = desc[:158].rsplit(' ', 1)[0] + '…' if len(desc) > 158 else desc
    ld = [{'@context': 'https://schema.org', '@type': 'Product', 'name': p['name'], 'category': CATEGORIES[p['cat']],
           'brand': {'@type': 'Brand', 'name': 'Sunnygafas'}, 'url': SITE_URL + product_url(p),
           'image': [SITE_URL + '/assets/img/p/' + g['f'] + '.webp' for x in p['vars'] for g in x['gal'][:1]],
           **({'description': v['desc']} if v['desc'] else {}),
           'offers': [{'@type': 'Offer', 'name': p['name'] + ' ' + x['label'], 'price': x['price'], 'priceCurrency': 'ARS', 'url': x['url'],
                       'availability': 'https://schema.org/' + ('InStock' if x['stock'] else 'OutOfStock'), 'itemCondition': 'https://schema.org/NewCondition'} for x in p['vars']]},
          {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
              {'@type': 'ListItem', 'position': 1, 'name': 'Inicio', 'item': SITE_URL + '/'},
              {'@type': 'ListItem', 'position': 2, 'name': CATEGORIES[p['cat']], 'item': SITE_URL + '/' + CAT_PAGE[p['cat']] + '.html'},
              {'@type': 'ListItem', 'position': 3, 'name': p['name'], 'item': SITE_URL + product_url(p)}]}]
    g0 = v['gal'][0]
    body = (PDP_TPL.replace('{{ID}}', p['id']).replace('{{NAME}}', html.escape(p['name'])).replace('{{KIND}}', html.escape(kind))
            .replace('{{CAT_NAME}}', CATEGORIES[p['cat']]).replace('{{CAT_URL}}', '/' + CAT_PAGE[p['cat']] + '.html')
            .replace('{{STORE_URL}}', v['url']).replace('{{VARIANT}}', html.escape(v['label']))
            .replace('{{PRICE_T}}', money(transfer(v['price']))).replace('{{PRICE_L}}', money(v['price'])))
    # Precarga solo la foto que se va a ver: con ?color= en la URL, la de esa variante (no la del primer color)
    if len(p['vars']) > 1:
        first = json.dumps({x['slug']: x['gal'][0]['f'] for x in p['vars']}, ensure_ascii=False, separators=(',', ':'))
        preload = ('<script>(function(){var m=' + first + ',c=(new URLSearchParams(location.search).get("color")||"").toLowerCase(),l=document.createElement("link");'
                   'l.rel="preload";l.as="image";l.fetchPriority="high";l.href="/assets/img/p/"+(m[c]||"' + g0['f'] + '")+".webp";document.head.appendChild(l)})()</script>\n')
    else:
        preload = f'<link rel="preload" href="/assets/img/p/{g0["f"]}.webp" as="image" fetchpriority="high">\n'
    page('producto/' + p['id'] + '.html', title, desc, body, js=('product',), active=p['cat'], jsonld=ld,
         preload=preload, og_image='/assets/img/p/' + g0['f'] + '.webp')

# ---------- Guía, ayuda, 404 y compatibilidad con la demo ----------
page('guia-de-calce.html', 'Guía de calce · Sunnygafas', 'Cómo leer las tres medidas de una montura (lente, puente y varilla) y compararlas con unas gafas que ya te queden cómodas.',
     (T / 'guia.html').read_text(), js=('guide',))
# Solo lo que el sitio puede sostener: tarjetas, plazos y política de cambios quedan a validar por la marca (tools/models.json → pending)
FAQ = [('¿Cómo compro?', 'Elegí un modelo y un color en el catálogo. Desde su ficha, tocá «Comprar en la tienda oficial». En Empretienda podés agregar ese color al carrito, elegir el envío y completar el pago.'),
       ('¿Cómo calculo el envío?', 'Abrí el producto en la tienda oficial y buscá «Calculá el costo de envío». Ingresá tu código postal para ver las opciones disponibles antes de pagar.'),
       ('¿Cómo pido un cambio?', 'Escribinos con tu número de pedido para que podamos indicarte los pasos. Para solicitar el arrepentimiento de una compra, usá el enlace «Botón de arrepentimiento» al pie de la tienda oficial.')]
page('ayuda.html', 'Ayuda · Sunnygafas', 'Cómo comprar, calcular el envío o pedir un cambio en Sunnygafas.', (T / 'ayuda.html').read_text(),
     jsonld={'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in FAQ]})
page('404.html', 'No encontramos este modelo · Sunnygafas', 'No encontramos este modelo.', (T / '404.html').read_text(), robots='noindex')
(root / 'demo.html').write_text((T / 'demo.html').read_text())

# ---------- Publicación ----------
urls = ['', 'catalogo.html', 'guia-de-calce.html', 'ayuda.html'] + [CAT_PAGE[c] + '.html' for c in CAT_PAGE] + ['producto/' + p['id'] + '.html' for p in products]
(root / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    ''.join(f'  <url><loc>{SITE_URL}/{u}</loc><lastmod>{S["fetched"]}</lastmod></url>\n' for u in urls) + '</urlset>\n')
(root / 'robots.txt').write_text(f'User-agent: *\nAllow: /\nDisallow: /demo.html\nSitemap: {SITE_URL}/sitemap.xml\n')
(root / '_headers').write_text('/assets/*\n  Cache-Control: public, max-age=604800\n/fonts/*\n  Cache-Control: public, max-age=31536000, immutable\n')

print(len(products), 'modelos,', sum(len(p['vars']) for p in products), 'variantes,', sum(1 for p in products for v in p['vars'] if not v['stock']), 'sin stock; retiradas:', removed)
