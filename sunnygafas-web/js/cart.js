/* =========================================================
   Sunnygafas — Carrito
   Cambiar cantidades (hasta el stock de cada color), quitar productos y seguir comprando.
   ========================================================= */
(function () {
  const SG = window.SG;
  const { money, transferPrice, img, productURL, maxQty, $, esc } = SG;
  const lines = $("#cartLines"), status = $("#cartStatus");
  try { const back = sessionStorage.getItem("sg:list"); if (back && back.charAt(0) === "/") $("#cartKeep").href = back; } catch (e) {}

  function render(focusSku) {
    const items = SG.cart.items(), t = SG.cart.totals(items);
    $("#cartFull").hidden = !items.length; $("#cartEmpty").hidden = !!items.length;
    lines.innerHTML = items.map((x) => {
      const max = maxQty(x.v), name = SG.fullName(x.p, x.v);
      return '<li class="line" data-sku="' + x.sku + '">' +
        '<a class="line__img" href="' + productURL(x.p, x.i) + '" tabindex="-1" aria-hidden="true"><img src="' + img(x.v.img) + '" alt="" width="720" height="612"></a>' +
        '<div class="line__info"><a class="line__name" href="' + productURL(x.p, x.i) + '">' + esc(x.p.name) + "</a>" +
          '<p class="meta">' + (x.p.vars.length > 1 ? "Color: " + esc(x.v.label) + " · " : "") + SG.typeLabel(x.p) + "</p>" +
          '<p class="line__unit meta num">' + money(transferPrice(x.v.price)) + " c/u con transferencia o efectivo · " + money(x.v.price) + " de lista</p>" +
          (max === x.qty && max < 10 ? '<p class="line__max meta">Es todo el stock disponible de este color.</p>' : "") + "</div>" +
        '<div class="line__qty"><div class="qty__ctl" role="group" aria-label="Cantidad de ' + esc(name) + '">' +
          '<button type="button" class="qty__btn" data-act="dec" aria-label="Restar una unidad de ' + esc(name) + '"' + (x.qty <= 1 ? " disabled" : "") + '><svg class="icon" aria-hidden="true"><use href="#i-minus"/></svg></button>' +
          '<span class="qty__val num" aria-live="off">' + x.qty + "</span>" +
          '<button type="button" class="qty__btn" data-act="inc" aria-label="Sumar una unidad de ' + esc(name) + '"' + (x.qty >= max ? " disabled" : "") + '><svg class="icon" aria-hidden="true"><use href="#i-plus"/></svg></button></div>' +
          '<button type="button" class="line__remove link" data-act="del"><svg class="icon" aria-hidden="true"><use href="#i-trash"/></svg>Quitar</button></div>' +
        '<p class="line__total num">' + money(transferPrice(x.v.price) * x.qty) + "</p></li>";
    }).join("");
    $("#cartSummary").innerHTML = SG.cart.summaryHTML(t);
    if (focusSku) { const el = lines.querySelector('[data-sku="' + focusSku.sku + '"] [data-act="' + focusSku.act + '"]'); if (el && !el.disabled) el.focus(); else { const q = lines.querySelector('[data-sku="' + focusSku.sku + '"] .qty__btn:not([disabled])'); if (q) q.focus(); } }
  }
  lines.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const li = b.closest(".line"), sku = li.dataset.sku, x = SG.cart.items().find((y) => y.sku === sku); if (!x) return;
    const name = SG.fullName(x.p, x.v);
    if (b.dataset.act === "del") {
      const next = li.nextElementSibling || li.previousElementSibling;
      SG.cart.remove(sku); render();
      status.textContent = "Quitaste " + name + " del carrito.";
      const tgt = next && lines.querySelector('[data-sku="' + next.dataset.sku + '"] .line__name');
      (tgt || $("#cartEmpty:not([hidden]) a") || $(".summary__go")).focus();
      return;
    }
    const n = x.qty + (b.dataset.act === "inc" ? 1 : -1);
    SG.cart.set(sku, n); render({ sku, act: b.dataset.act });
    status.textContent = name + ": " + Math.max(1, Math.min(n, maxQty(x.v))) + (n === 1 ? " unidad." : " unidades.");
  });
  render();
})();
