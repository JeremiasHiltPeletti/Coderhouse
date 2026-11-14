/* =========================================================
   Sunnygafas — Ficha de producto
   El color elegido define fotos, precio, stock y el destino de compra:
   cada color tiene su propia ficha en la tienda oficial.
   URL: /producto/<modelo>.html?color=<color>
   ========================================================= */
(function () {
  const SG = window.SG;
  const { BY_ID, PRODUCTS, HEX, STORE, SHAPE_NAME, SHAPE_GROUPS, CATEGORIES, money, transferPrice, typeLabel, productURL, inGroup, firstInStock, wa, cardHTML, bindSwatches, $, $$ } = SG;
  const p = BY_ID[$("#contenido").dataset.product];
  if (!p) return;

  const q = new URLSearchParams(location.search);
  let vi = p.vars.findIndex((v) => v.slug === (q.get("color") || "").toLowerCase());
  if (vi < 0) vi = firstInStock(p);
  let gi = 0;

  const stage = $("#galleryStage"), thumbs = $("#galleryThumbs"), gcount = $("#galleryCount");
  const swBox = $("#pdpSwatches"), status = $("#pdpStatus");
  const isGlasses = p.cat !== "acc";
  const pageURL = (i) => location.origin + productURL(p, i);

  /* ---------- Muestras de color ---------- */
  if (p.vars.length > 1) {
    swBox.innerHTML = p.vars.map((x, i) =>
      '<button type="button" class="swatch' + (x.stock ? "" : " is-out") + '" data-i="' + i + '" aria-pressed="false" aria-label="' + x.label + (x.stock ? "" : ", sin stock") + '" title="' + x.label + (x.stock ? "" : " (sin stock)") + '"><span style="background:' + (HEX[x.c] || "#ccc") + '"></span></button>').join("");
    swBox.addEventListener("click", (e) => {
      const b = e.target.closest(".swatch");
      if (!b) return;
      setVariant(+b.dataset.i, true);
    });
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
    const v = p.vars[vi];
    stage.innerHTML = v.gal.map((g, k) =>
      '<figure' + (k ? " hidden" : "") + '><img src="/assets/img/p/' + g.f + '.webp" width="' + g.w + '" height="' + g.h + '" alt="' + p.name + " " + v.label + ", foto " + (k + 1) + " de " + v.gal.length + '"' + (k ? ' loading="lazy"' : ' fetchpriority="high"') + "></figure>").join("") +
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
  // Deslizar en pantallas táctiles
  let sx = null, sy = null;
  stage.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  stage.addEventListener("touchend", (e) => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) showPhoto(gi + (dx < 0 ? 1 : -1));
    sx = null;
  }, { passive: true });

  /* ---------- Variante: fotos, precio, stock y destino ---------- */
  function setVariant(i, user) {
    vi = i;
    const v = p.vars[vi], full = p.name + " · " + v.label;
    $$(".swatch", swBox).forEach((s, k) => s.setAttribute("aria-pressed", k === vi));
    $("#pdpVariant").textContent = v.label;
    $("#pdpStock").hidden = v.stock;
    $("#pdpTransfer").textContent = money(transferPrice(v.price));
    $("#pdpList").textContent = money(v.price);
    $("#pdpInstallments").textContent = STORE.installments + " cuotas sin interés de " + money(v.price / STORE.installments);

    const buy = $("#pdpBuy"), waBtn = $("#pdpWa"), next = $("#pdpNext"), bar = $("#buybarBtn");
    if (v.stock) {
      buy.hidden = false; buy.href = v.url;
      buy.firstChild.textContent = "Comprar en la tienda oficial ";
      waBtn.className = "btn btn-outline btn-lg";
      $("#pdpWaText").textContent = "Consultar por WhatsApp";
      waBtn.href = wa("Hola, quiero consultar por " + full + ". " + pageURL(vi));
      next.textContent = "Se abre la ficha de " + full + " en la tienda oficial. Ahí lo agregás al carrito, calculás el envío y pagás.";
      bar.textContent = "Comprar"; bar.href = v.url;
    } else {
      const others = p.vars.filter((x) => x.stock).map((x) => x.label);
      buy.hidden = true;
      waBtn.className = "btn btn-primary btn-lg";
      $("#pdpWaText").textContent = "Consultar reposición por WhatsApp";
      waBtn.href = wa("Hola, quiero saber cuándo vuelve a entrar " + full + ". " + pageURL(vi));
      next.textContent = full + " está sin stock en la tienda." + (others.length ? " Con stock: " + others.join(", ") + ". Elegilo en las muestras de color." : " Escribinos y te avisamos cuando vuelva a entrar.");
      bar.textContent = "Consultar"; bar.href = waBtn.href;
    }
    $("#buybarName").textContent = full;
    $("#buybarPrice").textContent = v.stock ? money(transferPrice(v.price)) + " con transf." : "Sin stock";
    $("#pdpMeasure").href = wa("Hola, quiero saber las medidas (lente, puente y varilla) de " + full + ". " + pageURL(vi));

    // Detalle: solo lo que publica la tienda
    $("#pdpDesc").textContent = v.desc || "";
    $("#pdpDesc").hidden = !v.desc;
    const specs = [];
    specs.push(["Color", v.label]);
    if (p.shape) specs.push(["Forma", SHAPE_NAME[p.shape]]);
    if (p.col) specs.push(["Colección", p.col]);
    if (v.uv) specs.push(["Protección", "Filtro UV400"]);
    if (isGlasses && p.cat !== "arm") specs.push(["Cristales", v.polar ? "Polarizados" : "No polarizados"]);
    if (isGlasses) specs.push(["Con tu compra", "Estuche y líquido limpiador de regalo"]);
    $("#pdpSpecs").innerHTML = specs.map((s) => "<div><dt>" + s[0] + "</dt><dd>" + s[1] + "</dd></div>").join("");

    const facts = [];
    facts.push(['i-tag', "<strong>25% off</strong> con transferencia o efectivo: " + money(transferPrice(v.price))]);
    facts.push(['i-card', "Con tarjeta, " + STORE.installments + " cuotas sin interés de " + money(v.price / STORE.installments)]);
    facts.push(['i-truck', "Envíos a todo el país. El costo se calcula en la tienda con tu código postal."]);
    if (v.rx) facts.push(['i-check', 'Cristales con tu graduación: <a href="' + wa("Hola, quiero un presupuesto de cristales con mi graduación para " + full + ". " + pageURL(vi)) + '" rel="noopener">pedí el presupuesto</a>.']);
    $("#pdpFacts").innerHTML = facts.map((f) => '<li><svg class="icon" aria-hidden="true"><use href="#' + f[0] + '"/></svg><span>' + f[1] + "</span></li>").join("");

    renderGallery();
    document.title = full + " · " + typeLabel(p) + " · Sunnygafas";
    if (user) {
      history.replaceState(null, "", productURL(p, vi));
      status.textContent = "Color " + v.label + (v.stock ? "" : ", sin stock") + ". " + money(transferPrice(v.price)) + " con transferencia o efectivo.";
    }
  }
  setVariant(vi, false);

  /* ---------- Relacionados: misma forma o misma categoría ---------- */
  const group = p.shape ? Object.keys(SHAPE_GROUPS).find((g) => inGroup(p, g)) : null;
  let rel = PRODUCTS.filter((x) => x.id !== p.id && x.vars.some((v) => v.stock) && x.cat === p.cat && (!group || inGroup(x, group)));
  let relTitle = group ? "Más marcos " + SHAPE_GROUPS[group].plural : "Más en " + CATEGORIES[p.cat];
  if (rel.length < 2) { rel = PRODUCTS.filter((x) => x.id !== p.id && x.cat === p.cat && x.vars.some((v) => v.stock)); relTitle = "Más en " + CATEGORIES[p.cat]; }
  rel = rel.slice(0, 4);
  if (rel.length) {
    $("#related").hidden = false;
    $("#relatedTitle").textContent = relTitle;
    $("#relatedGrid").innerHTML = rel.map((x) => cardHTML(x, firstInStock(x))).join("");
    bindSwatches($("#relatedGrid"));
  }

  /* ---------- Barra de compra en celular ---------- */
  const bar = $("#buybar"), ctas = $("#pdpCtas");
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((es) => {
      const e = es[0];
      bar.hidden = e.isIntersecting || e.boundingClientRect.top > 0;
    }, { threshold: 0 }).observe(ctas);
  }
})();
