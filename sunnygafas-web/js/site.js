/* =========================================================
   Sunnygafas — lógica compartida por todas las páginas
   Tarjeta de producto, muestras de color, carrito (guardado en el navegador),
   menú móvil, buscador, acordeón y altura de cabecera para los saltos a anclas.
   Datos: js/data.js
   ========================================================= */
(function () {
  const SG = window.SG;
  const { BY_ID, BY_SKU, SHAPE_NAME, money, transferPrice, img, typeLabel, productURL, search, swatch, maxQty } = SG;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  SG.$ = $; SG.$$ = $$;
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  SG.esc = esc;

  /* ---------- Precio: el de transferencia o efectivo primero, el de lista como referencia ---------- */
  SG.priceHTML = function (v) {
    return '<span class="price-transfer">' + money(transferPrice(v.price)) + "<small>con transferencia o efectivo</small></span>" +
      '<span class="price-list">' + money(v.price) + " de lista</span>";
  };
  const variantText = (p, v) => (p.vars.length > 1 || p.cat !== "acc" ? v.label + " · " : "") + typeLabel(p);
  SG.swatchBtn = (x, i, pressed) => '<button type="button" class="swatch' + (x.stock ? "" : " is-out") + '" data-i="' + i + '" aria-pressed="' + pressed + '" aria-label="Color: ' + esc(x.label) + (x.stock ? ", disponible" : ", sin stock") + '" title="' + esc(x.label) + (x.stock ? "" : " (sin stock)") + '"><span style="background:' + swatch(x.label) + '"></span></button>';

  /* ---------- Tarjeta de producto ----------
     opts.only: índices de variantes que respetan los filtros activos; las demás quedan para la ficha */
  SG.cardHTML = function (p, vi, opts) {
    vi = vi || 0; opts = opts || {};
    const v = p.vars[vi], url = productURL(p, vi);
    const shown = p.vars.map((x, i) => ({ x, i })).filter((o) => !opts.only || opts.only.includes(o.i));
    const MAX = 6, extra = shown.length - MAX;
    const sw = shown.length > 1
      ? '<div class="swatches" role="group" aria-label="Colores de ' + esc(p.name) + '">' + shown.slice(0, MAX).map(({ x, i }) => SG.swatchBtn(x, i, i === vi)).join("") +
        (extra > 0 ? '<a class="swatches__more" href="' + url + '" aria-label="Ver los ' + shown.length + ' colores de ' + esc(p.name) + '">+' + extra + "</a>" : "") + "</div>"
      : '<div class="swatches swatches--none" aria-hidden="true"></div>';
    const more = opts.only && shown.length < p.vars.length ? '<p class="product-card__more meta">Más colores en la ficha</p>' : "";
    return '<li class="product-card" data-id="' + p.id + '" data-vi="' + vi + '">' +
      '<a class="product-card__media" href="' + url + '" tabindex="-1" aria-hidden="true">' +
        '<img src="' + img(v.img) + '" alt="" width="720" height="612" ' + (opts.eager ? "" : 'loading="lazy"') + ">" +
        '<span class="product-card__flag"' + (v.stock ? " hidden" : "") + ">Sin stock</span></a>" +
      '<div class="product-card__body">' +
        '<a class="product-card__name" href="' + url + '">' + esc(p.name) + "</a>" +
        '<p class="product-card__variant">' + esc(variantText(p, v)) + "</p>" +
        '<p class="product-card__price">' + SG.priceHTML(v) + "</p>" + sw + more +
      "</div></li>";
  };
  // Cambiar la muestra actualiza foto, variante, precio, stock y el enlace a la ficha
  SG.bindSwatches = function (root) {
    root.addEventListener("click", (e) => {
      const b = e.target.closest(".product-card .swatch");
      if (!b) return;
      const card = b.closest(".product-card");
      const p = BY_ID[card.dataset.id];
      const vi = +b.dataset.i, v = p.vars[vi];
      card.dataset.vi = vi;
      $$(".swatch", card).forEach((s) => s.setAttribute("aria-pressed", s === b));
      $(".product-card__media img", card).src = img(v.img);
      $(".product-card__variant", card).textContent = variantText(p, v);
      $(".product-card__price", card).innerHTML = SG.priceHTML(v);
      $(".product-card__flag", card).hidden = v.stock;
      $$("a:not(.swatches__more)", card).forEach((a) => { a.href = productURL(p, vi); });
    });
  };

  /* ---------- Carrito ----------
     Se guarda en el navegador (localStorage) como [{ sku, qty }]. Si el almacenamiento no está disponible,
     el carrito funciona igual durante la visita. Cada SKU es un color: el carrito siempre sabe qué variante se compra. */
  const KEY = "sg:cart";
  let memory = [];
  const read = () => { try { const x = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(x) ? x : []; } catch (e) { return memory; } };
  const write = (items) => { memory = items; try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {} SG.cart.render(); };
  SG.cart = {
    /* Solo variantes que siguen existiendo y con stock; la cantidad se ajusta al máximo disponible */
    items() {
      return read().map((it) => ({ it, ref: BY_SKU[it.sku] })).filter((x) => x.ref && x.ref.v.stock)
        .map(({ it, ref }) => ({ sku: it.sku, qty: Math.max(1, Math.min(+it.qty || 1, maxQty(ref.v))), p: ref.p, v: ref.v, i: ref.i }));
    },
    count() { return this.items().reduce((n, x) => n + x.qty, 0); },
    add(sku, qty) {
      const ref = BY_SKU[sku]; if (!ref || !ref.v.stock) return { ok: false };
      const items = read(), it = items.find((x) => x.sku === sku), max = maxQty(ref.v);
      const before = it ? +it.qty : 0, after = Math.min(max, before + (qty || 1));
      if (it) it.qty = after; else items.push({ sku, qty: after });
      write(items);
      return { ok: after > before, capped: before + (qty || 1) > max, qty: after, max };
    },
    set(sku, qty) {
      const ref = BY_SKU[sku]; const items = read().filter((x) => x.sku !== sku || qty > 0);
      const it = items.find((x) => x.sku === sku); if (it && ref) it.qty = Math.max(1, Math.min(qty, maxQty(ref.v)));
      write(items);
    },
    remove(sku) { write(read().filter((x) => x.sku !== sku)); },
    clear() { write([]); },
    totals(items) {
      items = items || this.items();
      const list = items.reduce((s, x) => s + x.v.price * x.qty, 0);
      const transfer = items.reduce((s, x) => s + transferPrice(x.v.price) * x.qty, 0);
      return { list, transfer, saving: list - transfer, units: items.reduce((n, x) => n + x.qty, 0) };
    },
    /* Filas del resumen. Sin medio de pago elegido muestra ambos totales; con uno, el que corresponde */
    summaryHTML(t, payment, ship) {
      const off = payment === "transferencia" || payment === "efectivo";
      return '<div><dt>Productos (' + t.units + ')</dt><dd class="num">' + money(t.list) + "</dd></div>" +
        (payment ? (off ? '<div class="is-off"><dt>25% off por ' + payment + '</dt><dd class="num">−' + money(t.saving) + "</dd></div>" : "")
                 : '<div class="is-off"><dt>Con transferencia o efectivo</dt><dd class="num">−' + money(t.saving) + "</dd></div>") +
        '<div><dt>Envío</dt><dd>' + (ship === "retiro" ? "A coordinar" : "A confirmar") + "</dd></div>" +
        '<div class="summary__total"><dt>' + (payment ? "Total" : "Total con transferencia o efectivo") + '</dt><dd class="num">' + money(off || !payment ? t.transfer : t.list) + "</dd></div>" +
        (!payment ? '<div class="summary__alt"><dt>Con tarjeta, hasta ' + SG.STORE.installments + ' cuotas sin interés</dt><dd class="num">' + money(t.list) + "</dd></div>" : "");
    },
    render() {
      const n = this.count();
      $$("[data-cart-count]").forEach((el) => { el.textContent = n; el.hidden = !n; });
      $$("[data-cart-link]").forEach((a) => a.setAttribute("aria-label", n ? "Ver carrito, " + n + (n === 1 ? " producto" : " productos") : "Ver carrito, vacío"));
    }
  };
  SG.cart.render();
  window.addEventListener("storage", (e) => { if (e.key === KEY) SG.cart.render(); });

  /* ---------- Aviso breve (no roba el foco; lo anuncia el lector de pantalla) ---------- */
  SG.toast = function (html) {
    let t = $("#toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.innerHTML = html; t.classList.add("is-on");
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("is-on"), 4000);
  };

  /* ---------- Altura real de la cabecera para los saltos a anclas ---------- */
  const header = $(".header");
  if (header) {
    const setOffset = () => document.documentElement.style.setProperty("--header-offset", (header.offsetHeight + 16) + "px");
    setOffset();
    window.addEventListener("resize", setOffset);
    if (location.hash.length > 1) {
      const t = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (t) requestAnimationFrame(() => t.scrollIntoView());
    }
  }

  /* ---------- Acordeón ---------- */
  $$(".faq__q button").forEach((btn) => btn.addEventListener("click", () => {
    const open = btn.getAttribute("aria-expanded") === "true";
    btn.setAttribute("aria-expanded", !open);
    document.getElementById(btn.getAttribute("aria-controls")).hidden = open;
  }));

  /* ---------- Menú móvil: foco atrapado, Escape y devolución del foco ---------- */
  const drawer = $("#mobileMenu"), menuToggle = $("#menuToggle");
  if (drawer && menuToggle) {
    const openMenu = () => {
      drawer.hidden = false; menuToggle.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
      $(".drawer__head button", drawer).focus();
    };
    const closeMenu = (restore) => {
      drawer.hidden = true; menuToggle.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
      if (restore !== false) menuToggle.focus();
    };
    menuToggle.addEventListener("click", openMenu);
    $$("[data-close-menu]", drawer).forEach((el) => el.addEventListener("click", () => closeMenu(el.tagName !== "A")));
    drawer.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu();
      if (e.key === "Tab") {
        const f = $$("a, button", drawer);
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
    window.matchMedia("(min-width: 1081px)").addEventListener("change", (m) => { if (m.matches && !drawer.hidden) closeMenu(false); });
  }

  /* ---------- Buscador: modelo, forma o color; cada sugerencia abre la variante que muestra ---------- */
  const panel = $("#searchPanel"), sToggle = $("#searchToggle"), sInput = $("#searchInput"), sResults = $("#searchResults"), sStatus = $("#searchStatus");
  if (panel && sToggle) {
    const hint = "Buscá por modelo, forma o color.";
    const openSearch = (open, restore) => {
      panel.hidden = !open; sToggle.setAttribute("aria-expanded", open);
      if (open) sInput.focus(); else if (restore !== false) sToggle.focus();
    };
    SG.openSearch = (q) => { openSearch(true); if (q != null) { sInput.value = q; run(); sInput.select(); } };
    sToggle.addEventListener("click", () => openSearch(panel.hidden));
    $("#searchClose").addEventListener("click", () => openSearch(false));
    panel.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { openSearch(false); return; }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const links = $$("a", sResults);
      if (!links.length) return;
      const i = links.indexOf(document.activeElement);
      e.preventDefault();
      if (e.key === "ArrowDown") (links[i + 1] || links[0]).focus();
      else if (i <= 0) sInput.focus(); else links[i - 1].focus();
    });
    document.addEventListener("click", (e) => { if (!panel.hidden && !e.target.closest(".header")) openSearch(false, false); });
    function run() {
      const q = sInput.value.trim();
      if (!q) { sResults.innerHTML = ""; sStatus.textContent = hint; return; }
      const all = search(q), hits = all.slice(0, 8);
      sStatus.textContent = all.length
        ? all.length + (all.length === 1 ? " resultado" : " resultados") + (all.length > hits.length ? ". Enter abre todos." : "")
        : "No encontramos resultados para “" + q + "”. Probá otro modelo, forma o color.";
      sResults.innerHTML = hits.map(({ p, vi }) => {
        const v = p.vars[vi];
        return '<li><a href="' + productURL(p, vi) + '"><img src="' + img(v.img) + '" alt="" width="720" height="612">' +
          "<span><strong>" + esc(p.name) + '</strong><br><span class="meta">' + (p.vars.length > 1 ? esc(v.label) + " · " : "") + (p.shape ? SHAPE_NAME[p.shape] + " · " : "") + money(transferPrice(v.price)) + " con transferencia" + (v.stock ? "" : " · Sin stock") + "</span></span></a></li>";
      }).join("");
    }
    sInput.addEventListener("input", run);
    $$("[data-open-search]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); SG.openSearch(); }));
  }
})();

/* Distintivo del hosting (Netlify lo inyecta en el plan gratuito, fijo abajo a la derecha).
   No se oculta: la barra fija de la ficha se ubica por encima para que no tape el botón. */
document.addEventListener("DOMContentLoaded", function () {
  if (document.querySelector("script[data-nf-variant]")) document.documentElement.style.setProperty("--host-badge", "64px");
});
