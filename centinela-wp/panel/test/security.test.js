// Contraseña del panel (scrypt con parámetros de OWASP) y cifrado de secretos v1 → v2.
import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// Datos "viejos": una contraseña de aplicación cifrada con la clave v1 (SHA-256 del secreto).
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "centinela-sec-"));
const SECRET = "una frase secreta de prueba";
const v1Key = crypto.createHash("sha256").update(SECRET).digest();
const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv("aes-256-gcm", v1Key, iv);
const data = Buffer.concat([cipher.update("abcd efgh ijkl mnop", "utf8"), cipher.final()]);
const v1Blob = ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
fs.writeFileSync(path.join(dir, "db.json"), JSON.stringify({ version: 1, sites: [{ id: "s1", appPassword: v1Blob }], reports: [], settings: {}, auth: {} }));

process.env.CENTINELA_DATA_DIR = dir;
process.env.CENTINELA_SECRET = SECRET;
const { store, saveNow, decrypt, encrypt, hashPassword, verifyPassword, needsRehash } = await import("../lib/store.js");

test("hash nuevo: scrypt N=2^17, r=8, p=1 con sal aleatoria", () => {
  const h = hashPassword("clave-larga-123");
  assert.match(h, /^scrypt\$17\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  assert.notEqual(h, hashPassword("clave-larga-123"));
  assert.equal(verifyPassword("clave-larga-123", h), true);
  assert.equal(verifyPassword("otra", h), false);
  assert.equal(needsRehash(h), false);
});

test("formato anterior (sal:hash, N=2^14) se acepta y se marca para actualizar", () => {
  const salt = "a1b2c3";
  const legacy = `${salt}:${crypto.scryptSync("vieja-clave-123", salt, 64).toString("hex")}`;
  assert.equal(verifyPassword("vieja-clave-123", legacy), true);
  assert.equal(verifyPassword("incorrecta", legacy), false);
  assert.equal(needsRehash(legacy), true);
});

test("hashes dañados no rompen el inicio de sesión", () => {
  for (const bad of ["", "nada", "scrypt$17$8$1$zz$", null, undefined]) assert.equal(verifyPassword("x", bad), false);
});

test("los secretos v1 se recifran a v2 al arrancar y siguen funcionando", () => {
  const site = store.site("s1");
  assert.match(site.appPassword, /^v2:/);
  assert.equal(decrypt(site.appPassword), "abcd efgh ijkl mnop");
  saveNow();
  const onDisk = JSON.parse(fs.readFileSync(path.join(dir, "db.json"), "utf8"));
  assert.match(onDisk.sites[0].appPassword, /^v2:/);
});

test("cifrado nuevo usa v2 y se puede leer un v1", () => {
  assert.match(encrypt("hola"), /^v2:/);
  assert.equal(decrypt(v1Blob), "abcd efgh ijkl mnop");
});
