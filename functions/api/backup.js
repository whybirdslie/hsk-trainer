import {
  ID_RE,
  clientIp,
  json,
  maxBytes,
  opaque,
  rateLimit,
  ttlDays,
  verifyTurnstile,
} from "../_shared/backup.js";
import { createBackup, storageKind, validateEnvelopeBody } from "../_shared/store.js";

/** POST /api/backup — create encrypted backup under client-derived id. */
export async function onRequestPost(context) {
  const { request, env } = context;
  if (storageKind(env) === "none") return opaque(503);

  if (!(await rateLimit(request, "create", { limit: 8, windowSec: 3600 }))) {
    return opaque(429);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return opaque(400);
  }

  const id = typeof body.id === "string" ? body.id.toLowerCase() : "";
  if (!ID_RE.test(id)) return opaque(400);

  const parsed = validateEnvelopeBody(body, maxBytes(env));
  if (!parsed) return opaque(400);

  const ts = await verifyTurnstile(env, body.turnstileToken, clientIp(request));
  if (!ts.ok) return opaque(403);

  try {
    const result = await createBackup(
      env,
      id,
      parsed.envelope,
      ttlDays(env),
      parsed.size
    );
    if (result.conflict) {
      // Idempotent-ish: treat as conflict so client does not overwrite stranger blob.
      return json({ error: "exists" }, 409);
    }
    return json({
      ok: true,
      etag: result.rev,
      createdAt: result.createdAt,
      expiresAt: result.expiresAt,
    });
  } catch (e) {
    return opaque(500);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
      "access-control-allow-headers": "content-type, if-match",
      "access-control-max-age": "86400",
    },
  });
}
