// Con CLAUDE_RESEARCH_MODEL=claude-haiku-5-5 la investigación usa la búsqueda básica y sin "fallbacks".
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
    calls.push({ model: json.model, tool: json.tools?.[0]?.type, fallbacks: json.fallbacks, beta: req.headers["anthropic-beta"] || "" });
    const text = json.output_config?.format ? JSON.stringify({ decision: "update", risk: "low", confidence: 60, summary: "OK", reasons: [], stack_conflicts: [], security: "s", precautions: [], sources: [] }) : "Informe.";
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ id: "m", type: "message", role: "assistant", model: json.model, content: [{ type: "text", text }], stop_reason: "end_turn", stop_details: null, usage: { input_tokens: 1, output_tokens: 1 } }));
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${server.address().port}`;
process.env.ANTHROPIC_API_KEY = "sk-ant-api03-" + "h".repeat(95);
process.env.CENTINELA_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "centinela-haiku-"));
process.env.CLAUDE_RESEARCH_MODEL = "claude-haiku-5-5";
delete process.env.CLAUDE_MODEL;
const { advise } = await import("../lib/advisor.js");

test("investigación con Haiku: búsqueda básica, sin fallbacks; decisión con Opus y fallbacks", async () => {
  const inv = { core: { version: "6.7" }, environment: { php: "8.2.0", can_update: true, server_software: "" }, plugins: [], themes: [], db: { server: "MySQL", version: "8" }, site: {} };
  await advise({ type: "plugin", slug: "demo", name: "Demo", current: "1.0", next: "1.1", active: true, package: true }, { wporg: { found: true, ageDays: 10 }, forum: null, vulns: null }, inv, { soakDays: 3, skip: [] }, () => {});
  server.close();
  assert.equal(calls[0].model, "claude-haiku-5-5");
  assert.equal(calls[0].tool, "web_search_20250305");
  assert.equal(calls[0].fallbacks, undefined);
  assert.ok(!calls[0].beta.includes("server-side-fallback"));
  assert.equal(calls[1].model, "claude-opus-5-5");
  assert.equal(calls[1].fallbacks, "default");
});
