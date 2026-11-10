// Si la API rechaza sitios que bloquean al buscador de Anthropic, se quitan y se reintenta.
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

const requests = [];
const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const json = JSON.parse(body);
    const domains = json.tools?.[0]?.allowed_domains || [];
    requests.push(domains);
    res.setHeader("Content-Type", "application/json");
    if (domains.includes("github.com")) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "The following domains are not accessible to our user agent: ['github.com']. Read more: https://support.anthropic.com/x" } }));
    }
    const text = json.output_config?.format
      ? JSON.stringify({ decision: "update", risk: "low", confidence: 70, summary: "Dominios OK", reasons: ["r"], stack_conflicts: [], security: "s", precautions: [], sources: [] })
      : "Informe.";
    res.end(JSON.stringify({ id: "m", type: "message", role: "assistant", model: "claude-opus-5-5", content: [{ type: "text", text }], stop_reason: "end_turn", stop_details: null, usage: { input_tokens: 1, output_tokens: 1 } }));
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${server.address().port}`;
process.env.ANTHROPIC_API_KEY = "sk-ant-api03-" + "z".repeat(95);
process.env.CENTINELA_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "centinela-dom-"));
const { advise } = await import("../lib/advisor.js");

test("quita los dominios bloqueados y completa el análisis", async () => {
  const logs = [];
  const item = { type: "plugin", slug: "demo", name: "Demo", current: "1.0.0", next: "1.0.1", active: true, package: true };
  const inventory = { core: { version: "6.7" }, environment: { php: "8.2.0", can_update: true, server_software: "" }, plugins: [], themes: [], db: { server: "MySQL", version: "8" }, site: {} };
  const r = await advise(item, { wporg: { found: true, ageDays: 10 }, forum: null, vulns: null }, inventory, { soakDays: 3, skip: [] }, (m) => logs.push(m));
  server.close();
  assert.equal(r.engine, "claude");
  assert.equal(r.summary, "Dominios OK");
  assert.ok(requests[0].includes("github.com"));
  assert.ok(!requests[1].includes("github.com") && requests[1].includes("wordpress.org"));
  assert.ok(logs.some((l) => l.includes("github.com")));
});
