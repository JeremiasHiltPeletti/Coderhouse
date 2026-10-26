// Verificación de salud del sitio desde afuera (como lo ve un visitante).
// Se toma una "foto" antes de actualizar y se compara después.

const MARKERS = [
  { re: /There has been a critical error|Ha habido un error crítico|Il y a eu une erreur critique/i, msg: "Pantalla de error crítico de WordPress" },
  { re: /<b>Fatal error<\/b>|PHP Fatal error|Fatal error: Uncaught/i, msg: "Error fatal de PHP visible" },
  { re: /<b>Parse error<\/b>|PHP Parse error/i, msg: "Error de sintaxis PHP" },
  { re: /Error establishing a database connection|Error al establecer una conexión con la base de datos/i, msg: "Error de conexión a la base de datos" },
  { re: /Briefly unavailable for scheduled maintenance|No disponible temporalmente por mantenimiento/i, msg: "El sitio quedó en modo mantenimiento" },
];
const SOFT_MARKERS = [{ re: /<b>(Warning|Deprecated|Notice)<\/b>:/i, msg: "Avisos de PHP visibles en la página" }];

export function healthPaths(site) {
  const extra = (site.settings?.healthUrls || []).filter(Boolean);
  return ["/", "/wp-login.php", "/wp-json/", ...extra];
}

async function fetchPage(url) {
  const started = Date.now();
  const target = new URL(url);
  target.searchParams.set("centinela_nocache", String(Date.now()));
  try {
    const res = await fetch(target, {
      headers: { "User-Agent": "Mozilla/5.0 (CentinelaWP health check)", "Cache-Control": "no-cache" },
      redirect: "follow",
      signal: AbortSignal.timeout(30000),
    });
    const body = await res.text();
    const title = (body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").trim().slice(0, 200);
    const hard = MARKERS.filter((m) => m.re.test(body)).map((m) => m.msg);
    const soft = SOFT_MARKERS.filter((m) => m.re.test(body)).map((m) => m.msg);
    return {
      url,
      status: res.status,
      ms: Date.now() - started,
      bytes: body.length,
      title,
      closesHtml: /<\/html>\s*$/i.test(body.trim()) || !/<html/i.test(body),
      hard,
      soft,
    };
  } catch (err) {
    return { url, status: 0, ms: Date.now() - started, bytes: 0, title: "", closesHtml: false, hard: [`Sin respuesta (${err.name === "TimeoutError" ? "tiempo agotado" : err.cause?.code || err.message})`], soft: [] };
  }
}

/** Toma una foto de salud de todas las rutas. */
export async function snapshot(site) {
  const base = site.url.replace(/\/+$/, "");
  const pages = await Promise.all(healthPaths(site).map((p) => fetchPage(base + (p.startsWith("/") ? p : `/${p}`))));
  const problems = [];
  for (const p of pages) {
    if (p.status >= 500 || p.status === 0) problems.push(`${p.url}: HTTP ${p.status || "sin respuesta"}`);
    for (const h of p.hard) problems.push(`${p.url}: ${h}`);
  }
  return { at: new Date().toISOString(), pages, ok: problems.length === 0, problems };
}

/** Compara la foto posterior con la previa. Devuelve problemas graves y advertencias. */
export function compare(before, after) {
  const problems = [];
  const warnings = [];
  for (const now of after.pages) {
    const prev = before?.pages.find((p) => p.url === now.url);
    for (const h of now.hard) problems.push(`${now.url}: ${h}`);
    if (now.status === 0) continue;
    if (prev) {
      const wasOk = prev.status > 0 && prev.status < 400;
      if (wasOk && now.status >= 400) problems.push(`${now.url}: antes respondía ${prev.status}, ahora ${now.status}`);
      if (prev.bytes > 2000 && now.bytes < prev.bytes * 0.4) problems.push(`${now.url}: la página quedó casi vacía (${prev.bytes} → ${now.bytes} bytes)`);
      else if (prev.bytes > 2000 && Math.abs(now.bytes - prev.bytes) > prev.bytes * 0.35) warnings.push(`${now.url}: el tamaño cambió bastante (${prev.bytes} → ${now.bytes} bytes)`);
      if (prev.title && now.title && prev.title !== now.title) warnings.push(`${now.url}: el título cambió («${prev.title}» → «${now.title}»)`);
      if (prev.closesHtml && !now.closesHtml) problems.push(`${now.url}: el HTML se corta antes de terminar (posible error a mitad de página)`);
      if (prev.ms > 0 && now.ms > Math.max(4000, prev.ms * 3)) warnings.push(`${now.url}: mucho más lenta (${prev.ms} ms → ${now.ms} ms)`);
      if (!prev.soft.length && now.soft.length) warnings.push(`${now.url}: ${now.soft.join(", ")}`);
    } else if (now.status >= 500) {
      problems.push(`${now.url}: HTTP ${now.status}`);
    }
  }
  return { ok: problems.length === 0, problems, warnings };
}
