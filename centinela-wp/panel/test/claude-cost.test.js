// Costo: investigación con Sonnet (máx. 3 búsquedas), decisión con Opus y reutilización de resultados.
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

const calls = [];
const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const json = JSON.parse(body);
    calls.push({ model: json.model, search: json.tools?.[0], decision: Boolean(json.output_config?.format), fallbacks: json.fallbacks });
    const text = json.output_config?.format
      ? JSON.stringify({ decision: "update", risk: "low", confidence: 75, summary: "OK", reasons: ["r"], stack_conflicts: [], security: "s", precautions: [], sources: [] })
      : "Informe general.";
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ id: "m", type: "message", role: "assistant", model: json.model, content: [{ type: "text", text }], stop_reason: "end_turn", stop_details: null, usage: { input_tokens: 1, output_tokens: 1 } }));
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${server.address().port}`;
process.env.ANTHROPIC_API_KEY = "sk-ant-api03-" + "c".repeat(95);
process.env.CENTINELA_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "centinela-cost-"));
delete process.env.CLAUDE_MODEL;
delete process.env.CLAUDE_RESEARCH_MODEL;
const { advise } = await import("../lib/advisor.js");

const item = { type: "plugin", slug: "elementor", name: "Elementor", current: "3.0.0", next: "3.0.1", active: true, package: true };
const evidence = { wporg: { found: true, ageDays: 10 }, forum: null, vulns: null };
const settings = { soakDays: 3, skip: [] };
const site = (php, plugins) => ({ core: { version: "6.7" }, environment: { php, can_update: true, server_software: "" }, plugins, themes: [], db: { server: "MySQL", version: "8" }, site: {} });
const siteA = site("8.2.0", [{ name: "WooCommerce", version: "9.0", active: true }]);
const siteB = site("8.1.0", [{ name: "Yoast SEO", version: "23.0", active: true }]);

test("primer análisis: investiga con Sonnet (3 búsquedas) y decide con Opus", async () => {
  const r = await advise(item, evidence, siteA, settings, () => {});
  assert.equal(r.engine, "claude");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].model, "claude-sonnet-5-5");
  assert.equal(calls[0].search.max_uses, 3);
  assert.equal(calls[0].search.type, "web_search_20260209");
  assert.equal(calls[1].model, "claude-opus-5-5");
  assert.ok(calls[1].decision);
});

test("otro sitio con el mismo plugin: reutiliza la investigación y solo decide", async () => {
  const logs = [];
  await advise(item, evidence, siteB, settings, (m) => logs.push(m));
  assert.equal(calls.length, 3);
  assert.equal(calls[2].model, "claude-opus-5-5");
  assert.ok(logs.some((l) => l.includes("Se reutiliza la investigación")));
});

test("revisión repetida sin cambios: no consulta a Claude", async () => {
  const logs = [];
  const r = await advise(item, evidence, siteB, settings, (m) => logs.push(m));
  server.close();
  assert.equal(calls.length, 3);
  assert.equal(r.engine, "claude");
  assert.ok(logs.some((l) => l.includes("Se reutiliza la decisión")));
});
