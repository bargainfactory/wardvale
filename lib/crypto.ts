import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Envelope encryption for secrets at rest (OAuth tokens, API keys). AES-256-GCM
// with a key from TOKEN_ENC_KEY (base64, 32 bytes). So a DB dump alone is not
// enough to read client credentials — you'd also need the app-held key.
//
// Backward-compatible + graceful:
//  - decryptSecret() passes through legacy plaintext (no prefix), so existing
//    rows keep working and re-encrypt on next write.
//  - with no TOKEN_ENC_KEY set, values are stored as-is (dev/local), never lost.

const PREFIX = "enc:v1:";

function key(): Buffer | null {
  const k = process.env.TOKEN_ENC_KEY;
  if (!k) return null;
  try {
    const buf = Buffer.from(k, "base64");
    return buf.length === 32 ? buf : null;
  } catch {
    return null;
  }
}

export function encryptSecret(plain: string | null | undefined): string | null {
  if (plain == null) return null;
  const k = key();
  if (!k) return plain; // no key configured → store plaintext (graceful)
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decryptSecret(value: string | null | undefined): string | null {
  if (value == null) return null;
  if (!value.startsWith(PREFIX)) return value; // legacy plaintext — pass through
  const k = key();
  if (!k) return null; // encrypted but no key → cannot read
  try {
    const raw = Buffer.from(value.slice(PREFIX.length), "base64");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ct = raw.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", k, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** True if a stored value is in encrypted form. */
export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}
