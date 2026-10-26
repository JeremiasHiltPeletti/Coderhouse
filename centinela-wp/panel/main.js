// Centinela WP — panel central.
// Lo carga server.js (punto de entrada). Ejecutar: npm start (ver README).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

console.log(`Iniciando Centinela WP · Node ${process.version} · PORT=${process.env.PORT || "(no definido)"}`);
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 2)) {
  console.error("ERROR: Centinela WP necesita Node.js 22.2 o superior. Cambiá la versión de Node.js en la configuración de la app (22 o 24).");
  process.exit(1);
}
process.on("uncaughtException", (err) => {
  console.error("ERROR inesperado:", err);
  process.exit(1);
});

// Carga .env sin dependencias (antes de importar módulos que leen process.env).
const here = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(here, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && m[2] !== "" && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const { store, save, saveNow, encrypt, newId, DEFAULT_SITE_SETTINGS, HOSTED, DATA_DIR } = await import("./lib/store.js");
const { WpClient, WpError, discover, normalizeUrl } = await import("./lib/wp.js");
const { startJob, listJobs, getJob, bus, runningJobFor } = await import("./lib/jobs.js");
const { checkSite, applyUpdates, fullBackup, manualRestore, recoverInflight, settingsOf, pendingItems, BACKUP_DIR } = await import("./lib/pipeline.js");
const { sourcesConfigured } = await import("./lib/research.js");
const { zipFolder } = await import("./lib/zip.js");

const PORT = Number(process.env.PORT || 4747);
// En tu PC escucha solo en localhost. En el hosting, el proxy del proveedor necesita llegar a la app.
const HOST = process.env.HOST || (HOSTED ? undefined : "127.0.0.1");
const PUBLIC_URL = (process.env.PANEL_PUBLIC_URL || "").replace(/\/+$/, "");
const PUBLIC_DIR = path.join(here, "public");
// El paquete para hosting incluye el conector junto al panel; en el repositorio está un nivel arriba.
const CONNECTOR_DIR = [path.join(here, "connector", "centinela-connector"), path.join(here, "..", "connector", "centinela-connector")].find((d) => fs.existsSync(d));
const CRON_TOKEN = process.env.CRON_TOKEN || "";

// ---------------------------------------------------------------------------
// Autenticación del panel
// ---------------------------------------------------------------------------
// Sesiones guardadas (como hash) en db.json: sobreviven a los reinicios del hosting.
const SESSION_TTL = 12 * 3600e3;
store.data.auth.sessions ||= {};
const tokenHash = (t) => crypto.createHash("sha256").update(String(t)).digest("hex");
const sessions = {
  get: (t) => {
    const expires = store.data.auth.sessions[tokenHash(t)];
    return expires ? { expires } : undefined;
  },
  set: (t, s) => {
    const now = Date.now();
    for (const [k, exp] of Object.entries(store.data.auth.sessions)) if (exp < now) delete store.data.auth.sessions[k];
    store.data.auth.sessions[tokenHash(t)] = s.expires;
    saveNow();
  },
  touch: (t, expires) => {
    store.data.auth.sessions[tokenHash(t)] = expires;
  },
  delete: (t) => {
    delete store.data.auth.sessions[tokenHash(t)];
    save();
  },
};
const loginAttempts = new Map();

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`;
}
function checkPassword(password, stored) {
  const [salt, hash] = String(stored).split(":");
  const test = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(test, Buffer.from(hash, "hex"));
}
// PANEL_PASSWORD manda: si cambia en la configuración, se actualiza al arrancar.
if (process.env.PANEL_PASSWORD && !(store.data.auth.passwordHash && checkPassword(process.env.PANEL_PASSWORD, store.data.auth.passwordHash))) {
  store.data.auth.passwordHash = hashPassword(process.env.PANEL_PASSWORD);
  store.data.auth.sessions = {};
  save();
}

function clientIp(req) {
  if (HOSTED) return String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress;
  return req.socket.remoteAddress;
}
const isLoopback = (req) => !HOSTED && ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress);

function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split(";").map((c) => c.trim().split("=").map(decodeURIComponent)).filter((p) => p[0]));
}
function sessionOf(req) {
  const token = parseCookies(req).cw_session;
  const s = token && sessions.get(token);
  if (!s || s.expires < Date.now()) return null;
  sessions.touch(token, Date.now() + SESSION_TTL);
  return s;
}
function createSession(res) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { expires: Date.now() + SESSION_TTL });
  const secure = PUBLIC_URL.startsWith("https://") || HOSTED ? "; Secure" : "";
  res.setHeader("Set-Cookie", `cw_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL / 1000}${secure}`);
}

// ---------------------------------------------------------------------------
// Utilidades HTTP
// ---------------------------------------------------------------------------
function send(res, status, data, headers = {}) {
  const body = typeof data === "string" || Buffer.isBuffer(data) ? data : JSON.stringify(data);
  res.writeHead(status, { "Content-Type": typeof data === "object" && !Buffer.isBuffer(data) ? "application/json; charset=utf-8" : "text/plain; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(body);
}
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1e6) throw new HttpError(413, "Petición demasiado grande");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "JSON inválido");
  }
}

const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json" };
function serveStatic(req, res, pathname) {
  const rel = pathname === "/" ? "index.html" : pathname.slice(1);
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return false;
  res.writeHead(200, {
    "Content-Type": MIME[path.extname(file)] || "application/octet-stream",
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
  });
  fs.createReadStream(file).pipe(res);
  return true;
}

// ---------------------------------------------------------------------------
// Vistas de datos
// ---------------------------------------------------------------------------
function publicSite(site) {
  const { appPassword, rescueKey, ...rest } = site;
  return { ...rest, settings: settingsOf(site), hasRescue: Boolean(rescueKey), job: runningJobFor(site.id)?.id || null };
}

function siteSummary(site) {
  const inv = site.inventory;
  const analysis = Object.values(site.analysis || {});
  const pending = inv ? pendingItems(inv).length : 0;
  const lastReport = store.reports(site.id)[0];
  return {
    id: site.id,
    name: site.name,
    url: site.url,
    online: site.online !== false,
    lastCheck: site.lastCheck || null,
    wp: inv?.core?.version || null,
    php: inv?.environment?.php || null,
    plugins: inv ? inv.plugins.filter((p) => !p.mu).length : null,
    pending,
    recommended: analysis.filter((a) => a.advice.decision === "update").length,
    waiting: analysis.filter((a) => a.advice.decision === "wait").length,
    held: analysis.filter((a) => a.advice.decision === "hold").length,
    security: analysis.filter((a) => a.advice.securityFix).length,
    lastBackup: (site.backups || [])[0]?.created_gmt || null,
    lastReport: lastReport ? { status: lastReport.status, type: lastReport.type, summary: lastReport.summary, createdAt: lastReport.createdAt } : null,
    mode: settingsOf(site).mode,
    job: runningJobFor(site.id)?.id || null,
  };
}

function getSiteOr404(id) {
  const site = store.site(id);
  if (!site) throw new HttpError(404, "Sitio no encontrado");
  return site;
}

// Conexiones pendientes del flujo "Autorizar en WordPress".
const pendingConnects = new Map();

async function connectSite({ url, username, appPassword, discovered }) {
  const info = discovered || (await discover(url));
  const existing = store.sites().find((s) => s.url === info.url);
  const draft = {
    id: existing?.id || newId("site_"),
    name: info.name,
    url: info.url,
    restRoot: info.restRoot,
    username: String(username || "").trim(),
    appPassword: encrypt(String(appPassword || "").replace(/\s+/g, " ").trim()),
  };
  if (!draft.username || !appPassword) throw new HttpError(400, "Faltan el usuario o la contraseña de aplicación.");
  const client = new WpClient(draft);
  let me;
  try {
    me = await client.me();
  } catch (err) {
    throw new HttpError(401, err.status === 401 ? "Usuario o contraseña de aplicación incorrectos." : `No se pudo autenticar: ${err.message}`);
  }
  const caps = me.capabilities || {};
  if (!caps.manage_options || !caps.update_plugins) throw new HttpError(403, `El usuario «${me.name}» no es administrador con permiso para actualizar.`);

  let handshake = null;
  try {
    handshake = await client.handshake(false);
  } catch (err) {
    if (err.status === 404) {
      const e = new HttpError(412, "Falta el plugin Centinela Connector en el sitio. Descargalo desde el panel, instalalo y activalo; luego reintentá.");
      e.code = "connector_missing";
      throw e;
    }
    throw new HttpError(502, `El conector respondió con error: ${err.message}`);
  }

  const site = existing || { createdAt: new Date().toISOString(), settings: { ...DEFAULT_SITE_SETTINGS }, analysis: {}, backups: [] };
  Object.assign(site, draft, {
    name: handshake.name || draft.name,
    rescueUrl: handshake.rescue_url,
    rescueKey: encrypt(handshake.rescue_key),
    connector: handshake.connector,
    online: true,
    user: me.name,
  });
  // Comprueba que el acceso de rescate sea alcanzable (algunos hostings lo bloquean).
  try {
    await new WpClient(site).rescue("ping");
    site.rescueOk = true;
  } catch {
    site.rescueOk = false;
  }
  if (!existing) store.addSite(site);
  save();
  return site;
}

// ---------------------------------------------------------------------------
// Rutas
// ---------------------------------------------------------------------------
const routes = [];
const route = (method, pattern, handler, { auth = true } = {}) => {
  const keys = [];
  const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), "([^/]+)"))}$`);
  routes.push({ method, re, keys, handler, auth });
};

route("GET", "/api/session", (req) => ({ authenticated: Boolean(sessionOf(req)), needsSetup: !store.data.auth.passwordHash, setupAllowed: isLoopback(req) }), { auth: false });

route(
  "POST",
  "/api/setup",
  async (req, res) => {
    if (store.data.auth.passwordHash) throw new HttpError(409, "El panel ya tiene contraseña.");
    // Crear la contraseña desde el navegador solo se permite en tu propia PC: en internet,
    // el primero que entrara podría quedarse con el panel.
    if (!isLoopback(req)) throw new HttpError(403, "Definí la variable PANEL_PASSWORD en la configuración del hosting y reiniciá la app.");
    const { password } = await readJson(req);
    if (!password || password.length < 10) throw new HttpError(400, "Usá al menos 10 caracteres.");
    store.data.auth.passwordHash = hashPassword(password);
    save();
    createSession(res);
    return { ok: true };
  },
  { auth: false }
);

route(
  "POST",
  "/api/login",
  async (req, res) => {
    const ip = clientIp(req);
    const attempts = (loginAttempts.get(ip) || []).filter((t) => t > Date.now() - 60e3);
    if (attempts.length >= 5) throw new HttpError(429, "Demasiados intentos. Esperá un minuto.");
    const { password } = await readJson(req);
    if (!store.data.auth.passwordHash || !password || !checkPassword(password, store.data.auth.passwordHash)) {
      loginAttempts.set(ip, [...attempts, Date.now()]);
      throw new HttpError(401, "Contraseña incorrecta.");
    }
    loginAttempts.delete(ip);
    createSession(res);
    return { ok: true };
  },
  { auth: false }
);

route("POST", "/api/logout", (req, res) => {
  sessions.delete(parseCookies(req).cw_session);
  res.setHeader("Set-Cookie", "cw_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
  return { ok: true };
});

route("GET", "/api/overview", () => ({ sites: store.sites().map(siteSummary), jobs: listJobs(), sources: sourcesConfigured(), reports: store.reports().slice(0, 15) }));

route("POST", "/api/sites/discover", async (req) => {
  const { url } = await readJson(req);
  let info;
  try {
    info = await discover(url);
  } catch (err) {
    throw new HttpError(400, err.message);
  }
  let authorizeLink = null;
  if (info.authorizeUrl) {
    const state = crypto.randomBytes(16).toString("hex");
    pendingConnects.set(state, { discovered: info, expires: Date.now() + 15 * 60e3 });
    const params = new URLSearchParams({ app_name: "Centinela WP", app_id: "5e1d6a1c-6c55-4d0b-9f3e-0b5a1c2e7a10" });
    if (PUBLIC_URL.startsWith("https://")) {
      params.set("success_url", `${PUBLIC_URL}/auth/callback?state=${state}`);
      params.set("reject_url", `${PUBLIC_URL}/#/sitios`);
    }
    authorizeLink = `${info.authorizeUrl}?${params}`;
  }
  return { ...info, authorizeLink, autoReturn: PUBLIC_URL.startsWith("https://"), warning: info.https ? null : "El sitio no usa HTTPS: la contraseña de aplicación viajaría sin cifrar. WordPress solo permite contraseñas de aplicación sobre HTTPS (salvo entornos locales)." };
});

route("POST", "/api/sites", async (req) => {
  const body = await readJson(req);
  try {
    const site = await connectSite({ url: normalizeUrl(body.url), username: body.username, appPassword: body.appPassword });
    return publicSite(site);
  } catch (err) {
    if (err instanceof WpError) throw new HttpError(400, err.message);
    throw err;
  }
});

route(
  "GET",
  "/auth/callback",
  async (req, res, _params, url) => {
    if (!sessionOf(req)) {
      res.writeHead(302, { Location: "/#/login" });
      return res.end();
    }
    const pending = pendingConnects.get(url.searchParams.get("state"));
    pendingConnects.delete(url.searchParams.get("state"));
    if (!pending || pending.expires < Date.now()) {
      res.writeHead(302, { Location: "/#/sitios?error=expired" });
      return res.end();
    }
    try {
      const site = await connectSite({ url: pending.discovered.url, username: url.searchParams.get("user_login"), appPassword: url.searchParams.get("password"), discovered: pending.discovered });
      res.writeHead(302, { Location: `/#/sitio/${site.id}` });
    } catch (err) {
      res.writeHead(302, { Location: `/#/sitios?error=${encodeURIComponent(err.message)}` });
    }
    res.end();
  },
  { auth: false }
);

route("GET", "/api/sites/:id", (req, res, { id }) => publicSite(getSiteOr404(id)));

route("PATCH", "/api/sites/:id/settings", async (req, res, { id }) => {
  const site = getSiteOr404(id);
  const body = await readJson(req);
  const s = settingsOf(site);
  if (["manual", "auto"].includes(body.mode)) s.mode = body.mode;
  if (Number.isInteger(body.soakDays) && body.soakDays >= 0 && body.soakDays <= 30) s.soakDays = body.soakDays;
  if (typeof body.restoreDb === "boolean") s.restoreDb = body.restoreDb;
  if (typeof body.includeUploads === "boolean") s.includeUploads = body.includeUploads;
  if (["off", "daily", "weekly"].includes(body.schedule)) s.schedule = body.schedule;
  if (Array.isArray(body.healthUrls)) s.healthUrls = body.healthUrls.map(String).map((u) => u.trim()).filter((u) => /^\/[\w\-./?=&%]*$/.test(u)).slice(0, 15);
  if (Array.isArray(body.skip)) s.skip = body.skip.map(String).filter((x) => /^[\w.-]+$/.test(x)).slice(0, 100);
  site.settings = s;
  save();
  return publicSite(site);
});

route("DELETE", "/api/sites/:id", (req, res, { id }) => {
  getSiteOr404(id);
  if (runningJobFor(id)) throw new HttpError(409, "Hay una tarea en curso para este sitio.");
  store.removeSite(id);
  return { ok: true };
});

route("POST", "/api/sites/:id/check", (req, res, { id }) => {
  const site = getSiteOr404(id);
  return startJob({ siteId: id, type: "check", title: `Analizar ${site.name}` }, (job) => checkSite(site, job));
});

route("POST", "/api/sites/:id/apply", async (req, res, { id }) => {
  const site = getSiteOr404(id);
  const { keys, override } = await readJson(req);
  if (!Array.isArray(keys) || !keys.length) throw new HttpError(400, "Elegí al menos una actualización.");
  return startJob({ siteId: id, type: "apply", title: `Actualizar ${site.name}` }, (job) => applyUpdates(site, keys.map(String), job, { override: Boolean(override) }));
});

route("POST", "/api/sites/:id/backup", (req, res, { id }) => {
  const site = getSiteOr404(id);
  return startJob({ siteId: id, type: "backup", title: `Copia completa de ${site.name}` }, (job) => fullBackup(site, job));
});

route("GET", "/api/sites/:id/backups", async (req, res, { id }) => {
  const site = getSiteOr404(id);
  let remote = [];
  let remoteError = null;
  try {
    remote = await new WpClient(site).listBackups();
  } catch (err) {
    remoteError = err.message;
  }
  const localDir = path.join(BACKUP_DIR, site.id);
  const local = fs.existsSync(localDir)
    ? fs
        .readdirSync(localDir)
        .filter((d) => fs.existsSync(path.join(localDir, d, "manifest.json")))
        .map((d) => JSON.parse(fs.readFileSync(path.join(localDir, d, "manifest.json"), "utf8")))
    : [];
  const map = new Map();
  for (const b of remote) map.set(b.id, { ...b, onSite: true, local: false });
  for (const b of local) map.set(b.id, { ...(map.get(b.id) || b), local: true, onSite: map.has(b.id) });
  const list = [...map.values()].sort((a, b) => String(b.created_gmt).localeCompare(String(a.created_gmt)));
  return { backups: list, remoteError };
});

route("POST", "/api/sites/:id/backups/:bid/restore", async (req, res, { id, bid }) => {
  const site = getSiteOr404(id);
  if (!/^[a-z0-9-]{8,64}$/.test(bid)) throw new HttpError(400, "Id inválido");
  const { restoreDb = true } = await readJson(req);
  return startJob({ siteId: id, type: "restore", title: `Restaurar ${site.name}` }, (job) => manualRestore(site, bid, job, { restoreDb: Boolean(restoreDb) }));
});

route("DELETE", "/api/sites/:id/backups/:bid", async (req, res, { id, bid }, url) => {
  const site = getSiteOr404(id);
  if (!/^[a-z0-9-]{8,64}$/.test(bid)) throw new HttpError(400, "Id inválido");
  const where = url.searchParams.get("where") || "both";
  if (where !== "local") await new WpClient(site).deleteBackup(bid).catch(() => null);
  if (where !== "remote") fs.rmSync(path.join(BACKUP_DIR, site.id, bid), { recursive: true, force: true });
  site.backups = (site.backups || []).filter((b) => b.id !== bid);
  save();
  return { ok: true };
});

route("GET", "/api/sites/:id/backups/:bid/files/:name", async (req, res, { id, bid, name }) => {
  const site = getSiteOr404(id);
  if (!/^[a-z0-9-]{8,64}$/.test(bid) || !/^(manifest\.json|database\.sql|files-\d{3}\.zip)$/.test(name)) throw new HttpError(400, "Archivo inválido");
  const file = path.join(BACKUP_DIR, site.id, bid, name);
  if (!fs.existsSync(file)) {
    // Si no está en el panel, se baja primero desde el sitio.
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await new WpClient(site).download(bid, name, file);
  }
  res.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Length": fs.statSync(file).size, "Content-Disposition": `attachment; filename="${site.id}-${bid}-${name}"` });
  fs.createReadStream(file).pipe(res);
});

route("POST", "/api/sites/:id/rescue-test", async (req, res, { id }) => {
  const site = getSiteOr404(id);
  try {
    const pong = await new WpClient(site).rescue("ping");
    site.rescueOk = true;
    save();
    return { ok: true, pong };
  } catch (err) {
    site.rescueOk = false;
    save();
    return { ok: false, error: err.message };
  }
});

route("POST", "/api/sites/:id/reconnect", async (req, res, { id }) => {
  const site = getSiteOr404(id);
  const hs = await new WpClient(site).handshake(true);
  site.rescueKey = encrypt(hs.rescue_key);
  site.rescueUrl = hs.rescue_url;
  site.connector = hs.connector;
  save();
  return publicSite(site);
});

route("GET", "/api/reports", (req, res, p, url) => store.reports(url.searchParams.get("site") || undefined).slice(0, 100));
route("GET", "/api/reports/:id", (req, res, { id }) => store.report(id) || Promise.reject(new HttpError(404, "Informe no encontrado")));
route("GET", "/api/jobs", () => listJobs());
route("GET", "/api/jobs/:id", (req, res, { id }) => getJob(id) || Promise.reject(new HttpError(404, "Tarea no encontrada")));

route("GET", "/api/events", (req, res) => {
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  res.write("retry: 3000\n\n");
  const onEvent = (e) => res.write(`data: ${JSON.stringify(e)}\n\n`);
  bus.on("event", onEvent);
  const ping = setInterval(() => res.write(": ping\n\n"), 25000);
  req.on("close", () => {
    bus.off("event", onEvent);
    clearInterval(ping);
  });
});

route("GET", "/download/centinela-connector.zip", (req, res) => {
  if (!CONNECTOR_DIR) throw new HttpError(404, "El paquete no incluye la carpeta del conector.");
  const zip = zipFolder(CONNECTOR_DIR, "centinela-connector");
  res.writeHead(200, { "Content-Type": "application/zip", "Content-Length": zip.length, "Content-Disposition": 'attachment; filename="centinela-connector.zip"' });
  res.end(zip);
});

// ---------------------------------------------------------------------------
// Servidor
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try {
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = url.pathname.match(r.re);
      if (!m) continue;
      if (r.auth && !sessionOf(req)) throw new HttpError(401, "Iniciá sesión.");
      // Protección CSRF: los formularios de otros sitios no pueden enviar este encabezado.
      if (req.method !== "GET" && url.pathname.startsWith("/api/") && req.headers["x-centinela"] !== "1") throw new HttpError(403, "Petición rechazada (CSRF).");
      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      const result = await r.handler(req, res, params, url);
      if (!res.headersSent && !res.writableEnded && result !== undefined) send(res, 200, result);
      return;
    }
    if (req.method === "GET" && serveStatic(req, res, url.pathname)) return;
    throw new HttpError(404, "No encontrado");
  } catch (err) {
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    if (status === 500) console.error(err);
    if (!res.headersSent) send(res, status, { error: err.message, code: err.code || null, jobId: err.jobId || null });
    else res.end();
  }
});

// Programación: revisa los sitios con análisis diario o semanal y retoma
// actualizaciones que quedaron a medias por un reinicio.
function schedulerTick() {
  const now = Date.now();
  const started = [];
  for (const site of store.sites()) {
    if (runningJobFor(site.id)) continue;
    try {
      if (site.inflight) {
        startJob({ siteId: site.id, type: "recover", title: `Recuperación de ${site.name}` }, (job) => recoverInflight(site, job));
        started.push(`recover:${site.id}`);
        continue;
      }
      const { schedule } = settingsOf(site);
      if (schedule === "off") continue;
      const every = schedule === "daily" ? 864e5 : 7 * 864e5;
      if (site.lastScheduled && now - new Date(site.lastScheduled).getTime() < every - 30 * 60e3) continue;
      site.lastScheduled = new Date().toISOString();
      save();
      startJob({ siteId: site.id, type: "check", title: `Revisión programada de ${site.name}` }, (job) => checkSite(site, job));
      started.push(`check:${site.id}`);
    } catch {
      /* ya hay otra tarea */
    }
  }
  store.data.lastTick = new Date().toISOString();
  save();
  return started;
}
setInterval(schedulerTick, 10 * 60e3).unref();
setTimeout(schedulerTick, 5000).unref();

// Hostinger detiene la app si no recibe visitas: una tarea cron del hosting llama a esta URL
// cada 5 minutos para mantenerla despierta y disparar las revisiones programadas.
route(
  "GET",
  "/api/cron",
  (req, res, _p, url) => {
    const given = Buffer.from(url.searchParams.get("token") || "");
    const expected = Buffer.from(CRON_TOKEN);
    if (CRON_TOKEN.length < 16 || given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) throw new HttpError(403, "Token inválido");
    return { ok: true, started: schedulerTick(), running: listJobs().filter((j) => j.status === "running").length, at: new Date().toISOString() };
  },
  { auth: false }
);

server.on("error", (err) => {
  console.error(`ERROR: no se pudo escuchar en el puerto ${PORT}: ${err.message}`);
  process.exit(1);
});
server.listen(PORT, HOST, () => {
  console.log(`Centinela WP listo en http://${HOST || "0.0.0.0"}:${PORT}${HOSTED ? " (modo hosting)" : ""} · datos en ${DATA_DIR}`);
  if (HOSTED && !process.env.PANEL_PASSWORD && !store.data.auth.passwordHash) console.log("FALTA PANEL_PASSWORD: definila en las variables de entorno del hosting.");
  if (HOSTED && CRON_TOKEN.length < 16) console.log("Aviso: definí CRON_TOKEN (16+ caracteres) y una tarea cron que llame a /api/cron cada 5 minutos.");
  if (!HOSTED && !store.data.auth.passwordHash) console.log("Primera vez: abrí el panel y creá la contraseña de acceso.");
  const src = sourcesConfigured();
  if (!src.claude) console.log("Aviso: sin ANTHROPIC_API_KEY el análisis usa solo reglas y datos de WordPress.org.");
});
