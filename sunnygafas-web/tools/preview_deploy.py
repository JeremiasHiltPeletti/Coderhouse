"""Sube el sitio a Netlify como VISTA PREVIA (deploy en borrador). No toca producción.

  uso: NETLIFY_AUTH_TOKEN=... python3 tools/preview_deploy.py <site_id> [titulo]

  Publica los archivos del sitio (sin tools/ ni README.md) con draft=true: Netlify devuelve una URL
  propia del deploy (https://<id>--<sitio>.netlify.app) y el deploy publicado sigue siendo el anterior.
  Para pasarla a producción hay que publicarla a propósito desde el panel de Netlify.
"""
import hashlib, json, os, pathlib, sys, time, urllib.request

root = pathlib.Path(__file__).resolve().parent.parent
site = sys.argv[1]
title = sys.argv[2] if len(sys.argv) > 2 else 'Vista previa'
API = 'https://api.netlify.com/api/v1'
TOKEN = os.environ.get('NETLIFY_AUTH_TOKEN', 'token')
SKIP = {'tools', 'README.md', '.git', '.netlify', '.gitignore', '.cache'}

def call(method, url, data=None, ctype='application/json', tries=5):
    for k in range(tries):
        try:
            req = urllib.request.Request(url, data=data, method=method, headers={'Authorization': 'Bearer ' + TOKEN, 'Content-Type': ctype})
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read() or b'{}')
        except (OSError, urllib.error.URLError) as e:   # cortes de red: reintenta con espera creciente
            if k == tries - 1: raise
            time.sleep(2 * (k + 1))

files = {}
for f in sorted(root.rglob('*')):
    rel = f.relative_to(root)
    if f.is_file() and rel.parts[0] not in SKIP:
        files['/' + rel.as_posix()] = hashlib.sha1(f.read_bytes()).hexdigest()

d = call('POST', f'{API}/sites/{site}/deploys', json.dumps({'files': files, 'draft': True, 'title': title}).encode())
need = set(d.get('required', []))
print('deploy', d['id'], '· archivos', len(files), '· a subir', len(need))
for path, sha in files.items():
    if sha in need:
        call('PUT', f'{API}/deploys/{d["id"]}/files{urllib.request.quote(path)}', (root / path[1:]).read_bytes(), 'application/octet-stream')
        need.discard(sha)
for _ in range(40):
    s = call('GET', f'{API}/deploys/{d["id"]}')
    if s['state'] in ('ready', 'error'): break
    time.sleep(3)
pub = call('GET', f'{API}/sites/{site}').get('published_deploy') or {}
print('estado:', s['state'], '· contexto:', s.get('context'))
print('vista previa:', s.get('deploy_ssl_url') or s.get('deploy_url'))
print('producción sigue en el deploy:', pub.get('id'), '(esta vista previa NO está publicada)' if pub.get('id') != d['id'] else '¡ATENCIÓN: quedó publicada!')
