// Cliente HTTP para un sitio WordPress con el conector Centinela.
import fs from "node:fs";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { decrypt } from "./store.js";

const UA = "CentinelaWP/1.0 (+panel)";

export class WpError extends Error {
  constructor(message, { status = 0, code = "", body = null } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export function normalizeUrl(input) {
  let url = String(input || "").trim();
  if (!url) throw new WpError("Ingresá la URL del sitio.");
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new WpError("La URL debe empezar con http:// o https://");
  parsed.hash = "";
  parsed.search = "";
  return parsed.toString().replace(/\/+$/, "");
}

/** Descubre la API REST y el flujo de autorización de contraseñas de aplicación. */
export async function discover(siteUrl) {
  const url = normalizeUrl(siteUrl);
  let res;
  try {
    res = await fetch(`${url}/wp-json/`, { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(20000) });
  } catch (err) {
    throw new WpError(`No se pudo contactar ${url}: ${err.cause?.code || err.message}`);
  }
  let restRoot = `${new URL(res.url).origin}${new URL(res.url).pathname.replace(/\/$/, "")}`;
  let index = null;
  if (res.ok) {
    index = await res.json().catch(() => null);
  }
  if (!index) {
    // Sitios sin enlaces permanentes: ?rest_route=
    const alt = await fetch(`${url}/?rest_route=/`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) }).catch(() => null);
    if (alt?.ok) {
      index = await alt.json().catch(() => null);
      restRoot = `${url}/?rest_route=`;
    }
  }
  if (!index || !index.namespaces) {
    throw new WpError("No parece un sitio WordPress con la API REST activa (/wp-json/ no responde).", { status: res.status });
  }
  const appPasswords = index.authentication?.["application-passwords"]?.endpoints?.authorization || null;
  return {
    url: (index.home || url).replace(/\/+$/, ""),
    name: index.name || url,
    restRoot,
    https: url.startsWith("https://"),
    authorizeUrl: appPasswords,
    hasConnector: index.namespaces.includes("centinela/v1"),
  };
}

export class WpClient {
  constructor(site) {
    this.site = site;
    this.restRoot = site.restRoot || `${site.url}/wp-json`;
    this.auth = "Basic " + Buffer.from(`${site.username}:${decrypt(site.appPassword)}`).toString("base64");
  }

  endpoint(route) {
    // restRoot puede ser .../wp-json o ...?rest_route=
    if (this.restRoot.endsWith("rest_route=")) {
      const [p, q] = route.split("?");
      return `${this.restRoot}${p}${q ? `&${q}` : ""}`;
    }
    return `${this.restRoot}${route}`;
  }

  async request(method, route, { body, timeout = 60000, query } = {}) {
    let r = route;
    if (query) r += (r.includes("?") ? "&" : "?") + new URLSearchParams(query).toString();
    let res;
    try {
      res = await fetch(this.endpoint(r), {
        method,
        headers: {
          Authorization: this.auth,
          "User-Agent": UA,
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeout),
      });
    } catch (err) {
      throw new WpError(`Sin respuesta del sitio (${err.name === "TimeoutError" ? "tiempo agotado" : err.cause?.code || err.message}).`, { code: "network" });
    }
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!res.ok) {
      const critical = /critical error|error crítico|Fatal error/i.test(text);
      const plain = String(data?.message || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      throw new WpError(critical ? "El sitio devolvió un error crítico de PHP." : plain || `HTTP ${res.status}`, {
        status: res.status,
        code: data?.code || (critical ? "php_fatal" : "http_error"),
        body: data || text.slice(0, 2000),
      });
    }
    if (data === null) throw new WpError("Respuesta no válida del sitio (no es JSON).", { status: res.status, code: "bad_json", body: text.slice(0, 2000) });
    return data;
  }

  get = (route, opts) => this.request("GET", route, opts);
  post = (route, body, opts = {}) => this.request("POST", route, { ...opts, body: body || {} });
  del = (route, opts) => this.request("DELETE", route, opts);

  me() {
    return this.get("/wp/v2/users/me", { query: { context: "edit" } });
  }
  status() {
    return this.get("/centinela/v1/status");
  }
  handshake(rotate = false) {
    return this.post("/centinela/v1/handshake", { rotate });
  }
  inventory(refresh = true) {
    return this.get("/centinela/v1/inventory", { query: { refresh: refresh ? 1 : 0 }, timeout: 120000 });
  }
  listBackups() {
    return this.get("/centinela/v1/backups");
  }
  createBackup(opts) {
    return this.post("/centinela/v1/backups", opts);
  }
  stepBackup(id) {
    return this.post(`/centinela/v1/backups/${id}/step`, {}, { timeout: 180000 });
  }
  deleteBackup(id) {
    return this.del(`/centinela/v1/backups/${id}`);
  }
  restore(id, phase, offset = 0) {
    return this.post(`/centinela/v1/backups/${id}/restore`, { phase, offset }, { timeout: 600000 });
  }
  update(type, slug, version) {
    return this.post("/centinela/v1/update", { type, slug, version }, { timeout: 900000 });
  }
  dbUpgrade() {
    return this.post("/centinela/v1/maintenance/db-upgrade", {}, { timeout: 300000 });
  }
  debugLog(since = 0) {
    return this.get("/centinela/v1/logs/debug", { query: { since } });
  }

  /** Descarga un archivo de la copia a disco y verifica su SHA-256. */
  async download(backupId, file, dest, expectedSha) {
    const res = await fetch(this.endpoint(`/centinela/v1/backups/${backupId}/download?file=${encodeURIComponent(file)}`), {
      headers: { Authorization: this.auth, "User-Agent": UA },
      signal: AbortSignal.timeout(3600000),
    });
    if (!res.ok || !res.body) throw new WpError(`No se pudo descargar ${file} (HTTP ${res.status}).`, { status: res.status });
    const hash = crypto.createHash("sha256");
    const tmp = `${dest}.part`;
    await pipeline(
      Readable.fromWeb(res.body),
      async function* (source) {
        for await (const chunk of source) {
          hash.update(chunk);
          yield chunk;
        }
      },
      fs.createWriteStream(tmp)
    );
    const sha = hash.digest("hex");
    if (expectedSha && sha !== expectedSha) {
      fs.rmSync(tmp, { force: true });
      throw new WpError(`La descarga de ${file} está corrupta (SHA-256 no coincide).`);
    }
    fs.renameSync(tmp, dest);
    return sha;
  }

  // ---------- Rescate (funciona aunque WordPress no arranque) ----------
  async rescue(action, params = {}) {
    if (!this.site.rescueUrl || !this.site.rescueKey) throw new WpError("El sitio no tiene acceso de rescate configurado.");
    const body = JSON.stringify({ action, params, ts: Math.floor(Date.now() / 1000), nonce: crypto.randomBytes(12).toString("hex") });
    const signature = crypto.createHmac("sha256", decrypt(this.site.rescueKey)).update(body).digest("hex");
    let res;
    try {
      res = await fetch(this.site.rescueUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Centinela-Signature": signature, "User-Agent": UA },
        body,
        signal: AbortSignal.timeout(600000),
      });
    } catch (err) {
      throw new WpError(`El acceso de rescate no responde (${err.cause?.code || err.message}).`, { code: "network" });
    }
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) throw new WpError(`Rescate: ${data?.error || `HTTP ${res.status}`}`, { status: res.status, body: data });
    return data;
  }
}
