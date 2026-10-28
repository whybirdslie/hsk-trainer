import { json } from "../_shared/backup.js";

/** GET /api/health — deploy smoke check (also aliased under /api/backup/health). */
export async function onRequestGet(context) {
  const env = context.env;
  const hasBucket = !!env.BACKUP_BUCKET;
  const hasKv = !!env.BACKUP_KV;
  return json({
    ok: hasBucket || hasKv,
    storage: hasBucket ? "r2" : hasKv ? "kv" : "none",
    turnstile: !!env.TURNSTILE_SECRET,
    siteKey: env.TURNSTILE_SITE_KEY || "",
    cryptoV: 1,
    ttlDays: Number(env.BACKUP_TTL_DAYS || 365),
    maxBytes: Number(env.BACKUP_MAX_BYTES || 524288),
  });
}
