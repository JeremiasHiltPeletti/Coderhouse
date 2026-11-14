/* =========================================================
   Sunnygafas — Guía de calce
   Si se llegó desde una ficha (?modelo=&color=), ofrece volver a ese modelo y color
   y precarga la consulta con esos datos. En acceso directo no cambia nada.
   ========================================================= */
(function () {
  const SG = window.SG, q = new URLSearchParams(location.search);
  const p = SG && SG.BY_ID[q.get("modelo") || ""];
  if (!p) return;
  const vi = Math.max(0, p.vars.findIndex((v) => v.slug === (q.get("color") || "").toLowerCase())), v = p.vars[vi];
  const back = document.getElementById("guideBack");
  back.textContent = "Volver a " + p.name;
  back.href = SG.productURL(p, vi) + "#medidas";
  back.hidden = false;
  document.getElementById("guideWa").href = SG.wa("Hola, quiero ayuda con el tamaño de " + SG.fullName(p, v) + ". La ficha es " + location.origin + SG.productURL(p, vi) + ".");
})();
