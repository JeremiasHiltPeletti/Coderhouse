/* =========================================================
   Sunnygafas — Confirmación del pedido de prueba
   Muestra lo que se envió desde el checkout (guardado en la sesión). No hay pedido real.
   ========================================================= */
(function () {
  const SG = window.SG;
  const { money, img, $, esc, BY_SKU, STORE } = SG;
  let o = null;
  try { o = JSON.parse(sessionStorage.getItem("sg:order") || "null"); } catch (e) {}
  $("#orderFull").hidden = !o; $("#orderEmpty").hidden = !!o;
  if (!o) return;
  const SHIP = { correo: "Envío por Correo Argentino", retiro: "Retiro en nuestro punto de entrega", acordar: "Entrega a acordar" };
  const PAY = { transferencia: "Transferencia (25% off)", efectivo: "Efectivo (25% off)", tarjeta: "Tarjeta, hasta " + STORE.installments + " cuotas sin interés" };
  $("#orderId").textContent = o.id;
  $("#orderLines").innerHTML = o.lines.map((l) => { const r = BY_SKU[l.sku]; if (!r) return ""; return '<li><img src="' + img(r.v.img) + '" alt="" width="720" height="612"><span><strong>' + esc(r.p.name) + "</strong>" + (r.p.vars.length > 1 ? '<span class="meta">' + esc(r.v.label) + "</span>" : "") + '<span class="meta">Cantidad: ' + l.qty + '</span></span><span class="num">' + money(r.v.price * l.qty) + "</span></li>"; }).join("");
  $("#orderSummary").innerHTML = '<div><dt>Productos</dt><dd class="num">' + money(o.list) + "</dd></div>" + (o.total < o.list ? '<div class="is-off"><dt>25% off</dt><dd class="num">−' + money(o.list - o.total) + "</dd></div>" : "") +
    '<div><dt>Envío</dt><dd>' + (o.ship === "retiro" ? "A coordinar" : "A confirmar") + '</dd></div><div class="summary__total"><dt>Total</dt><dd class="num">' + money(o.total) + "</dd></div>";
  const a = o.address;
  $("#orderData").innerHTML = '<div><dt>Contacto</dt><dd>' + esc(o.contact.name) + "<br>" + esc(o.contact.email) + "<br>" + esc(o.contact.phone) + "</dd></div>" +
    '<div><dt>Entrega</dt><dd>' + SHIP[o.ship] + (a ? "<br>" + esc(a.street + (a.floor ? ", " + a.floor : "")) + "<br>" + esc(a.city + ", " + a.province + " (" + a.zip + ")") : "") + "</dd></div>" +
    '<div><dt>Pago</dt><dd>' + PAY[o.pay] + "</dd></div>";
  const next = [
    "Te llegaría un email a " + esc(o.contact.email) + " con el resumen del pedido.",
    o.pay === "tarjeta" ? "Pagarías con tarjeta en una página segura del procesador de pagos." : o.pay === "transferencia" ? "Te enviaríamos los datos para transferir el total con el 25% off." : "Coordinaríamos el pago en efectivo al momento de la entrega o el retiro.",
    o.ship === "correo" ? "Te confirmaríamos el costo y el plazo del envío por Correo Argentino para el código postal " + esc(a.zip) + "." : "Te escribiríamos al " + esc(o.contact.phone) + " para coordinar la entrega."
  ];
  $("#orderNext").innerHTML = next.map((t) => "<li>" + t + "</li>").join("");
  $("#orderTitle").focus();
})();
