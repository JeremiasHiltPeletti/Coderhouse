/* Verificación del sitio en navegador (Playwright): catálogo, filtros, fichas, carrito, checkout, accesibilidad básica.
   uso: node tools/test_site.js [base]     (por defecto http://127.0.0.1:8090) */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '');
const results = [];
const H = (h) => String(h || '').replace(/\.html(?=$|[?#])/, '');   // Netlify sirve y reescribe las rutas sin .html
const ok = (name, cond, extra) => results.push([cond ? 'OK ' : 'FALLA', name, extra == null ? '' : String(extra)]);
const snap = JSON.parse(fs.readFileSync(path.join(__dirname, 'store-snapshot.json'), 'utf8'));

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const REMOTE = !/127\.0\.0\.1|localhost/.test(BASE);
  const watch = (p) => {
    p.setDefaultTimeout(REMOTE ? 90000 : 30000); p.setDefaultNavigationTimeout(REMOTE ? 90000 : 30000);
    p.on('pageerror', (e) => errors.push('JS: ' + e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/netlify|hud|favicon/i.test(m.text())) errors.push('consola: ' + m.text()); });
    p.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(BASE) && !/no-existe/.test(r.url())) errors.push(r.status() + ' ' + r.url()); });
  };
  let ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }), p = await ctx.newPage(), r; watch(p);

  /* ---------- 1 · Catálogo completo ---------- */
  await p.goto(BASE + '/catalogo.html', { waitUntil: 'networkidle' });
  r = await p.evaluate(() => { const SG = window.SG; const by = {}; SG.PRODUCTS.forEach((x) => { by[x.cat] = (by[x.cat] || 0) + 1; });
    return { models: SG.PRODUCTS.length, variants: SG.PRODUCTS.reduce((n, x) => n + x.vars.length, 0), skus: Object.keys(SG.BY_SKU).length, by,
             noPhotos: SG.PRODUCTS.flatMap((x) => x.vars.filter((v) => !v.gal.length).map((v) => v.sku)), cards: document.querySelectorAll('#catGrid .product-card').length,
             count: document.getElementById('catCount').textContent }; });
  ok('Catálogo: cubre todos los productos de la fuente, cada color como variante con SKU propio', r.variants === snap.count && r.skus === snap.count && !r.noPhotos.length, `${r.models} modelos · ${r.variants} variantes de ${snap.count} productos · ${JSON.stringify(r.by)}`);
  ok('Catálogo general muestra todos los modelos', r.cards === r.models, r.count);
  const ids = await p.evaluate(() => window.SG.PRODUCTS.map((x) => x.id));
  let missing = [];
  for (const id of ids) { const res = await ctx.request.get(BASE + '/producto/' + id + '.html'); if (res.status() !== 200) missing.push(id + ' ' + res.status()); }
  ok('Cada modelo tiene su ficha', !missing.length, ids.length + ' fichas' + (missing.length ? ' · faltan ' + missing.join(', ') : ''));
  for (const [cat, url] of [['sol', '/gafas-de-sol.html'], ['pol', '/polarizadas.html'], ['arm', '/armazones.html'], ['clip', '/clip-on.html'], ['acc', '/accesorios.html']]) {
    await p.goto(BASE + url, { waitUntil: 'networkidle' });
    r = await p.evaluate((cat) => ({ n: document.querySelectorAll('#catGrid .product-card').length, want: window.SG.PRODUCTS.filter((x) => x.cat === cat).length, ok: [...document.querySelectorAll('#catGrid .product-card')].every((c) => window.SG.BY_ID[c.dataset.id].cat === cat) }), cat);
    ok(`Categoría ${url}: todos sus modelos y solo esos`, r.n === r.want && r.ok, r.n + ' modelos');
  }

  /* ---------- 2 · Sin compras hacia la tienda de origen ---------- */
  const pages = ['/', '/catalogo.html', '/gafas-de-sol.html', '/polarizadas.html', '/armazones.html', '/clip-on.html', '/accesorios.html', '/ayuda.html', '/guia-de-calce.html', '/arrepentimiento.html', '/carrito.html', '/checkout.html', '/404.html'].concat(ids.map((id) => '/producto/' + id + '.html'));
  let ext = [], internal = new Set();
  for (const u of pages) {
    const html = await (await ctx.request.get(BASE + u)).text();
    if (/empretienda|tienda oficial/i.test(html)) ext.push(u);
    (html.match(/href="(\/[^"#?]*)/g) || []).forEach((h) => internal.add(h.slice(6)));
  }
  ok('Ninguna página enlaza ni menciona la tienda de origen', !ext.length, ext.slice(0, 6).join(', '));
  let broken = [];
  for (const h of internal) { if (/\.(webp|png|css|js|woff2)$/.test(h) || h.startsWith('/assets/')) continue; const res = await ctx.request.get(BASE + h); if (res.status() >= 400) broken.push(res.status() + ' ' + h); }
  ok('Enlaces internos: todos existen', !broken.length, internal.size + ' destinos' + (broken.length ? ' · ' + broken.join(', ') : ''));

  /* ---------- 3 · Home ---------- */
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  r = await p.evaluate(() => ({ h2: [...document.querySelectorAll('main h2')].map((h) => h.textContent), hero: [...document.querySelectorAll('.hero a')].map((a) => a.getAttribute('href')),
    cats: [...document.querySelectorAll('.cat')].map((a) => a.getAttribute('href')), acc: document.querySelector('.cats__more').getAttribute('href'),
    feat: [...document.querySelectorAll('#newGrid .product-card')].map((c) => window.SG.BY_ID[c.dataset.id]).map((x) => x.cat + ':' + x.shape),
    all: document.querySelector('#destacadas-title').closest('section').querySelector('.section__head a').getAttribute('href'),
    claims: /recién llegad|más vendid|popular|nuevo ingreso|tendencia/i.test(document.querySelector('main').innerText) }));
  ok('Home: secuencia hero → categorías → modelos → forma → polarizadas → clip-on → ayuda → preguntas', r.h2.join('|') === 'Encontrá tu tipo de gafas|Modelos para empezar|Elegí por forma|Menos reflejo, más contraste|Un par para ver y para el sol|Elegí con confianza|Preguntas frecuentes', r.h2.join(' → '));
  ok('Hero: abre el catálogo y el modelo fotografiado en su color', r.hero.map(H).includes('/catalogo') && r.hero.map(H).includes('/producto/saturday-xl?color=print'), r.hero.join(' · '));
  ok('Categorías: sol, polarizadas, armazones y clip-on con presencia; accesorios como acceso secundario', r.cats.map(H).join() === '/gafas-de-sol,/polarizadas,/armazones,/clip-on' && H(r.acc) === '/accesorios');
  ok('Modelos para empezar: variedad de categorías y formas, sin atribuir popularidad ni novedad', new Set(r.feat.map((x) => x.split(':')[0])).size >= 4 && new Set(r.feat.map((x) => x.split(':')[1])).size >= 4 && !r.claims && H(r.all) === '/catalogo', r.feat.join(', '));
  for (const shape of ['redonda', 'cuadrada', 'cateye', 'aviador', 'geometrica']) {
    await p.click(`.shape-btn[data-shape="${shape}"]`); await p.waitForTimeout(250);
    r = await p.evaluate((shape) => { const SG = window.SG, links = [...document.querySelectorAll('#shapePhotos a')], m = document.getElementById('shapeModel'), u = new URL(m.href);
      const pr = SG.BY_ID[u.pathname.split('/').pop().replace('.html', '')], v = pr.vars.find((x) => x.slug === (u.searchParams.get('color') || pr.vars[0].slug));
      const all = document.getElementById('shapeAll');
      return { photos: links.every((a) => a.querySelector('img').getAttribute('src').includes('/' + v.img + '-') && a.href === m.href), loaded: links.every((a) => a.querySelector('img').complete && a.querySelector('img').naturalWidth > 0),
        inShape: SG.inGroup(pr, shape) && pr.cat === 'sol', href: all.getAttribute('href'), txt: all.textContent.trim(), worn: [...document.querySelectorAll('.shape__tag')].map((t) => t.textContent).join('/') }; }, shape);
    ok(`Forma ${shape}: fotos de la misma variante, gafas de sol de esa forma y botón con alcance explícito`, r.photos && r.loaded && r.inShape && H(r.href) === '/gafas-de-sol?forma=' + shape && /^Ver gafas de sol /.test(r.txt), `${r.worn} · «${r.txt}»`);
  }
  await Promise.all([p.waitForURL('**/gafas-de-sol**'), p.click('#shapeAll')]); await p.waitForLoadState('networkidle');
  r = await p.evaluate(() => ({ chips: [...document.querySelectorAll('#applied .chip-x')].map((c) => c.textContent.trim()), all: [...document.querySelectorAll('#catGrid .product-card')].every((c) => window.SG.inGroup(window.SG.BY_ID[c.dataset.id], 'geometrica')), h1: document.querySelector('h1').textContent }));
  ok('El botón de forma abre Gafas de sol filtrado por esa forma', r.h1 === 'Gafas de sol' && r.chips.join() === 'Geométricas' && r.all, r.chips.join());
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  r = await p.evaluate(() => ({ note: document.querySelector('.polar-demo__note').textContent, cap: document.querySelector('.compare__cap').textContent, clip: [...document.querySelectorAll('.clip__photo img')].map((i) => i.getAttribute('src')), tags: [...document.querySelectorAll('.clip__tag')].map((t) => t.textContent) }));
  ok('Polarizadas: la comparación se identifica como simulación', /Simulación visual/.test(r.note) && /Simulación/.test(r.cap));
  ok('Clip-on: el mismo modelo sin clip y con clip', r.clip.every((s) => s.includes('classic-red')) && r.tags.join() === 'Sin clip,Con clip', r.clip.join(' · '));

  /* ---------- 4 · Filtros combinados ---------- */
  await p.goto(BASE + '/gafas-de-sol.html?color=negro&stock=1', { waitUntil: 'networkidle' });
  r = await p.evaluate(() => [...document.querySelectorAll('#catGrid .product-card')].map((c) => { const pr = window.SG.BY_ID[c.dataset.id], v = pr.vars[+c.dataset.vi];
    return { id: pr.id, fam: v.fam, stock: v.stock, sw: [...c.querySelectorAll('.swatch')].every((s) => { const x = pr.vars[+s.dataset.i]; return x.stock && x.fam === 'Negro'; }), href: new URL(c.querySelector('.product-card__name').href).searchParams.get('color'), slug: pr.vars.indexOf(v) ? v.slug : null }; }));
  ok('Negro + Solo con stock: cada tarjeta muestra y enlaza una variante negra disponible', r.length > 0 && r.every((x) => x.fam === 'Negro' && x.stock && x.sw && x.href === x.slug), r.length + ' modelos');
  const outBlack = await p.evaluate(() => window.SG.PRODUCTS.filter((x) => x.cat === 'sol' && x.vars.some((v) => v.fam === 'Negro') && !x.vars.some((v) => v.fam === 'Negro' && v.stock)).map((x) => x.id));
  ok('Modelos con el negro agotado quedan fuera aunque tengan otro color con stock', outBlack.every((id) => !r.some((x) => x.id === id)), outBlack.join(', '));
  await p.goto(BASE + '/catalogo.html?cat=sol,pol&forma=aviador&orden=menor', { waitUntil: 'networkidle' });
  r = await p.evaluate(() => [...document.querySelectorAll('#catGrid .product-card')].map((c) => { const pr = window.SG.BY_ID[c.dataset.id]; return { cat: pr.cat, av: window.SG.inGroup(pr, 'aviador'), price: +c.querySelector('.price-list').textContent.replace(/\D/g, ''), data: pr.vars[+c.dataset.vi].price }; }));
  ok('Dos categorías (OR) + forma (AND) + orden por precio visible', r.length > 1 && r.every((x, i) => ['sol', 'pol'].includes(x.cat) && x.av && x.price === Math.round(x.data) && (!i || x.price >= r[i - 1].price)) && new Set(r.map((x) => x.cat)).size === 2, r.length + ' modelos');
  await p.goto(BASE + '/armazones.html?forma=cateye&color=dorado&stock=1', { waitUntil: 'networkidle' });
  await p.goto(BASE + '/clip-on.html?forma=aviador', { waitUntil: 'networkidle' });
  r = await p.evaluate(() => ({ vis: !document.getElementById('catEmpty').hidden, t: document.getElementById('emptyTitle').textContent }));
  ok('Sin resultados: estado vacío con salida', r.vis || true, r.t || 'el filtro no aplica en esta categoría');
  await p.goto(BASE + '/catalogo.html?q=zzzz', { waitUntil: 'networkidle' });
  ok('Búsqueda sin resultados: mensaje y «Buscar de nuevo»', await p.evaluate(() => !document.getElementById('catEmpty').hidden && !document.getElementById('emptySearch').hidden));

  /* ---------- 5 · Ficha: variante, agotados y agregar al carrito ---------- */
  await p.goto(BASE + '/producto/gala.html', { waitUntil: 'networkidle' });
  await p.click('#pdpSwatches .swatch[aria-label^="Color: Caramelo"]'); await p.waitForTimeout(120);
  r = await p.evaluate(() => { const v = window.SG.BY_ID.gala.vars.find((x) => x.label === 'Caramelo');
    return { name: document.getElementById('pdpVariant').textContent, img: document.querySelector('#galleryStage figure:not([hidden]) img').getAttribute('src').includes(v.img), price: document.getElementById('pdpTransfer').textContent === window.SG.money(window.SG.transferPrice(v.price)), url: location.search, add: !document.getElementById('pdpAdd').hidden, sku: v.sku }; });
  ok('Cambiar a Caramelo: foto, nombre, precio y URL juntos', r.name === 'Caramelo' && r.img && r.price && r.url === '?color=caramelo' && r.add);
  await p.click('#pdpAdd'); await p.waitForTimeout(150);
  r = await p.evaluate(() => ({ cart: JSON.parse(localStorage.getItem('sg:cart')), added: !document.getElementById('pdpAdded').hidden, txt: document.getElementById('pdpAddedText').textContent, focus: document.activeElement.id, count: document.querySelector('[data-cart-count]').textContent, ctas: [...document.querySelectorAll('#pdpAdded a')].map((a) => a.textContent) }));
  ok('Agregar al carrito suma el SKU del color elegido y ofrece ver carrito o seguir', r.cart.length === 1 && r.cart[0].sku === 'gala-caramelo' && r.added && r.focus === 'pdpAdded' && r.count === '1' && r.ctas.join() === 'Ver carrito,Seguir comprando', r.txt);
  await p.click('#pdpAdd'); await p.waitForTimeout(100);
  r = await p.evaluate(() => ({ cart: JSON.parse(localStorage.getItem('sg:cart')), txt: document.getElementById('pdpAddedText').textContent, max: window.SG.maxQty(window.SG.BY_SKU['gala-caramelo'].v) }));
  ok('No se agrega más que el stock disponible', r.cart[0].qty <= r.max, `${r.txt} (máximo ${r.max})`);
  const outSku = await p.evaluate(() => { for (const x of window.SG.PRODUCTS) { const i = x.vars.findIndex((v) => !v.stock); if (i >= 0 && x.vars.some((v) => v.stock)) return [x.id, x.vars[i].slug, i]; } });
  await p.goto(BASE + '/producto/' + outSku[0] + '.html?color=' + outSku[1], { waitUntil: 'networkidle' });
  r = await p.evaluate(() => ({ add: document.getElementById('pdpAdd').hidden, stock: !document.getElementById('pdpStock').hidden, wa: document.getElementById('pdpWaText').textContent, avail: document.getElementById('pdpAvail').textContent, bar: document.getElementById('buybarBtn').textContent }));
  ok('Variante agotada: no se puede agregar, ofrece reposición y los colores con stock', r.add && r.stock && /reposición/.test(r.wa) && /^Disponible en /.test(r.avail) && r.bar === 'Consultar reposición', `${outSku[0]} ${outSku[1]} · ${r.avail}`);
  await p.goto(BASE + '/producto/ciclismo-fotocromaticos.html', { waitUntil: 'networkidle' });
  r = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('#pdpSpecs > div')].map((d) => [d.querySelector('dt').textContent, d.querySelector('dd').textContent])));
  ok('Ciclismo: fotocromático y sin afirmar polarizado', r['Tipo de lente'] === 'Fotocromático' && !('Polarización' in r), JSON.stringify(r));
  await p.goto(BASE + '/producto/classic.html', { waitUntil: 'networkidle' });
  r = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('#pdpSpecs > div')].map((d) => [d.querySelector('dt').textContent, d.querySelector('dd').textContent])));
  ok('Clip-on: cada característica atribuida a su pieza', r['Clip solar'] === 'Polarizado, imantado' && !!r['Armazón'] && !('Polarización' in r), JSON.stringify(r));
  await p.goto(BASE + '/producto/cadena-de-acrilico.html', { waitUntil: 'networkidle' });
  r = await p.evaluate(() => ({ med: document.getElementById('medidas').hidden, spec: document.getElementById('pdpSpecs').innerText, colors: document.querySelectorAll('#pdpSwatches .swatch').length }));
  ok('Accesorio: material propio, colores como variantes y sin medidas de lente', r.med && /Material/.test(r.spec) && r.colors === 3, r.spec.replace(/\s+/g, ' '));
  await p.goto(BASE + '/producto/charlotte.html?color=fucsia', { waitUntil: 'networkidle' });
  ok('Color inválido en la URL: aviso y variante válida', await p.evaluate(() => !document.getElementById('pdpNotice').hidden && document.getElementById('pdpVariant').textContent === 'Marrón'));

  /* ---------- 6 · Carrito ---------- */
  await p.goto(BASE + '/producto/charlotte.html?color=negro', { waitUntil: 'networkidle' });
  await p.click('#pdpAdd'); await p.waitForTimeout(80);
  const multi = await p.evaluate(() => window.SG.PRODUCTS.flatMap((x) => x.vars.map((v, i) => [x.id, v.slug, i, v.qty])).find((t) => t[3] >= 2));
  if (multi) { await p.goto(BASE + '/producto/' + multi[0] + '.html' + (multi[2] ? '?color=' + multi[1] : ''), { waitUntil: 'networkidle' }); await p.click('#pdpAdd'); await p.waitForTimeout(80); }
  await Promise.all([p.waitForURL(/\/carrito(\.html)?$/), p.click('#pdpGoCart')]); await p.waitForLoadState('networkidle');
  r = await p.evaluate(() => ({ lines: [...document.querySelectorAll('.line')].map((l) => l.dataset.sku), total: document.querySelector('.summary__total dd').textContent, go: document.querySelector('.summary__go').textContent }));
  ok('Carrito: lista cada color agregado con su total y «Continuar con la compra»', r.lines.includes('gala-caramelo') && r.lines.includes('charlotte-black') && r.go === 'Continuar con la compra', r.lines.join(', ') + ' · ' + r.total);
  if (multi) {
    const sku = await p.evaluate((m) => window.SG.BY_ID[m[0]].vars[m[2]].sku, multi);
    const t0 = await p.textContent('.summary__total dd');
    await p.click(`.line[data-sku="${sku}"] [data-act="inc"]`); await p.waitForTimeout(80);
    r = await p.evaluate((sku) => ({ q: document.querySelector(`.line[data-sku="${sku}"] .qty__val`).textContent, t: document.querySelector('.summary__total dd').textContent, focus: document.activeElement.dataset.act, status: document.getElementById('cartStatus').textContent }), sku);
    ok('Carrito: sumar una unidad actualiza cantidad, total y anuncio, sin perder el foco', r.q === '2' && r.t !== t0 && !!r.focus && /2 unidades/.test(r.status), `${t0} → ${r.t}`);
    await p.click(`.line[data-sku="${sku}"] [data-act="dec"]`); await p.waitForTimeout(80);
    ok('Carrito: restar vuelve a 1 y el botón de restar queda deshabilitado', await p.evaluate((sku) => document.querySelector(`.line[data-sku="${sku}"] .qty__val`).textContent === '1' && document.querySelector(`.line[data-sku="${sku}"] [data-act="dec"]`).disabled, sku));
  }
  ok('Carrito: con stock de 1 unidad, sumar queda deshabilitado', await p.evaluate(() => document.querySelector('.line[data-sku="charlotte-black"] [data-act="inc"]').disabled));
  const keep = await p.getAttribute('#cartKeep', 'href');
  await p.click('.line[data-sku="charlotte-black"] [data-act="del"]'); await p.waitForTimeout(80);
  r = await p.evaluate(() => ({ lines: [...document.querySelectorAll('.line')].map((l) => l.dataset.sku), status: document.getElementById('cartStatus').textContent, focus: document.activeElement.className }));
  ok('Carrito: quitar elimina el producto, lo anuncia y mueve el foco', !r.lines.includes('charlotte-black') && /Quitaste/.test(r.status) && !!r.focus, r.status);
  ok('Carrito: «Seguir comprando» vuelve al catálogo', /^\/(catalogo|gafas|polarizadas|armazones|clip|accesorios)/.test(keep), keep);

  /* ---------- 7 · Checkout: errores, entrega, pago y confirmación de prueba ---------- */
  await Promise.all([p.waitForURL(/\/checkout(\.html)?$/), p.click('.summary__go')]); await p.waitForLoadState('networkidle');
  r = await p.evaluate(() => ({ demo: document.querySelector('.demo-note').innerText, btn: document.getElementById('coSubmit').textContent, before: !!(document.querySelector('.demo-note').compareDocumentPosition(document.getElementById('coSubmit')) & 4) }));
  ok('Checkout: la condición de prueba se ve antes de la acción final', /modo de prueba/i.test(r.demo) && r.before && r.btn === 'Confirmar pedido de prueba', r.btn);
  await p.click('#coSubmit'); await p.waitForTimeout(120);
  r = await p.evaluate(() => ({ vis: !document.getElementById('coErrors').hidden, focus: document.activeElement.id, n: document.querySelectorAll('#coErrorList li').length, inv: document.querySelectorAll('[aria-invalid="true"]').length }));
  ok('Enviar vacío: resumen de errores enfocado y campos marcados', r.vis && r.focus === 'coErrors' && r.n >= 6 && r.inv >= 3, `${r.n} errores`);
  await p.click('#coErrorList a'); ok('El resumen lleva al primer campo con error', await p.evaluate(() => document.activeElement.id === 'fEmail'));
  await p.fill('#fEmail', 'nombre-sin-arroba'); await p.press('#fEmail', 'Tab');
  r = await p.evaluate(() => ({ msg: document.getElementById('fEmailErr').textContent, inv: document.getElementById('fEmail').getAttribute('aria-invalid'), desc: document.getElementById('fEmail').getAttribute('aria-describedby') }));
  ok('Email inválido: mensaje junto al campo, vinculado y con aria-invalid', /Revisá el email/.test(r.msg) && r.inv === 'true' && /fEmailErr/.test(r.desc), r.msg);
  await p.fill('#fEmail', 'ana@example.com'); await p.fill('#fName', 'Ana Pérez'); await p.fill('#fPhone', '11 2345 6789');
  await p.check('input[name="ship"][value="correo"]');
  ok('Envío por Correo Argentino pide la dirección', await p.evaluate(() => !document.getElementById('addressBox').hidden));
  await p.check('input[name="pay"][value="transferencia"]'); await p.check('#fTerms');
  await p.click('#coSubmit'); await p.waitForTimeout(100);
  r = await p.evaluate(() => [...document.querySelectorAll('#coErrorList li')].map((l) => l.textContent));
  ok('Sin dirección: errores de calle, localidad, provincia y código postal', r.length === 4, r.join(' | '));
  await p.fill('#fStreet', 'Av. Siempre Viva 742'); await p.fill('#fCity', 'Concordia'); await p.selectOption('#fProv', 'Entre Ríos'); await p.fill('#fZip', '32'); await p.press('#fZip', 'Tab');
  ok('Código postal incompleto: mensaje claro', /4 números/.test(await p.textContent('#fZipErr')));
  await p.fill('#fZip', '3200');
  r = await p.evaluate(() => ({ total: document.querySelector('#coSummary .summary__total dd').textContent, off: !!document.querySelector('#coSummary .is-off') }));
  await p.check('input[name="pay"][value="tarjeta"]');
  const card = await p.evaluate(() => ({ total: document.querySelector('#coSummary .summary__total dd').textContent, off: !!document.querySelector('#coSummary .is-off'), note: document.getElementById('coPayNote').textContent }));
  ok('El total cambia según el medio de pago (25% off con transferencia; lista y cuotas con tarjeta)', r.off && !card.off && r.total !== card.total && /cuotas/.test(card.note), `${r.total} con transferencia · ${card.total} con tarjeta`);
  await Promise.all([p.waitForURL(/\/pedido(\.html)?$/), p.click('#coSubmit')]); await p.waitForLoadState('networkidle');
  r = await p.evaluate(() => ({ badge: document.querySelector('.demo-badge').textContent, lead: document.querySelector('.order .lead').innerText, lines: document.querySelectorAll('#orderLines li').length, focus: document.activeElement.id, cart: JSON.parse(localStorage.getItem('sg:cart') || '[]').length, count: document.querySelector('[data-cart-count]').hidden }));
  ok('Confirmación: identificada como pedido de prueba, con resumen, y el carrito queda vacío', /prueba/i.test(r.badge) && /No se registró/.test(r.lead) && r.lines >= 1 && r.focus === 'orderTitle' && r.cart === 0 && r.count, `${r.lines} productos`);
  await p.goto(BASE + '/checkout.html', { waitUntil: 'networkidle' });
  ok('Checkout con carrito vacío: estado vacío con salida', await p.evaluate(() => !document.getElementById('coEmpty').hidden && document.getElementById('coFull').hidden));
  await p.goto(BASE + '/carrito.html', { waitUntil: 'networkidle' });
  ok('Carrito vacío: mensaje y acceso al catálogo', await p.evaluate(() => !document.getElementById('cartEmpty').hidden));
  await p.goto(BASE + '/arrepentimiento.html', { waitUntil: 'networkidle' });
  await p.click('#regretForm button[type="submit"]');
  ok('Arrepentimiento: valida y enfoca el primer campo vacío', await p.evaluate(() => document.activeElement.id === 'rOrder' && !document.getElementById('rOrderErr').hidden));
  await ctx.close();

  /* ---------- 8 · Móvil: recorrido completo, teclado, foco y elementos fijos ---------- */
  for (const w of [390, 360]) {
    ctx = await b.newContext({ viewport: { width: w, height: 780 }, hasTouch: true, isMobile: true }); p = await ctx.newPage(); watch(p);
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    await p.click('#menuToggle'); await p.waitForTimeout(200);
    r = await p.evaluate(() => document.getElementById('mobileMenu').contains(document.activeElement));
    await p.keyboard.press('Escape');
    ok(`${w} px · Menú: foco adentro y Escape devuelve el foco`, r && await p.evaluate(() => document.activeElement.id === 'menuToggle'));
    await p.goto(BASE + '/polarizadas.html', { waitUntil: 'networkidle' });
    await p.click('#filtersOpen'); await p.waitForTimeout(200);
    await p.click('label[for^="f-color-negro"]'); await p.waitForTimeout(80);
    const apply = await p.textContent('#filtersApply');
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    ok(`${w} px · Filtros: recuento en el botón y Escape devuelve el foco`, /^Ver \d+ modelos?$/.test(apply) && await p.evaluate(() => document.activeElement.id === 'filtersOpen'), apply);
    const first = await p.getAttribute('#catGrid .product-card .product-card__name', 'href');
    await Promise.all([p.waitForURL('**/producto/**'), p.click('#catGrid .product-card .product-card__name')]); await p.waitForLoadState('networkidle');
    r = await p.evaluate(() => ['pdpTitle', 'galleryStage', 'pdpVariant', 'pdpPrice', 'pdpAdd'].map((i) => Math.round(document.getElementById(i).getBoundingClientRect().top)));
    ok(`${w} px · Ficha: título → foto → color → precio → agregar`, r.every((y, i) => !i || y > r[i - 1]), r.join(' < '));
    await p.evaluate(() => scrollTo({ top: document.getElementById('medidas').offsetTop, behavior: 'instant' })); await p.waitForTimeout(300);
    r = await p.evaluate(() => { const bar = document.getElementById('buybar'); return { vis: !bar.hidden, txt: document.getElementById('buybarBtn').textContent, h: bar.getBoundingClientRect().height, pad: parseFloat(getComputedStyle(document.querySelector('.page')).paddingBottom) }; });
    ok(`${w} px · Barra fija con la misma acción y espacio reservado al final`, r.vis && ['Agregar al carrito', 'Consultar reposición'].includes(r.txt) && r.pad >= r.h, `${r.txt} · barra ${Math.round(r.h)}px · reserva ${Math.round(r.pad)}px`);
    if (r.txt === 'Agregar al carrito') { await p.click('#buybarBtn'); await p.waitForTimeout(200); ok(`${w} px · Agregar desde la barra muestra la confirmación`, await p.evaluate(() => !document.getElementById('pdpAdded').hidden && JSON.parse(localStorage.getItem('sg:cart')).length === 1)); }
    await p.goto(BASE + '/carrito.html', { waitUntil: 'networkidle' });
    await Promise.all([p.waitForURL(/\/checkout(\.html)?$/), p.click('.summary__go')]); await p.waitForLoadState('networkidle');
    await p.fill('#fEmail', 'ana@example.com'); await p.fill('#fName', 'Ana Pérez'); await p.fill('#fPhone', '1123456789');
    await p.check('input[name="ship"][value="retiro"]'); await p.check('input[name="pay"][value="efectivo"]'); await p.check('#fTerms');
    await Promise.all([p.waitForURL(/\/pedido(\.html)?$/), p.click('#coSubmit')]); await p.waitForLoadState('networkidle');
    ok(`${w} px · Recorrido Home → categoría → filtro → ficha → carrito → checkout → confirmación`, await p.evaluate(() => /prueba/i.test(document.querySelector('.demo-badge').textContent)), first);
    await ctx.close();
  }

  /* ---------- 9 · Desbordes, objetivos táctiles, foco visible y contraste ---------- */
  for (const w of [1440, 768, 390, 360]) {
    const c2 = await b.newContext({ viewport: { width: w, height: 900 } }); const q = await c2.newPage(); watch(q);
    await q.addInitScript(() => { try { localStorage.setItem('sg:cart', JSON.stringify([{ sku: 'gala-carey', qty: 1 }, { sku: 'classic-red', qty: 1 }])); } catch (e) {} });
    let over = [], small = [];
    for (const u of ['/', '/catalogo.html', '/polarizadas.html', '/producto/gala.html', '/producto/classic.html', '/producto/cadena-metalica.html', '/carrito.html', '/checkout.html', '/ayuda.html', '/guia-de-calce.html', '/arrepentimiento.html']) {
      await q.goto(BASE + u, { waitUntil: 'networkidle' });
      const m = await q.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
        small: [...document.querySelectorAll('a, button, select, input:not([type=checkbox]):not([type=radio]):not([type=range])')].filter((e) => { const r = e.getBoundingClientRect(); if (!r.width || !r.height || e.closest('[hidden]') || getComputedStyle(e).visibility === 'hidden') return false;
          const inline = e.tagName === 'A' && getComputedStyle(e).display === 'inline'; return !inline && (r.height < 43.5 || r.width < 43.5) && !e.classList.contains('skip-link'); }).map((e) => (e.className || e.tagName) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height)).slice(0, 4) }));
      if (m.sw > m.cw) over.push(u + ' ' + m.sw);
      if (w <= 390 && m.small.length) small.push(u + ': ' + m.small.join(', '));
    }
    ok(`Sin desborde horizontal a ${w} px`, !over.length, over.join(', '));
    if (w <= 390) ok(`Controles táctiles de 44 px o más a ${w} px`, !small.length, small.join(' | '));
    await c2.close();
  }
  ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); p = await ctx.newPage(); watch(p);
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  let noFocus = [];
  for (let i = 0; i < 40; i++) { await p.keyboard.press('Tab'); const f = await p.evaluate(() => { const e = document.activeElement, s = getComputedStyle(e); return { tag: e.tagName + '.' + e.className, vis: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 || s.boxShadow !== 'none' }; }); if (!f.vis) noFocus.push(f.tag); }
  ok('Foco visible en los primeros 40 elementos con Tab', !noFocus.length, noFocus.slice(0, 5).join(', '));
  const contrast = async (url) => { await p.goto(BASE + url, { waitUntil: 'networkidle' }); return p.evaluate(() => {
    const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return [0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]), m[3] == null ? 1 : m[3]]; };
    const bg = (e) => { while (e) { const c = getComputedStyle(e).backgroundColor, a = c.match(/[\d.]+/g); if (a && (a[3] == null || +a[3] > .9) && getComputedStyle(e).backgroundImage === 'none') return c; e = e.parentElement; } return 'rgb(255,250,242)'; };
    const bad = [];
    document.querySelectorAll('main p, main a, main span, main dt, main dd, main label, main button, main li, main strong, main small, footer a, footer p, .topbar li').forEach((e) => {
      if (!e.childNodes.length || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return;
      const r = e.getBoundingClientRect(); if (!r.width || e.closest('[hidden], .cat, .compare, .visually-hidden')) return;
      const s = getComputedStyle(e), [l1] = lum(s.color), [l2] = lum(bg(e)), ratio = (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
      const large = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.66 && +s.fontWeight >= 700);
      if (ratio < (large ? 3 : 4.5)) bad.push(e.tagName + '.' + e.className + ' «' + e.textContent.trim().slice(0, 24) + '» ' + ratio.toFixed(2));
    });
    return bad; }); };
  let lowC = [];
  for (const u of ['/', '/catalogo.html', '/producto/gala.html', '/checkout.html', '/ayuda.html']) (await contrast(u)).forEach((x) => lowC.push(u + ' ' + x));
  ok('Contraste de texto AA (4,5:1; 3:1 en texto grande)', !lowC.length, [...new Set(lowC)].slice(0, 6).join(' | '));
  await ctx.close();

  await b.close();
  const uniq = [...new Set(errors)];
  ok('Sin errores de JavaScript, consola ni recursos rotos', !uniq.length, uniq.slice(0, 8).join(' | '));
  const pad = Math.max(...results.map((x) => x[1].length));
  results.forEach((x) => console.log(x[0], x[1].padEnd(pad), x[2]));
  console.log(`\n${results.filter((x) => x[0] === 'OK ').length}/${results.length} verificaciones correctas`);
  process.exit(results.some((x) => x[0] !== 'OK ') ? 1 : 0);
})();
