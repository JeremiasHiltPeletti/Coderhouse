"""Agrupa los productos de la tienda de origen en modelos con variantes de color.

  uso: python3 tools/catalog.py            (lee tools/store-snapshot.json y tools/curation.json)

  En la tienda de origen cada color es un producto. Acá se agrupan los colores de un mismo modelo:
  - el color sale de las palabras finales del nombre («Gala print» → Gala · Print;
    «Shein print black» → Shein · Print negro);
  - dos productos son el mismo modelo si comparten nombre base y colección (Saturday XL de la colección
    Básica y Saturday XL de la Superior tienen otro precio y otra colección: quedan como modelos distintos);
  - tools/curation.json corrige los casos que la regla no resuelve (overrides por producto).
  Cada variante conserva su precio, stock, fotos, descripción y producto de origen.
  Escribe tools/catalog.json.
"""
import json, pathlib, re, unicodedata, collections

root = pathlib.Path(__file__).resolve().parent.parent
S = json.load(open(root / 'tools/store-snapshot.json'))
C = json.load(open(root / 'tools/curation.json'))

# Palabras de color (en el nombre de origen) → etiqueta en castellano
COLOR = {'black': 'Negro', 'negro': 'Negro', 'brown': 'Marrón', 'grey': 'Gris', 'gray': 'Gris', 'print': 'Print', 'carey': 'Carey',
         'clear': 'Transparente', 'gold': 'Dorado', 'silver': 'Plateado', 'rose': 'Rosé', 'pink': 'Rosa', 'blue': 'Azul', 'green': 'Verde',
         'yellow': 'Amarillo', 'violet': 'Violeta', 'red': 'Rojo', 'beige': 'Beige', 'white': 'Blanco', 'aqua': 'Aqua', 'caramel': 'Caramelo',
         'caramelo': 'Caramelo', 'tea': 'Té', 'nude': 'Nude', 'mate': 'Mate', 'degrade': 'Degradé', 'orange': 'Naranja'}
# Familia para el filtro de color
FAMILY = {'Negro': 'Negro', 'Mate': 'Negro', 'Marrón': 'Marrón', 'Caramelo': 'Marrón', 'Té': 'Marrón', 'Carey': 'Carey y print', 'Print': 'Carey y print',
          'Gris': 'Gris y plateado', 'Plateado': 'Gris y plateado', 'Dorado': 'Dorado', 'Beige': 'Claros', 'Nude': 'Claros', 'Transparente': 'Claros',
          'Blanco': 'Claros', 'Degradé': 'Negro'}
CAT = {'gafas-de-sol': 'sol', 'gafas-polarizadas': 'pol', 'armazones': 'arm', '2-en-1-clipon': 'clip', 'accesorios': 'acc'}
COL = {'coleccion-basica': 'Básica', 'coleccion-esencial': 'Esencial', 'coleccion-superior': 'Superior', 'coleccion-elite': 'Élite'}

def slug(t):
    t = unicodedata.normalize('NFD', t).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', t).strip('-')

def split_name(name):
    """«Shein print black» → ('Shein', ['Print', 'Negro'])"""
    words = re.sub(r'\(.*?\)', '', name).split()
    tail = []
    while len(words) > 1 and slug(words[-1]) in COLOR:
        tail.insert(0, COLOR[slug(words.pop())])
    return ' '.join(words), tail

def label_of(tail):
    if not tail: return None
    if tail == ['Mate']: return 'Negro mate'
    out = ' '.join(tail)
    return out[0] + out[1:].lower()

groups = collections.OrderedDict()
for p in S['products']:
    parts = p['path'].split('/')
    cat = CAT[parts[0]]; col = COL.get(parts[1]) if len(parts) > 2 else None
    ov = C['overrides'].get(p['slug'], {})
    base, tail = split_name(p['name'])
    base = ov.get('model', base)
    label = ov.get('label') or label_of(tail)
    key = (slug(base), cat, col)
    groups.setdefault(key, {'name': base, 'cat': cat, 'col': col, 'items': []})['items'].append((p, label, ov))

models, taken = [], collections.Counter()
for (b, cat, col), g in groups.items():
    taken[b] += 1
for (b, cat, col), g in groups.items():
    mid = b if taken[b] == 1 else b + '-' + slug(col or {'pol': 'polarizadas', 'arm': 'armazon', 'clip': 'clip-on', 'acc': 'accesorio', 'sol': 'sol'}[cat])
    mid = C['ids'].get(mid, mid)
    vars_ = []
    for p, label, ov in g['items']:
        if not label:
            label = C['labels'].get(p['slug'])          # color tomado de la descripción, revisado a mano
        vars_.append({'src': p['slug'], 'label': label or 'Único', 'family': FAMILY.get((label or '').split()[0], 'Color') if label else 'Color'})
    # orden: primero con stock, después alfabético; el color del nombre original manda si hay uno solo
    order = C['order'].get(mid)
    if order: vars_.sort(key=lambda v: order.index(v['src']) if v['src'] in order else 99)
    models.append({'id': mid, 'name': C['names'].get(mid, g['name']), 'cat': cat, 'col': col, 'vars': vars_})

# etiquetas duplicadas dentro de un modelo: se desambiguan con la descripción revisada
for m in models:
    seen = collections.Counter(v['label'] for v in m['vars'])
    dup = [k for k, n in seen.items() if n > 1]
    if dup: print('ETIQUETA REPETIDA', m['id'], dup)

json.dump({'source_count': S['count'], 'fetched': S['fetched'], 'models': models}, open(root / 'tools/catalog.json', 'w'), ensure_ascii=False, indent=1)
n = sum(len(m['vars']) for m in models)
print(len(models), 'modelos ·', n, 'variantes (origen:', S['count'], 'productos)', '· por categoría:', dict(collections.Counter(m['cat'] for m in models)))
assert n == S['count'], 'faltan productos'
