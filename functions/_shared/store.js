/**
 * Backup blob store: prefers R2 (BACKUP_BUCKET), falls back to KV (BACKUP_KV).
 * Value shape stored as JSON text:
 * { v, salt, iv, ct, createdAt, expiresAt, updatedAt, rev, size, cryptoV }
 */
import {
  CRYPTO_V,
  deleteIfExpired,
  isExpired,
  metaFromObject,
  objectKey,
  parseEnvelope,
} from "./backup.js";

function newRev() {
  return crypto.randomUUID().replace(/-/g, "");
}

export function storageKind(env) {
  if (env.BACKUP_BUCKET) return "r2";
  if (env.BACKUP_KV) return "kv";
  return "none";
}

export async function getBackup(env, id) {
  if (env.BACKUP_BUCKET) {
    const key = objectKey(id);
    const obj = await env.BACKUP_BUCKET.get(key);
    if (!obj) return null;
    if (await deleteIfExpired(env.BACKUP_BUCKET, id, obj)) return null;
    const text = await obj.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return null;
    }
    const meta = metaFromObject(obj, obj.customMetadata);
    return {
      envelope: { v: body.v, salt: body.salt, iv: body.iv, ct: body.ct },
      meta: {
        ...meta,
        createdAt: body.createdAt || meta.createdAt,
        expiresAt: body.expiresAt || meta.expiresAt,
        updatedAt: body.updatedAt || meta.updatedAt,
        rev: body.rev || meta.rev,
        size: body.size || meta.size,
        cryptoV: body.cryptoV || meta.cryptoV,
        etag: body.rev || meta.etag,
      },
    };
  }

  if (env.BACKUP_KV) {
    const raw = await env.BACKUP_KV.get(`bk:${id}`, { type: "json" });
    if (!raw) return null;
    if (isExpired(raw)) {
      await env.BACKUP_KV.delete(`bk:${id}`);
      return null;
    }
    return {
      envelope: { v: raw.v, salt: raw.salt, iv: raw.iv, ct: raw.ct },
      meta: {
        etag: raw.rev,
        rev: raw.rev,
        createdAt: raw.createdAt,
        expiresAt: raw.expiresAt,
        updatedAt: raw.updatedAt,
        size: raw.size,
        cryptoV: raw.cryptoV || CRYPTO_V,
      },
    };
  }

  return null;
}

export async function putBackup(env, id, { envelope, createdAt, expiresAt, updatedAt, rev, size }) {
  const record = {
    v: envelope.v,
    salt: envelope.salt,
    iv: envelope.iv,
    ct: envelope.ct,
    createdAt,
    expiresAt,
    updatedAt,
    rev,
    size,
    cryptoV: CRYPTO_V,
  };

  if (env.BACKUP_BUCKET) {
    const key = objectKey(id);
    await env.BACKUP_BUCKET.put(key, JSON.stringify(record), {
      httpMetadata: { contentType: "application/json" },
      customMetadata: {
        createdAt,
        expiresAt,
        updatedAt,
        rev,
        size: String(size),
        cryptoV: String(CRYPTO_V),
      },
    });
    return { rev, etag: rev };
  }

  if (env.BACKUP_KV) {
    // Absolute expiry: set KV expirationTtl from remaining lifetime (no refresh on later PUTs
    // beyond re-writing the same absolute expiresAt).
    const expMs = Date.parse(expiresAt);
    const ttlSec = Number.isFinite(expMs)
      ? Math.max(60, Math.floor((expMs - Date.now()) / 1000))
      : 365 * 86400;
    await env.BACKUP_KV.put(`bk:${id}`, JSON.stringify(record), {
      expirationTtl: ttlSec,
    });
    return { rev, etag: rev };
  }

  throw new Error("no storage binding");
}

export async function createBackup(env, id, envelope, ttlDays, size) {
  const existing = await getBackup(env, id);
  if (existing) return { conflict: true, existing };

  const now = new Date();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + ttlDays * 86400 * 1000).toISOString();
  const rev = newRev();
  await putBackup(env, id, {
    envelope,
    createdAt,
    expiresAt,
    updatedAt: createdAt,
    rev,
    size,
  });
  return { conflict: false, rev, createdAt, expiresAt };
}

export async function updateBackup(env, id, envelope, ifMatch, size) {
  const existing = await getBackup(env, id);
  if (!existing) return { missing: true };
  if (ifMatch && existing.meta.rev && ifMatch !== existing.meta.rev) {
    return { conflict: true, existing };
  }
  const rev = newRev();
  const updatedAt = new Date().toISOString();
  await putBackup(env, id, {
    envelope,
    createdAt: existing.meta.createdAt,
    expiresAt: existing.meta.expiresAt, // absolute — do not refresh
    updatedAt,
    rev,
    size,
  });
  return {
    conflict: false,
    rev,
    createdAt: existing.meta.createdAt,
    expiresAt: existing.meta.expiresAt,
    updatedAt,
  };
}

export async function removeBackup(env, id) {
  if (env.BACKUP_BUCKET) {
    await env.BACKUP_BUCKET.delete(objectKey(id));
    return;
  }
  if (env.BACKUP_KV) {
    await env.BACKUP_KV.delete(`bk:${id}`);
  }
}

export function validateEnvelopeBody(body, max) {
  const envl = parseEnvelope(body);
  if (!envl) return null;
  // estimate decoded size from base64 ct length
  const approx = Math.floor(((body.ct || "").length * 3) / 4);
  if (approx > max) return null;
  return { envelope: envl, size: approx };
}

export { newRev };
