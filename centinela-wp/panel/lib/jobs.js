// Registro de tareas en curso con registro en vivo (Server-Sent Events).
import { EventEmitter } from "node:events";
import { newId } from "./store.js";

export const bus = new EventEmitter();
bus.setMaxListeners(100);

const jobs = new Map();

export function runningJobFor(siteId) {
  return [...jobs.values()].find((j) => j.siteId === siteId && j.status === "running") || null;
}

export function listJobs() {
  return [...jobs.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 50).map(publicJob);
}

export function getJob(id) {
  const job = jobs.get(id);
  return job ? publicJob(job) : null;
}

function publicJob(j) {
  const { id, siteId, type, title, status, startedAt, finishedAt, progress, log, reportId, error } = j;
  return { id, siteId, type, title, status, startedAt, finishedAt, progress, log: log.slice(-400), reportId, error };
}

/**
 * Ejecuta fn(job) como tarea de fondo. Solo una tarea por sitio a la vez
 * (dos procesos tocando el mismo sitio es justamente lo que rompe cosas).
 */
export function startJob({ siteId, type, title }, fn) {
  const existing = siteId && runningJobFor(siteId);
  if (existing) {
    const err = new Error("Ya hay una tarea en curso para este sitio. Esperá a que termine.");
    err.status = 409;
    err.jobId = existing.id;
    throw err;
  }
  const job = {
    id: newId("job_"),
    siteId,
    type,
    title,
    status: "running",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    progress: { percent: 0, label: "Iniciando…" },
    log: [],
    reportId: null,
    error: null,
  };
  job.info = (msg) => push(job, "info", msg);
  job.ok = (msg) => push(job, "ok", msg);
  job.warn = (msg) => push(job, "warn", msg);
  job.fail = (msg) => push(job, "error", msg);
  job.setProgress = (percent, label) => {
    job.progress = { percent: Math.max(0, Math.min(100, Math.round(percent))), label };
    bus.emit("event", { type: "job", job: publicJob(job) });
  };
  jobs.set(job.id, job);
  bus.emit("event", { type: "job", job: publicJob(job) });

  Promise.resolve()
    .then(() => fn(job))
    .then((reportId) => {
      job.status = "done";
      job.reportId = reportId || null;
    })
    .catch((err) => {
      job.status = "failed";
      job.error = err.message;
      push(job, "error", err.message);
      console.error(err);
    })
    .finally(() => {
      job.finishedAt = new Date().toISOString();
      job.progress = { percent: 100, label: job.status === "done" ? "Terminado" : "Con errores" };
      bus.emit("event", { type: "job", job: publicJob(job) });
      bus.emit("event", { type: "sites" });
    });

  return publicJob(job);
}

function push(job, level, msg) {
  const line = { at: new Date().toISOString(), level, msg };
  job.log.push(line);
  bus.emit("event", { type: "log", jobId: job.id, siteId: job.siteId, line });
}
