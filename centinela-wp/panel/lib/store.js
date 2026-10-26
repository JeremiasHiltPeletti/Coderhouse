// Almacenamiento local en JSON (escritura atómica) + cifrado de secretos.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.CENTINELA_DATA_DIR || path.join(here, "..", "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });

// ---------- Cifrado AES-256-GCM para contraseñas de aplicación y claves de rescate ----------
function loadKey() {
  if (process.env.CENTINELA_SECRET) {
    return crypto.createHash("sha256").update(process.env.CENTINELA_SECRET).digest();
  }
  const file = path.join(DATA_DIR, ".secret");
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, crypto.randomBytes(32).toString("hex"), { mode: 0o600 });
  }
  return crypto.createHash("sha256").update(fs.readFileSync(file, "utf8").trim()).digest();
}
const KEY = loadKey();

export function encrypt(text) {
  if (text == null) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const data = Buffer.concat([cipher.update(String(text), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

export function decrypt(blob) {
  if (!blob) return null;
  const [v, iv, tag, data] = blob.split(":");
  if (v !== "v1") throw new Error("Formato de secreto desconocido");
  const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, Buffer.from(iv, "base64"));
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

process.on("exit", () => timer && flush());

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
