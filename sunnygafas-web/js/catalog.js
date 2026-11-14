/* =========================================================
   Sunnygafas — Catálogo: filtros, orden, estado en la URL
   La página fija la categoría con data-cat (vacío = todo el catálogo).
   Parámetros: ?forma= &color= &col= &cat= &stock=1 &orden= &q=
   ========================================================= */
(function () {
  const SG = window.SG;
  const { PRODUCTS, SHAPE_GROUPS, CATEGORIES, CAT_PAGE, COLLECTIONS, COLOR_FAMILY, FAMILY_HEX, inGroup, norm, search, cardHTML, bindSwatches, $, $$ } = SG;
  const main = $("#contenido"), cat = main.dataset.cat || null;
  const grid = $("#catGrid"), count = $("#catCount"), applied = $("#applied"), empty = $("#catEmpty"), form = $("#filterForm");
  const filters = $("#filters"), panel = $("#filtersPanel"), openBtn = $("#filtersOpen"), badge = $("#filtersBadge"), applyBtn = $("#filtersApply"), sort = $("#sort");
  const q0 = new URLSearchParams(location.search);
  const text = (q0.get("q") || "").trim();

  /* ---------- Base: categoría de la página o resultados de búsqueda ---------- */
  let base, hitVar = {};
  if (text) {
    const hits = search(text);
    base = []; hits.forEach((h) => { if (!(h.p.id in hitVar)) { hitVar[h.p.id] = h.vi; base.push(h.p); } });
    const safe = text.replace(/[<>&]/g, "");
    $("#catTitle").textContent = "Resultados para «" + safe + "»";
    $("#crumbCurrent").textContent = "Búsqueda";
    $("#catIntro").textContent = "Buscamos en modelos, formas y colores.";
    document.title = "«" + safe + "» · Sunnygafas";
  } else {
    base = PRODUCTS.filter((p) => !cat || p.cat === cat);
  }

  /* ---------- Grupos de filtro según lo que hay en la base ---------- */
  const colSlug = (c) => norm(c);
  const famSlug = (f) => norm(f).replace(/[^a-z]+/g, "-");
  const famOf = (v) => COLOR_FAMILY[v.c] || "Color";
  const GROUPS = [];
  if (!cat) {
    const cats = Object.keys(CATEGORIES).filter((k) => base.some((p) => p.cat === k));
    if (cats.length > 1) GROUPS.push({ key: "cat", label: "Categoría", options: cats.map((k) => ({ v: k, label: CATEGORIES[k] })), test: (p, vals) => vals.includes(p.cat) });
  }
  const shapes = Object.keys(SHAPE_GROUPS).filter((g) => base.some((p) => inGroup(p, g)));
  if (shapes.length > 1) GROUPS.push({ key: "forma", label: "Forma", options: shapes.map((g) => ({ v: g, label: SHAPE_GROUPS[g].label, icon: "f-" + g })), test: (p, vals) => vals.some((g) => inGroup(p, g)) });
  const fams = Object.keys(FAMILY_HEX).filter((f) => base.some((p) => p.vars.some((v) => famOf(v) === f)));
  if (fams.length > 1) GROUPS.push({ key: "color", label: "Color", options: fams.map((f) => ({ v: famSlug(f), label: f, hex: FAMILY_HEX[f] })), test: (p, vals) => p.vars.some((v) => vals.includes(famSlug(famOf(v)))) });
  const cols = COLLECTIONS.filter((c) => base.some((p) => p.col === c));
  if (cols.length > 1) GROUPS.push({ key: "col", label: "Colección", options: cols.map((c) => ({ v: colSlug(c), label: c })), test: (p, vals) => !!p.col && vals.includes(colSlug(p.col)) });
  if (base.some((p) => p.vars.some((v) => !v.stock))) GROUPS.push({ key: "stock", label: "Disponibilidad", options: [{ v: "1", label: "Solo con stock" }], test: (p) => p.vars.some((v) => v.stock) });

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
  const minPrice = (p) => Math.min.apply(null, p.vars.map((v) => v.price));
  function variantFor(p) {
    // Muestra el color que coincide con el filtro o con la búsqueda; si no, el primero con stock
    if (state.color && state.color.length) {
      const m = p.vars.map((v, i) => ({ v, i })).filter((x) => state.color.includes(famSlug(famOf(x.v))));
      const pick = m.find((x) => x.v.stock) || m[0];
      if (pick) return pick.i;
    }
    if (p.id in hitVar) return hitVar[p.id];
    return SG.firstInStock(p);
  }
  function current() {
    let list = base.filter((p) => GROUPS.every((g) => !state[g.key].length || g.test(p, state[g.key])));
    const o = sort.value;
    if (o === "menor") list = list.slice().sort((a, b) => minPrice(a) - minPrice(b));
    else if (o === "mayor") list = list.slice().sort((a, b) => minPrice(b) - minPrice(a));
    else if (o === "nombre") list = list.slice().sort((a, b) => a.name.localeCompare(b.name, "es"));
    else list = list.slice().sort((a, b) => (b.vars.some((v) => v.stock) - a.vars.some((v) => v.stock)) || (b.isNew - a.isNew));
    return list;
  }
  const nActive = () => GROUPS.reduce((n, g) => n + state[g.key].length, 0);
  function syncURL() {
    const out = new URLSearchParams();
    if (text) out.set("q", text);
    GROUPS.forEach((g) => { if (state[g.key].length) out.set(g.key, state[g.key].join(",")); });
    if (sort.value) out.set("orden", sort.value);
    const s = out.toString();
    history.replaceState(null, "", location.pathname + (s ? "?" + s : ""));
  }
  function render() {
    const list = current(), n = list.length, act = nActive();
    grid.innerHTML = list.map((p, i) => cardHTML(p, variantFor(p), { eager: i < 4 })).join("");
    grid.hidden = !n; empty.hidden = !!n;
    const word = n === 1 ? " modelo" : " modelos";
    count.textContent = n + word + (act ? " con " + act + (act === 1 ? " filtro" : " filtros") : "");
    applyBtn.textContent = n ? "Ver " + n + word : "Sin resultados";
    badge.hidden = !act; badge.textContent = act;
    openBtn.setAttribute("aria-label", "Filtrar" + (act ? ", " + act + (act === 1 ? " filtro aplicado" : " filtros aplicados") : ""));
    applied.innerHTML = GROUPS.map((g) => state[g.key].map((v) => {
      const o = g.options.find((x) => x.v === v);
      return '<li><button type="button" class="chip-x" data-key="' + g.key + '" data-v="' + v + '" aria-label="Quitar filtro ' + o.label + '">' + o.label + '<svg class="icon" aria-hidden="true"><use href="#i-close"/></svg></button></li>';
    }).join("")).join("") + (act > 1 ? '<li><button type="button" class="link applied__clear" data-clear>Borrar filtros</button></li>' : "");
    applied.hidden = !act;
    if (!n) {
      $("#emptyTitle").textContent = text && !act ? "No encontramos «" + text.replace(/[<>&]/g, "") + "»" : "No hay modelos con esos filtros";
      $("#emptyText").textContent = text && !act ? "Probá con una forma, como redonda o aviador, o con un color." : "Sacá un filtro para ver más modelos.";
      $("#emptyClear").hidden = !act;
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
