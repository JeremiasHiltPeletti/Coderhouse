// Almacenamiento local en JSON (escritura atómica) + cifrado de secretos.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
// En un hosting gestionado (Hostinger) cada despliegue crea una carpeta nueva (…/hbuilds/…):
// los datos van a una carpeta fija del usuario para que sobrevivan a los redespliegues.
export const HOSTED = process.env.CENTINELA_HOSTED === "1" || here.includes(`${path.sep}hbuilds${path.sep}`);
export const DATA_DIR = process.env.CENTINELA_DATA_DIR || (HOSTED ? path.join(os.homedir(), "centinela-data") : path.join(here, "..", "data"));
const DB_FILE = path.join(DATA_DIR, "db.json");

fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });

// ---------- Contraseña del panel: scrypt con parámetros de OWASP ----------
// OWASP recomienda scrypt con N=2^17, r=8, p=1 como mínimo. Formato guardado:
//   scrypt$<log2 N>$<r>$<p>$<sal hex>$<hash hex>
// Las contraseñas guardadas con el formato anterior ("sal:hash", N=2^14) se siguen aceptando
// y se vuelven a guardar con los parámetros nuevos en el siguiente inicio de sesión.
const SCRYPT = { logN: 17, r: 8, p: 1 };
const scryptOpts = (logN, r, p) => ({ N: 2 ** logN, r, p, maxmem: 256 * 1024 * 1024 });

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64, scryptOpts(SCRYPT.logN, SCRYPT.r, SCRYPT.p)).toString("hex");
  return `scrypt$${SCRYPT.logN}$${SCRYPT.r}$${SCRYPT.p}$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  try {
    let salt, hash, opts;
    const parts = String(stored).split("$");
    if (parts[0] === "scrypt" && parts.length === 6) {
      const [, logN, r, p] = parts.map(Number);
      [salt, hash] = parts.slice(4);
      opts = scryptOpts(logN, r, p);
    } else {
      [salt, hash] = String(stored).split(":"); // formato anterior: N=2^14, r=8, p=1
      opts = scryptOpts(14, 8, 1);
    }
    const expected = Buffer.from(hash, "hex");
    const test = crypto.scryptSync(String(password), salt, expected.length, opts);
    return expected.length > 0 && crypto.timingSafeEqual(test, expected);
  } catch {
    return false;
  }
}

/** true si el hash guardado usa parámetros más débiles que los actuales. */
export function needsRehash(stored) {
  const parts = String(stored).split("$");
  return !(parts[0] === "scrypt" && Number(parts[1]) >= SCRYPT.logN && Number(parts[2]) >= SCRYPT.r);
}

// ---------- Cifrado AES-256-GCM para contraseñas de aplicación y claves de rescate ----------
// v2: la clave se deriva del secreto con scrypt (resiste fuerza bruta si el secreto es una frase).
// v1 (anterior): un solo SHA-256. Se sigue leyendo y se recifra a v2 al arrancar.
function loadSecret() {
  if (process.env.CENTINELA_SECRET) return process.env.CENTINELA_SECRET;
  const file = path.join(DATA_DIR, ".secret");
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, crypto.randomBytes(32).toString("hex"), { mode: 0o600 });
  }
  return fs.readFileSync(file, "utf8").trim();
}
const SECRET = loadSecret();
const KEYS = {
  v1: crypto.createHash("sha256").update(SECRET).digest(),
  v2: crypto.scryptSync(SECRET, "centinela-wp/aes-256-gcm/v2", 32, scryptOpts(17, 8, 1)),
};

export function encrypt(text) {
  if (text == null) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEYS.v2, iv);
  const data = Buffer.concat([cipher.update(String(text), "utf8"), cipher.final()]);
  return ["v2", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

export function decrypt(blob) {
  if (!blob) return null;
  const [v, iv, tag, data] = blob.split(":");
  if (!KEYS[v]) throw new Error("Formato de secreto desconocido");
  const decipher = crypto.createDecipheriv("aes-256-gcm", KEYS[v], Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

// ---------- Base de datos JSON ----------
const empty = () => ({ version: 1, sites: [], reports: [], settings: {}, auth: {} });

let db = empty();
if (fs.existsSync(DB_FILE)) {
  try {
    db = { ...empty(), ...JSON.parse(fs.readFileSync(DB_FILE, "utf8")) };
  } catch (err) {
    const broken = `${DB_FILE}.broken-${Date.now()}`;
    fs.copyFileSync(DB_FILE, broken);
    console.error(`db.json ilegible; se guardó una copia en ${broken}`, err);
  }
}

// Recifra con v2 los secretos guardados en el formato anterior.
let migrated = false;
for (const site of db.sites) {
  for (const field of ["appPassword", "rescueKey"]) {
    if (typeof site[field] === "string" && site[field].startsWith("v1:")) {
      try {
        site[field] = encrypt(decrypt(site[field]));
        migrated = true;
      } catch {
        /* no se pudo descifrar (secreto cambiado): se deja como está */
      }
    }
  }
}

let timer = null;
function flush() {
  timer = null;
  const tmp = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, DB_FILE);
}

export function save() {
  if (!timer) timer = setTimeout(flush, 150);
}

export function saveNow() {
  if (timer) clearTimeout(timer);
  flush();
}

if (migrated) save();

process.on("exit", () => timer && flush());
// El hosting detiene la app con SIGTERM cuando no recibe visitas: se guardan los cambios pendientes.
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.once(signal, () => {
    if (timer) flush();
    process.exit(0);
  });
}

export const store = {
  get data() {
    return db;
  },
  sites: () => db.sites,
  site: (id) => db.sites.find((s) => s.id === id),
  addSite(site) {
    db.sites.push(site);
    save();
    return site;
  },
  removeSite(id) {
    db.sites = db.sites.filter((s) => s.id !== id);
    save();
  },
  addReport(report) {
    db.reports.unshift(report);
    db.reports = db.reports.slice(0, 500);
    save();
    return report;
  },
  reports: (siteId) => (siteId ? db.reports.filter((r) => r.siteId === siteId) : db.reports),
  report: (id) => db.reports.find((r) => r.id === id),
};

export const DEFAULT_SITE_SETTINGS = {
  mode: "manual", // manual: propone y espera aprobación · auto: aplica lo recomendado
  soakDays: 3, // días de espera desde la publicación de una versión antes de instalarla
  restoreDb: true, // en una restauración, volver también la base de datos
  includeUploads: false, // incluir uploads en las copias completas
  schedule: "off", // off | daily | weekly
  healthUrls: [], // rutas extra a verificar, p. ej. /tienda, /carrito
  skip: [], // slugs que nunca se actualizan automáticamente
};

export function newId(prefix = "") {
  return prefix + crypto.randomBytes(6).toString("hex");
}
