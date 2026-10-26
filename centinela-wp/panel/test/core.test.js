// Pruebas de la lógica que decide y verifica (sin red).
import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

process.env.CENTINELA_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "centinela-test-"));
delete process.env.ANTHROPIC_API_KEY;

const { compareVersions, jumpType, parseRss, cleanText } = await import("../lib/research.js");
const { heuristic } = await import("../lib/advisor.js");
const { compare } = await import("../lib/health.js");
const { encrypt, decrypt } = await import("../lib/store.js");
const { zipFolder } = await import("../lib/zip.js");

const inventory = {
  core: { version: "6.7" },
  environment: { php: "8.1.2", can_update: true },
  plugins: [],
  themes: [],
};
const settings = { soakDays: 3, skip: [] };
const item = (o = {}) => ({ type: "plugin", slug: "demo", name: "Demo", current: "1.2.0", next: "1.2.1", active: true, package: true, ...o });
const ev = (o = {}) => ({ wporg: { found: true, ageDays: 10, tested: "6.7" }, forum: { threadsSinceRelease: 0, problemThreads: [], stackThreads: 0, badReviews: [] }, vulns: null, ...o });

test("compara versiones como WordPress", () => {
  assert.equal(compareVersions("1.10.0", "1.9.9"), 1);
  assert.equal(compareVersions("6.7", "6.7.0"), 0);
  assert.equal(compareVersions("2.0-beta1", "2.0"), -1);
  assert.equal(jumpType("6.7", "6.8", "core"), "major");
  assert.equal(jumpType("6.7.1", "6.7.2", "core"), "patch");
  assert.equal(jumpType("1.9", "2.0"), "major");
});

test("una corrección sin reportes se recomienda", () => {
  const r = heuristic(item(), ev(), inventory, settings);
  assert.equal(r.decision, "update");
  assert.equal(r.risk, "low");
});

test("PHP incompatible bloquea siempre", () => {
  const r = heuristic(item({ requiresPhp: "8.2" }), ev(), inventory, settings);
  assert.equal(r.decision, "hold");
  assert.equal(r.risk, "critical");
  assert.match(r.blocks[0], /PHP 8.2/);
});

test("sin paquete (licencia vencida) no se actualiza", () => {
  assert.equal(heuristic(item({ package: false }), ev(), inventory, settings).decision, "hold");
});

test("versión recién publicada espera el período configurado", () => {
  const r = heuristic(item(), ev({ wporg: { found: true, ageDays: 1 } }), inventory, settings);
  assert.equal(r.decision, "wait");
  assert.ok(r.waitUntil);
});

test("un parche de seguridad no espera", () => {
  const vulns = { current: [{ title: "XSS", fixedIn: "1.2.1" }], next: [] };
  const r = heuristic(item(), ev({ wporg: { found: true, ageDays: 0 }, vulns }), inventory, settings);
  assert.equal(r.decision, "update");
  assert.equal(r.securityFix, true);
});

test("si la versión nueva es vulnerable, no se actualiza", () => {
  const vulns = { current: [], next: [{ title: "SQLi" }] };
  assert.equal(heuristic(item(), ev({ vulns }), inventory, settings).decision, "hold");
});

test("muchos reportes de rotura con el stack retienen la actualización", () => {
  const t = { title: "Fatal error after update", breaks: ["fatal"], stack: ["WooCommerce"] };
  const forum = { threadsSinceRelease: 5, problemThreads: [t, t, t, t], stackThreads: 3, badReviews: [{}, {}] };
  const r = heuristic(item({ current: "1.0", next: "2.0" }), ev({ forum }), inventory, settings);
  assert.equal(r.decision, "hold");
  assert.equal(r.risk, "high");
});

test("la verificación detecta un error crítico y un 500", () => {
  const page = (o) => ({ url: "https://x.test/", status: 200, ms: 300, bytes: 50000, title: "Inicio", closesHtml: true, hard: [], soft: [], ...o });
  const before = { pages: [page()] };
  assert.equal(compare(before, { pages: [page()] }).ok, true);
  const broken = compare(before, { pages: [page({ status: 500, bytes: 2600, hard: ["Pantalla de error crítico de WordPress"], closesHtml: false })] });
  assert.equal(broken.ok, false);
  assert.ok(broken.problems.length >= 2);
});

test("lee feeds RSS de los foros", () => {
  const xml = `<rss><channel><item><title>Site broke after update &#8211; help</title><link>https://wordpress.org/support/topic/x/</link><pubDate>Mon, 20 Oct 2026 10:00:00 +0000</pubDate><description><![CDATA[<p>Fatal error with <b>Elementor</b></p>]]></description></item></channel></rss>`;
  const [it] = parseRss(xml);
  assert.equal(it.title, "Site broke after update – help");
  assert.equal(it.text, "Fatal error with Elementor");
  assert.equal(cleanText("a&amp;b"), "a&b");
});

test("cifra y descifra credenciales", () => {
  const blob = encrypt("abcd efgh ijkl");
  assert.notEqual(blob, "abcd efgh ijkl");
  assert.equal(decrypt(blob), "abcd efgh ijkl");
});

test("genera un zip válido del conector", { skip: !hasUnzip() }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zip-src-"));
  fs.mkdirSync(path.join(dir, "sub"));
  fs.writeFileSync(path.join(dir, "a.php"), "<?php echo 1;");
  fs.writeFileSync(path.join(dir, "sub", "b.txt"), "hola ñ");
  const out = path.join(os.tmpdir(), `t-${Date.now()}.zip`);
  fs.writeFileSync(out, zipFolder(dir, "plugin"));
  const list = execFileSync("unzip", ["-l", out]).toString();
  assert.match(list, /plugin\/a\.php/);
  assert.match(list, /plugin\/sub\/b\.txt/);
  execFileSync("unzip", ["-t", out]);
});

function hasUnzip() {
  try {
    execFileSync("unzip", ["-v"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
