/* =========================================================
   Sunnygafas — Catálogo: filtros, orden, estado en la URL
   La página fija la categoría con data-cat (vacío = todo el catálogo).
   Parámetros: ?forma= &color= &col= &cat= &stock=1 &orden= &q=
   Color y stock se cruzan sobre una misma variante; la tarjeta muestra y enlaza esa variante.
   ========================================================= */
(function () {
  const SG = window.SG;
  const byId = (i) => document.getElementById(i);
  /* Catálogo no disponible: sin datos no hay grilla que mostrar; se ofrece reintentar y contacto */
  if (!SG || !SG.PRODUCTS || !SG.cardHTML) {
    ["catGrid", "filters", "applied"].forEach((i) => { byId(i).hidden = true; });
    document.querySelector(".cat-bar").hidden = true;
    byId("catError").hidden = false;
    byId("catRetry").addEventListener("click", () => location.reload());
    return;
  }
  const { PRODUCTS, SHAPE_GROUPS, CATEGORIES, COLLECTIONS, FAMILIES, FAMILY_HEX, inGroup, norm, search, cardHTML, bindSwatches, $, $$ } = SG;
  const main = $("#contenido"), cat = main.dataset.cat || null;
  const grid = $("#catGrid"), count = $("#catCount"), applied = $("#applied"), empty = $("#catEmpty"), form = $("#filterForm");
  const filters = $("#filters"), panel = $("#filtersPanel"), openBtn = $("#filtersOpen"), badge = $("#filtersBadge"), applyBtn = $("#filtersApply"), sort = $("#sort");
  const q0 = new URLSearchParams(location.search);
  const text = (q0.get("q") || "").trim(), safe = text.replace(/[<>&]/g, "");

  /* ---------- Base: categoría de la página o resultados de búsqueda ---------- */
  /* hit[id] = { pref: variante sugerida, only: variantes que nombra la consulta (si identifica un color) } */
  let base; const hit = {};
  if (text) {
    base = [];
    search(text).forEach((h) => {
      if (!hit[h.p.id]) { hit[h.p.id] = { pref: h.vi, only: h.byColor ? [] : null }; base.push(h.p); }
      if (h.byColor) hit[h.p.id].only.push(h.vi);
    });
    $("#catTitle").textContent = "Resultados para “" + safe + "”";
    $("#crumbCurrent").textContent = "Búsqueda";
    $("#catIntro").textContent = "Buscamos en modelos, formas y colores.";
    $("#catSearch").hidden = false; $("#catSearchInput").value = text;
    document.title = "“" + safe + "” · Sunnygafas";
  } else {
    base = PRODUCTS.filter((p) => !cat || p.cat === cat);
  }

  /* ---------- Grupos de filtro según lo que hay en la base ----------
     Valores de un mismo grupo: OR. Grupos distintos: AND.
     Categoría, forma y colección se prueban sobre el modelo (test).
     Color y stock se prueban sobre una misma variante (vtest): un modelo entra solo si
     alguna de sus variantes cumple las dos condiciones a la vez. */
  const colSlug = (c) => norm(c);
  const famSlug = (f) => norm(f).replace(/[^a-z]+/g, "-");
  const famOf = (v) => v.fam || "Color";
  const GROUPS = [];
  if (!cat) {
    const cats = Object.keys(CATEGORIES).filter((k) => base.some((p) => p.cat === k));
    if (cats.length > 1) GROUPS.push({ key: "cat", label: "Categoría", options: cats.map((k) => ({ v: k, label: CATEGORIES[k] })), test: (p, vals) => vals.includes(p.cat) });
  }
  const shapes = Object.keys(SHAPE_GROUPS).filter((g) => base.some((p) => inGroup(p, g)));
  if (shapes.length > 1) GROUPS.push({ key: "forma", label: "Forma", options: shapes.map((g) => ({ v: g, label: SHAPE_GROUPS[g].label, icon: "f-" + g })), test: (p, vals) => vals.some((g) => inGroup(p, g)) });
  const fams = FAMILIES.filter((f) => base.some((p) => p.vars.some((v) => famOf(v) === f)));
  if (fams.length > 1) GROUPS.push({ key: "color", label: "Color", options: fams.map((f) => ({ v: famSlug(f), label: f, hex: FAMILY_HEX[f] })), vtest: (v, vals) => vals.includes(famSlug(famOf(v))) });
  const cols = COLLECTIONS.filter((c) => base.some((p) => p.col === c));
  if (cols.length > 1) GROUPS.push({ key: "col", label: "Colección", options: cols.map((c) => ({ v: colSlug(c), label: c })), test: (p, vals) => !!p.col && vals.includes(colSlug(p.col)) });
  if (base.some((p) => p.vars.some((v) => !v.stock))) GROUPS.push({ key: "stock", label: "Disponibilidad", options: [{ v: "1", label: "Solo con stock" }], vtest: (v) => v.stock });

  /* ---------- Estado inicial desde la URL ---------- */
  const state = {};
  GROUPS.forEach((g) => {
    const allowed = g.options.map((o) => o.v);
    state[g.key] = (q0.get(g.key) || "").split(",").map((x) => norm(x.trim())).filter((x) => allowed.includes(x));
  });
  sort.value = ["menor", "mayor", "nombre"].includes(q0.get("orden")) ? q0.get("orden") : "";

  form.innerHTML = GROUPS.map((g) =>
    '<fieldset class="fgroup"><legend>' + g.label + "</legend>" +
    g.options.map((o) => {
      const id = "f-" + g.key + "-" + o.v;
      return '<label class="fopt" for="' + id + '"><input type="checkbox" id="' + id + '" name="' + g.key + '" value="' + o.v + '"' + (state[g.key].includes(o.v) ? " checked" : "") + ">" +
        '<span class="fopt__box" aria-hidden="true"></span>' +
        (o.hex ? '<span class="fopt__dot" aria-hidden="true" style="background:' + o.hex + '"></span>' : "") +
        (o.icon ? '<svg class="shape__icon" aria-hidden="true"><use href="#' + o.icon + '"/></svg>' : "") +
        "<span>" + o.label + "</span></label>";
    }).join("") + "</fieldset>").join("");

  /* ---------- Render ---------- */
  const VGROUPS = GROUPS.filter((g) => g.vtest), PGROUPS = GROUPS.filter((g) => g.test);
  const vActive = () => VGROUPS.some((g) => state[g.key].length);
  /* Variantes del modelo que cumplen, todas juntas, los filtros de variante y el color de la búsqueda */
  function eligible(p) {
    const only = hit[p.id] && hit[p.id].only;
    return p.vars.map((v, i) => i).filter((i) => (!only || only.includes(i)) && VGROUPS.every((g) => !state[g.key].length || g.vtest(p.vars[i], state[g.key])));
  }
  /* Variante de la tarjeta: siempre una elegible; ante empate, la disponible */
  function variantFor(p, el) {
    const pref = hit[p.id] ? hit[p.id].pref : -1;
    if (el.includes(pref) && p.vars[pref].stock) return pref;
    const inStock = el.find((i) => p.vars[i].stock);
    return inStock != null ? inStock : (el.includes(pref) ? pref : el[0]);
  }
  /* Lista de { p, el, vi }: el precio y el stock que ordenan son los de la tarjeta visible */
  function current() {
    let list = base.filter((p) => PGROUPS.every((g) => !state[g.key].length || g.test(p, state[g.key])))
      .map((p) => { const el = eligible(p); return el.length ? { p, el, vi: variantFor(p, el) } : null; }).filter(Boolean);
    const price = (x) => x.p.vars[x.vi].price, known = (x) => price(x) != null;
    const byPrice = (dir) => (a, b) => (known(b) - known(a)) || (known(a) ? dir * (price(a) - price(b)) : 0) || a.p.name.localeCompare(b.p.name, "es");
    const o = sort.value;
    if (o === "menor") list.sort(byPrice(1));
    else if (o === "mayor") list.sort(byPrice(-1));
    else if (o === "nombre") list.sort((a, b) => a.p.name.localeCompare(b.p.name, "es"));
    else {
      // Destacados: primero la selección curada, después lo que tiene stock, agrupado por categoría
      const CAT_ORDER = ["sol", "pol", "arm", "clip", "acc"], feat = (x) => { const i = SG.FEATURED.indexOf(x.p.id); return i < 0 ? 99 : i; };
      list.sort((a, b) => (feat(a) - feat(b)) || (b.p.vars[b.vi].stock - a.p.vars[a.vi].stock) || (CAT_ORDER.indexOf(a.p.cat) - CAT_ORDER.indexOf(b.p.cat)));
    }
    return list;
  }
  const nActive = () => GROUPS.reduce((n, g) => n + state[g.key].length, 0);
  function syncURL() {
    const out = new URLSearchParams();
    if (text) out.set("q", text);
    GROUPS.forEach((g) => { if (state[g.key].length) out.set(g.key, state[g.key].join(",")); });
    if (sort.value) out.set("orden", sort.value);
    const s = out.toString(), url = location.pathname + (s ? "?" + s : "");
    history.replaceState(null, "", url);
    // La ficha ofrece «Volver a resultados» solo si hay un estado que recuperar
    try { if (s) sessionStorage.setItem("sg:list", url); else sessionStorage.removeItem("sg:list"); } catch (e) {}
  }
  function render() {
    const list = current(), n = list.length, act = nActive();
    const limit = vActive() || Object.values(hit).some((h) => h.only);
    grid.innerHTML = list.map((x, i) => cardHTML(x.p, x.vi, { eager: i < 4, only: limit ? x.el : null })).join("");
    grid.hidden = !n; empty.hidden = !!n;
    const word = n === 1 ? " modelo" : " modelos";
    count.textContent = n + word + (act ? " con " + act + (act === 1 ? " filtro" : " filtros") : "");
    applyBtn.textContent = n ? "Ver " + n + word : "Ver resultados";
    badge.hidden = !act; badge.textContent = act;
    openBtn.setAttribute("aria-label", "Filtrar" + (act ? ", " + act + (act === 1 ? " filtro aplicado" : " filtros aplicados") : ""));
    applied.innerHTML = GROUPS.map((g) => state[g.key].map((v) => {
      const o = g.options.find((x) => x.v === v);
      return '<li><button type="button" class="chip-x" data-key="' + g.key + '" data-v="' + v + '" aria-label="Quitar filtro ' + o.label + '">' + o.label + '<svg class="icon" aria-hidden="true"><use href="#i-close"/></svg></button></li>';
    }).join("")).join("") + (act > 1 ? '<li><button type="button" class="link applied__clear" data-clear>Borrar filtros</button></li>' : "");
    applied.hidden = !act;
    if (!n) {
      const noHits = text && !act;   // la búsqueda no encontró nada; con filtros activos, el vacío es de los filtros
      $("#emptyTitle").textContent = noHits ? "No encontramos resultados para “" + safe + "”." : "No encontramos modelos con esos filtros.";
      $("#emptyText").textContent = noHits ? "Probá otro modelo, forma o color." : "Probá quitar un filtro o ver todos los modelos de esta categoría.";
      $("#emptyClear").hidden = noHits;
      $("#emptySearch").hidden = !noHits;
      $("#emptyStore").hidden = !noHits;
      $("#emptyAll").hidden = noHits || !text;
    }
    $("#filtersClear").disabled = !act;
    syncURL();
  }
  function clearAll(focusTarget) {
    GROUPS.forEach((g) => { state[g.key] = []; });
    $$("input", form).forEach((i) => { i.checked = false; });
    render();
    if (focusTarget) focusTarget.focus();
  }

  form.addEventListener("change", (e) => {
    const i = e.target;
    state[i.name] = $$('input[name="' + i.name + '"]:checked', form).map((x) => x.value);
    render();               // el foco queda en la casilla; el recuento se anuncia con aria-live
  });
  form.addEventListener("submit", (e) => e.preventDefault());
  sort.addEventListener("change", render);
  applied.addEventListener("click", (e) => {
    if (e.target.closest("[data-clear]")) { clearAll(sort); return; }
    const b = e.target.closest(".chip-x");
    if (!b) return;
    const li = b.parentNode, next = (li.nextElementSibling || li.previousElementSibling);
    const nk = next && next.firstElementChild ? [next.firstElementChild.dataset.key, next.firstElementChild.dataset.v] : null;
    state[b.dataset.key] = state[b.dataset.key].filter((v) => v !== b.dataset.v);
    const box = $('input[name="' + b.dataset.key + '"][value="' + b.dataset.v + '"]', form);
    if (box) box.checked = false;
    render();
    // devuelve el foco a un control vecino para no perderlo
    const t = nk && nk[0] ? $('.chip-x[data-key="' + nk[0] + '"][data-v="' + nk[1] + '"]', applied) : null;
    (t || $("[data-clear]", applied) || (getComputedStyle(openBtn).display !== "none" ? openBtn : sort)).focus();
  });
  $("#filtersClear").addEventListener("click", () => clearAll());
  $("#emptyClear").addEventListener("click", () => clearAll(getComputedStyle(openBtn).display !== "none" ? openBtn : sort));
  $("#emptySearch").addEventListener("click", (e) => { e.stopPropagation(); SG.openSearch(text); });
  bindSwatches(grid);

  /* ---------- Hoja de filtros en celular ---------- */
  const isSheet = () => getComputedStyle(openBtn).display !== "none";
  function openSheet() {
    filters.classList.add("is-open"); document.body.style.overflow = "hidden";
    panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true");
    $(".filters__close", panel).focus();
  }
  function closeSheet(restore) {
    if (!filters.classList.contains("is-open")) return;
    filters.classList.remove("is-open"); document.body.style.overflow = "";
    panel.removeAttribute("role"); panel.removeAttribute("aria-modal");
    if (restore !== false) openBtn.focus();
  }
  openBtn.addEventListener("click", openSheet);
  $$("[data-close-filters]", filters).forEach((el) => el.addEventListener("click", () => closeSheet()));
  filters.addEventListener("keydown", (e) => {
    if (!filters.classList.contains("is-open")) return;
    if (e.key === "Escape") closeSheet();
    if (e.key === "Tab") {
      const f = $$("button:not([disabled]), input", panel);
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  window.addEventListener("resize", () => { if (!isSheet()) closeSheet(false); });

  if (!GROUPS.length) { filters.hidden = true; openBtn.hidden = true; main.classList.add("no-filters"); }
  render();
})();
