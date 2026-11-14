/* =========================================================
   Sunnygafas — Checkout (modo de prueba)
   Contacto, entrega y pago con validación al salir de cada campo y al enviar.
   Al confirmar NO se registra un pedido ni se cobra: se guarda un resumen en la sesión y se muestra la confirmación.
   Para operar falta conectar un procesador de pagos y un sistema de pedidos (ver README).
   ========================================================= */
(function () {
  const SG = window.SG;
  const { money, transferPrice, img, STORE, $, $$, esc } = SG;
  const form = $("#coForm");
  const items = SG.cart.items();
  $("#coFull").hidden = !items.length; $("#coEmpty").hidden = !!items.length;
  if (!items.length) return;

  $("#coLines").innerHTML = items.map((x) => '<li><img src="' + img(x.v.img) + '" alt="" width="720" height="612"><span><strong>' + esc(x.p.name) + "</strong>" +
    (x.p.vars.length > 1 ? '<span class="meta">' + esc(x.v.label) + "</span>" : "") + '<span class="meta">Cantidad: ' + x.qty + '</span></span><span class="num">' + money(x.v.price * x.qty) + "</span></li>").join("");
  const pay = () => (form.querySelector('input[name="pay"]:checked') || {}).value || "";
  const ship = () => (form.querySelector('input[name="ship"]:checked') || {}).value || "";
  function summary() {
    const t = SG.cart.totals(items), p = pay();
    $("#coSummary").innerHTML = SG.cart.summaryHTML(t, p, ship());
    $("#coPayNote").textContent = p === "tarjeta" ? "Con tarjeta pagás el precio de lista, en hasta " + STORE.installments + " cuotas sin interés de " + SG.moneyExact(t.list / STORE.installments) + "." :
      p ? "El descuento de 25% se aplica pagando con " + p + "." : "Elegí un medio de pago para ver el total.";
  }
  summary();

  /* ---------- Validación ---------- */
  const needsAddress = () => ship() === "correo";
  const RULES = {
    fEmail: (v) => !v ? "Ingresá tu email." : !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? "Revisá el email: falta la @ o el dominio (por ejemplo, nombre@mail.com)." : "",
    fName: (v) => !v ? "Ingresá tu nombre y apellido." : v.trim().split(/\s+/).length < 2 ? "Ingresá nombre y apellido." : "",
    fPhone: (v) => !v ? "Ingresá un teléfono de contacto." : v.replace(/\D/g, "").length < 8 ? "El teléfono parece incompleto: incluí el código de área." : "",
    fStreet: (v) => needsAddress() && !v ? "Ingresá la calle y el número." : needsAddress() && !/\d/.test(v) ? "Agregá el número de la calle." : "",
    fCity: (v) => needsAddress() && !v ? "Ingresá la localidad." : "",
    fProv: (v) => needsAddress() && !v ? "Elegí la provincia." : "",
    fZip: (v) => needsAddress() && !v ? "Ingresá el código postal." : needsAddress() && !/^([A-Za-z]\d{4}[A-Za-z]{3}|\d{4})$/.test(v.trim()) ? "El código postal tiene 4 números (por ejemplo, 3200) o el formato completo (C1425ABC)." : "",
    fTerms: (v, el) => !el.checked ? "Confirmá que leíste cómo funcionan los cambios y el arrepentimiento." : ""
  };
  const GROUPS = { shipSet: () => ship() ? "" : "Elegí cómo querés recibir el pedido.", paySet: () => pay() ? "" : "Elegí un medio de pago." };
  const errOf = (id) => $("#" + id + "Err") || $("#" + id.replace("Set", "Err"));
  function setErr(id, msg) {
    const el = $("#" + id), e = id.endsWith("Set") ? $("#" + id.replace("Set", "Err")) : $("#" + id + "Err");
    e.textContent = msg; e.hidden = !msg;
    if (!id.endsWith("Set")) el.setAttribute("aria-invalid", msg ? "true" : "false");
    el.closest(".field, .co-block").classList.toggle("has-err", !!msg);
    return msg;
  }
  const check = (id) => id in RULES ? setErr(id, RULES[id](($("#" + id).value || "").trim(), $("#" + id))) : setErr(id, GROUPS[id]());
  Object.keys(RULES).forEach((id) => {
    const el = $("#" + id);
    el.addEventListener("blur", () => { if (el.value || el.getAttribute("aria-invalid") === "true") check(id); });
    el.addEventListener("input", () => { if (el.getAttribute("aria-invalid") === "true") check(id); });
    el.addEventListener("change", () => { if (el.type === "checkbox" || el.tagName === "SELECT") check(id); });
  });
  form.addEventListener("change", (e) => {
    if (e.target.name === "ship") { summary(); $("#addressBox").hidden = !needsAddress(); check("shipSet"); if (!needsAddress()) ["fStreet", "fCity", "fProv", "fZip"].forEach((id) => setErr(id, "")); summary(); }
    if (e.target.name === "pay") { check("paySet"); summary(); }
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const order = ["fEmail", "fName", "fPhone", "shipSet", "fStreet", "fCity", "fProv", "fZip", "paySet", "fTerms"];
    const bad = order.map((id) => ({ id, msg: check(id) })).filter((x) => x.msg);
    const box = $("#coErrors");
    if (bad.length) {
      $("#coErrorList").innerHTML = bad.map((x) => '<li><a href="#' + (x.id.endsWith("Set") ? $("#" + x.id).querySelector("input").id || x.id : x.id) + '" data-to="' + x.id + '">' + esc(x.msg) + "</a></li>").join("");
      box.hidden = false; box.focus();
      return;
    }
    box.hidden = true;
    const t = SG.cart.totals(items), p = pay(), off = p !== "tarjeta";
    const data = { id: "PRUEBA-" + Date.now().toString(36).toUpperCase().slice(-6), at: new Date().toISOString(), demo: true,
      contact: { email: $("#fEmail").value.trim(), name: $("#fName").value.trim(), phone: $("#fPhone").value.trim() },
      ship: ship(), address: needsAddress() ? { street: $("#fStreet").value.trim(), floor: $("#fFloor").value.trim(), city: $("#fCity").value.trim(), province: $("#fProv").value, zip: $("#fZip").value.trim() } : null,
      pay: p, lines: items.map((x) => ({ sku: x.sku, qty: x.qty })), list: t.list, total: off ? t.transfer : t.list };
    try { sessionStorage.setItem("sg:order", JSON.stringify(data)); } catch (err) {}
    SG.cart.clear();
    location.href = "/pedido.html";
  });
  // Los enlaces del resumen de errores llevan al campo y lo enfocan
  $("#coErrorList").addEventListener("click", (e) => {
    const a = e.target.closest("a"); if (!a) return; e.preventDefault();
    const id = a.dataset.to, el = id.endsWith("Set") ? $("#" + id).querySelector("input") : $("#" + id);
    el.focus(); el.scrollIntoView({ block: "center" });
  });
  // radios: los íconos de radio nativos se ocultan; la tarjeta completa refleja el estado elegido
  $$(".option input").forEach((r) => r.addEventListener("change", () => $$('.option input[name="' + r.name + '"]').forEach((x) => x.closest(".option").classList.toggle("is-on", x.checked))));
})();
