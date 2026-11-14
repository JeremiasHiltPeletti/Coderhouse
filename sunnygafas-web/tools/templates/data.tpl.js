/* =========================================================
   Sunnygafas — catálogo único (Home, búsqueda, catálogo, fichas, carrito y checkout)
   ARCHIVO GENERADO por tools/build.py. No lo edites a mano.
   Precio, stock, descripción y fotos de cada variante salen de la tienda de origen
   (tools/sync_store.py); el agrupamiento, de tools/catalog.py; la curaduría, de tools/curation.json.
   Un atributo en null es «sin confirmar»: no se muestra ni se niega.
   ========================================================= */
(function () {
  const STORE = /*STORE*/;

  /* Grupos de forma: Redondas incluye las ovaladas */
  const SHAPE_GROUPS = {
    redonda:    { label: "Redondas y ovaladas", fem: "redondas y ovaladas", one: "redonda u ovalada", includes: ["redonda", "ovalada"] },
    cuadrada:   { label: "Cuadradas", fem: "cuadradas", one: "cuadrada", includes: ["cuadrada"] },
    cateye:     { label: "Cat eye", fem: "cat eye", one: "cat eye", includes: ["cateye"] },
    aviador:    { label: "Aviador", fem: "aviador", one: "aviador", includes: ["aviador"] },
    geometrica: { label: "Geométricas", fem: "geométricas", one: "geométrica", includes: ["geometrica"] }
  };
  const SHAPE_NAME = { redonda: "Redonda", ovalada: "Ovalada", cuadrada: "Cuadrada", cateye: "Cat eye", aviador: "Aviador", geometrica: "Geométrica" };

  const CATEGORIES = { sol: "Gafas de sol", pol: "Polarizadas", arm: "Armazones", clip: "Clip-on 2 en 1", acc: "Accesorios" };
  const CAT_PAGE = { sol: "/gafas-de-sol.html", pol: "/polarizadas.html", arm: "/armazones.html", clip: "/clip-on.html", acc: "/accesorios.html" };
  const COLLECTIONS = ["Básica", "Esencial", "Superior", "Élite"];

  /* Muestras de color: se busca la etiqueta completa y, si no está, su primera palabra */
  const TORT = "repeating-linear-gradient(135deg,#5A3618 0 4px,#B98552 4px 7px,#3A2414 7px 10px)";
  const HEX = { Negro: "#1E1A16", "Negro mate": "#2B2724", "Negro degradé": "linear-gradient(180deg,#1E1A16,#8C8580)", "Marrón": "#7A4A24", "Marrón mate": "#6E4A2E",
    Carey: TORT, Print: TORT, "Print negro": TORT, "Print marrón": TORT, Gris: "#A9A6A2", "Gris mate": "#8D8A86", Verde: "#7FA88A", Amarillo: "#E2B03A",
    Naranja: "#E58A2B", "Naranja y azul": "linear-gradient(135deg,#E58A2B 50%,#8FB4D8 50%)", Azul: "#4F79A3", "Azul print": "linear-gradient(135deg,#3E6A96,#9CC0DF)",
    Celeste: "#9CC8E6", Aqua: "#6FC2BA", Caramelo: "#B8763A", Rosa: "#E7B8B2", "Rosé": "#D8A79A", Violeta: "#7E5A9B", Rojo: "#A33A2E", Beige: "#D9C4A3",
    Nude: "#D8B79A", "Té": "#9C6B3E", Blanco: "#F4F1EC", Transparente: "#E9E6E1", Dorado: "#C9A85C", Plateado: "#C7C9CC", Degradé: "linear-gradient(180deg,#1E1A16,#8C8580)",
    Espejado: "linear-gradient(135deg,#7FD1C9,#5AA7E0 50%,#E79AA6)", "Print violeta": "linear-gradient(135deg,#4A2C5E,#9C7AB8)", "Print amarillo": "linear-gradient(135deg,#6B4B1E,#E2B03A)",
    "Print aqua": "linear-gradient(135deg,#5A3618,#6FC2BA)", "Aqua print": "linear-gradient(135deg,#5A3618,#6FC2BA)", "Print transparente": "linear-gradient(135deg,#8C5A30,#E9E6E1)",
    "Violeta print": "linear-gradient(135deg,#4A2C5E,#9C7AB8)", "Único": "#C9C2B8" };
  const swatch = (label) => HEX[label] || HEX[label.split(" ")[0]] || "#C9C2B8";
  const FAMILIES = ["Negro", "Marrón", "Carey y print", "Gris y plateado", "Dorado", "Claros", "Color"];
  const FAMILY_HEX = { Negro: "#1E1A16", "Marrón": "#7A4A24", "Carey y print": TORT, "Gris y plateado": "#B4B5B6", Dorado: "#C9A85C", Claros: "#E6DDCC",
    Color: "conic-gradient(#E58A2B,#E2B03A,#7FA88A,#4F79A3,#E7B8B2,#A33A2E,#E58A2B)" };

  const PRODUCTS = /*PRODUCTS*/;
  const BY_ID = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
  /* Índice por SKU (cada color es un SKU): lo usan el carrito y el checkout */
  const BY_SKU = {};
  PRODUCTS.forEach((p) => p.vars.forEach((v, i) => { BY_SKU[v.sku] = { p, v, i }; }));
  const FEATURED = /*FEATURED*/;

  const money = (n) => "$" + Math.round(n).toLocaleString("es-AR");
  /* Importe exacto: conserva los centavos cuando existen ($3.733,33) */
  const moneyExact = (n) => { const r = Math.round(n * 100) / 100; return "$" + r.toLocaleString("es-AR", Number.isInteger(r) ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  const transferPrice = (n) => Math.round(n * (1 - STORE.transferOff));
  const img = (name, kind) => "/assets/img/" + (kind || "card") + "/" + name + ".webp";
  const typeLabel = (p) => p.cat === "sol" && p.col ? "Colección " + p.col : CATEGORIES[p.cat];
  const productURL = (p, vi) => "/producto/" + p.id + ".html" + (vi ? "?color=" + p.vars[vi].slug : "");
  const inGroup = (p, group) => !!p.shape && SHAPE_GROUPS[group].includes.includes(p.shape);
  const firstInStock = (p) => Math.max(0, p.vars.findIndex((v) => v.stock));
  const norm = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  /* «Charlotte en Marrón»; si el modelo tiene un solo color, alcanza con el nombre */
  const fullName = (p, v) => p.vars.length === 1 ? p.name : p.name + " en " + v.label;
  const wa = (text) => "https://wa.me/" + STORE.waNumber + "?text=" + encodeURIComponent(text);
  /* Cantidad máxima por SKU: el stock informado por la tienda (si no informa, 10) */
  const maxQty = (v) => !v.stock ? 0 : (v.qty == null ? 10 : Math.max(1, Math.min(10, v.qty)));

  /* Búsqueda: devuelve producto + variante; «gala carey» → Gala, variante Carey */
  function search(q) {
    const terms = norm(q).split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    const out = [];
    PRODUCTS.forEach((p) => {
      const group = p.shape ? Object.keys(SHAPE_GROUPS).find((g) => inGroup(p, g)) : null;
      const base = norm([p.name, CATEGORIES[p.cat], p.col || "", p.shape ? SHAPE_NAME[p.shape] : "", group ? SHAPE_GROUPS[group].label : "", p.cat === "pol" ? "polarizada polarizado" : "", p.cat === "sol" ? "sol" : "", p.cat === "arm" ? "receta graduacion" : "", p.cat === "clip" ? "clip on" : ""].join(" "));
      const hits = p.vars.map((v, i) => ({ i, text: base + " " + norm(v.label + " " + v.fam) }))
        .filter((x) => terms.every((t) => x.text.includes(t)));
      if (!hits.length) return;
      const colorTerm = terms.some((t) => p.vars.some((v) => norm(v.label + " " + v.fam).includes(t)) && !base.includes(t));
      (colorTerm ? hits : [hits.find((h) => p.vars[h.i].stock) || hits[0]]).forEach((h) => out.push({ p, vi: h.i, byColor: colorTerm }));
    });
    return out;
  }

  window.SG = { STORE, SHAPE_GROUPS, SHAPE_NAME, CATEGORIES, CAT_PAGE, COLLECTIONS, HEX, swatch, FAMILIES, FAMILY_HEX, PRODUCTS, BY_ID, BY_SKU, FEATURED,
    money, moneyExact, transferPrice, fullName, img, typeLabel, productURL, inGroup, firstInStock, norm, wa, maxQty, search };
})();
