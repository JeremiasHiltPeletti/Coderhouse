/* Recorridos de verificación en navegador (Playwright).
   uso: node tools/test_flows.js [base]   (por defecto http://localhost:8090) */
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:8090';
const results = [];
const ok = (name, cond, extra) => { results.push([cond ? 'OK ' : 'FALLA', name, extra || '']); };

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const watch = (p) => {
    p.on('pageerror', (e) => errors.push('JS: ' + e.message));
    p.on('console', (m) => { if (m.type() === 'error') errors.push('consola: ' + m.text()); });
    p.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(BASE)) errors.push(r.status() + ' ' + r.url()); });
  };

  /* 1 · Home → Elegí por forma → ficha */
  let ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); let p = await ctx.newPage(); watch(p);
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p.click('.hero__ctas a[href="#forma"]'); await p.waitForTimeout(900);
  let r = await p.evaluate(() => { const t = document.getElementById('forma-title').getBoundingClientRect(), h = document.querySelector('.header').getBoundingClientRect(); return { top: t.top, hb: h.bottom }; });
  ok('Home: el título «Elegí por forma» queda visible bajo la cabecera fija', r.top >= r.hb && r.top < 400, JSON.stringify(r));
  for (const shape of ['cuadrada', 'cateye', 'aviador', 'redonda']) {
    await p.click(`.shape[data-shape="${shape}"]`); await p.waitForTimeout(150);
    r = await p.evaluate((shape) => {
      const SG = window.SG;
      const cards = [...document.querySelectorAll('#shapeGrid .product-card')].filter((c) => getComputedStyle(c).display !== 'none').map((c) => c.dataset.id);
      const puestas = [...document.querySelectorAll('#fitShot:not([hidden]) .puesta')].map((a) => new URL(a.href).pathname.split('/').pop().replace('.html', ''));
      return { cards, puestas, okCards: cards.every((id) => SG.inGroup(SG.BY_ID[id], shape)), okPuestas: puestas.every((id) => SG.inGroup(SG.BY_ID[id], shape)),
               fullWhenEmpty: puestas.length > 0 || document.querySelector('.shape-body').classList.contains('shape-body--full') };
    }, shape);
    ok(`Forma ${shape}: modelos y retratos coinciden con el filtro`, r.okCards && r.okPuestas && r.fullWhenEmpty && r.cards.length > 0, `${r.cards.length} modelos, ${r.puestas.length} retratos`);
  }
  await p.click('.shape[data-shape="cuadrada"]');
  const puestaHref = await p.getAttribute('#fitShot .puesta', 'href');
  await Promise.all([p.waitForURL('**/producto/**'), p.click('#fitShot .puesta')]); await p.waitForLoadState('networkidle');
  r = await p.evaluate(() => ({ h1: document.querySelector('h1').textContent, variant: document.getElementById('pdpVariant').textContent, buy: document.getElementById('pdpBuy').href }));
  ok('Retrato puesto → abre la ficha de esa variante', p.url().endsWith(puestaHref) && !!r.h1, `${r.h1} · ${r.variant}`);

  /* 2 · Buscar «Gala Carey» → ficha → Caramelo */
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p.click('#searchToggle'); await p.fill('#searchInput', 'Gala Carey'); await p.waitForTimeout(150);
  r = await p.evaluate(() => [...document.querySelectorAll('#searchResults a')].map((a) => a.getAttribute('href') + ' | ' + a.textContent.trim().slice(0, 40)));
  ok('Búsqueda «Gala Carey» devuelve la variante Carey', r.length === 1 && r[0].startsWith('/producto/gala.html') && /Carey/.test(r[0]), r.join(' ; '));
  await p.keyboard.press('ArrowDown'); await Promise.all([p.waitForURL('**/producto/**'), p.keyboard.press('Enter')]); await p.waitForLoadState('networkidle');
  const read = () => p.evaluate(() => {
    const SG = window.SG, pr = SG.BY_ID.gala, v = pr.vars.find((x) => x.label === document.getElementById('pdpVariant').textContent);
    const im = document.querySelector('#galleryStage figure:not([hidden]) img');
    return { variant: v.label, img: im.getAttribute('src'), imgOK: im.getAttribute('src').includes(v.img), transfer: document.getElementById('pdpTransfer').textContent, list: document.getElementById('pdpList').textContent,
             priceOK: document.getElementById('pdpTransfer').textContent === SG.money(SG.transferPrice(v.price)) && document.getElementById('pdpList').textContent === SG.money(v.price),
             buy: document.getElementById('pdpBuy').href, buyOK: document.getElementById('pdpBuy').href === v.url, wa: decodeURIComponent(document.getElementById('pdpWa').href), url: location.pathname + location.search };
  });
  r = await read();
  ok('Ficha Gala · Carey: foto, precio y destino de compra coinciden', r.variant === 'Carey' && r.imgOK && r.priceOK && r.buyOK, `${r.transfer} / ${r.list} → ${r.buy}`);
  await p.click('#pdpSwatches .swatch[aria-label="Caramelo"]'); await p.waitForTimeout(150);
  r = await read();
  ok('Cambiar a Caramelo: foto, color, precio, URL y destino se actualizan', r.variant === 'Caramelo' && r.imgOK && r.priceOK && r.buyOK && r.buy.endsWith('gala-caramelo') && r.url.endsWith('?color=caramelo') && r.wa.includes('Gala · Caramelo'), `${r.img} → ${r.buy}`);
  // foco conservado en la muestra y recarga con la misma variante
  ok('La muestra elegida conserva el foco', await p.evaluate(() => document.activeElement.getAttribute('aria-label') === 'Caramelo'));
  await p.reload({ waitUntil: 'networkidle' }); r = await read();
  ok('Recargar la URL conserva la variante', r.variant === 'Caramelo');
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p.click('#searchToggle'); await p.fill('#searchInput', 'Caramelo'); await p.waitForTimeout(150);
  r = await p.evaluate(() => [...document.querySelectorAll('#searchResults a')].map((a) => a.getAttribute('href')));
  ok('Búsqueda «Caramelo» abre variantes de ese color', r.length > 0 && r.every((h) => /caramel/.test(h)), r.join(' ; '));
  await p.fill('#searchInput', 'xyzzy'); await p.waitForTimeout(150);
  r = await p.evaluate(() => ({ n: document.querySelectorAll('#searchResults a').length, s: document.getElementById('searchStatus').textContent }));
  ok('Búsqueda sin coincidencias: mensaje útil', r.n === 0 && /No encontramos/.test(r.s), r.s);
  await p.keyboard.press('Escape');
  ok('Escape cierra el buscador y devuelve el foco', await p.evaluate(() => document.getElementById('searchPanel').hidden && document.activeElement.id === 'searchToggle'));
  // variante sin stock
  await p.goto(BASE + '/producto/yanis.html?color=negro', { waitUntil: 'networkidle' });
  r = await p.evaluate(() => ({ stock: !document.getElementById('pdpStock').hidden, buyHidden: document.getElementById('pdpBuy').hidden, wa: document.getElementById('pdpWaText').textContent, next: document.getElementById('pdpNext').textContent }));
  ok('Variante sin stock: estado real, sin botón de compra y con alternativa', r.stock && r.buyHidden && /reposición/.test(r.wa) && /Print/.test(r.next), r.next);
  await ctx.close();

  /* 3 · Catálogo móvil: aplicar, quitar y estado en cero */
  ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); p = await ctx.newPage(); watch(p);
  await p.goto(BASE + '/gafas-de-sol.html', { waitUntil: 'networkidle' });
  const total = await p.textContent('#catCount');
  await p.click('#filtersOpen'); await p.waitForTimeout(300);
  ok('Catálogo móvil: Filtrar abre la hoja y lleva el foco adentro', await p.evaluate(() => document.getElementById('filters').classList.contains('is-open') && document.getElementById('filtersPanel').contains(document.activeElement)));
  await p.click('label[for="f-forma-cateye"]'); await p.waitForTimeout(100);
  r = await p.evaluate(() => ({ count: document.getElementById('catCount').textContent, apply: document.getElementById('filtersApply').textContent, focus: document.activeElement.id }));
  ok('Aplicar «Cat eye»: recuento anunciado y foco conservado', /3 modelos con 1 filtro/.test(r.count) && r.focus === 'f-forma-cateye', `${r.count} · botón «${r.apply}»`);
  await p.click('label[for="f-col-superior"]'); await p.waitForTimeout(100);
  r = await p.evaluate(() => ({ count: document.getElementById('catCount').textContent, apply: document.getElementById('filtersApply').textContent }));
  await p.click('#filtersApply'); await p.waitForTimeout(300);
  r = await p.evaluate(() => ({ count: document.getElementById('catCount').textContent, emptyVisible: !document.getElementById('catEmpty').hidden, title: document.getElementById('emptyTitle').textContent, chips: [...document.querySelectorAll('#applied .chip-x')].map((c) => c.textContent.trim()), url: location.search, focus: document.activeElement.id }));
  ok('Cero resultados: estado útil, filtros aplicados visibles y foco devuelto', r.emptyVisible && r.chips.length === 2 && r.focus === 'filtersOpen' && /forma=cateye/.test(r.url), `${r.count} · ${r.title} · chips: ${r.chips.join(', ')}`);
  await p.click('#applied .chip-x[data-key="col"]'); await p.waitForTimeout(100);
  r = await p.evaluate(() => ({ count: document.getElementById('catCount').textContent, n: document.querySelectorAll('#catGrid .product-card').length, focusInApplied: !!document.activeElement.closest('#applied') || document.activeElement.id === 'filtersOpen' }));
  ok('Quitar un filtro desde su chip: vuelven los resultados y no se pierde el foco', r.n === 3 && r.focusInApplied, r.count);
  await p.click('#applied .chip-x'); await p.waitForTimeout(100);
  ok('Sin filtros vuelve el total', (await p.textContent('#catCount')) === total, total);
  r = await p.evaluate(() => { const bar = document.querySelector('.cat-bar'); scrollTo(0, 1200); return new Promise((res) => setTimeout(() => { const rc = bar.getBoundingClientRect(); res({ top: rc.top, visible: rc.top >= 0 && rc.bottom < 300 }); }, 200)); });
  ok('Filtrar y Ordenar siguen a mano al desplazar', r.visible, 'top ' + Math.round(r.top));
  await p.selectOption('#sort', 'menor'); await p.waitForTimeout(100);
  r = await p.evaluate(() => { const ids = [...document.querySelectorAll('#catGrid .product-card')].map((c) => window.SG.BY_ID[c.dataset.id].vars[0].price); return ids.every((x, i) => !i || x >= ids[i - 1]); });
  ok('Ordenar por menor precio', r);
  // menú móvil
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p.click('#menuToggle'); await p.waitForTimeout(300); await p.keyboard.press('Escape');
  ok('Menú móvil: Escape cierra y devuelve el foco', await p.evaluate(() => document.getElementById('mobileMenu').hidden && document.activeElement.id === 'menuToggle'));

  /* 4 · Comparador: tacto, mouse y teclado */
  await p.evaluate(() => document.getElementById('compare').scrollIntoView({ block: 'center', behavior: 'instant' })); await p.waitForTimeout(300);
  const box = await (await p.$('.compare__stage')).boundingBox();
  const cdp = await ctx.newCDPSession(p);
  const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const pos = () => p.evaluate(() => +document.getElementById('compareRange').value);
  let y0 = await p.evaluate(() => scrollY);
  await touch('touchStart', box.x + box.width * 0.5, box.y + box.height * 0.5);
  for (let i = 1; i <= 8; i++) await touch('touchMove', box.x + box.width * 0.5 + 2, box.y + box.height * 0.5 - i * 20);
  await touch('touchEnd'); await p.waitForTimeout(400);
  const y1 = await p.evaluate(() => scrollY);
  ok('Comparador: el gesto vertical sobre la imagen sigue desplazando la página', y1 > y0 + 60, `scroll ${Math.round(y0)} → ${Math.round(y1)}`);
  await p.evaluate(() => document.getElementById('compare').scrollIntoView({ block: 'center', behavior: 'instant' })); await p.waitForTimeout(300);
  const box2 = await (await p.$('.compare__stage')).boundingBox();
  const before = await pos();
  await touch('touchStart', box2.x + box2.width * 0.45, box2.y + box2.height * 0.5);
  for (let i = 1; i <= 8; i++) await touch('touchMove', box2.x + box2.width * (0.45 + i * 0.04), box2.y + box2.height * 0.5);
  await touch('touchEnd'); await p.waitForTimeout(200);
  ok('Comparador: el gesto horizontal mueve la división', (await pos()) > before + 15, `${before} → ${await pos()}`);
  await ctx.close();

  ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); p = await ctx.newPage(); watch(p);
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p.evaluate(() => document.getElementById('compare').scrollIntoView({ block: 'center', behavior: 'instant' })); await p.waitForTimeout(300);
  const bx = await (await p.$('.compare__stage')).boundingBox();
  await p.mouse.move(bx.x + bx.width * 0.3, bx.y + bx.height * 0.5); await p.mouse.down(); await p.mouse.move(bx.x + bx.width * 0.7, bx.y + bx.height * 0.5, { steps: 6 }); await p.mouse.up();
  ok('Comparador: arrastre con mouse', Math.abs((await p.evaluate(() => +document.getElementById('compareRange').value)) - 70) <= 2);
  await p.focus('#compareRange'); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft');
  r = await p.evaluate(() => ({ v: +document.getElementById('compareRange').value, handles: document.querySelectorAll('.compare__handle').length,
    outline: getComputedStyle(document.querySelector('.compare__handle span')).outlineStyle, a: document.querySelector('.compare__layer--plain img').getBoundingClientRect().top, b: document.querySelector('.compare__layer--polar img').getBoundingClientRect().top }));
  ok('Comparador: flechas del teclado, una sola manija, foco visible y horizonte alineado', r.v === 68 && r.handles === 1 && r.outline !== 'none' && r.a === r.b, JSON.stringify(r));

  /* 5 · Enlaces: internos existen; compatibilidad de la demo */
  const pages = ['/', '/gafas-de-sol.html', '/polarizadas.html', '/armazones.html', '/clip-on.html', '/accesorios.html', '/catalogo.html', '/guia-de-calce.html', '/ayuda.html', '/producto/gala.html', '/producto/tr90.html', '/producto/cadena-gold.html', '/404.html'];
  const internal = new Set(), external = new Set();
  for (const u of pages) {
    await p.goto(BASE + u, { waitUntil: 'networkidle' });
    const hrefs = await p.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => a.href));
    hrefs.forEach((h) => (h.startsWith(BASE) ? internal : external).add(h.split('#')[0]));
    const bad = await p.evaluate(() => [...document.querySelectorAll('img')].filter((i) => i.complete && !i.naturalWidth && i.loading !== 'lazy').map((i) => i.src));
    if (bad.length) errors.push('imagen rota en ' + u + ': ' + bad.join(', '));
    const leftovers = await p.evaluate(() => (document.body.innerText.match(/\[[^\]]{3,}\]|Vista de demostración|Demo de diseño|a confirmar vigencia|Demo:/g) || []));
    if (leftovers.length) errors.push('texto de demo en ' + u + ': ' + leftovers.join(' | '));
  }
  let missing = [];
  for (const h of internal) { if (!h.startsWith(BASE)) continue; const res = await ctx.request.get(h); if (res.status() >= 400) missing.push(res.status() + ' ' + h); }
  ok('Enlaces internos: todos existen', !missing.length, `${internal.size} destinos` + (missing.length ? ' · ' + missing.join(', ') : ''));
  console.log('Destinos externos:', [...external].filter((h) => !h.includes('/gafas-') && !h.includes('/armazones/') && !h.includes('/accesorios/') && !h.includes('/2-en-1')).join('\n  '));
  for (const [from, to] of [['/demo.html?vista=producto&id=gala&v=2', '/producto/gala.html?color=caramelo'], ['/demo.html?vista=catalogo&cat=polarizadas', '/polarizadas.html'], ['/demo.html?vista=catalogo&forma=aviador', '/catalogo.html?forma=aviador'], ['/demo.html?vista=ayuda#cambios', '/ayuda.html#cambios'], ['/demo.html?vista=guia', '/guia-de-calce.html']]) {
    await p.goto(BASE + from, { waitUntil: 'networkidle' }); await p.waitForTimeout(200);
    const at = await p.evaluate(() => location.pathname + location.search + location.hash);
    ok('Enlace viejo ' + from, at === to, '→ ' + at);
  }

  /* 6 · Desbordes y tamaño de controles */
  for (const w of [1440, 768, 390]) {
    const c2 = await b.newContext({ viewport: { width: w, height: 900 } }); const q = await c2.newPage(); watch(q);
    let over = [], small = [];
    for (const u of ['/', '/gafas-de-sol.html', '/producto/gala.html', '/producto/lennon.html', '/guia-de-calce.html', '/ayuda.html']) {
      await q.goto(BASE + u, { waitUntil: 'networkidle' });
      const m = await q.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
        small: [...document.querySelectorAll('a, button, select, input')].filter((e) => { const r = e.getBoundingClientRect(); if (!r.width || !r.height || e.closest('[hidden]') || getComputedStyle(e).visibility === 'hidden' || e.type === 'checkbox' || e.type === 'range') return false;
          const inline = e.tagName === 'A' && getComputedStyle(e).display === 'inline'; return !inline && (r.height < 43.5 || r.width < 43.5) && !e.classList.contains('skip-link'); }).map((e) => (e.className || e.tagName) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height)).slice(0, 6) }));
      if (m.sw > m.cw) over.push(u + ' ' + m.sw);
      if (w === 390 && m.small.length) small.push(u + ': ' + m.small.join(', '));
    }
    ok(`Sin desborde horizontal a ${w} px`, !over.length, over.join(', '));
    if (w === 390) ok('Controles táctiles de 44 px o más a 390 px', !small.length, small.join(' | '));
    await c2.close();
  }

  await b.close();
  const uniq = [...new Set(errors)];
  ok('Sin errores de consola, recursos rotos ni textos de demo', !uniq.length, uniq.slice(0, 10).join(' | '));
  const pad = Math.max(...results.map((r) => r[1].length));
  results.forEach((r) => console.log(r[0], r[1].padEnd(pad), r[2]));
  console.log(`\n${results.filter((r) => r[0] === 'OK ').length}/${results.length} verificaciones correctas`);
  process.exit(results.some((r) => r[0] !== 'OK ') ? 1 : 0);
})();
