/** Shared helpers for encrypted progress backup Pages Functions. */

export const CRYPTO_V = 1;
export const ID_RE = /^[a-f0-9]{64}$/;

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

export function opaque(status = 400) {
  return json({ error: "unavailable" }, status);
}

export function objectKey(id) {
  return `bk/${id}.json`;
}

export function maxBytes(env) {
  const n = Number(env.BACKUP_MAX_BYTES || 524288);
  return Number.isFinite(n) && n > 0 ? n : 524288;
}

export function ttlDays(env) {
  const n = Number(env.BACKUP_TTL_DAYS || 365);
  return Number.isFinite(n) && n > 0 ? n : 365;
}

export function clientIp(request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "0.0.0.0"
  );
}

/** Simple Cache-API rate limit. Returns true if allowed. */
export async function rateLimit(request, bucket, { limit, windowSec }) {
  const ip = clientIp(request);
  const key = new Request(
    `https://backup-rl.internal/${bucket}/${ip}/${Math.floor(Date.now() / (windowSec * 1000))}`
  );
  const cache = caches.default;
  const hit = await cache.match(key);
  let count = 0;
  if (hit) {
    count = Number(await hit.text()) || 0;
  }
  if (count >= limit) return false;
  await cache.put(
    key,
    new Response(String(count + 1), {
      headers: { "cache-control": `max-age=${windowSec}` },
    })
  );
  return true;
}

export async function verifyTurnstile(env, token, ip) {
  const secret = env.TURNSTILE_SECRET;
  if (!secret) {
    // Dev / first deploy: allow when secret not configured.
    return { ok: true, bypass: true };
  }
  if (!token || typeof token !== "string") {
    return { ok: false };
  }
  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (ip) body.set("remoteip", ip);
  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body }
  );
  const data = await res.json().catch(() => null);
  return { ok: !!(data && data.success), data };
}

export function parseEnvelope(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.v !== CRYPTO_V) return null;
  if (typeof raw.salt !== "string" || typeof raw.iv !== "string" || typeof raw.ct !== "string") {
    return null;
  }
  // rough size guard on base64 fields (ct may be ~4/3 of plaintext)
  if (raw.salt.length > 128 || raw.iv.length > 128 || raw.ct.length > maxBytes({}) * 2) {
    return null;
  }
  return raw;
}

export function metaFromObject(obj, custom) {
  const c = custom || obj.customMetadata || {};
  return {
    etag: obj.httpEtag || obj.etag || c.rev || "",
    createdAt: c.createdAt || "",
    expiresAt: c.expiresAt || "",
    updatedAt: c.updatedAt || "",
    size: Number(c.size || obj.size || 0),
    cryptoV: Number(c.cryptoV || CRYPTO_V),
    rev: c.rev || "",
  };
}

export function isExpired(meta, now = Date.now()) {
  if (!meta.expiresAt) return false;
  const t = Date.parse(meta.expiresAt);
  return Number.isFinite(t) && t <= now;
}

export async function deleteIfExpired(bucket, id, obj) {
  const meta = metaFromObject(obj);
  if (!isExpired(meta)) return false;
  await bucket.delete(objectKey(id));
  return true;
}
