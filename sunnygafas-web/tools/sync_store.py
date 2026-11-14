"""Lee de la tienda oficial (páginas públicas) el precio, el stock y la descripción de cada variante del sitio.

  uso: python3 tools/sync_store.py [carpeta_cache]

  Fuente: https://sunnygafas.empretienda.com.ar  (cada color es un producto con su propia ficha).
  Escribe tools/store-snapshot.json, que después usa tools/build.py.
  Si una variante de tools/models.json ya no existe en la tienda, queda marcada como faltante y el build la retira.
"""
import re, json, html, subprocess, sys, time, pathlib, datetime, glob

root = pathlib.Path(__file__).resolve().parent.parent
STORE = 'https://sunnygafas.empretienda.com.ar'
cache = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else None
M = json.load(open(root / 'tools/models.json'))

def fetch(url):
    return subprocess.run(['curl', '-sS', '-L', '-m', '30', '-A', 'Mozilla/5.0 (compatible; sunnygafas-sync)', url], capture_output=True, text=True).stdout

# El sitemap público lista la URL oficial de cada producto
if cache and (cache / 'sitemap.xml').exists():
    sm = (cache / 'sitemap.xml').read_text()
else:
    sm = fetch(STORE + '/sitemap.xml')
urls = {u.rstrip('/').rsplit('/', 1)[1]: u for u in re.findall(r'<loc>([^<]+)</loc>', sm) if u.count('/') >= 4}

out = {'fetched': datetime.date.today().isoformat(), 'store': STORE, 'store_products': len(urls), 'variants': {}, 'missing': []}
for m in M['models']:
    for v in m['vars']:
        s = v['s']
        if s not in urls:
            out['missing'].append(s); continue
        page = None
        if cache:
            f = glob.glob(str(cache / 'pages' / ('*__' + s + '.html')))
            if f: page = open(f[0], encoding='utf-8', errors='ignore').read()
        if page is None:
            page = fetch(urls[s]); time.sleep(0.35)
        sp = re.search(r'var s_producto = (\{.*?\});', page)
        if not sp:
            out['missing'].append(s); continue
        sp = json.loads(sp.group(1))
        d = re.search(r'product-vip__description[^>]*>(.*?)</div>\s*</div>', page, re.S)
        desc = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', d.group(1)))).strip() if d else ''
        t = re.search(r'<meta property="og:title" content="([^"]*)"', page)
        out['variants'][s] = {'url': urls[s], 'name': html.unescape(t.group(1)) if t else s, 'price': round(sp['precio']),
                              'stock': bool(sp['stock']), 'desc': desc, 'path': urls[s].split('.com.ar/', 1)[1]}
json.dump(out, open(root / 'tools/store-snapshot.json', 'w'), ensure_ascii=False, indent=1)
print(len(out['variants']), 'variantes;', 'faltan:', out['missing'], '; sin stock:', sum(1 for x in out['variants'].values() if not x['stock']))
