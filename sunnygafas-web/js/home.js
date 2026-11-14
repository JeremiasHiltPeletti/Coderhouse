/* =========================================================
   Sunnygafas — Home: modelos para empezar y exploración por forma
   Datos: js/data.js · Tarjeta, carrito, menú y buscador: js/site.js
   ========================================================= */
(function () {
  const SG = window.SG;
  const { PRODUCTS, BY_ID, FEATURED, SHAPE_GROUPS, productURL, inGroup, firstInStock, cardHTML, bindSwatches, money, transferPrice, $, $$ } = SG;

  /* ---------- Modelos para empezar: selección por variedad de categoría y forma ---------- */
  const grid = $("#newGrid");
  grid.innerHTML = FEATURED.map((id) => cardHTML(BY_ID[id], firstInStock(BY_ID[id]))).join("");
  bindSwatches(grid);

  /* ---------- Elegí por forma (dentro de gafas de sol) ----------
     Cada forma muestra una variante real: la foto puesta y la montura de cerca son del mismo color.
     Si no hay foto puesta, se muestran dos vistas de la montura. */
  const SHAPE_PICK = {
    redonda:    { id: "oval", color: "dorado", shots: [
      { src: "oval-gold-3", worn: true, alt: "Mujer con las gafas Oval doradas", pos: "50% 22%" },
      { src: "oval-gold-6", alt: "Oval dorado, vista de la montura" }] },
    cuadrada:   { id: "charlotte", color: "marron", shots: [
      { src: "charlotte-brown-2", worn: true, alt: "Mujer con las gafas Charlotte marrón, al sol en la calle", pos: "50% 30%" },
      { src: "charlotte-brown-1", alt: "Charlotte marrón, vista de la montura sobre una superficie gris" }] },
    cateye:     { id: "pilot", color: "negro", shots: [
      { src: "pilot-black-1", worn: true, alt: "Mujer con las gafas Pilot negras, dentro de un auto", pos: "50% 28%" },
      { src: "pilot-black-4", studio: true, alt: "Pilot negro, vista de frente" }] },
    aviador:    { id: "saturday-premium", color: "print", shots: [
      { src: "saturday-premium-print-2", worn: true, alt: "Mujer con las gafas Saturday premium print", pos: "50% 26%" },
      { src: "saturday-premium-print-3", studio: true, alt: "Saturday premium print, vista de la montura" }] },
    geometrica: { id: "west", color: "negro", shots: [
      { src: "west-black-1", alt: "West negro, vista de la montura" },
      { src: "west-black-2", alt: "West negro, otra vista de la montura" }] }
  };
  const shapePhotos = $("#shapePhotos"), shapeModel = $("#shapeModel"), shapePrice = $("#shapePrice"), shapeAll = $("#shapeAll"), shapeStatus = $("#shapeStatus");
  function renderShape(group, announce) {
    const pick = SHAPE_PICK[group], p = BY_ID[pick.id];
    const vi = Math.max(0, p.vars.findIndex((v) => v.slug === pick.color)), v = p.vars[vi], url = productURL(p, vi);
    const n = PRODUCTS.filter((x) => x.cat === "sol" && inGroup(x, group)).length;
    shapePhotos.innerHTML = pick.shots.map((f) =>
      '<a class="shape__photo' + (f.studio ? " shape__photo--studio" : "") + '" href="' + url + '"><img src="/assets/img/p/' + f.src + '.webp" alt="' + f.alt + '" loading="lazy"' + (f.pos ? ' style="object-position:' + f.pos + '"' : "") + ">" +
      '<span class="shape__tag">' + (f.worn ? "Puesta" : "Montura") + "</span></a>").join("");
    shapeModel.textContent = p.name + " · " + v.label;
    shapeModel.href = url;
    shapePrice.innerHTML = "<strong>" + money(transferPrice(v.price)) + "</strong> con transferencia o efectivo · " + money(v.price) + " de lista";
    // La exploración por forma se mantiene dentro de gafas de sol, y el botón lo dice
    shapeAll.href = "/gafas-de-sol.html?forma=" + group;
    shapeAll.firstChild.textContent = "Ver gafas de sol " + SHAPE_GROUPS[group].fem + " (" + n + ") ";
    if (announce) shapeStatus.textContent = SHAPE_GROUPS[group].label + ": " + p.name + " " + v.label + ". " + n + (n === 1 ? " modelo de gafas de sol" : " modelos de gafas de sol") + " con esta forma.";
  }
  $$(".shape-btn").forEach((btn) => btn.addEventListener("click", () => {
    $$(".shape-btn").forEach((b) => b.setAttribute("aria-pressed", b === btn));
    renderShape(btn.dataset.shape, true);
  }));
  renderShape("cuadrada", false);
})();
