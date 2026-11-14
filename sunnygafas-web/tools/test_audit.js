/* Criterios de aceptación de la auditoría (Playwright).
   uso: node tools/test_audit.js [base] [--tienda]
   --tienda sigue el botón de compra hasta la ficha del mismo color en Empretienda (sin agregar al carrito). */
const { chromium } = require('playwright');
const BASE = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'http://localhost:8090').replace(/\/$/, '');
const STORE = process.argv.includes('--tienda');
const results = [];
const ok = (name, cond, extra) => results.push([cond ? 'OK ' : 'FALLA', name, extra == null ? '' : String(extra)]);
const idOf = (href) => new URL(href, BASE).pathname.split('/').pop().replace('.html', '');

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const watch = (p) => { p.on('pageerror', (e) => errors.push('JS: ' + e.message)); p.on('console', (m) => { if (m.type() === 'error' && p.url().startsWith(BASE) && !/netlify|hud/i.test(m.text())) errors.push('consola: ' + m.text()); }); };
  let ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }), p = await ctx.newPage(); watch(p), r = null;

  /* ---------- P1 · Color y stock sobre una misma variante ---------- */
  await p.goto(BASE + '/gafas-de-sol.html?color=negro&stock=1', { waitUntil: 'networkidle' });
  r = await p.evaluate(() => [...document.querySelectorAll('#catGrid .product-card')].map((c) => {
    const pr = window.SG.BY_ID[c.dataset.id], v = pr.vars[+c.dataset.vi], a = c.querySelector('.product-card__name');
    return { id: pr.id, c: v.c, stock: v.stock, flag: !c.querySelector('.product-card__flag').hidden, href: a.getAttribute('href'), text: c.querySelector('.product-card__variant').textContent,
             sw: [...c.querySelectorAll('.swatch')].map((s) => pr.vars[+s.dataset.i]).every((x) => x.stock && ['Negro', 'Black'].includes(x.c)),
             hrefOK: new URL(a.href).searchParams.get('color') === (pr.vars.indexOf(v) ? v.slug : null) };
  }));
  ok('Negro + Solo con stock: cada tarjeta muestra y enlaza una variante negra disponible', r.length > 0 && r.every((x) => ['Negro', 'Black'].includes(x.c) && x.stock && !x.flag && /Negro/.test(x.text) && x.hrefOK), r.map((x) => x.id).join(', '));
  ok('Negro + Solo con stock: Yanis, Dallas y Molly (negro agotado) quedan fuera', !r.some((x) => ['yanis', 'dallas', 'molly'].includes(x.id)));
  ok('Con filtro de color o stock, las muestras de la tarjeta se limitan a las variantes que lo respetan', r.every((x) => x.sw));
  // caso de control con los mismos datos: sin «Solo con stock», el negro agotado aparece marcado
  await p.goto(BASE + '/gafas-de-sol.html?color=negro', { waitUntil: 'networkidle' });
  r = await p.evaluate(() => [...document.querySelectorAll('#catGrid .product-card')].filter((c) => ['yanis', 'dallas', 'molly'].includes(c.dataset.id)).map((c) => ({ id: c.dataset.id, flag: !c.querySelector('.product-card__flag').hidden, v: c.querySelector('.product-card__variant').textContent })));
  ok('Solo «Negro»: los tres modelos aparecen en su variante negra, marcada sin stock', r.length === 3 && r.every((x) => x.flag && /Negro/.test(x.v)), r.map((x) => x.id + ':' + x.v).join(' · '));
  // mismo grupo = OR
  await p.goto(BASE + '/gafas-de-sol.html?forma=cateye,aviador', { waitUntil: 'networkidle' });
  r = await p.evaluate(() => { const SG = window.SG, c = [...document.querySelectorAll('#catGrid .product-card')].map((x) => SG.BY_ID[x.dataset.id]); return { n: c.length, ok: c.every((x) => SG.inGroup(x, 'cateye') || SG.inGroup(x, 'aviador')), both: c.some((x) => SG.inGroup(x, 'cateye')) && c.some((x) => SG.inGroup(x, 'aviador')) }; });
  ok('Dos valores del mismo filtro se combinan con OR', r.ok && r.both, r.n + ' modelos');

  /* ---------- Orden por el precio de la tarjeta visible ---------- */
  for (const [o, dir] of [['menor', 1], ['mayor', -1]]) {
    for (const url of ['/catalogo.html?orden=' + o, '/catalogo.html?stock=1&color=negro&orden=' + o, '/catalogo.html?q=negro&orden=' + o]) {
      await p.goto(BASE + url, { waitUntil: 'networkidle' });
      r = await p.evaluate(() => [...document.querySelectorAll('#catGrid .product-card')].map((c) => { const t = c.querySelector('.price-list').textContent.replace(/\D/g, ''); return { shown: +t, data: window.SG.BY_ID[c.dataset.id].vars[+c.dataset.vi].price }; }));
      ok(`Orden ${o} en ${url}: sigue el precio visible de cada tarjeta`, r.length > 1 && r.every((x, i) => x.shown === x.data && (!i || dir * (x.shown - r[i - 1].shown) >= 0)), r.length + ' tarjetas');
    }
  }

  /* ---------- Estados de recuperación ---------- */
  await p.goto(BASE + '/gafas-de-sol.html?forma=cuadrada&color=gris-y-plateado', { waitUntil: 'networkidle' });
  r = await p.evaluate(() => ({ t: document.getElementById('emptyTitle').textContent, x: document.getElementById('emptyText').textContent, clear: !document.getElementById('emptyClear').hidden, vis: !document.getElementById('catEmpty').hidden }));
  ok('Sin resultados por filtros: mensaje y «Borrar filtros»', r.vis && r.t === 'No encontramos modelos con esos filtros.' && r.clear, r.t);
  await p.click('#emptyClear'); await p.waitForTimeout(100);
  ok('«Borrar filtros» recupera la categoría completa', await p.evaluate(() => document.querySelectorAll('#catGrid .product-card').length > 5 && location.search === ''));
  await p.goto(BASE + '/catalogo.html?q=zzzz', { waitUntil: 'networkidle' });
  r = await p.evaluate(() => ({ h1: document.getElementById('catTitle').textContent, t: document.getElementById('emptyTitle').textContent, again: !document.getElementById('emptySearch').hidden, store: !document.getElementById('emptyStore').hidden, q: document.getElementById('catSearchInput').value }));
  ok('Búsqueda sin resultados: título, consulta editable, «Buscar de nuevo» y tienda oficial', r.h1 === 'Resultados para “zzzz”' && /No encontramos resultados para “zzzz”/.test(r.t) && r.again && r.store && r.q === 'zzzz', r.t);
  await p.click('#emptySearch'); await p.waitForTimeout(150);
  ok('«Buscar de nuevo» abre y enfoca el campo con la consulta', await p.evaluate(() => !document.getElementById('searchPanel').hidden && document.activeElement.id === 'searchInput' && document.activeElement.value === 'zzzz'));
  await p.fill('#searchInput', 'gala carey'); await Promise.all([p.waitForURL('**/catalogo**q=gala**'), p.keyboard.press('Enter')]); await p.waitForLoadState('networkidle');
  r = await p.evaluate(() => [...document.querySelectorAll('#catGrid .product-card')].map((c) => c.dataset.id + ':' + c.querySelector('.product-card__variant').textContent + ':' + c.querySelectorAll('.swatch').length));
  ok('Enter en el buscador abre /catalogo?q= y preserva el color de la consulta', r.length === 1 && /^gala:Carey/.test(r[0]) && r[0].endsWith(':0'), r.join(' '));
  await p.route('**/js/data.js', (route) => route.abort());
  await p.goto(BASE + '/polarizadas.html', { waitUntil: 'load' }).catch(() => {});
  r = await p.evaluate(() => ({ err: !document.getElementById('catError').hidden, retry: !!document.getElementById('catRetry'), link: document.querySelector('#catError a').href }));
  ok('Catálogo no disponible: mensaje, «Reintentar» y enlace oficial de la categoría', r.err && r.retry && /gafas-polarizadas/.test(r.link), r.link);
  await p.unroute('**/js/data.js'); errors.length = 0;
  let res = await ctx.request.get(BASE + '/producto/no-existe.html');
  await p.goto(BASE + '/404.html', { waitUntil: 'networkidle' });
  r = await p.evaluate(() => ({ h1: document.querySelector('h1').textContent, all: document.querySelector('.notfound a').getAttribute('href') }));
  await p.click('[data-open-search]'); await p.waitForTimeout(100);
  ok('URL de producto inválida: «No encontramos este modelo.», buscar y ver todas las categorías', r.h1 === 'No encontramos este modelo.' && /catalogo/.test(r.all) && await p.evaluate(() => document.activeElement.id === 'searchInput'), 'estado HTTP en este servidor: ' + res.status());
  await p.goto(BASE + '/producto/charlotte.html?color=fucsia', { waitUntil: 'networkidle' });
  r = await p.evaluate(() => ({ n: document.getElementById('pdpNotice').textContent, vis: !document.getElementById('pdpNotice').hidden, v: document.getElementById('pdpVariant').textContent, buy: document.getElementById('pdpBuy').href, wa: decodeURIComponent(document.getElementById('pdpWa').href) }));
  ok('URL con color inválido: aviso y una variante válida para compra y consulta', r.vis && r.n === 'Ese color no está en este modelo. Te mostramos Marrón.' && r.v === 'Marrón' && r.buy.endsWith('charlotte-brown') && r.wa.includes('Charlotte en Marrón'), r.n);

  /* ---------- P1 · Datos de las fichas ---------- */
  const specs = async (u) => { await p.goto(BASE + u, { waitUntil: 'networkidle' }); return p.evaluate(() => ({ s: Object.fromEntries([...document.querySelectorAll('#pdpSpecs > div')].map((d) => [d.querySelector('dt').textContent, d.querySelector('dd').textContent])), desc: document.getElementById('pdpDesc').textContent, all: document.getElementById('contenido').innerText })); };
  r = await specs('/producto/ciclismo.html');
  ok('Ciclismo: «Tipo de lente · Fotocromático» y ninguna afirmación de polarizado', r.s['Tipo de lente'] === 'Fotocromático' && !('Polarización' in r.s) && !('Cristales' in r.s) && !/polarizad/i.test(r.desc), JSON.stringify(r.s));
  r = await specs('/producto/classic.html');
  ok('Classic: la polarización se atribuye al clip solar, no a «Cristales»', r.s['Clip solar'] === 'Polarizado, imantado' && r.s['Armazón'] === 'Policarbonato' && !('Cristales' in r.s) && !('Polarización' in r.s) && !/antirreflejo|anti reflejo/i.test(r.all), JSON.stringify(r.s));
  r = await specs('/producto/tulum.html');
  ok('Tulum: UV y polarización como datos independientes y respaldados', r.s['Protección UV'] === 'Filtro UV400' && r.s['Polarización'] === 'Lentes polarizados', JSON.stringify(r.s));
  r = await specs('/producto/glow.html');
  ok('Dato ausente no se presenta como negación (Glow, sin descripción en la tienda)', !('Polarización' in r.s) && !('Protección UV' in r.s) && !/No polarizad/i.test(r.all) && !/estuche/i.test(r.all), JSON.stringify(r.s));
  r = await specs('/producto/charlotte.html');
  const ch = await p.evaluate(() => ({ jump: document.querySelector('#pdpMeasureJump a').getAttribute('href'), txt: document.getElementById('pdpMeasureText').textContent, wa: decodeURIComponent(document.getElementById('pdpMeasure').href), inst: document.getElementById('pdpInstallments').textContent, guide: document.getElementById('pdpGuide').getAttribute('href') }));
  ok('Charlotte: medidas pendientes con consulta precargada (modelo, color y enlace) cerca del color', ch.jump === '#medidas' && ch.txt === 'Todavía no publicamos las medidas de este modelo.' && /ancho del lente, el puente y el largo de la varilla de Charlotte en Marrón\? La ficha es http.+\/producto\/charlotte/.test(ch.wa), ch.wa.split('text=')[1]);
  ok('Cuota con centavos cuando existen', ch.inst === '3 cuotas sin interés de $22.333,33', ch.inst);
  await p.click('#pdpSwatches .swatch[aria-label^="Color: Negro"]'); await p.waitForTimeout(100);
  r = await p.evaluate(() => ({ v: document.getElementById('pdpVariant').textContent, url: location.search, buy: document.getElementById('pdpBuy').href, wa: decodeURIComponent(document.getElementById('pdpWa').href), m: decodeURIComponent(document.getElementById('pdpMeasure').href), img: document.querySelector('#galleryStage figure:not([hidden]) img').getAttribute('src') }));
  ok('Charlotte Marrón → Negro: nombre, URL, foto, Empretienda y WhatsApp cambian juntos', r.v === 'Negro' && r.url === '?color=negro' && r.buy.endsWith('charlotte-black') && r.wa.includes('Charlotte en Negro') && r.wa.includes('color=negro') && r.m.includes('Charlotte en Negro') && r.img.includes('charlotte-black'), r.buy);
  await p.click('#pdpGuide'); await p.waitForLoadState('networkidle');
  r = await p.evaluate(() => ({ back: document.getElementById('guideBack').textContent, href: document.getElementById('guideBack').getAttribute('href'), wa: decodeURIComponent(document.getElementById('guideWa').href) }));
  ok('Guía de calce desde una ficha: «Volver a Charlotte» con el color y consulta precargada', r.back === 'Volver a Charlotte' && /charlotte(\.html)?\?color=negro#medidas/.test(r.href) && r.wa.includes('Charlotte en Negro'), r.href);
  await p.goto(BASE + '/guia-de-calce.html', { waitUntil: 'networkidle' });
  ok('Guía de calce en acceso directo: sin «Volver a…», con «Ver todas las categorías»', await p.evaluate(() => document.getElementById('guideBack').hidden && /catalogo/.test(document.getElementById('guideAll').getAttribute('href'))));
  await p.goto(BASE + '/producto/risky.html', { waitUntil: 'networkidle' });
  r = await p.evaluate(() => ({ label: !document.getElementById('pdpPriceLabel').hidden && document.getElementById('pdpPriceLabel').textContent, buy: document.getElementById('pdpBuyText').textContent, rx: !document.getElementById('pdpRx').hidden && document.getElementById('pdpRx').textContent.trim(), wa: decodeURIComponent(document.getElementById('pdpRx').href) }));
  ok('Risky: «Precio del armazón», compra del armazón y CTA de presupuesto de cristales', r.label === 'Precio del armazón' && r.buy === 'Comprar armazón en la tienda oficial' && r.rx === 'Pedir presupuesto de cristales por WhatsApp' && /presupuesto de cristales con mi graduación para Risky en Negro\. La ficha es http/.test(r.wa), r.wa.split('text=')[1]);
  await p.goto(BASE + '/producto/cadena-beige.html', { waitUntil: 'networkidle' });
  r = await p.evaluate(() => ({ h1: document.querySelector('h1').textContent, med: document.getElementById('medidas').hidden, jump: document.getElementById('pdpMeasureJump').hidden, desc: document.getElementById('pdpDesc').textContent, inst: document.getElementById('pdpInstallments').textContent, t: document.getElementById('pdpTransfer').textContent, l: document.getElementById('pdpList').textContent, all: document.getElementById('contenido').innerText, wa: decodeURIComponent(document.getElementById('pdpWa').href) }));
  ok('Cadena beige: nombre propio, descripción de cadena y sin medidas de lente, puente y varilla', r.h1 === 'Cadena beige' && r.med && r.jump && r.desc === 'Cadena de acrílico en beige y dorado.' && !/lente|puente|varilla/i.test(r.all) && r.wa.includes('consultar por Cadena beige.'), r.desc);
  ok('Cadena beige: $8.400 con transferencia, $11.200 de lista y cuota de $3.733,33', r.t === '$8.400' && r.l === '$11.200' && r.inst === '3 cuotas sin interés de $3.733,33', `${r.t} · ${r.l} · ${r.inst}`);
  await p.goto(BASE + '/accesorios.html', { waitUntil: 'networkidle' });
  r = await p.evaluate(() => [...document.querySelectorAll('#catGrid .product-card__name')].map((a) => a.textContent));
  ok('Accesorios: cada tarjeta se distingue por su título', new Set(r).size === r.length && r.includes('Cadena beige') && r.includes('Cadena negra'), r.join(', '));

  /* ---------- Precarga de la foto de la variante pedida por URL ---------- */
  const firstImgs = async (u) => { const pg = await ctx.newPage(); const reqs = []; pg.on('request', (q) => { if (/\/assets\/img\/p\//.test(q.url())) reqs.push(q.url().split('/').pop()); }); await pg.goto(BASE + u, { waitUntil: 'networkidle' }); const pre = await pg.evaluate(() => [...document.querySelectorAll('link[rel=preload][as=image]')].map((l) => l.getAttribute('href').split('/').pop())); await pg.close(); return { reqs, pre }; };
  r = await firstImgs('/producto/saturday.html?color=print');
  ok('Saturday XL ?color=print: se precarga la foto Print y no se descarga ninguna de Naranja y azul', r.pre.length === 1 && r.pre[0] === 'saturday-xl-print-1.webp' && !r.reqs.some((x) => x.includes('blue-orange')), 'preload ' + r.pre.join(',') + ' · ' + r.reqs.length + ' fotos');
  r = await firstImgs('/producto/saturday.html');
  ok('Saturday XL sin color: se precarga la foto del color por defecto', r.pre.length === 1 && r.pre[0] === 'saturday-xl-blue-orange-1.webp' && !r.reqs.some((x) => x.includes('print')), r.pre.join(','));

  /* ---------- Navegación, Home y Ayuda ---------- */
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  r = await p.evaluate(() => ({ nav: [...document.querySelectorAll('.nav a')].map((a) => a.textContent.trim()), h2: [...document.querySelectorAll('main h2')].map((h) => h.textContent), lead: document.querySelector('.hero__lead').textContent,
    cats: [...document.querySelectorAll('.tri__item, .cats__link')].map((a) => a.getAttribute('href')), gone: !document.querySelector('.polar, .faq, .duo, .collections, .novedades'), foot: [...document.querySelectorAll('.footer a')].map((a) => a.textContent.trim()), all: document.querySelector('#destacadas-title').closest('section').querySelector('.section__head a').getAttribute('href'),
    before: [...document.querySelectorAll('.before__list a')].map((a) => a.textContent.trim() + '→' + a.getAttribute('href')) }));
  ok('Cabecera: Catálogo y las cinco categorías', r.nav.join('|') === 'Catálogo|Gafas de sol|Polarizadas|Armazones|Clip-on 2 en 1|Accesorios', r.nav.join(' · '));
  ok('Home: orden hero → categorías → destacadas → forma → antes de comprar', r.h2.join('|') === 'Encontrá tu tipo de gafas|Gafas de sol destacadas|Elegí por forma|Antes de comprar' && r.cats.length === 5 && r.gone && /Explorá gafas de sol, polarizadas y armazones/.test(r.lead), r.h2.join(' → '));
  ok('Home: «Antes de comprar» lleva a guía, cómo comprar y envíos', r.before.length === 3 && /guia-de-calce/.test(r.before[0]) && /#comprar/.test(r.before[1]) && /#envios/.test(r.before[2]), r.before.join(' · '));
  ok('Pie: Catálogo, Instagram en contacto y salida a la tienda oficial', r.foot.includes('Catálogo') && r.foot.includes('Ver @sunnygafas en Instagram') && r.foot.includes('Ir a la tienda oficial') && r.foot.includes('Email'));
  await p.goto(BASE + '/polarizadas.html', { waitUntil: 'networkidle' });
  r = await p.evaluate(() => ({ h2: document.getElementById('polar-title').textContent, tags: [...document.querySelectorAll('.compare__tag')].map((t) => t.textContent), store: document.querySelector('.cat-head__store').href, after: !!(document.getElementById('catGrid').compareDocumentPosition(document.getElementById('compare')) & 4) }));
  ok('Polarizadas: la simulación «Cómo se ve el reflejo» vive en la categoría, después de la grilla', r.h2 === 'Cómo se ve el reflejo' && r.tags.join('|') === 'Lente común|Lente polarizado' && r.after && /gafas-polarizadas/.test(r.store), r.store);
  await p.goto(BASE + '/ayuda.html', { waitUntil: 'networkidle' });
  r = await p.evaluate(() => ({ back: [...document.querySelectorAll('#comprar a')].map((a) => a.textContent.trim() + '→' + a.getAttribute('href')), txt: document.getElementById('contenido').innerText }));
  ok('Ayuda: «Ver todas las categorías» lleva al catálogo general; sin tarjetas ni plazos sin validar', r.back.length === 1 && /Ver todas las categorías→\/catalogo/.test(r.back[0]) && !/Visa|Mastercard|Naranja|Cabal|Resolución|art\. 1116/.test(r.txt), r.back[0]);
  await p.click('.help__nav a[href="#envios"]'); await p.waitForTimeout(700);
  r = await p.evaluate(() => { const t = document.querySelector('#envios h2').getBoundingClientRect(), h = document.querySelector('.header').getBoundingClientRect(); return { top: Math.round(t.top), hb: Math.round(h.bottom) }; });
  ok('Ayuda: el ancla deja el título visible debajo de la cabecera', r.top >= r.hb && r.top < 500, JSON.stringify(r));
  await ctx.close();

  /* ---------- Recorrido Home → categoría → filtros → ficha → color → compra y WhatsApp ---------- */
  for (const w of [1440, 390, 360]) {
    const mob = w < 800;
    ctx = await b.newContext({ viewport: { width: w, height: mob ? 780 : 900 }, hasTouch: mob, isMobile: mob }); p = await ctx.newPage(); watch(p);
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    if (mob) {
      await p.click('#menuToggle'); await p.waitForTimeout(250);
      r = await p.evaluate(() => ({ in: document.getElementById('mobileMenu').contains(document.activeElement), items: [...document.querySelectorAll('#mobileMenu a')].map((a) => a.textContent.trim()) }));
      ok(`${w} px · Menú: foco adentro, Catálogo + categorías, Ayuda y WhatsApp al final`, r.in && r.items.slice(0, 6).join('|') === 'Catálogo|Gafas de sol|Polarizadas|Armazones|Clip-on 2 en 1|Accesorios' && r.items.slice(-2).join('|') === 'Ayuda|Escribinos por WhatsApp', r.items.join(' · '));
      await Promise.all([p.waitForURL('**/gafas-de-sol**'), p.click('#mobileMenu a[href^="/gafas-de-sol"]')]);
    } else {
      await Promise.all([p.waitForURL('**/gafas-de-sol**'), p.click('.tri__item[href^="/gafas-de-sol"]')]);
    }
    await p.waitForLoadState('networkidle');
    if (mob) {
      await p.click('#filtersOpen'); await p.waitForTimeout(250);
      await p.keyboard.press('Tab'); await p.keyboard.press('Space');     // primera casilla, con teclado
      const first = await p.evaluate(() => document.activeElement.id);
      await p.keyboard.press('Space');
      await p.click('label[for="f-forma-cuadrada"]'); await p.waitForTimeout(80);
      const apply = await p.textContent('#filtersApply');
      await p.keyboard.press('Escape'); await p.waitForTimeout(250);
      ok(`${w} px · Filtros: operables con teclado, recuento en el botón, Escape cierra y devuelve el foco`, /^f-/.test(first) && /^Ver \d+ modelos?$/.test(apply) && await p.evaluate(() => !document.getElementById('filters').classList.contains('is-open') && document.activeElement.id === 'filtersOpen'), `foco en ${first} · «${apply}»`);
    } else {
      await p.click('label[for="f-forma-cuadrada"]'); await p.waitForTimeout(80);
    }
    const listURL = await p.evaluate(() => location.pathname + location.search);
    await p.evaluate(() => document.querySelector('#catGrid .product-card[data-id="charlotte"]').scrollIntoView({ block: 'center', behavior: 'instant' }));
    const y0 = await p.evaluate(() => Math.round(scrollY));
    await Promise.all([p.waitForURL('**/producto/charlotte**'), p.click('#catGrid .product-card[data-id="charlotte"] .product-card__name')]); await p.waitForLoadState('networkidle');
    r = await p.evaluate(() => { const b = document.getElementById('backToList'); return { back: !b.hidden && b.getAttribute('href'), order: ['pdpTitle', 'galleryStage', 'pdpSwatches', 'pdpPrice', 'pdpBuy'].map((i) => Math.round(document.getElementById(i).getBoundingClientRect().top)) }; });
    ok(`${w} px · Ficha: «Volver a resultados» conserva el filtro`, r.back === listURL, r.back);
    if (mob) ok(`${w} px · Ficha: título → foto → color → precio → acción`, r.order.every((y, i) => !i || y > r.order[i - 1]), r.order.join(' < '));
    await p.click('#pdpSwatches .swatch[aria-label^="Color: Negro"]'); await p.waitForTimeout(120);
    const pick = await p.evaluate(() => ({ v: document.getElementById('pdpVariant').textContent, buy: document.getElementById('pdpBuy').href, wa: decodeURIComponent(document.getElementById('pdpWa').href), waHost: new URL(document.getElementById('pdpWa').href).host + new URL(document.getElementById('pdpWa').href).pathname, url: location.pathname + location.search, bar: document.getElementById('buybarBtn').href, store: window.SG.BY_ID.charlotte.vars[1] }));
    ok(`${w} px · Charlotte Negro: compra y WhatsApp apuntan al modelo y color elegidos`, pick.v === 'Negro' && pick.buy === pick.store.url && pick.bar === pick.store.url && pick.waHost === 'wa.me/5493454149784' && /consultar por Charlotte en Negro\. La ficha es http.+charlotte(\.html)?\?color=negro\.$/.test(pick.wa), pick.buy + ' · ' + pick.wa.split('text=')[1]);
    await p.reload({ waitUntil: 'networkidle' });
    ok(`${w} px · Recargar conserva el color`, await p.evaluate(() => document.getElementById('pdpVariant').textContent === 'Negro' && document.getElementById('pdpBuy').href.endsWith('charlotte-black')));
    if (mob) {
      // barra fija: aparece al pasar el botón, repite la acción y no tapa el final del contenido ni el distintivo del hosting
      await p.evaluate(() => scrollTo({ top: document.getElementById('medidas').offsetTop + 400, behavior: 'instant' })); await p.waitForTimeout(600);
      r = await p.evaluate(() => { const bar = document.getElementById('buybar').getBoundingClientRect(), f = document.querySelector('iframe[style*="position:fixed"], iframe[style*="position: fixed"]');
        const badge = f ? f.getBoundingClientRect() : null; scrollTo(0, document.documentElement.scrollHeight);
        const last = document.querySelector('.page').getBoundingClientRect(), pad = parseFloat(getComputedStyle(document.querySelector('.page')).paddingBottom);
        return { vis: !document.getElementById('buybar').hidden, txt: document.getElementById('buybarBtn').textContent, h: Math.round(bar.height), w: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, pad, badge: badge ? [Math.round(badge.top), Math.round(badge.height)] : null, barBottom: Math.round(bar.bottom), vh: innerHeight }; });
      ok(`${w} px · Barra fija: «Comprar en Empretienda», con espacio reservado y sin desborde`, r.vis && r.txt === 'Comprar en Empretienda' && r.pad >= r.h + (r.vh - r.barBottom) && r.w <= r.cw, `barra ${r.h}px, reserva ${Math.round(r.pad)}px` + (r.badge ? ` · distintivo del hosting a ${r.vh - r.barBottom}px por debajo de la barra` : ' · sin distintivo en este servidor'));
      if (r.badge) ok(`${w} px · La barra fija queda por encima del distintivo del hosting`, r.vh - r.barBottom >= 44, JSON.stringify(r.badge));
    }
    await p.goBack({ waitUntil: 'networkidle' }); await p.waitForTimeout(400);
    r = await p.evaluate(() => ({ url: location.pathname + location.search, y: Math.round(scrollY), chips: [...document.querySelectorAll('#applied .chip-x')].map((c) => c.textContent.trim()), n: document.querySelectorAll('#catGrid .product-card').length }));
    ok(`${w} px · Atrás: recupera filtros y posición de lectura`, r.url === listURL && r.chips.join() === 'Cuadradas' && Math.abs(r.y - y0) < 80, `${r.url} · scroll ${y0} → ${r.y}`);
    if (STORE) {
      await p.goto(BASE + '/', { waitUntil: 'networkidle' });
      await Promise.all([p.waitForURL('**/producto/saturday**'), p.click('.hero__sign a')]); await p.waitForLoadState('networkidle');
      const s = await p.evaluate(() => ({ v: document.getElementById('pdpVariant').textContent, buy: document.getElementById('pdpBuy').href, list: document.getElementById('pdpList').textContent }));
      await Promise.all([p.waitForURL('**empretienda.com.ar/**'), p.click('#pdpBuy')]); await p.waitForLoadState('domcontentloaded');
      const st = await p.evaluate(() => ({ url: location.href, title: (document.querySelector('meta[property="og:title"]') || {}).content || document.title, price: (document.documentElement.innerHTML.match(/var s_producto = (\{.*?\});/) || [])[1] }));
      const sp = st.price ? JSON.parse(st.price) : {};
      ok(`${w} px · Home → Saturday XL Print → Empretienda: misma variante y mismo precio de lista`, s.v === 'Print' && st.url === s.buy && /saturday xl print/i.test(st.title) && '$' + Math.round(sp.precio).toLocaleString('es-AR') === s.list && !!sp.stock, `${st.title} · ${st.url} · lista ${s.list} · stock ${!!sp.stock}`);
    }
    await ctx.close();
  }

  await b.close();
  const uniq = [...new Set(errors)];
  ok('Sin errores de JavaScript ni de consola', !uniq.length, uniq.slice(0, 8).join(' | '));
  const pad = Math.max(...results.map((r) => r[1].length));
  results.forEach((r) => console.log(r[0], r[1].padEnd(pad), r[2]));
  console.log(`\n${results.filter((r) => r[0] === 'OK ').length}/${results.length} verificaciones correctas`);
  process.exit(results.some((r) => r[0] !== 'OK ') ? 1 : 0);
})();
