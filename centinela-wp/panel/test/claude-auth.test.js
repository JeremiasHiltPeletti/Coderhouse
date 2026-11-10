// El análisis con Claude reintenta con "x-api-key" si la clave es rechazada como Bearer.
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

const KEY = "sk-ant-usr01-" + "k".repeat(80);
const seen = [];
const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const viaHeader = req.headers["x-api-key"] === KEY;
    seen.push({ bearer: Boolean(req.headers.authorization), xApiKey: viaHeader });
    if (!viaHeader) {
      res.writeHead(401, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }));
    }
    const wantsJson = JSON.parse(body).output_config?.format;
    const text = wantsJson
      ? JSON.stringify({ decision: "update", risk: "low", confidence: 80, summary: "Prueba OK", reasons: ["r"], stack_conflicts: [], security: "s", precautions: [], sources: [] })
      : "Sin reportes de problemas.";
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5-5", content: [{ type: "text", text }], stop_reason: "end_turn", stop_details: null, usage: { input_tokens: 1, output_tokens: 1 } }));
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${server.address().port}`;
process.env.ANTHROPIC_API_KEY = KEY;
process.env.CENTINELA_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "centinela-auth-"));

const { advise } = await import("../lib/advisor.js");

test("reintenta con x-api-key y usa la decisión de Claude", async () => {
  const logs = [];
  const item = { type: "plugin", slug: "demo", name: "Demo", current: "1.0.0", next: "1.0.1", active: true, package: true };
  const inventory = { core: { version: "6.7" }, environment: { php: "8.2.0", can_update: true, server_software: "" }, plugins: [], themes: [], db: { server: "MySQL", version: "8" }, site: {} };
  const evidence = { wporg: { found: true, ageDays: 10 }, forum: null, vulns: null };
  const r = await advise(item, evidence, inventory, { soakDays: 3, skip: [] }, (m) => logs.push(m));
  server.close();
  assert.equal(r.engine, "claude");
  assert.equal(r.summary, "Prueba OK");
  assert.ok(seen[0].bearer && !seen[0].xApiKey, "primer intento con Bearer");
  assert.ok(seen.slice(1).every((s) => s.xApiKey && !s.bearer), "reintentos con x-api-key");
  assert.ok(logs.some((l) => l.includes("encabezado clásico")));
});
