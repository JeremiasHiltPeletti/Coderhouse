// Centinela WP — interfaz del panel (sin dependencias).
// Todo dato que viene de los sitios o de internet se escapa con esc() antes de mostrarse.

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const icon = (name, cls = "") => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const safeUrl = (u) => (/^https?:\/\//i.test(String(u || "")) ? esc(u) : "#");

const state = { overview: null, site: null, tab: "updates", selected: new Set(), override: false, dockJob: null, jobs: new Map(), backups: null };

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { "X-Centinela": "1", ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !url.startsWith("/api/login") && !url.startsWith("/api/session")) {
    location.hash = "#/login";
  }
  if (!res.ok) {
    const err = new Error(data.error || `Error ${res.status}`);
    err.code = data.code;
    err.status = res.status;
    err.jobId = data.jobId;
    throw err;
  }
  return data;
}

// ---------------------------------------------------------------------------
// Formato
// ---------------------------------------------------------------------------
const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
function ago(iso) {
  if (!iso) return "nunca";
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}
const dateFmt = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" });
const fmtDate = (iso) => (iso ? dateFmt.format(new Date(iso)) : "—");
const numFmt = new Intl.NumberFormat("es");
function bytes(n) {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
}

const DECISION = {
  update: { cls: "badge-ok", icon: "check", label: "Actualizar" },
  wait: { cls: "badge-warn", icon: "clock", label: "Esperar" },
  hold: { cls: "badge-danger", icon: "x", label: "No actualizar" },
};
const RISK = {
  low: { cls: "badge-ok", label: "Riesgo bajo" },
  medium: { cls: "badge-warn", label: "Riesgo medio" },
  high: { cls: "badge-danger", label: "Riesgo alto" },
  critical: { cls: "badge-danger", label: "Bloqueado" },
};
const OUTCOME = {
  updated: { cls: "badge-ok", icon: "check", label: "Actualizado" },
  rolled_back: { cls: "badge-warn", icon: "undo", label: "Falló y se restauró" },
  failed: { cls: "badge-danger", icon: "alert", label: "Falló" },
  skipped: { cls: "", icon: "chevron", label: "Omitido" },
  recommended: { cls: "badge-info", icon: "check", label: "Recomendado" },
  waiting: { cls: "badge-warn", icon: "clock", label: "En espera" },
  held: { cls: "badge-danger", icon: "x", label: "Retenido" },
  backed_up: { cls: "badge-ok", icon: "database", label: "Copia creada" },
  restored: { cls: "badge-ok", icon: "undo", label: "Restaurado" },
};
const REPORT_STATUS = {
  ok: { cls: "badge-ok", label: "Correcto" },
  rolled_back: { cls: "badge-warn", label: "Restaurado" },
  failed: { cls: "badge-danger", label: "Con errores" },
};
const TYPE = { plugin: "Plugin", theme: "Tema", core: "WordPress", translations: "Idiomas" };
const badge = (b, text) => `<span class="badge ${b.cls}">${b.icon ? icon(b.icon) : ""}${esc(text ?? b.label)}</span>`;

// ---------------------------------------------------------------------------
// Avisos y modales
// ---------------------------------------------------------------------------
function toast(msg, kind = "ok") {
  const el = document.createElement("div");
  el.className = `toast toast-${kind}`;
  el.setAttribute("role", kind === "error" ? "alert" : "status");
  el.innerHTML = `${icon(kind === "error" ? "alert" : "check")}<div>${esc(msg)}</div>`;
  $("#toasts").append(el);
  setTimeout(() => el.remove(), kind === "error" ? 7000 : 4000);
}

function modal({ title, body, actions = [], onOpen }) {
  const dlg = document.createElement("dialog");
  dlg.className = "modal";
  dlg.setAttribute("aria-labelledby", "modal-title");
  dlg.innerHTML = `
    <div class="modal-head"><h2 id="modal-title">${esc(title)}</h2>
      <button class="btn btn-ghost btn-icon" data-close aria-label="Cerrar">${icon("x")}</button></div>
    <div class="modal-body">${body}</div>
    ${actions.length ? `<div class="modal-foot">${actions.map((a, i) => `<button class="btn ${a.cls || ""}" data-action="${i}">${a.icon ? icon(a.icon) : ""}${esc(a.label)}</button>`).join("")}</div>` : ""}`;
  document.body.append(dlg);
  const close = () => {
    dlg.close();
    dlg.remove();
  };
  dlg.addEventListener("cancel", close);
  dlg.addEventListener("click", async (e) => {
    if (e.target.closest("[data-close]")) return close();
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = actions[Number(btn.dataset.action)];
    if (!action.run) return close();
    btn.setAttribute("aria-busy", "true");
    btn.disabled = true;
    try {
      const keep = await action.run(dlg);
      if (keep !== true) close();
    } catch (err) {
      const box = $(".form-error", dlg);
      if (box) box.textContent = err.message;
      else toast(err.message, "error");
    } finally {
      btn.removeAttribute("aria-busy");
      btn.disabled = false;
    }
  });
  dlg.showModal();
  onOpen?.(dlg, close);
  return { dlg, close };
}

// ---------------------------------------------------------------------------
// Tareas en vivo
// ---------------------------------------------------------------------------
function connectEvents() {
  const es = new EventSource("/api/events");
  let refreshTimer = null;
  es.onmessage = (e) => {
    const ev = JSON.parse(e.data);
    if (ev.type === "job") {
      state.jobs.set(ev.job.id, ev.job);
      if (state.dockJob === ev.job.id) renderDock();
      if (ev.job.status !== "running") {
        if (state.dockJob === ev.job.id) toast(ev.job.status === "done" ? `${ev.job.title}: terminado.` : `${ev.job.title}: con errores.`, ev.job.status === "done" ? "ok" : "error");
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => route(true), 400);
      }
    } else if (ev.type === "log") {
      const job = state.jobs.get(ev.jobId);
      if (job) {
        job.log.push(ev.line);
        if (state.dockJob === ev.jobId) appendLog(ev.line);
      }
    }
  };
}

function openDock(job) {
  state.jobs.set(job.id, job);
  state.dockJob = job.id;
  renderDock();
}

function renderDock() {
  const job = state.jobs.get(state.dockJob);
  let dock = $("#jobdock");
  if (!dock) {
    dock = document.createElement("section");
    dock.id = "jobdock";
    dock.className = "jobdock card";
    dock.setAttribute("aria-label", "Tarea en curso");
    document.body.append(dock);
  }
  if (!job) return dock.classList.remove("open");
  dock.classList.add("open");
  const running = job.status === "running";
  dock.innerHTML = `
    <div class="card-head">
      <div style="min-width:0">
        <h3 style="display:flex;gap:8px;align-items:center">${running ? '<span class="spinner" aria-hidden="true"></span>' : icon(job.status === "done" ? "check" : "alert")}${esc(job.title)}</h3>
        <p class="small muted" id="dock-label" aria-live="polite">${esc(job.progress?.label || "")}</p>
      </div>
      <button class="btn btn-ghost btn-icon" id="dock-close" aria-label="Ocultar registro">${icon("x")}</button>
    </div>
    <div style="padding:10px 16px 0"><div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${job.progress?.percent || 0}"><span style="width:${job.progress?.percent || 0}%"></span></div></div>
    <div class="joblog" id="joblog"></div>`;
  for (const line of job.log) appendLog(line);
  $("#dock-close").onclick = () => {
    state.dockJob = null;
    dock.classList.remove("open");
  };
}

function appendLog(line) {
  const box = $("#joblog");
  if (!box) return;
  const div = document.createElement("div");
  div.className = `line line-${line.level}`;
  div.innerHTML = `<time>${esc(new Date(line.at).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", second: "2-digit" }))}</time><span>${esc(line.msg)}</span>`;
  box.append(div);
  box.scrollTop = box.scrollHeight;
}

async function startTask(method, url, body) {
  try {
    const job = await api(method, url, body);
    openDock(job);
    route(true);
  } catch (err) {
    if (err.jobId) {
      const job = await api("GET", `/api/jobs/${err.jobId}`).catch(() => null);
      if (job) openDock(job);
    }
    toast(err.message, "error");
  }
}

// ---------------------------------------------------------------------------
// Estructura
// ---------------------------------------------------------------------------
let eventsStarted = false;
function shell() {
  if (!eventsStarted) {
    eventsStarted = true;
    connectEvents();
  }
  if ($(".app")) return;
  $("#root").innerHTML = `
    <div class="topbar">
      <a class="brand" href="#/"><span class="brand-mark">${icon("shield")}</span>Centinela WP</a>
      <button class="btn btn-ghost btn-icon" id="menu-btn" aria-label="Abrir menú" aria-expanded="false" aria-controls="sidebar">${icon("menu")}</button>
    </div>
    <div class="app">
      <aside class="sidebar" id="sidebar">
        <a class="brand" href="#/"><span class="brand-mark">${icon("shield")}</span>Centinela WP</a>
        <nav class="nav" aria-label="Principal">
          <a href="#/" data-nav="resumen">${icon("dashboard")}Resumen</a>
          <a href="#/sitios" data-nav="sitios">${icon("globe")}Sitios</a>
          <a href="#/actividad" data-nav="actividad">${icon("activity")}Actividad</a>
          <a href="#/fuentes" data-nav="fuentes">${icon("settings")}Fuentes y ajustes</a>
        </nav>
        <div class="sidebar-foot">
          <button class="btn btn-ghost" id="theme-btn" style="justify-content:flex-start">${icon("sun")}Cambiar tema</button>
          <button class="btn btn-ghost" id="logout-btn" style="justify-content:flex-start">${icon("logout")}Cerrar sesión</button>
        </div>
      </aside>
      <main class="main" id="main" tabindex="-1"></main>
    </div>`;
  $("#menu-btn").onclick = () => {
    const open = $("#sidebar").classList.toggle("open");
    $("#menu-btn").setAttribute("aria-expanded", String(open));
  };
  $("#sidebar").addEventListener("click", (e) => e.target.closest("a") && $("#sidebar").classList.remove("open"));
  $("#theme-btn").onclick = () => {
    const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme = dark ? "light" : "dark";
    try {
      localStorage.setItem("cw-theme", document.documentElement.dataset.theme);
    } catch {
      /* sin almacenamiento */
    }
  };
  $("#logout-btn").onclick = async () => {
    await api("POST", "/api/logout").catch(() => null);
    location.hash = "#/login";
  };
}

function setNav(key) {
  for (const a of $$("[data-nav]")) {
    if (a.dataset.nav === key) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
let lastRoute = "";
async function route(soft = false) {
  const hash = location.hash.slice(1) || "/";
  const [pathPart] = hash.split("?");
  const parts = pathPart.split("/").filter(Boolean);
  if (parts[0] === "login") return renderLogin();

  const session = await api("GET", "/api/session").catch(() => ({ authenticated: false }));
  if (!session.authenticated) return renderLogin(session.needsSetup);

  shell();
  const main = $("#main");
  const changed = lastRoute !== hash;
  lastRoute = hash;
  if (changed && !soft) {
    main.innerHTML = `<div class="skeleton" aria-busy="true" aria-label="Cargando"></div>`;
    main.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
  try {
    if (!parts.length) await viewOverview(main);
    else if (parts[0] === "sitios") await viewSites(main);
    else if (parts[0] === "sitio") await viewSite(main, parts[1], parts[2], soft && !changed);
    else if (parts[0] === "actividad") await viewActivity(main);
    else if (parts[0] === "fuentes") await viewSources(main);
    else main.innerHTML = `<div class="empty">${icon("alert")}<h2>Página no encontrada</h2><a class="btn" href="#/">Volver al resumen</a></div>`;
  } catch (err) {
    main.innerHTML = `<div class="callout callout-danger">${icon("alert")}<div><strong>No se pudo cargar.</strong> ${esc(err.message)} <button class="btn btn-sm" id="retry">Reintentar</button></div></div>`;
    $("#retry").onclick = () => route();
  }
  const query = new URLSearchParams(hash.split("?")[1] || "");
  if (query.get("error")) toast(query.get("error") === "expired" ? "La autorización expiró. Volvé a intentarlo." : query.get("error"), "error");
}

// ---------------------------------------------------------------------------
// Acceso
// ---------------------------------------------------------------------------
async function renderLogin(needsSetup) {
  if (needsSetup === undefined) needsSetup = (await api("GET", "/api/session").catch(() => ({}))).needsSetup;
  lastRoute = "";
  $("#root").innerHTML = `
    <div class="auth"><form class="card" id="login-form" novalidate>
      <div class="brand"><span class="brand-mark">${icon("shield")}</span>Centinela WP</div>
      <h1 style="font-size:1.35rem;margin-bottom:6px">${needsSetup ? "Creá la contraseña del panel" : "Entrar al panel"}</h1>
      <p class="muted small" style="margin-bottom:20px">${needsSetup ? "Protege el acceso a todos tus sitios. Usá al menos 10 caracteres." : "Gestioná las actualizaciones de tus sitios WordPress."}</p>
      <div class="field"><label for="pw">Contraseña</label>
        <input id="pw" type="password" autocomplete="${needsSetup ? "new-password" : "current-password"}" required minlength="${needsSetup ? 10 : 1}" />
        <div class="form-error" id="login-error" role="alert"></div></div>
      <button class="btn btn-primary" style="width:100%" type="submit">${needsSetup ? "Crear y entrar" : "Entrar"}</button>
    </form></div>`;
  $("#pw").focus();
  $("#login-form").onsubmit = async (e) => {
    e.preventDefault();
    const btn = $("button[type=submit]", e.target);
    btn.disabled = true;
    try {
      await api("POST", needsSetup ? "/api/setup" : "/api/login", { password: $("#pw").value });
      location.hash = "#/";
      $("#root").innerHTML = "";
      route();
    } catch (err) {
      $("#login-error").textContent = err.message;
      $("#pw").focus();
    } finally {
      btn.disabled = false;
    }
  };
}

// ---------------------------------------------------------------------------
// Resumen
// ---------------------------------------------------------------------------
async function viewOverview(main) {
  setNav("resumen");
  const ov = await api("GET", "/api/overview");
  state.overview = ov;
  for (const j of ov.jobs) state.jobs.set(j.id, j);
  const sum = (k) => ov.sites.reduce((s, x) => s + (x[k] || 0), 0);
  main.innerHTML = `
    <div class="page-head">
      <div><h1>Resumen</h1><p class="sub">Estado de tus sitios y de las actualizaciones.</p></div>
      <div class="actions"><button class="btn btn-primary" id="add-site">${icon("plus")}Agregar sitio</button></div>
    </div>
    ${!ov.sources.claude ? `<div class="callout callout-warn">${icon("sparkles")}<div><strong>Análisis inteligente desactivado.</strong> Sin clave de Claude, las decisiones se basan solo en reglas y datos de WordPress.org. <a href="#/fuentes">Ver cómo activarlo</a>.</div></div>` : ""}
    <div class="kpis">
      ${kpi("globe", "Sitios conectados", ov.sites.length)}
      ${kpi("package", "Actualizaciones pendientes", sum("pending"))}
      ${kpi("check", "Recomendadas", sum("recommended"))}
      ${kpi("bug", "Parches de seguridad", sum("security"), sum("security") ? "var(--danger)" : "")}
    </div>
    <div class="grid-2">
      <section class="card" aria-labelledby="sites-h">
        <div class="card-head"><h2 id="sites-h">Sitios</h2><a class="btn btn-sm" href="#/sitios">Ver todos</a></div>
        ${ov.sites.length ? sitesTable(ov.sites) : emptySites()}
      </section>
      <section class="card" aria-labelledby="act-h">
        <div class="card-head"><h2 id="act-h">Actividad reciente</h2><a class="btn btn-sm" href="#/actividad">Ver todo</a></div>
        ${reportList(ov.reports.slice(0, 8), true)}
      </section>
    </div>`;
  $("#add-site").onclick = addSiteModal;
  $("#empty-add")?.addEventListener("click", addSiteModal);
}

function kpi(ic, label, value, color = "") {
  return `<div class="card kpi"><span class="kpi-label">${icon(ic, "icon-sm")}${esc(label)}</span><span class="kpi-value" ${color ? `style="color:${color}"` : ""}>${numFmt.format(value)}</span></div>`;
}

function emptySites() {
  return `<div class="empty">${icon("globe")}<h3>Todavía no conectaste ningún sitio</h3><p class="muted">Agregá tu primer sitio con su URL; te guiamos paso a paso.</p><button class="btn btn-primary" id="empty-add">${icon("plus")}Agregar sitio</button></div>`;
}

function siteStatus(s) {
  if (s.job) return `<span class="badge badge-info"><span class="spinner" aria-hidden="true" style="width:12px;height:12px"></span>Trabajando</span>`;
  if (!s.online) return badge({ cls: "badge-danger", icon: "alert" }, "Sin conexión");
  if (s.lastReport?.status === "failed") return badge({ cls: "badge-danger", icon: "alert" }, "Revisar");
  if (s.security) return badge({ cls: "badge-danger", icon: "bug" }, `${s.security} de seguridad`);
  if (s.recommended) return badge({ cls: "badge-info", icon: "package" }, `${s.recommended} para actualizar`);
  if (!s.lastCheck) return badge({ cls: "", icon: "clock" }, "Sin analizar");
  if (s.pending) return badge({ cls: "badge-warn", icon: "clock" }, `${s.pending} en espera`);
  return badge({ cls: "badge-ok", icon: "check" }, "Al día");
}

function sitesTable(sites) {
  return `<div class="table-wrap"><table>
    <thead><tr><th scope="col">Sitio</th><th scope="col">Estado</th><th scope="col">WordPress</th><th scope="col">Último análisis</th></tr></thead>
    <tbody>${sites
      .map(
        (s) => `<tr>
      <td><a href="#/sitio/${esc(s.id)}"><strong>${esc(s.name)}</strong></a><div class="small muted">${esc(s.url.replace(/^https?:\/\//, ""))}</div></td>
      <td>${siteStatus(s)}</td>
      <td class="num">${esc(s.wp || "—")}</td>
      <td class="small muted">${esc(ago(s.lastCheck))}</td></tr>`
      )
      .join("")}</tbody></table></div>`;
}

function reportList(reports, compact = false) {
  if (!reports.length) return `<div class="empty">${icon("activity")}<p class="muted">Sin actividad todavía.</p></div>`;
  const label = { check: "Análisis", apply: "Actualización", backup: "Copia", restore: "Restauración" };
  return `<ul style="list-style:none;margin:0;padding:0">${reports
    .map(
      (r) => `<li style="padding:12px 20px;border-bottom:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><strong>${esc(label[r.type] || r.type)}${compact ? ` · ${esc(r.siteName)}` : ""}</strong>${badge(REPORT_STATUS[r.status] || REPORT_STATUS.ok)}</div>
      <div class="small muted">${esc(r.summary)} · ${esc(ago(r.createdAt))}</div>
      ${
        !compact && r.items?.length
          ? `<details class="small" style="margin-top:8px"><summary style="cursor:pointer">Ver detalle (${r.items.length})</summary><ul style="margin:8px 0 0;padding-left:18px">${r.items
              .map((it) => `<li style="margin:6px 0">${badge(OUTCOME[it.outcome] || OUTCOME.skipped)} <strong>${esc(it.name)}</strong> ${it.from && it.from !== "—" ? `<span class="mono">${esc(it.from)} → ${esc(it.to)}</span>` : ""}<div class="muted">${esc(it.summary || "")}</div>${(it.details || []).map((d) => `<div>· ${esc(d)}</div>`).join("")}</li>`)
              .join("")}</ul></details>`
          : ""
      }</li>`
    )
    .join("")}</ul>`;
}

// ---------------------------------------------------------------------------
// Sitios
// ---------------------------------------------------------------------------
async function viewSites(main) {
  setNav("sitios");
  const ov = await api("GET", "/api/overview");
  main.innerHTML = `
    <div class="page-head"><div><h1>Sitios</h1><p class="sub">Cada sitio se conecta con su URL y una contraseña de aplicación de WordPress.</p></div>
      <div class="actions"><a class="btn" href="/download/centinela-connector.zip">${icon("download")}Descargar conector</a><button class="btn btn-primary" id="add-site">${icon("plus")}Agregar sitio</button></div></div>
    ${
      ov.sites.length
        ? `<div class="site-grid">${ov.sites
            .map(
              (s) => `<a class="card site-card" href="#/sitio/${esc(s.id)}">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><div style="min-width:0"><h3>${esc(s.name)}</h3><div class="url">${esc(s.url)}</div></div>${siteStatus(s)}</div>
        <div class="meta-row"><span class="badge">WP <span class="mono">${esc(s.wp || "—")}</span></span><span class="badge">PHP <span class="mono">${esc(s.php || "—")}</span></span><span class="badge">${s.mode === "auto" ? "Automático" : "Manual"}</span></div>
        <div class="small muted">Analizado ${esc(ago(s.lastCheck))} · Última copia ${esc(ago(s.lastBackup))}</div></a>`
            )
            .join("")}</div>`
        : `<div class="card">${emptySites()}</div>`
    }`;
  $("#add-site").onclick = addSiteModal;
  $("#empty-add")?.addEventListener("click", addSiteModal);
}

function addSiteModal() {
  let discovered = null;
  const body = `
    <form id="add-form" novalidate>
      <div id="step1">
        <div class="field"><label for="site-url">URL del sitio</label>
          <input id="site-url" type="url" inputmode="url" autocomplete="url" placeholder="https://misitio.com" required />
          <span class="help">Debe ser un sitio WordPress 5.6 o superior, preferentemente con HTTPS.</span></div>
      </div>
      <div id="step2" hidden></div>
      <div class="form-error" role="alert"></div>
    </form>`;
  const { dlg, close } = modal({
    title: "Agregar sitio",
    body,
    actions: [
      { label: "Cancelar" },
      {
        label: "Continuar",
        cls: "btn-primary",
        run: async (d) => {
          $(".form-error", d).textContent = "";
          if (!discovered) {
            const url = $("#site-url", d).value.trim();
            if (!url) throw new Error("Ingresá la URL del sitio.");
            discovered = await api("POST", "/api/sites/discover", { url });
            renderStep2(d);
            $("[data-action='1']", d).lastChild.textContent = "Conectar sitio";
            return true;
          }
          const site = await api("POST", "/api/sites", { url: discovered.url, username: $("#wp-user", d).value, appPassword: $("#wp-pass", d).value }).catch((err) => {
            if (err.code === "connector_missing") $("#connector-box", d).hidden = false;
            throw err;
          });
          toast(`${site.name} conectado.`);
          location.hash = `#/sitio/${site.id}`;
          return false;
        },
      },
    ],
    onOpen: (d) => $("#site-url", d).focus(),
  });
  $("#add-form", dlg).onsubmit = (e) => {
    e.preventDefault();
    $("[data-action='1']", dlg).click();
  };

  function renderStep2(d) {
    $("#step1", d).hidden = true;
    const s2 = $("#step2", d);
    s2.hidden = false;
    s2.innerHTML = `
      <div class="callout">${icon("globe")}<div><strong>${esc(discovered.name)}</strong><div class="small mono">${esc(discovered.url)}</div></div></div>
      ${discovered.warning ? `<div class="callout callout-warn">${icon("alert")}<div class="small">${esc(discovered.warning)}</div></div>` : ""}
      <div id="connector-box" class="callout ${discovered.hasConnector ? "" : "callout-warn"}" ${discovered.hasConnector ? "hidden" : ""}>${icon("package")}<div class="small">
        <strong>Falta instalar el conector.</strong> Descargalo, subilo en <em>Plugins → Añadir nuevo → Subir plugin</em> y activalo.
        <div style="margin-top:8px"><a class="btn btn-sm" href="/download/centinela-connector.zip">${icon("download")}Descargar centinela-connector.zip</a></div></div></div>
      <ol class="steps">
        <li>${
          discovered.authorizeLink
            ? `Autorizá la conexión en tu WordPress: <a class="btn btn-sm" href="${safeUrl(discovered.authorizeLink)}" target="_blank" rel="noopener">${icon("external")}Autorizar en WordPress</a><div class="help">${discovered.autoReturn ? "Al aprobar, volverás al panel automáticamente." : "Al aprobar, WordPress te mostrará una contraseña: copiala y pegala abajo."}</div>`
            : "Creá una contraseña de aplicación en <em>Usuarios → Perfil → Contraseñas de aplicación</em> (este sitio no anuncia el flujo de autorización)."
        }</li>
        <li>Completá tu usuario administrador y la contraseña generada.</li>
      </ol>
      <div class="field"><label for="wp-user">Usuario de WordPress</label><input id="wp-user" type="text" autocomplete="username" required /></div>
      <div class="field"><label for="wp-pass">Contraseña de aplicación</label><input id="wp-pass" type="password" autocomplete="off" placeholder="xxxx xxxx xxxx xxxx xxxx xxxx" required />
        <span class="help">No es tu contraseña normal. Se guarda cifrada y podés revocarla desde tu perfil cuando quieras.</span></div>`;
    $("#wp-user", d).focus();
  }
  return close;
}

// ---------------------------------------------------------------------------
// Detalle de sitio
// ---------------------------------------------------------------------------
async function viewSite(main, id, tab, soft) {
  setNav("sitios");
  const site = await api("GET", `/api/sites/${encodeURIComponent(id)}`);
  if (state.site?.id !== site.id) {
    state.selected = new Set();
    state.override = false;
    state.backups = null;
  }
  state.site = site;
  state.tab = tab || state.tab || "updates";
  if (site.job && !state.dockJob) {
    const job = await api("GET", `/api/jobs/${site.job}`).catch(() => null);
    if (job) openDock(job);
  }
  const analysis = Object.values(site.analysis || {});
  const inv = site.inventory;
  const busy = Boolean(site.job);
  const scrollY = window.scrollY;

  main.innerHTML = `
    <nav class="small muted" aria-label="Ruta" style="margin-bottom:10px"><a href="#/sitios">Sitios</a> / ${esc(site.name)}</nav>
    <div class="page-head">
      <div style="min-width:0"><h1>${esc(site.name)}</h1>
        <p class="sub"><a href="${safeUrl(site.url)}" target="_blank" rel="noopener">${esc(site.url)} ${icon("external", "icon-sm")}</a></p>
        <div class="meta-row" style="margin-top:10px">
          ${inv ? `<span class="badge">WordPress <span class="mono">${esc(inv.core.version)}</span></span><span class="badge">PHP <span class="mono">${esc(inv.environment.php)}</span></span>` : ""}
          <span class="badge">${site.settings.mode === "auto" ? "Modo automático" : "Modo manual"}</span>
          ${site.rescueOk ? badge({ cls: "badge-ok", icon: "lifebuoy" }, "Rescate activo") : badge({ cls: "badge-warn", icon: "lifebuoy" }, "Rescate no disponible")}
          ${inv && !inv.environment.can_update ? badge({ cls: "badge-danger", icon: "alert" }, "Sin escritura de archivos") : ""}
        </div>
      </div>
      <div class="actions">
        <button class="btn" id="btn-backup" ${busy ? "disabled" : ""}>${icon("database")}Copia completa</button>
        <button class="btn btn-primary" id="btn-check" ${busy ? "disabled" : ""}>${icon("refresh")}Buscar y analizar</button>
      </div>
    </div>
    ${site.online === false ? `<div class="callout callout-danger">${icon("alert")}<div>No se pudo contactar el sitio en el último intento.</div></div>` : ""}
    <div class="tabs" role="tablist" aria-label="Secciones del sitio">
      ${tabBtn("updates", "Actualizaciones", analysis.length)}
      ${tabBtn("backups", "Copias de seguridad")}
      ${tabBtn("stack", "Stack")}
      ${tabBtn("history", "Historial")}
      ${tabBtn("settings", "Ajustes")}
    </div>
    <div id="tabpanel" role="tabpanel" aria-labelledby="tab-${esc(state.tab)}"></div>`;

  $("#btn-check").onclick = () => startTask("POST", `/api/sites/${site.id}/check`);
  $("#btn-backup").onclick = () =>
    modal({
      title: "Copia de seguridad completa",
      body: `<p>Se copia la base de datos completa, WordPress y <code>wp-content</code>${site.settings.includeUploads ? " (incluidas las imágenes subidas)" : " (sin la carpeta de imágenes; podés incluirla en Ajustes)"}. Queda guardada en el servidor y descargada en el panel.</p>`,
      actions: [{ label: "Cancelar" }, { label: "Crear copia", cls: "btn-primary", icon: "database", run: () => startTask("POST", `/api/sites/${site.id}/backup`) }],
    });
  for (const b of $$(".tabs button")) {
    b.onclick = () => {
      location.hash = `#/sitio/${site.id}/${b.dataset.tab}`;
    };
  }
  const panel = $("#tabpanel");
  if (state.tab === "updates") renderUpdates(panel, site, analysis, busy);
  else if (state.tab === "backups") await renderBackups(panel, site, busy);
  else if (state.tab === "stack") renderStack(panel, inv);
  else if (state.tab === "history") await renderHistory(panel, site);
  else if (state.tab === "settings") renderSettings(panel, site);
  if (soft) window.scrollTo(0, scrollY);
}

function tabBtn(key, label, count) {
  return `<button role="tab" id="tab-${key}" data-tab="${key}" aria-selected="${state.tab === key}">${esc(label)}${count != null ? `<span class="count">${count}</span>` : ""}</button>`;
}

function renderUpdates(panel, site, analysis, busy) {
  if (!site.lastCheck) {
    panel.innerHTML = `<div class="card empty">${icon("refresh")}<h3>Todavía no se analizó este sitio</h3><p class="muted" style="max-width:60ch">Centinela lee el stack, busca actualizaciones, revisa foros, reseñas y avisos de seguridad, y te dice qué conviene actualizar y por qué.</p><button class="btn btn-primary" id="first-check" ${busy ? "disabled" : ""}>${icon("refresh")}Analizar ahora</button></div>`;
    $("#first-check").onclick = () => startTask("POST", `/api/sites/${site.id}/check`);
    return;
  }
  if (!analysis.length) {
    panel.innerHTML = `<div class="card empty">${icon("check")}<h3>Todo al día</h3><p class="muted">No hay actualizaciones pendientes. Último análisis ${esc(ago(site.lastCheck))}.</p></div>`;
    return;
  }
  const order = { update: 0, wait: 1, hold: 2 };
  analysis.sort((a, b) => order[a.advice.decision] - order[b.advice.decision] || a.item.name.localeCompare(b.item.name));
  if (state.selectedFor !== site.lastCheck) {
    // Nuevo análisis: se preseleccionan solo las recomendadas.
    state.selectedFor = site.lastCheck;
    state.selected = new Set(analysis.filter((a) => a.advice.decision === "update").map((a) => `${a.item.type}:${a.item.slug}`));
  }

  panel.innerHTML = `
    <p class="muted small" style="margin-bottom:14px">Analizado ${esc(ago(site.lastCheck))}. Antes de cada actualización se hace una copia restaurable; si el sitio falla, se restaura solo.</p>
    <div class="update-list">${analysis.map((a) => updateCard(a, busy)).join("")}</div>
    <div class="card sticky-bar">
      <label class="check small" style="min-height:auto"><input type="checkbox" id="override" ${state.override ? "checked" : ""} ${busy ? "disabled" : ""}/> <span>Permitir elegir también las que no se recomiendan (bajo tu responsabilidad)</span></label>
      <button class="btn btn-primary" id="apply" ${busy ? "disabled" : ""}>${icon("play")}<span>Actualizar seleccionadas (<span id="sel-count">0</span>)</span></button>
    </div>`;

  const sync = () => {
    for (const cb of $$("input[data-key]", panel)) {
      const decision = cb.dataset.decision;
      const blocked = cb.dataset.blocked === "1";
      cb.disabled = busy || blocked || (decision !== "update" && !state.override);
      if (cb.disabled && decision !== "update") state.selected.delete(cb.dataset.key);
      cb.checked = state.selected.has(cb.dataset.key);
    }
    $("#sel-count").textContent = state.selected.size;
    $("#apply").disabled = busy || !state.selected.size;
  };
  panel.addEventListener("change", (e) => {
    if (e.target.id === "override") {
      state.override = e.target.checked;
    } else if (e.target.dataset.key) {
      if (e.target.checked) state.selected.add(e.target.dataset.key);
      else state.selected.delete(e.target.dataset.key);
    }
    sync();
  });
  sync();

  $("#apply").onclick = () => {
    const chosen = analysis.filter((a) => state.selected.has(`${a.item.type}:${a.item.slug}`));
    const risky = chosen.filter((a) => a.advice.decision !== "update");
    modal({
      title: `Actualizar ${chosen.length} componente(s)`,
      body: `
        ${risky.length ? `<div class="callout callout-warn">${icon("alert")}<div><strong>Incluiste ${risky.length} actualización(es) no recomendadas:</strong> ${risky.map((a) => esc(a.item.name)).join(", ")}.</div></div>` : ""}
        <p style="margin-bottom:12px">Para cada una, en este orden:</p>
        <ol class="steps">
          <li>Foto de salud del sitio (páginas, acceso, API y registro de errores).</li>
          <li>Copia de seguridad del componente y de la base de datos, descargada y verificada en el panel.</li>
          <li>Actualización con el instalador oficial de WordPress.</li>
          <li>Verificación. Si algo se rompe, se restaura la copia y se detiene el resto.</li>
        </ol>
        <ul class="small" style="padding-left:18px;margin:0">${chosen.map((a) => `<li><strong>${esc(a.item.name)}</strong> <span class="mono">${esc(a.item.current)} → ${esc(a.item.next)}</span></li>`).join("")}</ul>`,
      actions: [
        { label: "Cancelar" },
        {
          label: "Empezar",
          cls: "btn-primary",
          icon: "play",
          run: () => startTask("POST", `/api/sites/${site.id}/apply`, { keys: [...state.selected], override: state.override }),
        },
      ],
    });
  };
}

function updateCard({ item, advice, evidence }, busy) {
  const key = `${item.type}:${item.slug}`;
  const d = DECISION[advice.decision];
  const r = RISK[advice.risk] || RISK.medium;
  const facts = [];
  const w = evidence?.wporg;
  if (w?.found) {
    if (w.ageDays != null) facts.push(`Publicada hace ${w.ageDays} d`);
    if (w.rating != null) facts.push(`Valoración ${Math.round(w.rating / 20 * 10) / 10}/5 (${numFmt.format(w.numRatings || 0)})`);
    if (w.activeInstalls) facts.push(`${numFmt.format(w.activeInstalls)}+ instalaciones`);
    if (w.supportThreads != null) facts.push(`Soporte: ${w.supportResolved}/${w.supportThreads} resueltos`);
    if (w.tested) facts.push(`Probado hasta WP ${w.tested}`);
  }
  if (evidence?.forum) facts.push(`${evidence.forum.problemThreads.length} reporte(s) de problemas desde el lanzamiento`);
  if (advice.engine === "claude") facts.push(`Investigado con IA · confianza ${advice.confidence}%`);
  const list = (title, arr) => (arr?.length ? `<div><h4>${esc(title)}</h4><ul>${arr.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : "");

  return `<article class="update" data-decision="${esc(advice.decision)}" aria-labelledby="u-${esc(key)}">
    <div class="update-main">
      <input type="checkbox" data-key="${esc(key)}" data-decision="${esc(advice.decision)}" data-blocked="${advice.blocks?.length ? 1 : 0}" aria-label="Seleccionar ${esc(item.name)}" ${busy ? "disabled" : ""}/>
      <div style="min-width:0">
        <div class="update-title"><h3 id="u-${esc(key)}">${esc(item.name)}</h3><span class="badge">${esc(TYPE[item.type] || item.type)}</span>${item.active === false ? '<span class="badge">Inactivo</span>' : ""}<span class="versions">${esc(item.current)} → <strong>${esc(item.next)}</strong></span></div>
        <p class="update-summary">${esc(advice.summary)}</p>
        ${advice.blocks?.length ? `<p class="small" style="color:var(--danger);margin-top:6px">${icon("alert", "icon-sm")} ${esc(advice.blocks.join(" "))}</p>` : ""}
        ${advice.waitUntil ? `<p class="small muted" style="margin-top:6px">Se vuelve a evaluar a partir del ${esc(fmtDate(advice.waitUntil))}.</p>` : ""}
      </div>
      <div class="update-badges">${badge(d)}${badge(r)}${advice.securityFix ? badge({ cls: "badge-danger", icon: "bug" }, "Parche de seguridad") : ""}</div>
    </div>
    <details class="why"><summary>${icon("chevron", "icon-sm chev")}Por qué ${advice.decision === "update" ? "se recomienda" : "no se recomienda ahora"}</summary>
      <div class="why-body">
        ${list("Razones", advice.reasons)}
        ${list("Conflictos reportados con tu stack", advice.stackConflicts)}
        <div><h4>Seguridad</h4><p>${esc(advice.security)}</p></div>
        ${list("Qué revisar después", advice.precautions)}
        ${facts.length ? `<div><h4>Datos</h4><div class="facts">${facts.map((f) => `<span class="badge">${esc(f)}</span>`).join("")}</div></div>` : ""}
        ${advice.sources?.length ? `<div><h4>Fuentes</h4><ul>${advice.sources.map((s) => `<li><a href="${safeUrl(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title || s.url)}</a></li>`).join("")}</ul></div>` : ""}
        ${evidence?.wporg?.changelog ? `<div style="grid-column:1/-1"><h4>Changelog</h4><p class="small muted" style="white-space:pre-line">${esc(evidence.wporg.changelog)}</p></div>` : ""}
      </div>
    </details>
  </article>`;
}

async function renderBackups(panel, site, busy) {
  panel.innerHTML = `<div class="skeleton" aria-busy="true"></div>`;
  const { backups, remoteError } = await api("GET", `/api/sites/${site.id}/backups`);
  const reason = { pre_update: "Antes de actualizar", manual: "Manual" };
  panel.innerHTML = `
    ${remoteError ? `<div class="callout callout-warn">${icon("alert")}<div class="small">No se pudo leer la lista del servidor (${esc(remoteError)}). Se muestran las copias guardadas en el panel.</div></div>` : ""}
    <div class="callout">${icon("database")}<div class="small">Cada copia contiene <code>database.sql</code> y uno o más <code>files-NNN.zip</code>, verificados con SHA-256. Las marcadas «en el panel» siguen disponibles aunque el servidor del sitio se pierda.</div></div>
    ${
      backups.length
        ? `<div class="card table-wrap"><table>
      <thead><tr><th scope="col">Fecha</th><th scope="col">Motivo</th><th scope="col">Contenido</th><th scope="col">Tamaño</th><th scope="col">Dónde</th><th scope="col"><span class="sr-only">Acciones</span></th></tr></thead>
      <tbody>${backups
        .map((b) => {
          const size = (b.artifacts || []).reduce((s, a) => s + a.size, 0);
          const comps = (b.components || []).map((c) => (c.type === "content" ? "wp-content" : c.type === "core" ? `WordPress ${c.version || ""}` : `${c.slug}${c.version ? ` ${c.version}` : ""}`));
          return `<tr>
        <td class="num">${esc(fmtDate(b.created_gmt))}</td>
        <td>${esc(b.label || reason[b.reason] || b.reason)}</td>
        <td class="small">${esc([b.include_db ? "Base de datos" : null, ...comps].filter(Boolean).join(", "))}</td>
        <td class="num">${esc(bytes(size))}</td>
        <td><div class="meta-row">${b.onSite ? '<span class="badge">Servidor</span>' : ""}${b.local ? '<span class="badge badge-ok">En el panel</span>' : ""}</div></td>
        <td><div class="actions" style="justify-content:flex-end">
          ${b.status === "complete" ? `<button class="btn btn-sm" data-dl="${esc(b.id)}">${icon("download", "icon-sm")}Descargar</button>` : badge({ cls: "badge-warn" }, b.status)}
          ${b.status === "complete" && b.onSite ? `<button class="btn btn-sm" data-restore="${esc(b.id)}" ${busy ? "disabled" : ""}>${icon("undo", "icon-sm")}Restaurar</button>` : ""}
          <button class="btn btn-sm btn-danger btn-icon" data-del="${esc(b.id)}" aria-label="Eliminar copia ${esc(b.id)}">${icon("trash", "icon-sm")}</button>
        </div></td></tr>`;
        })
        .join("")}</tbody></table></div>`
        : `<div class="card empty">${icon("database")}<h3>Sin copias todavía</h3><p class="muted">Se crean automáticamente antes de cada actualización, o podés crear una completa ahora.</p></div>`
    }`;

  panel.onclick = (e) => {
    const dl = e.target.closest("[data-dl]");
    const rs = e.target.closest("[data-restore]");
    const del = e.target.closest("[data-del]");
    const b = backups.find((x) => x.id === (dl || rs || del)?.dataset[dl ? "dl" : rs ? "restore" : "del"]);
    if (!b) return;
    if (dl) {
      modal({
        title: "Descargar copia",
        body: `<p class="small muted" style="margin-bottom:12px">Descargá todos los archivos para tener la copia en tu equipo. Para restaurar a mano: importá <code>database.sql</code> con phpMyAdmin y descomprimí los zip (cada carpeta indica dónde va: <code>plugin/</code> → wp-content/plugins, <code>theme/</code> → wp-content/themes, <code>core/</code> → raíz, <code>content/</code> → wp-content).</p>
          <ul style="padding-left:18px">${["manifest.json", ...(b.artifacts || []).map((a) => a.name)].map((n) => `<li><a href="/api/sites/${esc(site.id)}/backups/${esc(b.id)}/files/${esc(n)}">${esc(n)}</a></li>`).join("")}</ul>`,
        actions: [{ label: "Cerrar" }],
      });
    } else if (rs) {
      modal({
        title: "Restaurar copia",
        body: `<div class="callout callout-warn">${icon("alert")}<div>Se reemplazan los archivos incluidos en la copia${site.settings.restoreDb ? " y <strong>la base de datos vuelve al " + esc(fmtDate(b.created_gmt)) + "</strong> (se pierden pedidos, comentarios o cambios posteriores)" : ""}.</div></div>
          <label class="check"><input type="checkbox" id="restore-db" ${b.include_db ? "checked" : "disabled"}/> <span>Restaurar también la base de datos</span></label>
          <div class="form-error" role="alert"></div>`,
        actions: [{ label: "Cancelar" }, { label: "Restaurar", cls: "btn-danger", icon: "undo", run: (d) => startTask("POST", `/api/sites/${site.id}/backups/${b.id}/restore`, { restoreDb: $("#restore-db", d).checked }) }],
      });
    } else if (del) {
      modal({
        title: "Eliminar copia",
        body: `<p>¿Dónde querés eliminar la copia del ${esc(fmtDate(b.created_gmt))}?</p>`,
        actions: [
          { label: "Cancelar" },
          ...(b.local ? [{ label: "Solo del panel", cls: "btn-danger", run: () => delBackup(site, b, "local") }] : []),
          ...(b.onSite ? [{ label: b.local ? "Solo del servidor" : "Del servidor", cls: "btn-danger", run: () => delBackup(site, b, "remote") }] : []),
        ],
      });
    }
  };
}

async function delBackup(site, b, where) {
  await api("DELETE", `/api/sites/${site.id}/backups/${b.id}?where=${where}`);
  toast("Copia eliminada.");
  route(true);
}

function renderStack(panel, inv) {
  if (!inv) {
    panel.innerHTML = `<div class="card empty">${icon("package")}<p class="muted">Analizá el sitio para ver su stack.</p></div>`;
    return;
  }
  const env = inv.environment;
  const row = (k, v) => `<tr><th scope="row" style="width:40%">${esc(k)}</th><td class="mono">${esc(v)}</td></tr>`;
  const yes = (b) => (b ? "Sí" : "No");
  panel.innerHTML = `
    <div class="grid-2" style="margin-bottom:24px">
      <section class="card"><div class="card-head"><h2>Plugins (${inv.plugins.length})</h2></div><div class="table-wrap"><table>
        <thead><tr><th scope="col">Plugin</th><th scope="col">Versión</th><th scope="col">Estado</th></tr></thead>
        <tbody>${inv.plugins
          .map((p) => `<tr><td>${esc(p.name)}${p.mu ? ' <span class="badge">MU</span>' : ""}<div class="small muted mono">${esc(p.slug)}</div></td><td class="num">${esc(p.version)}${p.update ? `<div class="small" style="color:var(--info)">→ ${esc(p.update.version)}</div>` : ""}</td><td>${p.active ? badge({ cls: "badge-ok" }, "Activo") : badge({ cls: "" }, "Inactivo")}</td></tr>`)
          .join("")}</tbody></table></div></section>
      <section class="card"><div class="card-head"><h2>Servidor</h2></div><div class="table-wrap"><table><tbody>
        ${row("WordPress", inv.core.version)}${row("PHP", env.php)}${row("Base de datos", `${inv.db.server || ""} ${inv.db.version}`.trim())}${row("Tamaño BD", inv.db.size_mb != null ? `${inv.db.size_mb} MB` : "—")}
        ${row("Servidor web", env.server_software || "—")}${row("Memoria PHP", env.memory_limit)}${row("Tiempo máx.", `${env.max_execution_time} s`)}
        ${row("Escritura de archivos", env.filesystem_method)}${row("Espacio libre", env.disk_free_mb != null ? `${numFmt.format(env.disk_free_mb)} MB` : "—")}
        ${row("Multisitio", yes(inv.site.multisite))}${row("Caché de objetos", yes(env.object_cache))}${row("debug.log", yes(env.debug_log))}
        ${row("ZipArchive", yes(env.php_extensions.zip))}${row("Conector", inv.connector)}
      </tbody></table></div></section>
    </div>
    <section class="card"><div class="card-head"><h2>Temas</h2></div><div class="table-wrap"><table>
      <thead><tr><th scope="col">Tema</th><th scope="col">Versión</th><th scope="col">Estado</th></tr></thead>
      <tbody>${inv.themes.map((t) => `<tr><td>${esc(t.name)}${t.parent ? `<div class="small muted">Hijo de ${esc(t.parent)}</div>` : ""}</td><td class="num">${esc(t.version)}${t.update ? `<div class="small" style="color:var(--info)">→ ${esc(t.update.version)}</div>` : ""}</td><td>${t.active ? badge({ cls: "badge-ok" }, "Activo") : badge({ cls: "" }, "Inactivo")}</td></tr>`).join("")}</tbody></table></div></section>`;
}

async function renderHistory(panel, site) {
  const reports = await api("GET", `/api/reports?site=${encodeURIComponent(site.id)}`);
  panel.innerHTML = `<section class="card">${reportList(reports)}</section>`;
}

function renderSettings(panel, site) {
  const s = site.settings;
  panel.innerHTML = `
    <form class="card card-pad" id="settings-form" style="max-width:760px">
      <fieldset style="border:0;padding:0;margin:0 0 18px"><legend class="label" style="margin-bottom:8px">Modo de trabajo</legend>
        <div class="segmented">
          <label><input type="radio" name="mode" value="manual" ${s.mode === "manual" ? "checked" : ""}/><span>Manual</span></label>
          <label><input type="radio" name="mode" value="auto" ${s.mode === "auto" ? "checked" : ""}/><span>Automático</span></label>
        </div>
        <p class="help" style="margin-top:6px">Manual: analiza y espera tu aprobación. Automático: aplica solo lo recomendado (siempre con copia y verificación).</p>
      </fieldset>
      <div class="field"><label for="schedule">Revisión programada</label>
        <select id="schedule" name="schedule"><option value="off" ${s.schedule === "off" ? "selected" : ""}>Desactivada</option><option value="daily" ${s.schedule === "daily" ? "selected" : ""}>Diaria</option><option value="weekly" ${s.schedule === "weekly" ? "selected" : ""}>Semanal</option></select>
        <span class="help">El panel debe estar encendido para que se ejecute.</span></div>
      <div class="field"><label for="soak">Días de espera para versiones nuevas</label>
        <input id="soak" name="soakDays" type="number" min="0" max="30" value="${esc(s.soakDays)}" style="max-width:140px"/>
        <span class="help">Deja que otros usuarios detecten fallos antes de instalar. Los parches de seguridad no esperan.</span></div>
      <div class="field"><label for="urls">Páginas extra a verificar después de actualizar</label>
        <textarea id="urls" name="healthUrls" placeholder="/tienda&#10;/carrito&#10;/contacto">${esc(s.healthUrls.join("\n"))}</textarea>
        <span class="help">Una ruta por línea. Siempre se verifican la portada, /wp-login.php y la API.</span></div>
      <div class="field"><label for="skip">No actualizar nunca estos slugs</label>
        <input id="skip" name="skip" type="text" value="${esc(s.skip.join(", "))}" placeholder="plugin-personalizado, mi-tema"/></div>
      <label class="check"><input type="checkbox" name="restoreDb" ${s.restoreDb ? "checked" : ""}/><span>Al restaurar por un fallo, volver también la base de datos<br><span class="help">Recomendado: algunas actualizaciones cambian la estructura de la base de datos.</span></span></label>
      <label class="check"><input type="checkbox" name="includeUploads" ${s.includeUploads ? "checked" : ""}/><span>Incluir las imágenes subidas (uploads) en las copias completas</span></label>
      <div class="actions" style="margin-top:18px"><button class="btn btn-primary" type="submit">${icon("check")}Guardar ajustes</button></div>
    </form>
    <section class="card card-pad" style="max-width:760px;margin-top:24px">
      <h2 style="margin-bottom:10px">Conexión</h2>
      <p class="small muted" style="margin-bottom:14px">Usuario: <strong>${esc(site.username)}</strong> · Conector ${esc(site.connector || "—")} · Acceso de rescate: ${site.rescueOk ? "funcionando" : "no disponible (el hosting puede bloquear el acceso directo a archivos PHP de plugins)"}.</p>
      <div class="actions">
        <button class="btn" id="test-rescue">${icon("lifebuoy")}Probar rescate</button>
        <button class="btn" id="rotate">${icon("refresh")}Renovar clave de rescate</button>
        <button class="btn btn-danger" id="remove-site">${icon("trash")}Quitar sitio del panel</button>
      </div>
    </section>`;

  $("#settings-form").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      await api("PATCH", `/api/sites/${site.id}/settings`, {
        mode: f.get("mode"),
        schedule: f.get("schedule"),
        soakDays: Number(f.get("soakDays")),
        healthUrls: String(f.get("healthUrls") || "").split(/\n/).map((x) => x.trim()).filter(Boolean),
        skip: String(f.get("skip") || "").split(/[,\s]+/).filter(Boolean),
        restoreDb: f.get("restoreDb") === "on",
        includeUploads: f.get("includeUploads") === "on",
      });
      toast("Ajustes guardados.");
    } catch (err) {
      toast(err.message, "error");
    }
  };
  $("#test-rescue").onclick = async () => {
    const r = await api("POST", `/api/sites/${site.id}/rescue-test`).catch((e) => ({ ok: false, error: e.message }));
    toast(r.ok ? "El acceso de rescate responde correctamente." : `Rescate no disponible: ${r.error}`, r.ok ? "ok" : "error");
  };
  $("#rotate").onclick = async () => {
    await api("POST", `/api/sites/${site.id}/reconnect`).then(() => toast("Clave de rescate renovada.")).catch((e) => toast(e.message, "error"));
  };
  $("#remove-site").onclick = () =>
    modal({
      title: "Quitar sitio",
      body: `<p>Se elimina <strong>${esc(site.name)}</strong> del panel (las copias descargadas se conservan en <code>data/backups</code>). En el sitio, revocá la contraseña de aplicación desde tu perfil.</p>`,
      actions: [
        { label: "Cancelar" },
        {
          label: "Quitar",
          cls: "btn-danger",
          icon: "trash",
          run: async () => {
            await api("DELETE", `/api/sites/${site.id}`);
            location.hash = "#/sitios";
          },
        },
      ],
    });
}

// ---------------------------------------------------------------------------
// Actividad y fuentes
// ---------------------------------------------------------------------------
async function viewActivity(main) {
  setNav("actividad");
  const [jobs, reports] = await Promise.all([api("GET", "/api/jobs"), api("GET", "/api/reports")]);
  for (const j of jobs) state.jobs.set(j.id, j);
  main.innerHTML = `
    <div class="page-head"><div><h1>Actividad</h1><p class="sub">Tareas recientes e informes con lo que se hizo y por qué.</p></div></div>
    ${
      jobs.length
        ? `<section class="card" style="margin-bottom:24px"><div class="card-head"><h2>Tareas de esta sesión</h2></div><div class="table-wrap"><table>
      <thead><tr><th scope="col">Tarea</th><th scope="col">Estado</th><th scope="col">Inicio</th><th scope="col"><span class="sr-only">Registro</span></th></tr></thead>
      <tbody>${jobs.map((j) => `<tr><td>${esc(j.title)}</td><td>${j.status === "running" ? badge({ cls: "badge-info" }, `${j.progress.percent}%`) : j.status === "done" ? badge({ cls: "badge-ok", icon: "check" }, "Terminada") : badge({ cls: "badge-danger", icon: "alert" }, "Con errores")}</td><td class="small muted">${esc(ago(j.startedAt))}</td><td><button class="btn btn-sm" data-job="${esc(j.id)}">Ver registro</button></td></tr>`).join("")}</tbody></table></div></section>`
        : ""
    }
    <section class="card"><div class="card-head"><h2>Informes</h2></div>${reportList(reports)}</section>`;
  main.onclick = (e) => {
    const b = e.target.closest("[data-job]");
    if (b) openDock(state.jobs.get(b.dataset.job));
  };
}

async function viewSources(main) {
  setNav("fuentes");
  const ov = await api("GET", "/api/overview");
  const s = ov.sources;
  const row = (on, name, desc, how) => `<tr><td><strong>${esc(name)}</strong><div class="small muted">${esc(desc)}</div></td><td>${on ? badge({ cls: "badge-ok", icon: "check" }, "Activa") : badge({ cls: "", icon: "x" }, "No configurada")}</td><td class="small">${on ? "" : how}</td></tr>`;
  main.innerHTML = `
    <div class="page-head"><div><h1>Fuentes y ajustes</h1><p class="sub">De dónde sale la información para decidir si actualizar.</p></div></div>
    <section class="card table-wrap" style="margin-bottom:24px"><table>
      <thead><tr><th scope="col">Fuente</th><th scope="col">Estado</th><th scope="col">Cómo activarla</th></tr></thead>
      <tbody>
        ${row(s.wporg, "WordPress.org", "Ficha oficial, compatibilidad, changelog, foros de soporte y reseñas recientes.", "")}
        ${row(s.claude, "Claude (IA)", "Investiga foros, GitHub, Reddit, Wordfence, Patchstack y WPScan con tu stack exacto y redacta la decisión.", "Definí <code>ANTHROPIC_API_KEY</code> en <code>panel/.env</code> y reiniciá el panel.")}
        ${row(s.wpscan, "WPScan", "Base de vulnerabilidades por versión de plugin, tema y WordPress.", "Creá un token gratuito en wpscan.com y definí <code>WPSCAN_API_TOKEN</code>.")}
        ${row(s.wordfence, "Wordfence Intelligence", "Feed de vulnerabilidades con rangos de versiones afectadas.", "Definí <code>WORDFENCE_API_KEY</code> (clave de Wordfence Intelligence).")}
      </tbody></table></section>
    <section class="card card-pad">
      <h2 style="margin-bottom:10px">Conector para WordPress</h2>
      <p class="muted" style="margin-bottom:14px">Instalalo en cada sitio. Agrega copias por pasos, actualización segura y el acceso de rescate.</p>
      <a class="btn btn-primary" href="/download/centinela-connector.zip">${icon("download")}Descargar centinela-connector.zip</a>
    </section>`;
}

// ---------------------------------------------------------------------------
try {
  const saved = localStorage.getItem("cw-theme");
  if (saved) document.documentElement.dataset.theme = saved;
} catch {
  /* sin almacenamiento */
}
window.addEventListener("hashchange", () => route());
route();
