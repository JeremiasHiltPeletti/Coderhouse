/* =========================================================
   Sunnygafas — Home: recién llegadas, selector de forma y comparador
   Datos: js/data.js · Tarjeta, menú y buscador: js/site.js
   ========================================================= */
(function () {
  const SG = window.SG;
  const { PRODUCTS, BY_ID, FEATURED, SHAPE_GROUPS, SHAPE_NAME, productURL, inGroup, firstInStock, cardHTML, bindSwatches, $, $$ } = SG;

  /* ---------- Recién llegadas ---------- */
  const newGrid = $("#newGrid");
  newGrid.innerHTML = FEATURED.map((id) => cardHTML(BY_ID[id], firstInStock(BY_ID[id]))).join("");
  bindSwatches(newGrid);

  /* ---------- Elegí por forma ---------- */
  /* Fotos con el modelo puesto: salen de la galería oficial de esa misma variante */
  const PUESTAS = [
    { id: "saturday", color: "print", src: "saturday-xl-print-2", alt: "Mujer con las gafas Saturday XL print, de tres cuartos" },
    { id: "charlotte", color: "marron", src: "charlotte-brown-2", alt: "Mujer con las gafas Charlotte marrón, al sol en la calle" },
    { id: "risky", color: "negro", src: "risky-5", alt: "Hombre con el armazón Risky negro, de perfil" },
    { id: "pilot", color: "negro", src: "pilot-black-1", alt: "Mujer con las gafas Pilot negro, dentro de un auto" },
    { id: "lupe", color: "print", src: "lupe-1", alt: "Mujer con el armazón Lupe print" }
  ].map((f) => {
    const p = BY_ID[f.id];
    return p ? Object.assign(f, { p, vi: Math.max(0, p.vars.findIndex((v) => v.slug === f.color)) }) : null;
  }).filter(Boolean);
  const CAT_ORDER = { sol: 0, pol: 1, arm: 2, clip: 3, acc: 4 };
  const shapeGrid = $("#shapeGrid"), shapeAll = $("#shapeAll"), shapeStatus = $("#shapeStatus"), fitShot = $("#fitShot");
  function renderShape(group, announce) {
    const all = PRODUCTS.filter((p) => inGroup(p, group) && p.vars.some((v) => v.stock))
      .sort((a, b) => (CAT_ORDER[a.cat] - CAT_ORDER[b.cat]) || (b.isNew - a.isNew));
    const list = all.slice(0, 4);
    shapeGrid.innerHTML = list.map((p) => cardHTML(p, firstInStock(p))).join("");
    // Misma regla que la grilla: solo retratos de modelos de la forma activa
    const puestas = PUESTAS.filter((f) => inGroup(f.p, group)).slice(0, 2);
    fitShot.hidden = !puestas.length;
    fitShot.classList.toggle("puestas--single", puestas.length === 1);
    $(".shape-body").classList.toggle("shape-body--full", !puestas.length);
    $(".puestas__list", fitShot).innerHTML = puestas.map((f) => {
      const v = f.p.vars[f.vi];
      return '<a class="puesta" href="' + productURL(f.p, f.vi) + '"><img src="/assets/img/p/' + f.src + '.webp" alt="' + f.alt + '" loading="lazy">' +
        '<span class="puesta__cap"><b>' + f.p.name + "</b> · " + v.label + "</span></a>";
    }).join("");
    shapeAll.href = "/catalogo.html?forma=" + group;
    shapeAll.firstChild.textContent = "Ver los " + all.length + " modelos " + SHAPE_GROUPS[group].plural + " ";
    if (announce) shapeStatus.textContent = SHAPE_GROUPS[group].label + ": " + list.length + " modelos. " + list.map((p) => p.name + " (" + SHAPE_NAME[p.shape].toLowerCase() + ")").join(", ") + ".";
  }
  bindSwatches(shapeGrid);
  $$(".shape").forEach((btn) => btn.addEventListener("click", () => {
    $$(".shape").forEach((b) => b.setAttribute("aria-pressed", b === btn));
    renderShape(btn.dataset.shape, true);
  }));
  renderShape("redonda", false);

  /* ---------- Comparador: misma foto en ambas capas; la común suma un reflejo simulado ---------- */
  const stage = $(".compare__stage"), range = $("#compareRange");
  function setPos(v) {
    v = Math.max(0, Math.min(100, Math.round(v)));
    range.value = v;
    stage.style.setProperty("--pos", v + "%");
    range.setAttribute("aria-valuetext", (100 - v) + "% de la vista con lente polarizada");
  }
  range.addEventListener("input", () => setPos(+range.value));
  let dragging = false, startX = 0;
  const fromPointer = (e) => { const r = stage.getBoundingClientRect(); setPos(((e.clientX - r.left) / r.width) * 100); };
  // touch-action: pan-y deja el desplazamiento vertical al navegador; el gesto horizontal mueve la división
  stage.addEventListener("pointerdown", (e) => {
    dragging = true; startX = e.clientX;
    if (e.pointerType === "mouse") { stage.setPointerCapture(e.pointerId); fromPointer(e); range.focus({ preventScroll: true }); }
  });
  stage.addEventListener("pointermove", (e) => { if (dragging && (e.pointerType === "mouse" || Math.abs(e.clientX - startX) > 4)) fromPointer(e); });
  ["pointerup", "pointercancel", "pointerleave"].forEach((t) => stage.addEventListener(t, (e) => {
    if (dragging && e.type === "pointerup" && e.pointerType !== "mouse" && Math.abs(e.clientX - startX) <= 4) fromPointer(e);
    if (e.type !== "pointerleave" || e.pointerType !== "mouse") dragging = false;
  }));
  stage.style.touchAction = "pan-y";
  setPos(+range.value);
})();
