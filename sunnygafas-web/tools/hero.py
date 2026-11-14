"""Prepara el retrato del hero sobre fondo tinta.

  uso: python3 tools/hero.py <retrato_original.jpg>

  El retrato de Saturday XL · Print tiene fondo de estudio claro. Se separa el fondo (región clara conectada con los
  bordes), se calcula una transparencia suave en el contorno del pelo y se compone sobre el color tinta del sitio.
  No se toca el interior de la figura: cara, lentes y montura quedan con su color original.
  Salidas: assets/img/hero-ink-desk.webp y assets/img/hero-ink-mob.webp
"""
import sys, pathlib
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

root = pathlib.Path(__file__).resolve().parent.parent
INK = (30, 26, 22)
src = Image.open(sys.argv[1]).convert('RGB')
W, H = src.size
a = np.asarray(src).astype(np.float32)
lum = a.mean(axis=2)
sat = a.max(axis=2) - a.min(axis=2)

# 1 · Fondo: claro, poco saturado y conectado con el borde superior o los laterales
cand = ((lum > 196) & (sat < 26)).astype(np.uint8) * 255
m = Image.fromarray(cand).convert('L')
seeds = [(x, 0) for x in range(0, W, 6)] + [(0, y) for y in range(0, int(H * 0.72), 6)] + [(W - 1, y) for y in range(0, int(H * 0.62), 6)]
for s in seeds:
    if m.getpixel(s) == 255:
        ImageDraw.floodfill(m, s, 128)
bg = np.asarray(m) == 128

# 2 · Franja de contorno: ahí la transparencia sale de la luminosidad (el fondo es lo más claro de la foto)
bgim = Image.fromarray((bg * 255).astype(np.uint8))
near_bg = np.asarray(bgim.filter(ImageFilter.MaxFilter(13))) > 0          # hasta 6 px hacia adentro de la figura
bg_level = float(np.median(lum[bg]))
alpha_l = np.clip((bg_level - 8 - lum) / 70.0, 0, 1)
alpha = np.where(bg, 0.0, np.where(near_bg, alpha_l, 1.0))
alpha = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))).astype(np.float32) / 255
alpha[np.asarray(bgim.filter(ImageFilter.MinFilter(5))) > 0] = 0            # fondo seguro, sin velo

# 3 · Quita el tinte del fondo en los píxeles semitransparentes y compone sobre tinta
B = np.array([bg_level] * 3, dtype=np.float32)
al = np.clip(alpha, 0.02, 1)[..., None]
fg = np.clip((a - (1 - al) * B) / al, 0, 255)
out = fg * alpha[..., None] + np.array(INK, dtype=np.float32) * (1 - alpha[..., None])
cut = Image.fromarray(out.astype(np.uint8))

def export(box, size, name, q=82):
    im = cut.crop(box).resize(size, Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=1.4, percent=60, threshold=2))
    im.save(root / 'assets/img' / name, quality=q, method=6)
    print(name, im.size)

# Escritorio: cara y montura completas, con aire a la izquierda para que el pelo se funda con el panel
export((0, 118, 600, 601), (1200, 966), 'hero-ink-desk.webp')
# Celular: recorte más cerrado sobre las gafas
export((70, 140, 530, 520), (920, 760), 'hero-ink-mob.webp')
cut.save('/tmp/hero-cut-preview.png')
