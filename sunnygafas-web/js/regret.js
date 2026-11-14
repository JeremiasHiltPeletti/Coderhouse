/* =========================================================
   Sunnygafas — Botón de arrepentimiento (modo de prueba)
   Valida el formulario y muestra la constancia. En la vista previa no se envía: falta conectar el correo o un sistema de pedidos.
   ========================================================= */
(function () {
  const SG = window.SG, $ = SG.$;
  const form = $("#regretForm"); if (!form) return;
  const rules = { rOrder: (v) => !v ? "Ingresá el número de pedido." : "", rName: (v) => !v ? "Ingresá tu nombre y apellido." : "",
    rEmail: (v) => !v ? "Ingresá tu email." : !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? "Revisá el email (por ejemplo, nombre@mail.com)." : "" };
  const set = (id, m) => { const e = $("#" + id + "Err"); e.textContent = m; e.hidden = !m; $("#" + id).setAttribute("aria-invalid", m ? "true" : "false"); $("#" + id).closest(".field").classList.toggle("has-err", !!m); return m; };
  Object.keys(rules).forEach((id) => $("#" + id).addEventListener("blur", (e) => { if (e.target.value || e.target.getAttribute("aria-invalid") === "true") set(id, rules[id](e.target.value.trim())); }));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const bad = Object.keys(rules).filter((id) => set(id, rules[id]($("#" + id).value.trim())));
    if (bad.length) { $("#" + bad[0]).focus(); return; }
    const code = "ARR-" + Date.now().toString(36).toUpperCase().slice(-6);
    $("#regretCode").textContent = code;
    form.hidden = true; const ok = $("#regretDone"); ok.hidden = false; ok.focus();
  });
})();
