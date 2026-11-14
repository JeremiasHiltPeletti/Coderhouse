/* =========================================================
   Sunnygafas — Ficha de producto
   El color elegido define fotos, precio, stock, consulta y destino de compra:
   cada color tiene su propia ficha en la tienda oficial.
   URL: /producto/<modelo>.html?color=<color>
   Un atributo en null es «sin confirmar»: no se muestra ni se niega.
   ========================================================= */
(function () {
  const SG = window.SG;
  const { BY_ID, PRODUCTS, HEX, STORE, SHAPE_NAME, SHAPE_GROUPS, CATEGORIES, CAT_PAGE, money, moneyExact, transferPrice, fullName, typeLabel, productURL, inGroup, firstInStock, wa, cardHTML, bindSwatches, $, $$ } = SG;
  const p = BY_ID[$("#contenido").dataset.product];
  if (!p) return;

  const q = new URLSearchParams(location.search);
  const asked = (q.get("color") || "").toLowerCase();
  let vi = p.vars.findIndex((v) => v.slug === asked);
  const badColor = !!asked && vi < 0;
  if (vi < 0) vi = firstInStock(p);
  let gi = 0;

  const stage = $("#galleryStage"), thumbs = $("#galleryThumbs"), gcount = $("#galleryCount");
  const swBox = $("#pdpSwatches"), status = $("#pdpStatus");
  const isAcc = p.cat === "acc";
  const pageURL = (i) => location.origin + productURL(p, i);

  /* ---------- Color inválido en la URL: se muestra uno válido y se avisa ---------- */
  if (badColor) {
    const n = $("#pdpNotice");
    n.textContent = "Ese color no está en este modelo. Te mostramos " + p.vars[vi].label + ".";
    n.hidden = false;
    history.replaceState(null, "", productURL(p, vi));
  }

  /* ---------- Volver a resultados, si el listado dejó un estado que recuperar ---------- */
  try {
    const back = sessionStorage.getItem("sg:list");
    if (back && back.charAt(0) === "/") { const a = $("#backToList"); a.href = back; a.hidden = false; }
  } catch (e) {}

  /* ---------- Muestras de color ---------- */
  if (p.vars.length > 1) {
    swBox.innerHTML = p.vars.map((x, i) =>
      '<button type="button" class="swatch' + (x.stock ? "" : " is-out") + '" data-i="' + i + '" aria-pressed="false" aria-label="Color: ' + x.label + (x.stock ? ", disponible" : ", sin stock") + '" title="' + x.label + (x.stock ? "" : " (sin stock)") + '"><span style="background:' + (HEX[x.c] || "#ccc") + '"></span></button>').join("");
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
    const v = p.vars[vi], who = isAcc ? p.name : p.name + " " + v.label.toLowerCase();
    // Solo la primera foto visible carga con prioridad; el resto espera
    stage.innerHTML = v.gal.map((g, k) =>
      '<figure' + (k ? " hidden" : "") + '><img src="/assets/img/p/' + g.f + '.webp" width="' + g.w + '" height="' + g.h + '" alt="' + who + ", foto " + (k + 1) + " de " + v.gal.length + '"' + (k ? ' loading="lazy"' : ' fetchpriority="high"') + "></figure>").join("") +
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

  /* ---------- Variante: fotos, precio, stock, consulta y destino ---------- */
  function setVariant(i, user) {
    vi = i;
    const v = p.vars[vi], full = fullName(p, v), url = pageURL(vi), known = v.price != null;
    $$(".swatch", swBox).forEach((s, k) => s.setAttribute("aria-pressed", k === vi));
    $("#pdpVariant").textContent = v.label;
    $("#pdpStock").hidden = v.stock;
    const others = p.vars.filter((x) => x.stock && x !== v).map((x) => x.label);
    $("#pdpAvail").hidden = v.stock || !others.length;
    $("#pdpAvail").textContent = "Disponible en " + others.join(", ") + ".";

    // Precio: solo importes que salen de la tienda; si faltan, se deriva a la ficha oficial
    $("#pdpPrice").hidden = !known;
    if (known) {
      $("#pdpTransfer").textContent = money(transferPrice(v.price));
      $("#pdpList").textContent = money(v.price);
      $("#pdpInstallments").textContent = STORE.installments + " cuotas sin interés de " + moneyExact(v.price / STORE.installments);
    }
    $("#pdpPriceLabel").hidden = p.cat !== "arm";

    const buy = $("#pdpBuy"), rx = $("#pdpRx"), waBtn = $("#pdpWa"), next = $("#pdpNext"), bar = $("#buybarBtn");
    if (v.stock) {
      buy.hidden = false; buy.href = v.url;
      $("#pdpBuyText").textContent = !known ? "Ver precio y stock en la tienda oficial" : p.cat === "arm" ? "Comprar armazón en la tienda oficial" : "Comprar en la tienda oficial";
      waBtn.className = "btn btn-outline btn-lg";
      $("#pdpWaText").textContent = "Consultar por WhatsApp";
      waBtn.href = wa("Hola, quiero consultar por " + full + ". La ficha es " + url + ".");
      next.textContent = "Se abre " + full + " en Empretienda. Ahí podés agregarlo al carrito y calcular el envío con tu código postal." +
        (p.rx ? " Si querés cristales con tu graduación, pedí un presupuesto para este armazón." : "");
      bar.textContent = "Comprar en Empretienda"; bar.href = v.url;
    } else {
      // Sin stock: la compra deja de estar visible, también en la barra fija
      buy.hidden = true;
      waBtn.className = "btn btn-primary btn-lg";
      $("#pdpWaText").textContent = "Consultar reposición por WhatsApp";
      waBtn.href = wa("Hola, ¿tienen prevista la reposición de " + full + "? La ficha es " + url + ".");
      next.textContent = (isAcc ? p.name : v.label) + " sin stock." + (others.length ? " Elegí otro color en las muestras o consultanos la reposición." : " Consultanos la reposición.");
      bar.textContent = "Consultar reposición"; bar.href = waBtn.href;
    }
    rx.hidden = !p.rx || !v.stock;
    rx.href = wa("Hola, quiero un presupuesto de cristales con mi graduación para " + full + ". La ficha es " + url + ".");
    $("#buybarName").textContent = isAcc ? p.name : p.name + " · " + v.label;
    $("#buybarPrice").textContent = !v.stock ? "Sin stock" : known ? money(transferPrice(v.price)) + " con transferencia" : "";

    // Medidas y calce: solo las cargadas para el modelo; si faltan, una consulta específica
    const guide = "/guia-de-calce.html?modelo=" + p.id + "&color=" + v.slug;
    if (isAcc) {
      $("#medidas").hidden = true; $("#pdpMeasureJump").hidden = true;
    } else if (p.measures) {
      $("#pdpMeasureText").innerHTML = '<strong class="num">Lente ' + p.measures.lens + " mm · Puente " + p.measures.bridge + " mm · Varilla " + p.measures.temple + " mm</strong>";
      $("#pdpMeasure").hidden = true;
      $("#pdpGuide").firstChild.textContent = "Cómo leer estas medidas ";
      $("#pdpGuide").href = guide;
    } else {
      $("#pdpMeasure").href = wa("Hola, ¿me pasás el ancho del lente, el puente y el largo de la varilla de " + full + "? La ficha es " + url + ".");
      $("#pdpGuide").href = guide;
    }

    // Detalles: protección UV, polarización y fotocromía son datos independientes
    $("#pdpDesc").textContent = v.desc || "";
    $("#pdpDesc").hidden = !v.desc;
    const specs = [];
    if (!isAcc) specs.push(["Color", v.label]);
    if (p.shape) specs.push(["Forma", SHAPE_NAME[p.shape]]);
    if (p.col) specs.push(["Colección", p.col]);
    if (p.cat === "arm") specs.push(["Uso", "Modelo para lentes con graduación"]);
    if (v.uv === true) specs.push(["Protección UV", "Filtro UV400"]);
    if (v.photo === true) specs.push(["Tipo de lente", "Fotocromático"]);
    if (v.polar === true) specs.push(["Polarización", "Lentes polarizados"]);
    (p.parts || []).forEach((x) => specs.push(x));
    if (p.material) specs.push(["Material", p.material]);
    if (isAcc && v.sname) specs.push(["En la tienda oficial", v.sname]);
    if (!isAcc && STORE.includes === true) specs.push(["Con tu compra", "Estuche y líquido limpiador"]);
    $("#pdpSpecs").innerHTML = specs.map((s) => "<div><dt>" + s[0] + "</dt><dd>" + s[1] + "</dd></div>").join("");

    renderGallery();
    document.title = (isAcc ? p.name : p.name + " · " + v.label) + " · " + typeLabel(p) + " · Sunnygafas";
    if (user) {
      history.replaceState(null, "", productURL(p, vi));
      $("#pdpNotice").hidden = true;
      status.textContent = "Color " + v.label + (v.stock ? "" : ", sin stock") + (known ? ". " + money(transferPrice(v.price)) + " con transferencia o efectivo." : ".");
    }
  }
  setVariant(vi, false);

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
    $("#relatedAllText").textContent = "Ver más " + catLow;
    $("#relatedAll").href = CAT_PAGE[p.cat] + (byShape ? "?forma=" + group : "");
    $("#relatedGrid").innerHTML = rel.map((x) => cardHTML(x, firstInStock(x))).join("");
    bindSwatches($("#relatedGrid"));
  }

  /* ---------- Barra fija en celular: aparece cuando el botón principal queda arriba de la ventana ----------
     Se calcula con la posición real en cada desplazamiento: también responde a saltos por ancla o con Atrás. */
  const bar = $("#buybar"), ctas = $("#pdpCtas");
  let tick = false;
  const syncBar = () => { tick = false; bar.hidden = ctas.getBoundingClientRect().bottom > 0; };
  const onScroll = () => { if (!tick) { tick = true; requestAnimationFrame(syncBar); } };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  syncBar();
})();
