# Arma assets/app.js (con el sprite de íconos) y assets/proto.css a partir de las fuentes del prototipo.
import pathlib
root = pathlib.Path(__file__).resolve().parent.parent
sprite = (root / 'assets/_sprite.txt').read_text().replace("'", "\\'").replace('\n', ' ')
src = (root / 'prototipo/app.src.js').read_text()
(root / 'assets/app.js').write_text(src.replace('/*SPRITE*/', sprite))
css = (root / 'assets/proto-base.css').read_text() + '\n' + (root / 'prototipo/proto-extra.css').read_text()
(root / 'assets/proto.css').write_text(css)
print('ok')
