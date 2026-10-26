// Punto de entrada de Centinela WP.
// Algunos hostings (LiteSpeed/Hostinger) cargan la app con require(), que no admite módulos
// con "await" a nivel principal. Por eso este archivo no lo usa y carga la app real con import().
import("./main.js").catch((err) => {
  console.error("ERROR al iniciar Centinela WP:", err);
  process.exit(1);
});
