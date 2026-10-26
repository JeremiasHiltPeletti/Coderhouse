// Punto de entrada de Centinela WP (CommonJS a propósito).
// Hostinger/LiteSpeed carga la app con require(); este archivo es compatible con cualquier
// cargador y arranca la app real (lib/app.js, módulo ES) con import() dinámico.
"use strict";
console.log("Centinela WP: cargando (entrada CommonJS v3)…");
import("./lib/app.js").catch((err) => {
  console.error("ERROR al iniciar Centinela WP:", err);
  process.exit(1);
});
