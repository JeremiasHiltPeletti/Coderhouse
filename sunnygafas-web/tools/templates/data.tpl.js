/* =========================================================
   Sunnygafas — catálogo único (Home, búsqueda, catálogo y fichas)
   ARCHIVO GENERADO por tools/build.py. No lo edites a mano.
   Precio, stock, descripción y enlace de cada variante salen de la
   tienda oficial (tools/sync_store.py); la curaduría, de tools/models.json.
   ========================================================= */
(function () {
  const STORE = /*STORE*/;

  /* Grupos del selector: Redondas incluye los marcos ovalados */
  const SHAPE_GROUPS = {
    redonda:  { label: "Redondas y ovaladas", plural: "redondos y ovalados", fem: "redondas y ovaladas", one: "redonda u ovalada", includes: ["redonda", "ovalada"] },
    cuadrada: { label: "Cuadradas", plural: "cuadrados", fem: "cuadradas", one: "cuadrada", includes: ["cuadrada"] },
    cateye:   { label: "Cat eye",   plural: "cat eye", fem: "cat eye", one: "cat eye", includes: ["cateye"] },
    aviador:  { label: "Aviador",   plural: "aviador", fem: "aviador", one: "aviador", includes: ["aviador"] }
  };
  const SHAPE_NAME = { redonda: "Redonda", ovalada: "Ovalada", cuadrada: "Cuadrada", cateye: "Cat eye", aviador: "Aviador" };

  const CATEGORIES = { sol: "Gafas de sol", pol: "Polarizadas", arm: "Armazones", clip: "Clip-on 2 en 1", acc: "Accesorios" };
  const CAT_PAGE = { sol: "/gafas-de-sol.html", pol: "/polarizadas.html", arm: "/armazones.html", clip: "/clip-on.html", acc: "/accesorios.html" };
  const COLLECTIONS = ["Básica", "Esencial", "Superior", "Élite"];

  const TORT = "repeating-linear-gradient(135deg,#5A3618 0 4px,#B98552 4px 7px,#3A2414 7px 10px)";
  const HEX = { Negro: "#1E1A16", "Marrón": "#7A4A24", Carey: TORT, Print: TORT, Gris: "#A9A6A2", Verde: "#9DBB9E", Amarillo: "#E2B03A", Naranja: "#E58A2B", Azul: "#5D86A8", Caramelo: "#B8763A", Rosa: "#E7B8B2", Gold: "#C9A85C", Silver: "#C7C9CC", Rose: "#D8A79A", Beige: "#D9C4A3", Black: "#1E1A16", Espejado: "linear-gradient(135deg,#7FD1C9,#5AA7E0 50%,#E79AA6)", Transparente: "#E9E6E1", Rojo: "#A33A2E", Dorado: "#C9A85C", Plateado: "#C7C9CC" };
  /* Familias para el filtro de color del catálogo */
  const COLOR_FAMILY = { Negro: "Negro", Black: "Negro", "Marrón": "Marrón", Caramelo: "Marrón", Carey: "Carey y print", Print: "Carey y print", Gris: "Gris y plateado", Plateado: "Gris y plateado", Silver: "Gris y plateado", Dorado: "Dorado", Gold: "Dorado", Beige: "Claros", Transparente: "Claros", Rosa: "Color", Rose: "Color", Rojo: "Color", Verde: "Color", Amarillo: "Color", Naranja: "Color", Azul: "Color", Espejado: "Color" };
  const FAMILY_HEX = { Negro: "#1E1A16", "Marrón": "#7A4A24", "Carey y print": TORT, "Gris y plateado": "#B4B5B6", Dorado: "#C9A85C", Claros: "#E6DDCC", Color: "conic-gradient(#E58A2B,#E2B03A,#9DBB9E,#5D86A8,#E7B8B2,#A33A2E,#E58A2B)" };

  const PRODUCTS = /*PRODUCTS*/;
  const BY_ID = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
  const FEATURED = /*FEATURED*/;

  const money = (n) => "$" + Math.round(n).toLocaleString("es-AR");
  /* Importe exacto: conserva los centavos cuando existen ($3.733,33), como los muestra la tienda */
  const moneyExact = (n) => { const r = Math.round(n * 100) / 100; return "$" + r.toLocaleString("es-AR", Number.isInteger(r) ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  const transferPrice = (n) => Math.round(n * (1 - STORE.transferOff));
  const img = (name, kind) => "/assets/img/" + (kind || "card") + "/" + name + ".webp";
  const typeLabel = (p) => p.cat === "sol" && p.col ? "Colección " + p.col : CATEGORIES[p.cat];
  const productURL = (p, vi) => "/producto/" + p.id + ".html" + (vi ? "?color=" + p.vars[vi].slug : "");
  const inGroup = (p, group) => !!p.shape && SHAPE_GROUPS[group].includes.includes(p.shape);
  const firstInStock = (p) => Math.max(0, p.vars.findIndex((v) => v.stock));
  const norm = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  /* Nombre para mensajes y avisos: «Charlotte en Marrón»; los accesorios ya llevan el color en el nombre */
  const fullName = (p, v) => p.cat === "acc" ? p.name : p.name + " en " + v.label;
  const wa = (text) => "https://wa.me/" + STORE.waNumber + "?text=" + encodeURIComponent(text);

  /* Búsqueda: devuelve producto + variante; «gala carey» → Gala, variante Carey */
  function search(q) {
    const terms = norm(q).split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    const out = [];
    PRODUCTS.forEach((p) => {
      const group = p.shape ? Object.keys(SHAPE_GROUPS).find((g) => inGroup(p, g)) : null;
      const base = norm([p.name, CATEGORIES[p.cat], p.col || "", p.shape ? SHAPE_NAME[p.shape] : "", group ? SHAPE_GROUPS[group].label : "", p.cat === "pol" ? "polarizada polarizado" : "", p.cat === "sol" ? "sol" : ""].join(" "));
      const hits = p.vars.map((v, i) => ({ i, text: base + " " + norm(v.c + " " + v.label) }))
        .filter((x) => terms.every((t) => x.text.includes(t)));
      if (!hits.length) return;
      const colorTerm = terms.some((t) => p.vars.some((v) => norm(v.c + " " + v.label).includes(t)) && !base.includes(t));
      (colorTerm ? hits : [hits.find((h) => p.vars[h.i].stock) || hits[0]]).forEach((h) => out.push({ p, vi: h.i, byColor: colorTerm }));
    });
    return out;
  }

  window.SG = { STORE, SHAPE_GROUPS, SHAPE_NAME, CATEGORIES, CAT_PAGE, COLLECTIONS, HEX, COLOR_FAMILY, FAMILY_HEX, PRODUCTS, BY_ID, FEATURED,
    money, moneyExact, transferPrice, fullName, img, typeLabel, productURL, inGroup, firstInStock, norm, wa, search };
})();
