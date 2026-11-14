"""Lee de la tienda de origen (páginas públicas) todos los productos publicados.

  uso: python3 tools/sync_store.py [carpeta_cache]

  Fuente: https://sunnygafas.empretienda.com.ar — su sitemap lista cada producto; en la tienda cada color
  es un producto propio. Por cada uno guarda nombre, categoría, precio, stock (cantidad), descripción y fotos.
  Escribe tools/store-snapshot.json. El agrupamiento en modelos y variantes lo hace tools/catalog.py.

  La tienda de origen se usa solo como fuente de datos: el sitio no enlaza compras hacia ella.
"""
import re, json, html, subprocess, sys, time, pathlib, datetime

root = pathlib.Path(__file__).resolve().parent.parent
STORE = 'https://sunnygafas.empretienda.com.ar'
cache = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else root / '.cache' / 'store'
(cache / 'pages').mkdir(parents=True, exist_ok=True)
UA = 'Mozilla/5.0 (compatible; sunnygafas-sync)'
IMG = re.compile(r'(?:data-src|src|href)="(https://d22fxaf9t8d39k\.cloudfront\.net/[0-9a-f]+204332\.(?:jpg|jpeg|png|webp))"')

def fetch(url, dest=None):
    args = ['curl', '-sS', '-L', '-m', '30', '-A', UA, url]
    if dest: args[1:1] = ['-o', str(dest)]
    return subprocess.run(args, capture_output=True, text=True).stdout

sm = fetch(STORE + '/sitemap.xml')
(cache / 'sitemap.xml').write_text(sm)
locs = re.findall(r'<loc>([^<]+)</loc>', sm)
cands = [u for u in locs if u.rstrip('/').count('/') >= 4]

out = {'fetched': datetime.datetime.now().strftime('%Y-%m-%d %H:%M'), 'store': STORE, 'sitemap_urls': len(locs),
       'products': [], 'not_products': []}
for i, u in enumerate(cands):
    path = u.split('.com.ar', 1)[1].strip('/')
    f = cache / 'pages' / (path.replace('/', '__') + '.html')
    fetch(u, f); time.sleep(0.3)
    s = f.read_text(encoding='utf-8', errors='ignore')
    sp = re.search(r'var s_producto = (\{.*?\});', s)
    if not sp:
        out['not_products'].append(path); continue           # páginas de colección
    sp = json.loads(sp.group(1))
    st = re.search(r'\bstock = (\[.*?\]);', s)
    st = json.loads(st.group(1)) if st else []
    qty = sum(x.get('s_cantidad') or 0 for x in st); unlimited = any(x.get('s_ilimitado') for x in st)
    t = re.search(r'<meta property="og:title" content="([^"]*)"', s)
    d = re.search(r'product-vip__description[^>]*>(.*?)</div>\s*</div>', s, re.S)
    desc = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', d.group(1)))).strip() if d else ''
    imgs = []
    for x in IMG.findall(s):
        if x not in imgs: imgs.append(x)
    out['products'].append({'slug': path.rsplit('/', 1)[1], 'path': path, 'url': u, 'name': html.unescape(t.group(1)).strip() if t else path,
                            'price': sp.get('precio'), 'price_before': sp.get('precio_anterior'), 'sale': sp.get('sale_off'),
                            'stock': bool(sp.get('stock')), 'qty': None if unlimited else qty, 'desc': desc, 'imgs': imgs})
    if i % 40 == 0: print(i, '/', len(cands), flush=True)
# Imágenes de plantilla de la tienda (logo y banner): aparecen en casi todos los productos y no muestran el producto
import collections
seen = collections.Counter(u for x in out['products'] for u in x['imgs'])
template = {u for u, n in seen.items() if n > 10}
for x in out['products']:
    x['imgs'] = [u for u in x['imgs'] if u not in template]
out['template_images_removed'] = len(template)
out['count'] = len(out['products'])
json.dump(out, open(root / 'tools/store-snapshot.json', 'w'), ensure_ascii=False, indent=1)
print(out['count'], 'productos ·', sum(1 for p in out['products'] if not p['stock']), 'sin stock ·', len(out['not_products']), 'páginas que no son producto')
