// Flujos principales: analizar, actualizar con red de seguridad, copiar y restaurar.
//
// Por cada actualización aprobada:
//   foto de salud → copia (archivos + BD) → descarga verificada al panel → actualizar
//   → verificar (páginas, API, debug.log) → si algo se rompió: restaurar y detener el lote.
import fs from "node:fs";
import path from "node:path";
import { store, save, newId, DATA_DIR, DEFAULT_SITE_SETTINGS } from "./store.js";
import { WpClient } from "./wp.js";
import { gatherEvidence, compareVersions } from "./research.js";
import { advise } from "./advisor.js";
import { snapshot, compare } from "./health.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const BACKUP_DIR = path.join(DATA_DIR, "backups");

export function settingsOf(site) {
  return { ...DEFAULT_SITE_SETTINGS, ...(site.settings || {}) };
}

export function itemKey(item) {
  return `${item.type}:${item.slug}`;
}

/** Arma la lista de actualizaciones pendientes desde el inventario. */
export function pendingItems(inv) {
  const items = [];
  if (inv.core?.update) {
    items.push({ type: "core", slug: "wordpress", name: "WordPress", current: inv.core.version, next: inv.core.update.version, phpVersion: inv.core.update.php_version, package: inv.core.update.package, active: true });
  }
  for (const p of inv.plugins || []) {
    if (!p.update || p.mu) continue;
    items.push({ type: "plugin", slug: p.slug, file: p.file, name: p.name, current: p.version, next: p.update.version, tested: p.update.tested, requiresPhp: p.update.requires_php, requiresWp: p.update.requires, package: p.update.package, active: p.active, source: p.update.source });
  }
  for (const t of inv.themes || []) {
    if (!t.update) continue;
    items.push({ type: "theme", slug: t.slug, name: t.name, current: t.version, next: t.update.version, requiresPhp: t.update.requires_php, requiresWp: t.update.requires, package: t.update.package, active: t.active });
  }
  if (inv.translations > 0) {
    items.push({ type: "translations", slug: "translations", name: `Traducciones (${inv.translations})`, current: "—", next: "—", active: true, package: true });
  }
  return items;
}

function translationAdvice() {
  return {
    decision: "update",
    label: "Actualizar",
    risk: "low",
    confidence: 95,
    summary: "Las traducciones solo cambian textos; se actualizan con copia previa de la carpeta de idiomas.",
    reasons: ["Las traducciones no modifican código ni base de datos."],
    blocks: [],
    stackConflicts: [],
    security: "Sin impacto de seguridad.",
    precautions: [],
    sources: [],
    engine: "reglas",
  };
}

// ---------------------------------------------------------------------------
// 1. Analizar
// ---------------------------------------------------------------------------
export async function checkSite(site, job, { autoApply = true } = {}) {
  const client = new WpClient(site);
  const settings = settingsOf(site);
  job.setProgress(5, "Leyendo el sitio");
  job.info(`Conectando con ${site.url}…`);

  const inventory = await client.inventory(true);
  site.inventory = inventory;
  site.lastCheck = new Date().toISOString();
  site.online = true;
  save();
  job.ok(`Stack: WordPress ${inventory.core.version}, PHP ${inventory.environment.php}, ${inventory.plugins.filter((p) => p.active).length} plugins activos.`);

  const items = pendingItems(inventory);
  if (!items.length) {
    job.ok("Todo está al día. No hay actualizaciones pendientes.");
    site.analysis = {};
    save();
    return store.addReport(makeReport(site, "check", [], "Todo al día")).id;
  }
  job.info(`${items.length} actualización(es) disponibles. Analizando riesgos…`);

  const analysis = {};
  let i = 0;
  for (const item of items) {
    job.setProgress(10 + (80 * i++) / items.length, `Analizando ${item.name}`);
    let advice;
    let evidence = null;
    if (item.type === "translations") {
      advice = translationAdvice();
    } else {
      evidence = await gatherEvidence(item, inventory).catch((err) => {
        job.warn(`No se pudo obtener información pública de ${item.name}: ${err.message}`);
        return { wporg: null, forum: null, vulns: null };
      });
      advice = await advise(item, evidence, inventory, settings, (m) => job.info(m));
      if (knownBad(site, item)) {
        advice = {
          ...advice,
          decision: "hold",
          label: "No actualizar",
          risk: "critical",
          summary: `Esta versión ya rompió este sitio el ${new Date(site.problemVersions[`${itemKey(item)}@${item.next}`]).toLocaleDateString("es")} y se restauró la copia. Se espera a una versión corregida.`,
          reasons: ["Falló en este mismo sitio en un intento anterior.", ...advice.reasons],
        };
      }
    }
    analysis[itemKey(item)] = { item, advice, evidence: compactEvidence(evidence), analyzedAt: new Date().toISOString() };
    const icon = { update: "✔", wait: "⏳", hold: "✖" }[advice.decision];
    (advice.decision === "update" ? job.ok : job.warn)(`${icon} ${item.name} ${item.current} → ${item.next}: ${advice.label}. ${advice.summary}`);
  }
  site.analysis = analysis;
  save();

  const reportItems = Object.values(analysis).map(({ item, advice }) => ({
    key: itemKey(item),
    name: item.name,
    type: item.type,
    from: item.current,
    to: item.next,
    decision: advice.decision,
    risk: advice.risk,
    summary: advice.summary,
    outcome: advice.decision === "update" ? "recommended" : advice.decision === "wait" ? "waiting" : "held",
  }));
  const reportId = store.addReport(makeReport(site, "check", reportItems, `${reportItems.filter((r) => r.decision === "update").length} recomendadas de ${reportItems.length}`)).id;

  if (autoApply && settings.mode === "auto") {
    const keys = reportItems.filter((r) => r.decision === "update").map((r) => r.key);
    if (keys.length) {
      job.info(`Modo automático: aplicando ${keys.length} actualización(es) recomendadas.`);
      return applyUpdates(site, keys, job);
    }
  }
  return reportId;
}

function compactEvidence(e) {
  if (!e) return null;
  return {
    wporg: e.wporg ? { ...e.wporg, changelog: e.wporg.changelog?.slice(0, 1200) } : null,
    forum: e.forum,
    vulns: e.vulns,
    release: e.release,
  };
}

// ---------------------------------------------------------------------------
// 2. Actualizar con red de seguridad
// ---------------------------------------------------------------------------
const ORDER = { translations: 0, plugin: 1, theme: 2, core: 3 };

export async function applyUpdates(site, keys, job, { override = false } = {}) {
  const client = new WpClient(site);
  const settings = settingsOf(site);
  const analysis = site.analysis || {};

  let selected = keys.map((k) => analysis[k]).filter(Boolean);
  if (!override) {
    const blocked = selected.filter((a) => a.advice.decision !== "update");
    for (const b of blocked) job.warn(`Se omite ${b.item.name}: la recomendación es «${b.advice.label}». ${b.advice.summary}`);
    selected = selected.filter((a) => a.advice.decision === "update");
  } else {
    for (const a of selected.filter((x) => x.advice.blocks?.length)) job.warn(`Se omite ${a.item.name}: ${a.advice.blocks[0]}`);
    selected = selected.filter((a) => !a.advice.blocks?.length);
  }
  if (!selected.length) {
    job.warn("No hay actualizaciones para aplicar.");
    return store.addReport(makeReport(site, "apply", [], "Nada para aplicar")).id;
  }

  // Inactivos primero, luego de menor a mayor riesgo; el núcleo al final.
  const riskRank = { low: 0, medium: 1, high: 2, critical: 3 };
  selected.sort((a, b) => ORDER[a.item.type] - ORDER[b.item.type] || Number(a.item.active) - Number(b.item.active) || riskRank[a.advice.risk] - riskRank[b.advice.risk]);
  // El conector se actualiza al final de los plugins para no cortar el proceso a mitad de camino.
  selected.sort((a, b) => (a.item.slug === "centinela-connector") - (b.item.slug === "centinela-connector"));

  job.setProgress(3, "Verificando el sitio antes de tocar nada");
  let baseline = await snapshot(site);
  if (!baseline.ok) {
    job.fail(`El sitio ya tiene problemas ANTES de actualizar: ${baseline.problems.join(" · ")}. No se toca nada.`);
    return store.addReport(makeReport(site, "apply", [], "Cancelado: el sitio ya tenía errores", "failed")).id;
  }
  job.ok("El sitio responde correctamente. Foto de salud tomada.");
  let logOffset = (await client.debugLog(0).catch(() => ({ size: 0 }))).size || 0;

  const results = [];
  let stop = false;
  for (const [index, entry] of selected.entries()) {
    const { item, advice } = entry;
    const base = (index / selected.length) * 100;
    const span = 100 / selected.length;
    const result = { key: itemKey(item), name: item.name, type: item.type, from: item.current, to: item.next, decision: advice.decision, risk: advice.risk, summary: advice.summary, outcome: "skipped", details: [] };
    results.push(result);
    if (stop) {
      result.details.push("No se aplicó porque una actualización anterior falló y se restauró el sitio.");
      continue;
    }

    // a) Copia de seguridad previa
    job.setProgress(base + span * 0.05, `Copia de seguridad antes de ${item.name}`);
    let backup;
    try {
      backup = await runBackup(client, site, job, {
        scope: "components",
        components: [{ type: item.type === "translations" ? "translations" : item.type, slug: item.slug }],
        include_db: true,
        label: `Antes de actualizar ${item.name} ${item.current} → ${item.next}`,
        reason: "pre_update",
      }, (p) => job.setProgress(base + span * (0.05 + 0.35 * p), `Copia de ${item.name}: ${Math.round(p * 100)}%`));
      result.backupId = backup.id;
    } catch (err) {
      result.outcome = "failed";
      result.details.push(`No se pudo hacer la copia: ${err.message}. Por seguridad no se actualizó.`);
      job.fail(`Copia fallida para ${item.name}: ${err.message}. No se actualiza sin copia.`);
      stop = true;
      continue;
    }

    // b) Actualizar
    job.setProgress(base + span * 0.45, `Actualizando ${item.name}`);
    job.info(`Actualizando ${item.name} ${item.current} → ${item.next}…`);
    let updateError = null;
    try {
      const res = await client.update(item.type, item.type === "core" ? "" : item.slug, item.type === "translations" ? "" : item.next);
      if (!res.ok) updateError = res.errors?.join(" ") || "WordPress informó que la actualización no se completó.";
      else result.details.push(`WordPress actualizó ${res.from || item.current} → ${res.to || item.next}.`);
      if (res.reactivated) result.details.push("El plugin se reactivó automáticamente tras actualizar.");
      if (item.type === "core") {
        await sleep(3000);
        const dbu = await client.dbUpgrade().catch((e) => ({ ok: false, error: e.message }));
        result.details.push(dbu.ok ? "Base de datos de WordPress actualizada." : `Actualización de base de datos pendiente: ${dbu.error || ""}`);
      }
    } catch (err) {
      if (err.code === "centinela_version_changed" || err.code === "centinela_no_update") {
        result.outcome = "skipped";
        result.details.push(err.message);
        job.warn(`${item.name}: ${err.message}`);
        continue;
      }
      updateError = err.message;
    }

    // c) Verificar
    job.setProgress(base + span * 0.7, `Verificando el sitio tras ${item.name}`);
    await sleep(2500);
    let verdict = await verify(site, client, baseline, logOffset);
    if (!verdict.ok) {
      job.warn(`Posibles problemas tras ${item.name}; se vuelve a comprobar en 10 s…`);
      await sleep(10000);
      verdict = await verify(site, client, baseline, logOffset);
    }
    if (updateError && verdict.ok) {
      verdict = { ok: false, problems: [`La actualización informó un error: ${updateError}`], warnings: verdict.warnings };
    }

    if (verdict.ok) {
      result.outcome = "updated";
      result.details.push(...verdict.warnings.map((w) => `Aviso: ${w}`));
      job.ok(`✔ ${item.name} actualizado a ${item.next} y el sitio funciona bien.${verdict.warnings.length ? ` Avisos: ${verdict.warnings.join(" · ")}` : ""}`);
      baseline = verdict.after || baseline;
      logOffset = verdict.logSize ?? logOffset;
      continue;
    }

    // d) Algo se rompió: restaurar
    result.details.push(...verdict.problems.map((p) => `Problema detectado: ${p}`));
    job.fail(`✖ ${item.name} rompió algo: ${verdict.problems.slice(0, 4).join(" · ")}${verdict.problems.length > 4 ? ` (y ${verdict.problems.length - 4} más)` : ""}. Restaurando la copia ${backup.id}…`);
    job.setProgress(base + span * 0.8, `Restaurando ${item.name}`);
    const restored = await rollback(site, client, backup.id, job, settings.restoreDb);
    result.details.push(...restored.details);
    for (const d of restored.details) (restored.ok ? job.info : job.fail)(d);
    const after = await snapshot(site);
    const check = compare(baseline, after);
    if (restored.ok && check.ok) {
      result.outcome = "rolled_back";
      job.ok(`Sitio restaurado al estado anterior (${item.name} ${item.current}). Funciona correctamente.`);
    } else {
      result.outcome = "failed";
      job.fail(`ATENCIÓN: la restauración no dejó el sitio sano (${[...restored.details, ...check.problems].join(" · ")}). Tenés la copia descargada en el panel para restaurarla manualmente.`);
    }
    // Marca la versión como problemática para no reintentarla automáticamente.
    site.problemVersions = { ...(site.problemVersions || {}), [`${itemKey(item)}@${item.next}`]: new Date().toISOString() };
    stop = true;
  }

  job.setProgress(97, "Actualizando inventario");
  try {
    site.inventory = await client.inventory(true);
    site.lastCheck = new Date().toISOString();
  } catch (err) {
    job.warn(`No se pudo refrescar el inventario: ${err.message}`);
  }
  for (const r of results) if (r.outcome === "updated") delete site.analysis?.[r.key];
  save();

  const updated = results.filter((r) => r.outcome === "updated").length;
  const status = results.some((r) => r.outcome === "failed") ? "failed" : results.some((r) => r.outcome === "rolled_back") ? "rolled_back" : "ok";
  return store.addReport(makeReport(site, "apply", results, `${updated} de ${results.length} actualizadas`, status)).id;
}

async function verify(site, client, baseline, logOffset) {
  const after = await snapshot(site);
  const cmp = compare(baseline, after);
  const problems = [...cmp.problems];
  const warnings = [...cmp.warnings];
  try {
    await client.status();
  } catch (err) {
    problems.push(`La API de WordPress dejó de responder: ${err.message}`);
  }
  let logSize;
  try {
    const log = await client.debugLog(logOffset);
    logSize = log.size;
    const fatals = log.lines.filter((l) => /PHP (Fatal|Parse)/i.test(l));
    if (fatals.length) problems.push(`Errores fatales nuevos en debug.log: ${fatals.slice(-2).join(" | ")}`);
    const warns = log.lines.filter((l) => /PHP Warning|WordPress database error/i.test(l));
    if (warns.length) warnings.push(`${warns.length} advertencia(s) nuevas en debug.log`);
  } catch {
    /* debug.log no disponible: no es un error */
  }
  return { ok: problems.length === 0, problems, warnings, after, logSize };
}

// ---------------------------------------------------------------------------
// 3. Copias de seguridad
// ---------------------------------------------------------------------------
export async function runBackup(client, site, job, opts, onProgress) {
  const created = await client.createBackup(opts);
  job.info(`Copia ${created.id} iniciada (${opts.scope === "full" ? "sitio completo" : "componente + base de datos"}).`);
  let progress;
  let failures = 0;
  for (let i = 0; i < 2000; i++) {
    try {
      progress = await client.stepBackup(created.id);
      failures = 0;
    } catch (err) {
      if (++failures >= 3) throw err;
      await sleep(3000);
      continue;
    }
    onProgress?.(progress.percent / 100);
    if (progress.status === "complete") break;
    if (progress.status === "failed") throw new Error(progress.manifest?.errors?.join(" ") || "La copia falló en el servidor.");
  }
  if (progress?.status !== "complete") throw new Error("La copia no terminó a tiempo.");

  const manifest = progress.manifest;
  const sizeMb = (manifest.artifacts.reduce((s, a) => s + a.size, 0) / 1048576).toFixed(1);
  job.ok(`Copia ${manifest.id} lista en el servidor (${sizeMb} MB, ${manifest.stats.tables} tablas, ${manifest.stats.files} archivos).`);

  // Copia externa: se descarga al panel y se verifica con SHA-256.
  const dir = path.join(BACKUP_DIR, site.id, manifest.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  for (const art of manifest.artifacts) {
    await client.download(manifest.id, art.name, path.join(dir, art.name), art.sha256);
  }
  job.ok(`Copia descargada y verificada en el panel (data/backups/${site.id}/${manifest.id}).`);
  site.backups = [{ ...manifest, local: true }, ...(site.backups || []).filter((b) => b.id !== manifest.id)].slice(0, 50);
  save();
  return manifest;
}

export async function rollback(site, client, backupId, job, restoreDb = true) {
  const details = [];
  let viaRescue = false;

  // Archivos: primero por la API; si WordPress no arranca, por el acceso de rescate.
  try {
    const res = await client.restore(backupId, "files");
    if (!res.ok) throw new Error(res.errors?.join(" ") || "error");
    details.push(`Archivos restaurados por la API (${res.restored.join(", ")}).`);
  } catch (err) {
    job.warn(`La API no pudo restaurar (${err.message}). Usando el acceso de rescate…`);
    viaRescue = true;
    try {
      const res = await client.rescue("restore", { id: backupId, phase: "files" });
      if (!res.ok) throw new Error(res.errors?.join(" ") || "error");
      details.push(`Archivos restaurados por el acceso de rescate (${res.restored.join(", ")}).`);
    } catch (err2) {
      details.push(`No se pudieron restaurar los archivos: ${err2.message}`);
      return { ok: false, details };
    }
  }

  if (restoreDb) {
    let offset = 0;
    for (let i = 0; i < 5000; i++) {
      let res;
      try {
        res = viaRescue ? await client.rescue("restore", { id: backupId, phase: "db", offset }) : await client.restore(backupId, "db", offset);
      } catch (err) {
        if (!viaRescue) {
          viaRescue = true;
          job.warn(`Cambiando al acceso de rescate para la base de datos (${err.message}).`);
          continue;
        }
        details.push(`Error restaurando la base de datos: ${err.message}`);
        return { ok: false, details };
      }
      if (res.error) {
        details.push(`Error restaurando la base de datos: ${res.error}`);
        return { ok: false, details };
      }
      offset = res.offset;
      job.setProgress(job.progress.percent, `Restaurando base de datos ${Math.round((100 * offset) / Math.max(1, res.size))}%`);
      if (res.done) break;
    }
    details.push("Base de datos restaurada al momento de la copia.");
  }
  return { ok: true, details };
}

export async function manualRestore(site, backupId, job, { restoreDb = true } = {}) {
  const client = new WpClient(site);
  job.info(`Restaurando la copia ${backupId}…`);
  job.setProgress(10, "Restaurando archivos");
  const res = await rollback(site, client, backupId, job, restoreDb);
  for (const d of res.details) (res.ok ? job.info : job.fail)(d);
  job.setProgress(90, "Verificando");
  const after = await snapshot(site);
  if (after.ok) job.ok("El sitio responde correctamente tras la restauración.");
  else job.fail(`Problemas tras restaurar: ${after.problems.join(" · ")}`);
  try {
    site.inventory = await client.inventory(true);
    save();
  } catch {
    /* sin inventario */
  }
  return store.addReport(makeReport(site, "restore", [{ key: backupId, name: `Copia ${backupId}`, outcome: res.ok && after.ok ? "restored" : "failed", details: res.details }], res.ok && after.ok ? "Restauración correcta" : "Restauración con problemas", res.ok && after.ok ? "ok" : "failed")).id;
}

export async function fullBackup(site, job) {
  const client = new WpClient(site);
  const settings = settingsOf(site);
  const manifest = await runBackup(client, site, job, { scope: "full", include_uploads: settings.includeUploads, include_db: true, label: "Copia completa manual", reason: "manual" }, (p) => job.setProgress(5 + p * 85, `Copia completa: ${Math.round(p * 100)}%`));
  return store.addReport(makeReport(site, "backup", [{ key: manifest.id, name: `Copia completa ${manifest.id}`, outcome: "backed_up", backupId: manifest.id, details: [`${manifest.stats.tables} tablas, ${manifest.stats.files} archivos`] }], "Copia completa creada")).id;
}

function makeReport(site, type, items, summary, status = "ok") {
  return { id: newId("rep_"), siteId: site.id, siteName: site.name, type, status, summary, items, createdAt: new Date().toISOString() };
}

/** Indica si una versión ya falló antes en este sitio. */
export function knownBad(site, item) {
  return Boolean(site.problemVersions?.[`${itemKey(item)}@${item.next}`]);
}

export { compareVersions };
