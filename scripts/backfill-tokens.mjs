#!/usr/bin/env node
// One-time backfill: envelope-encrypt any connection tokens still stored in
// plaintext, so historical rows match the AES-256-GCM format the app now writes
// (lib/crypto.ts). Idempotent — already-encrypted values are skipped, so it's
// safe to re-run. Pass --dry to report without writing.
//
//   node scripts/backfill-tokens.mjs          # encrypt in place
//   node scripts/backfill-tokens.mjs --dry    # report only
//
// Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TOKEN_ENC_KEY
// (auto-loaded from .env.local / .env if present).

import { createClient } from "@supabase/supabase-js";
import { createCipheriv, randomBytes } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";

const PREFIX = "enc:v1:";
const PAGE = 500;

// Minimal .env loader (no dependency) — only sets vars not already in the env.
function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}
loadEnv(".env.local");
loadEnv(".env");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const encKeyB64 = process.env.TOKEN_ENC_KEY;
const DRY = process.argv.includes("--dry");

if (!url || !svcKey) {
  console.error("✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
if (!encKeyB64) {
  console.error("✗ Missing TOKEN_ENC_KEY — nothing to encrypt with. Generate: openssl rand -base64 32");
  process.exit(1);
}
const key = Buffer.from(encKeyB64, "base64");
if (key.length !== 32) {
  console.error("✗ TOKEN_ENC_KEY must decode to 32 bytes (openssl rand -base64 32).");
  process.exit(1);
}

const isEnc = (v) => typeof v === "string" && v.startsWith(PREFIX);
function encrypt(plain) {
  if (plain == null || isEnc(plain)) return plain;
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(String(plain), "utf8"), c.final()]);
  return PREFIX + Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64");
}

const supabase = createClient(url, svcKey, { auth: { persistSession: false } });

let scanned = 0;
let updated = 0;
let alreadyEncrypted = 0;
let from = 0;

console.log(`${DRY ? "[dry-run] " : ""}Backfilling connection token encryption…`);

for (;;) {
  const { data, error } = await supabase
    .from("connections")
    .select("id, access_token, refresh_token")
    .range(from, from + PAGE - 1);
  if (error) {
    console.error("✗ Fetch error:", error.message);
    process.exit(1);
  }
  if (!data || data.length === 0) break;

  for (const row of data) {
    scanned++;
    const needsA = row.access_token && !isEnc(row.access_token);
    const needsR = row.refresh_token && !isEnc(row.refresh_token);
    if (!needsA && !needsR) {
      if (row.access_token || row.refresh_token) alreadyEncrypted++;
      continue;
    }
    const patch = {};
    if (needsA) patch.access_token = encrypt(row.access_token);
    if (needsR) patch.refresh_token = encrypt(row.refresh_token);
    if (DRY) {
      updated++;
      continue;
    }
    const { error: upErr } = await supabase.from("connections").update(patch).eq("id", row.id);
    if (upErr) {
      console.error(`✗ Update failed for ${row.id}:`, upErr.message);
      continue;
    }
    updated++;
  }

  if (data.length < PAGE) break;
  from += PAGE;
}

console.log(
  `✓ ${DRY ? "[dry-run] " : ""}scanned ${scanned} connection(s) · ` +
    `${updated} ${DRY ? "would be " : ""}encrypted · ${alreadyEncrypted} already encrypted`
);
