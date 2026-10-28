import {
  ID_RE,
  json,
  maxBytes,
  opaque,
  rateLimit,
} from "../../_shared/backup.js";
import {
  getBackup,
  removeBackup,
  storageKind,
  updateBackup,
  validateEnvelopeBody,
} from "../../_shared/store.js";

function parseId(context) {
  const id = String(context.params.id || "").toLowerCase();
  return ID_RE.test(id) ? id : null;
}

/** GET /api/backup/:id */
export async function onRequestGet(context) {
  const { request, env } = context;
  if (storageKind(env) === "none") return opaque(503);
  if (!(await rateLimit(request, "get", { limit: 60, windowSec: 60 }))) {
    return opaque(429);
  }
  const id = parseId(context);
  if (!id) return opaque(400);

  const row = await getBackup(env, id);
  if (!row) return opaque(404);

  return json({
    v: row.envelope.v,
    salt: row.envelope.salt,
    iv: row.envelope.iv,
    ct: row.envelope.ct,
    etag: row.meta.rev,
    createdAt: row.meta.createdAt,
    expiresAt: row.meta.expiresAt,
    updatedAt: row.meta.updatedAt,
    size: row.meta.size,
    cryptoV: row.meta.cryptoV,
  });
}

/** PUT /api/backup/:id — update ciphertext; If-Match required when etag known. */
export async function onRequestPut(context) {
  const { request, env } = context;
  if (storageKind(env) === "none") return opaque(503);
  if (!(await rateLimit(request, "put", { limit: 30, windowSec: 60 }))) {
    return opaque(429);
  }
  const id = parseId(context);
  if (!id) return opaque(400);

  let body;
  try {
    body = await request.json();
  } catch {
    return opaque(400);
  }

  const parsed = validateEnvelopeBody(body, maxBytes(env));
  if (!parsed) return opaque(400);

  const ifMatch =
    request.headers.get("if-match")?.replace(/^"|"$/g, "") ||
    (typeof body.etag === "string" ? body.etag : "");

  const result = await updateBackup(env, id, parsed.envelope, ifMatch, parsed.size);
  if (result.missing) return opaque(404);
  if (result.conflict) {
    return json(
      {
        error: "precondition",
        etag: result.existing.meta.rev,
        updatedAt: result.existing.meta.updatedAt,
        size: result.existing.meta.size,
      },
      412
    );
  }

  return json({
    ok: true,
    etag: result.rev,
    createdAt: result.createdAt,
    expiresAt: result.expiresAt,
    updatedAt: result.updatedAt,
  });
}

/** DELETE /api/backup/:id — requires body { confirm: true } to avoid accidents. */
export async function onRequestDelete(context) {
  const { request, env } = context;
  if (storageKind(env) === "none") return opaque(503);
  if (!(await rateLimit(request, "del", { limit: 10, windowSec: 3600 }))) {
    return opaque(429);
  }
  const id = parseId(context);
  if (!id) return opaque(400);

  // Possession of id (= hash of code) is the capability. Soft confirm via query/body.
  let confirm = false;
  try {
    if (request.headers.get("content-type")?.includes("application/json")) {
      const body = await request.json();
      confirm = !!body.confirm;
    }
  } catch {
    /* empty */
  }
  const url = new URL(request.url);
  if (url.searchParams.get("confirm") === "1") confirm = true;
  if (!confirm) return opaque(400);

  const row = await getBackup(env, id);
  if (!row) return opaque(404);
  await removeBackup(env, id);
  return json({ ok: true });
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
