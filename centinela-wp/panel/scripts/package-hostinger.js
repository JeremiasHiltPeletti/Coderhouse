// Arma dist/centinela-panel-hostinger.zip: el panel + el conector, listo para
// subir como "Web App" de Node.js en Hostinger (sin node_modules ni datos).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { zipFolder } from "../lib/zip.js";

const panel = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const stage = fs.mkdtempSync(path.join(os.tmpdir(), "centinela-pkg-"));
const copy = (from, to = from) => fs.cpSync(path.join(panel, from), path.join(stage, to), { recursive: true });

for (const item of ["server.js", "package.json", "package-lock.json", ".env.example", "lib", "public", "scripts"]) copy(item);
fs.cpSync(path.join(panel, "..", "connector", "centinela-connector"), path.join(stage, "connector", "centinela-connector"), { recursive: true });

const out = path.join(panel, "..", "dist", "centinela-panel-hostinger.zip");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, zipFolder(stage, ""));
fs.rmSync(stage, { recursive: true, force: true });
console.log(`Paquete listo: ${path.relative(process.cwd(), out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
