// Recolección de evidencia sobre cada actualización pendiente:
//  - Ficha oficial en WordPress.org (valoración, compatibilidad, changelog, fecha de publicación)
//  - Foros de soporte y reseñas recientes (¿alguien reporta que se rompió algo?)
//  - Bases de vulnerabilidades (WPScan, Wordfence Intelligence) si hay credenciales
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./store.js";

const UA = "CentinelaWP/1.0 (+https://wordpress.org)";
const cache = new Map();

async function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.value;
  const value = await fn();
  cache.set(key, { value, until: Date.now() + ttlMs });
  return value;
}

async function getJson(url, headers = {}) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json", ...headers }, signal: AbortSignal.timeout(25000) });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

async function getText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(25000) });
  if (!res.ok) return null;
  return res.text();
}

// ---------- Utilidades de versión ----------
export function parseVersion(v) {
  return String(v || "")
    .split(/[.\-+]/)
    .map((p) => (/^\d+$/.test(p) ? Number(p) : p));
}

export function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (typeof x === "number" && typeof y === "number") {
      if (x !== y) return x < y ? -1 : 1;
    } else if (String(x) !== String(y)) {
      // "beta"/"rc" < número
      if (typeof x === "number") return 1;
      if (typeof y === "number") return -1;
      return String(x) < String(y) ? -1 : 1;
    }
  }
  return 0;
}

export function jumpType(from, to, type = "") {
  const a = parseVersion(from);
  const b = parseVersion(to);
  // En WordPress, 6.7 → 6.8 ya es una versión "mayor"; solo el tercer número es de mantenimiento.
  if (type === "core") return (a[0] ?? 0) !== (b[0] ?? 0) || (a[1] ?? 0) !== (b[1] ?? 0) ? "major" : "patch";
  if ((a[0] ?? 0) !== (b[0] ?? 0)) return "major";
  if ((a[1] ?? 0) !== (b[1] ?? 0)) return "minor";
  return "patch";
}

// ---------- Texto / RSS ----------
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#8217": "’", "#8220": "“", "#8221": "”", "#187": "»", "#8211": "–", "#8230": "…", "#039": "'" };

export function cleanText(html) {
  return String(html || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#?\w+);/g, (m, e) => ENTITIES[e] ?? (e.startsWith("#") ? String.fromCodePoint(Number(e.slice(1).replace(/^x/, "0x"))) : m))
    .replace(/\s+/g, " ")
    .trim();
}

export function parseRss(xml) {
  if (!xml) return [];
  const items = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const raw = m[1];
    const tag = (name) => raw.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`))?.[1] || "";
    items.push({
      title: cleanText(tag("title")),
      link: cleanText(tag("link")),
      date: new Date(cleanText(tag("pubDate"))).toISOString(),
      text: cleanText(tag("content:encoded") || tag("description")).slice(0, 1200),
    });
  }
  return items;
}

function parseWporgDate(s) {
  // Plugins: "2026-10-09 3:35pm GMT" · Temas: "2026-10-09" o "2026-10-09 15:35:00"
  const str = String(s || "");
  const m = str.match(/(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})(am|pm)/i);
  if (!m) {
    const d = str.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}(?::\d{2})?))?/);
    return d ? new Date(`${d[1]}T${d[2] || "12:00"}${d[2]?.length === 5 ? ":00" : ""}Z`).toISOString() : null;
  }
  let h = Number(m[2]) % 12;
  if (m[4].toLowerCase() === "pm") h += 12;
  return new Date(`${m[1]}T${String(h).padStart(2, "0")}:${m[3]}:00Z`).toISOString();
}

// ---------- WordPress.org ----------
async function wporgInfo(type, slug) {
  return cached(`wporg:${type}:${slug}`, 3600e3, async () => {
    const base = type === "theme" ? "https://api.wordpress.org/themes/info/1.2/" : "https://api.wordpress.org/plugins/info/1.2/";
    const params = new URLSearchParams({
      action: type === "theme" ? "theme_information" : "plugin_information",
      "request[slug]": slug,
      "request[fields][sections]": "1",
      "request[fields][versions]": "0",
      "request[fields][reviews]": "0",
    });
    const data = await getJson(`${base}?${params}`).catch(() => null);
    if (!data || data.error) return null;
    return data;
  });
}

function changelogFor(info, version) {
  const html = info?.sections?.changelog;
  if (!html) return "";
  const text = cleanText(html.replace(/<\/(h\d|li|p)>/g, "\n$&"));
  const idx = version ? text.indexOf(version) : -1;
  return (idx >= 0 ? text.slice(idx, idx + 1500) : text.slice(0, 1500)).trim();
}

// ---------- Foros y reseñas ----------
const BREAK_WORDS = [
  "fatal", "critical error", "error crítico", "white screen", "pantalla blanca", "500", "broke", "broken", "breaks",
  "rompió", "roto", "crash", "after update", "after updating", "tras actualizar", "después de actualizar", "luego de actualizar",
  "conflict", "conflicto", "incompatible", "rollback", "roll back", "downgrade", "revert", "not working", "no funciona",
  "stopped working", "dejó de funcionar", "deprecated", "uncaught", "checkout", "cannot", "can't log", "no puedo entrar",
];

function classifyThread(item, ctx) {
  const hay = `${item.title} ${item.text}`.toLowerCase();
  const breaks = BREAK_WORDS.filter((w) => hay.includes(w));
  const stack = ctx.stackTerms.filter((t) => t.length > 3 && hay.includes(t.toLowerCase()));
  const mentionsVersion = ctx.next && hay.includes(String(ctx.next).toLowerCase());
  return { ...item, breaks, stack, mentionsVersion };
}

async function forumSignals(type, slug, sinceIso, ctx) {
  const kind = type === "theme" ? "theme" : "plugin";
  const [support, reviews] = await Promise.all([
    cached(`forum:${kind}:${slug}`, 1800e3, () => getText(`https://wordpress.org/support/${kind}/${slug}/feed/`).then(parseRss).catch(() => [])),
    cached(`reviews:${kind}:${slug}`, 1800e3, () => getText(`https://wordpress.org/support/${kind}/${slug}/reviews/feed/`).then(parseRss).catch(() => [])),
  ]);
  const since = sinceIso ? new Date(sinceIso).getTime() : Date.now() - 30 * 864e5;
  const recent = support.filter((t) => new Date(t.date).getTime() >= since - 864e5).map((t) => classifyThread(t, ctx));
  const problemThreads = recent.filter((t) => t.breaks.length > 0);
  const stackThreads = problemThreads.filter((t) => t.stack.length > 0);
  const badReviews = reviews
    .filter((r) => new Date(r.date).getTime() >= since - 864e5)
    .map((r) => ({ ...r, stars: Number(r.title.match(/\((\d) stars?\)/)?.[1] || 0) }))
    .filter((r) => r.stars > 0 && r.stars <= 2);
  return {
    threadsSinceRelease: recent.length,
    problemThreads: problemThreads.slice(0, 12).map(({ title, link, date, text, breaks, stack, mentionsVersion }) => ({ title, link, date, excerpt: text.slice(0, 400), breaks, stack, mentionsVersion })),
    stackThreads: stackThreads.length,
    badReviews: badReviews.slice(0, 8).map(({ title, link, date, text, stars }) => ({ title, link, date, stars, excerpt: text.slice(0, 300) })),
  };
}

// ---------- Vulnerabilidades ----------
async function wpscan(type, slug) {
  const token = process.env.WPSCAN_API_TOKEN;
  if (!token) return null;
  const kind = type === "core" ? "wordpresses" : type === "theme" ? "themes" : "plugins";
  const id = type === "core" ? slug.replace(/\D/g, "") : slug;
  return cached(`wpscan:${kind}:${id}`, 6 * 3600e3, async () => {
    const data = await getJson(`https://wpscan.com/api/v3/${kind}/${encodeURIComponent(id)}`, { Authorization: `Token token=${token}` }).catch(() => null);
    const entry = data ? Object.values(data)[0] : null;
    return (entry?.vulnerabilities || []).map((v) => ({
      source: "WPScan",
      title: v.title,
      fixedIn: v.fixed_in || null,
      introducedIn: v.introduced_in || null,
      cvss: v.cvss?.score ?? null,
      references: (v.references?.url || []).slice(0, 3),
    }));
  });
}

let wordfenceFeed = null;
async function wordfence() {
  const key = process.env.WORDFENCE_API_KEY;
  if (!key) return null;
  if (wordfenceFeed && wordfenceFeed.until > Date.now()) return wordfenceFeed.data;
  const file = path.join(DATA_DIR, "wordfence-feed.json");
  if (fs.existsSync(file) && Date.now() - fs.statSync(file).mtimeMs < 12 * 3600e3) {
    wordfenceFeed = { data: JSON.parse(fs.readFileSync(file, "utf8")), until: Date.now() + 3600e3 };
    return wordfenceFeed.data;
  }
  const data = await getJson("https://www.wordfence.com/api/intelligence/v3/vulnerabilities/production", { Authorization: `Bearer ${key}` }).catch(() => null);
  if (!data) return null;
  fs.writeFileSync(file, JSON.stringify(data));
  wordfenceFeed = { data, until: Date.now() + 3600e3 };
  return data;
}

function inRange(version, r) {
  const lo = r.from_version === "*" ? -1 : compareVersions(version, r.from_version);
  const hi = r.to_version === "*" ? -1 : compareVersions(version, r.to_version);
  const okLo = r.from_version === "*" || lo > 0 || (lo === 0 && r.from_inclusive);
  const okHi = r.to_version === "*" || hi < 0 || (hi === 0 && r.to_inclusive);
  return okLo && okHi;
}

async function wordfenceFor(type, slug, current, next) {
  const feed = await wordfence();
  if (!feed) return null;
  const out = [];
  for (const v of Object.values(feed)) {
    for (const sw of v.software || []) {
      if (sw.slug !== slug || (type !== "core" && sw.type !== type)) continue;
      const ranges = Object.values(sw.affected_versions || {});
      out.push({
        source: "Wordfence",
        title: v.title,
        cvss: v.cvss?.score ?? null,
        affectsCurrent: ranges.some((r) => inRange(current, r)),
        affectsNext: ranges.some((r) => inRange(next, r)),
        fixedIn: (sw.patched_versions || [])[0] || null,
        references: (v.references || []).slice(0, 3),
      });
    }
  }
  return out;
}

function vulnStatus(list, current, next) {
  if (!list) return null;
  const items = list.map((v) => {
    const affects = (version) => (!v.fixedIn || compareVersions(version, v.fixedIn) < 0) && (!v.introducedIn || compareVersions(version, v.introducedIn) >= 0);
    const affectsCurrent = v.affectsCurrent ?? affects(current);
    const affectsNext = v.affectsNext ?? affects(next);
    return { ...v, affectsCurrent, affectsNext };
  });
  return {
    current: items.filter((v) => v.affectsCurrent),
    next: items.filter((v) => v.affectsNext),
  };
}

// ---------- Núcleo ----------
async function coreRelease(version) {
  const items = await cached("wp-news", 3600e3, () => getText("https://wordpress.org/news/category/releases/feed/").then(parseRss).catch(() => []));
  const post = items.find((i) => i.title.includes(version));
  return post ? { title: post.title, link: post.link, date: post.date, excerpt: post.text.slice(0, 800), security: /security|seguridad/i.test(post.title + post.text) } : null;
}

/**
 * Evidencia de una actualización.
 * @param {object} item   {type, slug, name, current, next, active, tested, requiresPhp, requiresWp}
 * @param {object} stack  Inventario del sitio.
 */
export async function gatherEvidence(item, stack) {
  const stackTerms = [
    ...stack.plugins.filter((p) => p.active && p.slug !== item.slug).map((p) => p.name),
    ...stack.themes.filter((t) => t.active).map((t) => t.name),
    `php ${stack.environment.php.split(".").slice(0, 2).join(".")}`,
    `wordpress ${stack.core.version.split(".").slice(0, 2).join(".")}`,
  ];
  const evidence = { fetchedAt: new Date().toISOString(), wporg: null, forum: null, vulns: null, release: null };

  if (item.type === "core") {
    evidence.release = await coreRelease(item.next);
    const vulns = await wpscan("core", item.current).catch(() => null);
    evidence.vulns = vulns ? { current: vulns, next: [] } : null;
    return evidence;
  }

  const info = await wporgInfo(item.type, item.slug);
  let releasedAt = null;
  if (info) {
    const latest = info.version;
    releasedAt = compareVersions(latest, item.next) === 0 ? parseWporgDate(info.last_updated) : null;
    evidence.wporg = {
      found: true,
      latest,
      releasedAt,
      ageDays: releasedAt ? Math.floor((Date.now() - new Date(releasedAt).getTime()) / 864e5) : null,
      rating: info.rating ?? null,
      numRatings: info.num_ratings ?? null,
      activeInstalls: info.active_installs ?? null,
      supportThreads: info.support_threads ?? null,
      supportResolved: info.support_threads_resolved ?? null,
      tested: info.tested ?? null,
      requires: info.requires ?? null,
      requiresPhp: info.requires_php ?? null,
      changelog: changelogFor(info, item.next),
      homepage: info.homepage || null,
    };
    evidence.forum = await forumSignals(item.type, item.slug, releasedAt, { stackTerms, next: item.next });
  } else {
    evidence.wporg = { found: false };
  }

  const [scan, wf] = await Promise.all([wpscan(item.type, item.slug).catch(() => null), wordfenceFor(item.type, item.slug, item.current, item.next).catch(() => null)]);
  if (scan || wf) {
    const merged = vulnStatus([...(scan || []), ...(wf || [])], item.current, item.next);
    evidence.vulns = merged;
  }
  return evidence;
}

export function sourcesConfigured() {
  return {
    wporg: true,
    wpscan: Boolean(process.env.WPSCAN_API_TOKEN),
    wordfence: Boolean(process.env.WORDFENCE_API_KEY),
    claude: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
  };
}
