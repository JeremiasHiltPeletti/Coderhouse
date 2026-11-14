# Arma etapa-4.html: inserta capturas, filas SEO e íconos SVG en etapa-4.src.html.
import pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = (root / 'etapa-4.src.html').read_text()

SHOTS = [
 ('nosotros', 'Quiénes somos', 'Persuade · página de marca', 'Arena-50 con banda <b>ink</b> (quién avala las gafas, con los rayos) y banda <b>mar</b> (dónde encontrarnos). La historia queda en placeholder: no se inventa.'),
 ('ayuda', 'Ayuda y preguntas frecuentes', 'Read', 'Navegación de temas fija (chips en mobile, lateral en desktop), acordeones con las respuestas reales y guía de medidas con el dibujo acotado.'),
 ('contacto', 'Contacto y venta mayorista', 'Operate', 'WhatsApp primero. Formulario de contacto con motivo y número de pedido; solicitud mayorista con validación de CUIT y confirmación en el lugar.'),
 ('blog', 'Blog', 'Read', 'Artículo destacado y grilla con filtro por tema. Cada card dice tema y minutos de lectura.'),
 ('articulo-que-es-uv400', 'Artículo: Qué significa UV400', 'Read', 'Texto completo a 18/30 px y 68ch, índice fijo en desktop, callout gris, productos al pie y "Seguí leyendo".'),
 ('arrepentimiento', 'Botón de arrepentimiento', 'Operate', 'Formulario de tres datos, sin pedir motivo. Al enviar muestra el código de trámite (Res. 424/2020).'),
 ('legal-terminos', 'Términos y condiciones', 'Read', 'Diseño de lectura y estructura de secciones. El texto lo redacta un abogado.'),
 ('404', 'Página 404', 'Persuade', 'Rayos como único dorado, buscador, categorías y recién llegadas para no perder la visita.'),
 ('listado-clip-on', 'Listado: Clip-on 2 en 1', 'Operate', 'Categoría nueva con los 9 modelos reales, de $80.000 a $130.000.'),
]
shots = ''.join(f'''<article class="shot"><header><h3>{t}</h3><span class="mode">{m}</span></header><div class="pair">
<figure><div class="imgbox"><img src="assets/etapa4/m-{k}.webp" alt="{t} en mobile" loading="lazy"></div><figcaption>390 px</figcaption></figure>
<figure><div class="imgbox"><img src="assets/etapa4/d-{k}.webp" alt="{t} en desktop" loading="lazy"></div><figcaption>1440 px</figcaption></figure></div><p class="note">{n}</p></article>''' for k, t, m, n in SHOTS)

ICO = lambda d: f'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;margin-top:2px">{d}</svg>'
CHECK = ICO('<path d="M20 6 9 17l-5-5"/>')
ALERT = ICO('<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>')
out = (src.replace('<!--SHOTS-->', shots)
          .replace('<!--SEO_PAGES-->', (root / 'seo/seo-pages.html').read_text())
          .replace('<!--SEO_POSTS-->', (root / 'seo/seo-posts.html').read_text())
          .replace('✓&nbsp;', CHECK + '&nbsp;').replace('⚠ ', ALERT).replace('✓ ', CHECK)
          .replace('<span class="circ">✓</span>', '<span class="circ">' + CHECK + '</span>')
          .replace('>✓<', '>' + CHECK + '<')
          .replace(', Nested Tabs no', ''))
assert '✓' not in out and '⚠' not in out, 'quedan glifos'
(root / 'etapa-4.html').write_text(out)
print('ok', len(out))
