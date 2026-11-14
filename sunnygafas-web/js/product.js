/* =========================================================
   Sunnygafas — Ficha de producto
   El color elegido define fotos, nombre, precio, stock, consulta y el SKU que se agrega al carrito.
   URL: /producto/<modelo>.html?color=<color>
   Un atributo en null es «sin confirmar»: no se muestra ni se niega.
   ========================================================= */
(function () {
  const SG = window.SG;
  const { BY_ID, PRODUCTS, STORE, SHAPE_NAME, SHAPE_GROUPS, CATEGORIES, CAT_PAGE, money, moneyExact, transferPrice, fullName, typeLabel, productURL, inGroup, firstInStock, wa, maxQty, cardHTML, bindSwatches, $, $$ } = SG;
  const p = BY_ID[$("#contenido").dataset.product];
  if (!p) return;

  const q = new URLSearchParams(location.search);
  const asked = (q.get("color") || "").toLowerCase();
  let vi = p.vars.findIndex((v) => v.slug === asked);
  const badColor = !!asked && vi < 0;
  if (vi < 0) vi = firstInStock(p);
  let gi = 0;

  const stage = $("#galleryStage"), thumbs = $("#galleryThumbs"), gcount = $("#galleryCount");
  const swBox = $("#pdpSwatches"), status = $("#pdpStatus"), qtyIn = $("#pdpQty"), added = $("#pdpAdded");
  const isAcc = p.cat === "acc";
  const pageURL = (i) => location.origin + productURL(p, i);

  /* ---------- Color inválido en la URL: se muestra uno válido y se avisa ---------- */
  if (badColor) {
    const n = $("#pdpNotice");
    n.textContent = "Ese color no está en este modelo. Te mostramos " + p.vars[vi].label + ".";
    n.hidden = false;
    history.replaceState(null, "", productURL(p, vi));
  }

  /* ---------- Volver a resultados y Seguir comprando: recuperan el listado de origen si existe ---------- */
  try {
    const back = sessionStorage.getItem("sg:list");
    if (back && back.charAt(0) === "/") { const a = $("#backToList"); a.href = back; a.hidden = false; $("#pdpKeep").href = back; }
  } catch (e) {}

  /* ---------- Muestras de color ---------- */
  if (p.vars.length > 1) {
    swBox.innerHTML = p.vars.map((x, i) => SG.swatchBtn(x, i, false)).join("");
    swBox.addEventListener("click", (e) => { const b = e.target.closest(".swatch"); if (b) setVariant(+b.dataset.i, true); });
  } else {
    swBox.hidden = true;
  }

  /* ---------- Galería ---------- */
  function showPhoto(i, focusThumb) {
    const v = p.vars[vi];
    gi = (i + v.gal.length) % v.gal.length;
    $$("figure", stage).forEach((f, k) => { f.hidden = k !== gi; });
    $$("button", thumbs).forEach((b, k) => b.setAttribute("aria-current", k === gi));
    gcount.textContent = v.gal.length > 1 ? "Foto " + (gi + 1) + " de " + v.gal.length : "";
    if (focusThumb) $$("button", thumbs)[gi].focus();
  }
  function renderGallery() {
    const v = p.vars[vi], who = fullName(p, v);
    // Solo la primera foto visible carga con prioridad; el resto espera
    stage.innerHTML = v.gal.map((g, k) =>
      '<figure' + (k ? " hidden" : "") + '><img src="/assets/img/p/' + g.f + '.webp" width="' + g.w + '" height="' + g.h + '" alt="' + SG.esc(who) + ", foto " + (k + 1) + " de " + v.gal.length + '"' + (k ? ' loading="lazy"' : ' fetchpriority="high"') + "></figure>").join("") +
      (v.gal.length > 1 ? '<button type="button" class="gallery__nav gallery__nav--prev" data-step="-1" aria-label="Foto anterior"><svg class="icon" aria-hidden="true"><use href="#i-chev"/></svg></button><button type="button" class="gallery__nav gallery__nav--next" data-step="1" aria-label="Foto siguiente"><svg class="icon" aria-hidden="true"><use href="#i-chev"/></svg></button>' : "");
    thumbs.innerHTML = v.gal.length > 1 ? v.gal.map((g, k) =>
      '<li><button type="button" data-k="' + k + '" aria-label="Ver foto ' + (k + 1) + '" aria-current="' + (k === 0) + '"><img src="/assets/img/p/' + g.f + '.webp" alt="" width="' + g.w + '" height="' + g.h + '" loading="lazy"></button></li>').join("") : "";
    thumbs.hidden = v.gal.length < 2;
    showPhoto(0);
  }
  stage.addEventListener("click", (e) => { const b = e.target.closest("[data-step]"); if (b) showPhoto(gi + +b.dataset.step); });
  stage.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); showPhoto(gi + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); showPhoto(gi - 1); }
  });
  thumbs.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) showPhoto(+b.dataset.k); });
  let sx = null, sy = null;
  stage.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  stage.addEventListener("touchend", (e) => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) showPhoto(gi + (dx < 0 ? 1 : -1));
    sx = null;
  }, { passive: true });

  /* ---------- Cantidad: entre 1 y el stock del color elegido ---------- */
  const clampQty = () => { const max = maxQty(p.vars[vi]) || 1; const n = Math.max(1, Math.min(max, parseInt(qtyIn.value, 10) || 1)); qtyIn.value = n; qtyIn.max = max; $$(".qty__btn", $("#pdpQtyBox")).forEach((b) => { b.disabled = (+b.dataset.step < 0 && n <= 1) || (+b.dataset.step > 0 && n >= max); }); return n; };
  $("#pdpQtyBox").addEventListener("click", (e) => { const b = e.target.closest(".qty__btn"); if (!b) return; qtyIn.value = (parseInt(qtyIn.value, 10) || 1) + +b.dataset.step; clampQty(); });
  qtyIn.addEventListener("change", clampQty);

  /* ---------- Variante: fotos, nombre, precio, stock, consulta y SKU ---------- */
  function setVariant(i, user) {
    vi = i;
    const v = p.vars[vi], full = fullName(p, v), url = pageURL(vi), max = maxQty(v);
    $$(".swatch", swBox).forEach((s, k) => s.setAttribute("aria-pressed", k === vi));
    $("#pdpVariant").textContent = v.label;
    $("#pdpStock").hidden = v.stock;
    const others = p.vars.filter((x) => x.stock && x !== v).map((x) => x.label);
    $("#pdpAvail").textContent = v.stock ? (v.qty === 1 ? "Disponible · queda 1 unidad" : "Disponible" + (v.qty ? " · " + v.qty + " unidades" : "")) : (others.length ? "Disponible en " + others.join(", ") + "." : "Sin stock en este momento.");
    $("#pdpTransfer").textContent = money(transferPrice(v.price));
    $("#pdpList").textContent = money(v.price);
    $("#pdpInstallments").textContent = "con tarjeta, hasta " + STORE.installments + " cuotas sin interés de " + moneyExact(v.price / STORE.installments);
    $("#pdpPriceLabel").hidden = p.cat !== "arm";

    const add = $("#pdpAdd"), waBtn = $("#pdpWa"), rx = $("#pdpRx"), bar = $("#buybarBtn");
    added.hidden = true;
    $("#pdpQtyBox").hidden = !v.stock || max < 2;
    qtyIn.value = 1; clampQty();
    if (v.stock) {
      add.hidden = false;
      $("#pdpAddText").textContent = p.cat === "arm" ? "Agregar armazón al carrito" : "Agregar al carrito";
      waBtn.className = "btn btn-outline btn-lg";
      $("#pdpWaText").textContent = "Consultar por WhatsApp";
      waBtn.href = wa("Hola, quiero consultar por " + full + ". La ficha es " + url + ".");
      bar.textContent = "Agregar al carrito"; bar.dataset.mode = "add";
    } else {
      // Sin stock: no se puede agregar al carrito, tampoco desde la barra fija
      add.hidden = true;
      waBtn.className = "btn btn-primary btn-lg";
      $("#pdpWaText").textContent = "Consultar reposición por WhatsApp";
      waBtn.href = wa("Hola, ¿tienen prevista la reposición de " + full + "? La ficha es " + url + ".");
      bar.textContent = "Consultar reposición"; bar.dataset.mode = "wa";
    }
    rx.hidden = !p.rx;
    rx.href = wa("Hola, quiero un presupuesto de cristales con mi graduación para " + full + ". La ficha es " + url + ".");
    $("#buybarName").textContent = p.vars.length > 1 ? p.name + " · " + v.label : p.name;
    $("#buybarPrice").textContent = v.stock ? money(transferPrice(v.price)) + " con transferencia" : "Sin stock";

    // Datos de compra que respaldan las condiciones vigentes
    const facts = [
      ["i-tag", "<strong>25% off</strong> pagando con transferencia o efectivo"],
      ["i-card", "Tarjetas " + STORE.cards.slice(0, -1).join(", ") + " y " + STORE.cards.slice(-1) + ", hasta " + STORE.installments + " cuotas sin interés"],
      ["i-truck", "Envío por Correo Argentino, retiro o entrega a coordinar. El costo se confirma con tu código postal."]
    ];
    if (p.rx) facts.push(["i-check", "Si querés cristales con tu graduación, pedí un presupuesto para este armazón."]);
    $("#pdpFacts").innerHTML = facts.map((f) => '<li><svg class="icon" aria-hidden="true"><use href="#' + f[0] + '"/></svg><span>' + f[1] + "</span></li>").join("");

    // Medidas y calce: solo las cargadas; si faltan, una consulta específica
    const guide = "/guia-de-calce.html?modelo=" + p.id + "&color=" + v.slug;
    if (isAcc) {
      $("#medidas").hidden = true; $("#pdpMeasureJump").hidden = true;
    } else {
      $("#pdpMeasure").href = wa("Hola, ¿me pasás el ancho del lente, el puente y el largo de la varilla de " + full + "? La ficha es " + url + ".");
      $("#pdpGuide").href = guide;
    }

    // Detalles: protección UV, polarización y fotocromía son datos independientes; en clip-on, por pieza
    $("#pdpDesc").textContent = v.desc || "";
    $("#pdpDesc").hidden = !v.desc;
    const specs = [];
    if (p.vars.length > 1 || !isAcc) specs.push(["Color", v.label]);
    if (p.shape) specs.push(["Forma", SHAPE_NAME[p.shape]]);
    if (p.col) specs.push(["Colección", p.col]);
    if (p.cat === "arm") specs.push(["Uso", "Armazón para lentes con graduación"]);
    if (v.uv === true) specs.push(["Protección UV", "Filtro UV400"]);
    if (v.uv === false) specs.push(["Protección UV", "Sin filtro solar"]);
    if (v.photo === true) specs.push(["Tipo de lente", "Fotocromático"]);
    if (v.polar === true) specs.push(["Polarización", "Lentes polarizados"]);
    (p.parts || []).forEach((x) => specs.push(x));
    Object.entries(p.acc || {}).forEach((x) => specs.push(x));
    $("#pdpSpecs").innerHTML = specs.map((s) => "<div><dt>" + s[0] + "</dt><dd>" + SG.esc(s[1]) + "</dd></div>").join("");

    renderGallery();
    document.title = (p.vars.length > 1 ? p.name + " · " + v.label : p.name) + " · " + typeLabel(p) + " · Sunnygafas";
    if (user) {
      history.replaceState(null, "", productURL(p, vi));
      $("#pdpNotice").hidden = true;
      status.textContent = "Color " + v.label + (v.stock ? "" : ", sin stock") + ". " + money(transferPrice(v.price)) + " con transferencia o efectivo.";
    }
  }
  setVariant(vi, false);

  /* ---------- Agregar al carrito: el SKU del color elegido ---------- */
  function addToCart(fromBar) {
    const v = p.vars[vi];
    if (!v.stock) return;
    const n = fromBar ? 1 : clampQty();
    const r = SG.cart.add(v.sku, n);
    const name = fullName(p, v);
    $("#pdpAddedText").textContent = r.ok
      ? (r.capped ? "Tenés " + r.qty + " de " + name + " en el carrito: es todo el stock disponible." : "Agregaste " + (n > 1 ? n + " × " : "") + name + " al carrito.")
      : "Ya tenés todo el stock de " + name + " en el carrito (" + r.qty + ").";
    added.hidden = false;
    if (fromBar) { added.scrollIntoView({ block: "center" }); }
    added.focus({ preventScroll: !fromBar });
  }
  $("#pdpForm").addEventListener("submit", (e) => { e.preventDefault(); addToCart(false); });
  $("#buybarBtn").addEventListener("click", (e) => {
    if (e.currentTarget.dataset.mode === "wa") { location.href = $("#pdpWa").href; return; }
    addToCart(true);
  });

  /* ---------- Alternativas: misma categoría y forma, con stock; si son pocas, la categoría ---------- */
  const catName = CATEGORIES[p.cat], catLow = catName.charAt(0).toLowerCase() + catName.slice(1);
  const group = p.shape ? Object.keys(SHAPE_GROUPS).find((g) => inGroup(p, g)) : null;
  const avail = (x) => x.id !== p.id && x.cat === p.cat && x.vars.some((v) => v.stock);
  let rel = group ? PRODUCTS.filter((x) => avail(x) && inGroup(x, group)) : [], byShape = rel.length >= 2;
  if (!byShape) rel = PRODUCTS.filter(avail);
  rel = rel.slice(0, 4);
  if (rel.length) {
    $("#related").hidden = false;
    $("#relatedTitle").textContent = byShape ? "Más " + catLow + " de forma " + SHAPE_GROUPS[group].one : "Más en " + catLow;
    $("#relatedAllText").textContent = byShape ? "Ver " + catLow + " " + SHAPE_GROUPS[group].fem : "Ver todo en " + catLow;
    $("#relatedAll").href = CAT_PAGE[p.cat] + (byShape ? "?forma=" + group : "");
    $("#relatedGrid").innerHTML = rel.map((x) => cardHTML(x, firstInStock(x))).join("");
    bindSwatches($("#relatedGrid"));
  }

  /* ---------- Barra fija en celular: aparece cuando el botón principal queda arriba de la ventana ---------- */
  const bar = $("#buybar"), ctas = $("#pdpCtas");
  let tick = false;
  const syncBar = () => { tick = false; bar.hidden = ctas.getBoundingClientRect().bottom > 0; };
  const onScroll = () => { if (!tick) { tick = true; requestAnimationFrame(syncBar); } };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  syncBar();
})();
