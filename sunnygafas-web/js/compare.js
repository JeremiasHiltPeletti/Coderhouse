/* =========================================================
   Sunnygafas — Comparador de reflejo (categoría Polarizadas)
   La misma foto en ambas capas; la del lente común suma un reflejo simulado.
   Un solo control: se arrastra, se toca o se mueve con las flechas.
   ========================================================= */
(function () {
  const stage = document.querySelector(".compare__stage"), range = document.getElementById("compareRange");
  if (!stage || !range) return;
  function setPos(v) {
    v = Math.max(0, Math.min(100, Math.round(v)));
    range.value = v;
    stage.style.setProperty("--pos", v + "%");
    range.setAttribute("aria-valuetext", (100 - v) + "% de la vista con lente polarizado");
  }
  range.addEventListener("input", () => setPos(+range.value));
  let dragging = false, startX = 0;
  const fromPointer = (e) => { const r = stage.getBoundingClientRect(); setPos(((e.clientX - r.left) / r.width) * 100); };
  // touch-action: pan-y deja el desplazamiento vertical al navegador; el gesto horizontal mueve la división
  stage.addEventListener("pointerdown", (e) => {
    dragging = true; startX = e.clientX;
    if (e.pointerType === "mouse") { stage.setPointerCapture(e.pointerId); fromPointer(e); range.focus({ preventScroll: true }); }
  });
  stage.addEventListener("pointermove", (e) => { if (dragging && (e.pointerType === "mouse" || Math.abs(e.clientX - startX) > 4)) fromPointer(e); });
  ["pointerup", "pointercancel", "pointerleave"].forEach((t) => stage.addEventListener(t, (e) => {
    if (dragging && e.type === "pointerup" && e.pointerType !== "mouse" && Math.abs(e.clientX - startX) <= 4) fromPointer(e);
    if (e.type !== "pointerleave" || e.pointerType !== "mouse") dragging = false;
  }));
  stage.style.touchAction = "pan-y";
  setPos(+range.value);
})();
