"""Prepara las fotos del sitio a partir de las galerías oficiales descargadas.

  uso: python3 tools/images.py <carpeta_con_galerias> [carpeta_recortes_previos]

  Recorre tools/catalog.json (todas las variantes). Las fotos ya preparadas se conservan.
  - assets/img/p/<slug>-<n>.webp   galería de ficha (hasta 6 fotos, lado mayor <= 900 px)
  - assets/img/card/<slug>.webp    tarjeta 720x612 con criterio común:
        foto de estudio (fondo claro y parejo)  -> se recorta al producto, se lleva el fondo a blanco
                                                  y se centra con la misma escala aparente
        foto de ambiente                         -> recorte previo curado si existe; si no, recorte centrado
  No se retoca forma, color ni textura de la montura.
"""
import json, pathlib, sys, glob
from PIL import Image, ImageFilter, ImageChops, ImageOps

root = pathlib.Path(__file__).resolve().parent.parent
src = pathlib.Path(sys.argv[1])
prev = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else None
M = json.load(open(root / 'tools/catalog.json'))
PREV_CARDS = {'yanis-print': 'yanis-print'}   # recortes curados a mano en una etapa anterior
P = root / 'assets/img/p'; C = root / 'assets/img/card'
P.mkdir(parents=True, exist_ok=True); C.mkdir(parents=True, exist_ok=True)
CW, CH = 720, 612

def load(f):
    im = Image.open(f)
    im = ImageOps.exif_transpose(im)
    if im.mode in ('RGBA', 'LA', 'P'):
        im = im.convert('RGBA'); bg = Image.new('RGBA', im.size, 'white'); bg.alpha_composite(im); im = bg
    return im.convert('RGB')

def border_stats(im):
    """Mediana y dispersión del marco exterior: detecta fondo de estudio claro."""
    w, h = im.size; t = max(2, min(w, h) // 40)
    px = []
    g = im.convert('L')
    for box in ((0, 0, w, t), (0, h - t, w, h), (0, 0, t, h), (w - t, 0, w, h)):
        px += list(g.crop(box).getdata())
    px.sort()
    med = px[len(px) // 2]; lo = px[len(px) // 20]
    return med, lo

def studio_card(im):
    """Recorta al producto y lo centra a escala común sobre blanco."""
    g = im.convert('L').filter(ImageFilter.GaussianBlur(2))
    med, _ = border_stats(im)
    # nivela: el fondo pasa a blanco puro sin tocar los tonos del producto más que en luz general
    k = 255.0 / max(med, 200)
    im2 = im.point(lambda v: min(255, int(v * k)))
    mask = g.point(lambda v: 255 if v < med - 22 else 0)
    bb = mask.getbbox()
    if not bb:
        return None
    x0, y0, x1, y1 = bb
    bw, bh = x1 - x0, y1 - y0
    if bw < im.size[0] * 0.15:
        return None
    pad = int(max(bw, bh) * 0.04)
    crop = im2.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.size[0], x1 + pad), min(im.size[1], y1 + pad)))
    s = min(CW * 0.80 / crop.size[0], CH * 0.66 / crop.size[1])
    crop = crop.resize((max(1, round(crop.size[0] * s)), max(1, round(crop.size[1] * s))), Image.LANCZOS)
    card = Image.new('RGB', (CW, CH), 'white')
    card.paste(crop, ((CW - crop.size[0]) // 2, (CH - crop.size[1]) // 2 + 6))
    # funde el borde del recorte con el blanco
    return card

def gallery_crop(im):
    """En fotos de estudio recorta el aire blanco sobrante para que la montura se vea a buena escala en la ficha."""
    med, lo = border_stats(im)
    if not (med >= 236 and lo >= 205):
        return im.copy()
    g = im.convert('L').filter(ImageFilter.GaussianBlur(2))
    bb = g.point(lambda v: 255 if v < med - 22 else 0).getbbox()
    if not bb:
        return im.copy()
    x0, y0, x1, y1 = bb
    bw, bh = x1 - x0, y1 - y0
    px, py = int(bw * 0.14), int(max(bh * 0.30, bw * 0.12))
    return im.crop((max(0, x0 - px), max(0, y0 - py), min(im.size[0], x1 + px), min(im.size[1], y1 + py)))

def cover_card(im):
    return ImageOps.fit(im, (CW, CH), Image.LANCZOS, centering=(0.5, 0.5))

report = []
for m in M['models']:
    for v in m['vars']:
        s = v['src']
        files = sorted(glob.glob(str(src / f'{s}__*.*')), key=lambda f: int(f.rsplit('__', 1)[1].split('.')[0]))
        gal, card, how = [], None, 'conservada'
        cpath = C / f'{s}.webp'
        for k, f in enumerate(files[:6], 1):
            out = P / f'{s}-{k}.webp'
            if not out.exists():
                im = load(f)
                g = gallery_crop(im); g.thumbnail((900, 900), Image.LANCZOS)
                g.save(out, quality=78, method=6)
            with Image.open(out) as g:
                gal.append({'f': f'{s}-{k}', 'w': g.size[0], 'h': g.size[1]})
            if not cpath.exists() and card is None:
                im = load(f); med, lo = border_stats(im)
                if med >= 236 and lo >= 205:
                    card = studio_card(im); how = f'estudio (foto {k})' if card else ''
        if not cpath.exists():
            if card is None:
                card = cover_card(load(files[0])); how = 'ambiente, recorte centrado'
            card.save(cpath, quality=82, method=6)
        report.append({'s': s, 'card': how, 'gal': gal})
json.dump(report, open(root / 'tools/images-report.json', 'w'), indent=1)
import collections
print(collections.Counter(r['card'].split(' (')[0] for r in report))
