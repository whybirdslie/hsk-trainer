# HSKTrainer tasks

## Done (PWA / Cloudflare Pages)

- [x] Root files were misnamed (HTML/JSON/font/icons swapped); corrected into `public/`
- [x] Deliverables in `public/`: `index.html`, `hsk-data.json`, `kai.woff2`, `icons/`, PWA files
- [x] Removed claude.ai cloud sync (`window.claude`, `connectCloud`, `flush`, dirty tracking)
- [x] Storage via `lsGet`/`lsSet` only; `navigator.storage.persist()` on boot
- [x] Sync UI replaced with local-only note in settings; header sync dot removed
- [x] Export: Blob + `canShare` / download / textarea fallback; import format unchanged
- [x] PWA: `manifest.webmanifest`, `sw.js` (CACHE_VERSION, precache, network-first nav), head meta
- [x] `public/_headers` Cache-Control no-cache for sw/index/manifest
- [x] README: lokal starten + Cloudflare Pages deploy
- [x] `.gitignore`: `.DS_Store`, `node_modules/`, `.env`

## Verify locally (checked 2026-10-25)

- [x] `py -3 -m http.server 8080` in `public/`
- [x] App loads; Kaiti (`HSK Kai`) loaded; 10944 words
- [x] SW `hsk-v1` active + controlling; manifest OK (name/icons/standalone)
- [x] Offline reload: app starts, cards work, font + progress OK
- [x] Progress persists after reload; export JSON format roundtrip OK
- [x] Settings show "Lokal auf diesem Gerät gespeichert"

## Cloudflare Pages

- [x] Project `hsk-trainer` created
- [x] Build: empty command, `destination_dir=public`, branch `main`
- [x] First production deploy live: https://hsk-trainer-eno.pages.dev
- [x] GitHub Actions workflow: `.github/workflows/deploy-pages.yml`
- [x] GitHub secret `CLOUDFLARE_API_TOKEN` set; push to main deploys (run 40201596843 success)
- [x] iOS icons: transparent red glyph (`apple-touch-icon`, `icon-192`, `icon-512`). Maskable stays opaque. Cache `hsk-v2`. Home-screen icon updates only after remove and add again.
- [x] Android: `icon-monochrome-512.png` + manifest `purpose: monochrome` for themed icons. Cache `hsk-v3`. Play Protect WebAPK targetSdk is Chrome-side, not fixable in the static app.
- [x] Text selection: app chrome (buttons, tabs, title, badges, stats labels) is `user-select: none` plus `-webkit-touch-callout: none`, so iOS long-press does not offer Kopieren/Nachschlagen. Study text uses `.copy` (hanzi, pinyin, DE/EN gloss, examples, components, quiz answers). Inputs stay editable. A selection gesture does not also activate the control under it. Cache `hsk-v4`.
- [x] Tabs: inactive tabs drop `aria-current` instead of `aria-current="false"`.
- [x] iOS status bar: `black-translucent` + `theme-color` `#12161B` when the applied theme is dark, `default` + `#B5332B` when light. Follows in-app theme and system changes. Home-screen apps may keep the old bar until removed and added again.
- [x] Card back always shows a radical chip per character, including single-character words. Chip stays compact: character, pinyin, radical glyph. The gloss (Hand, 提手旁) stays on the character sheet. Cache `hsk-v6`.
- [ ] Optional: reinstall Cloudflare GitHub App (error 8000011 blocks native Git connect)

## Cloud backup (implemented 2026-10-28)

Recovery-code + client-encrypted blob via Pages Functions + KV (R2 preferred when account enables R2).

### Shipped
- [x] `functions/api/backup.js` POST create; `functions/api/backup/[id].js` GET/PUT/DELETE
- [x] `functions/api/health.js` (+ `/api/backup/health`) smoke
- [x] KV namespace `hsk-trainer-backups` id `88b30019b8474fbca7f07791428a7644`, binding `BACKUP_KV`
- [x] `wrangler.toml` Pages config; deploy must include `functions/`
- [x] Client: Crockford 128-bit code, confirm re-type, AES-GCM + HKDF, debounce upload, empty-PUT guard, boot restore prompt, If-Match / 412 merge retry
- [x] SW `hsk-v7`: never cache `/api/*`
- [x] Absolute TTL from create (KV `expirationTtl` + `expiresAt`); no refresh on PUT
- [x] Fresh IV+salt every encrypt
- [ ] Production verify: deploy + `GET /api/health` → `ok:true`
- [ ] Optional Turnstile: set `TURNSTILE_SITE_KEY` + secret; wire widget on create
- [ ] Optional R2: enable R2 in CF dashboard, uncomment bucket binding (code already prefers `BACKUP_BUCKET`)
- [ ] Optional: QR library, BroadcastChannel upload leader, code rotate

### v1 architecture decisions
1. Code = 128-bit secret, Crockford base32 grouped; share/copy once. Never store plaintext as KV key.
2. KV key = `bk:` + SHA-256(`hsk-bk-id-v1|` + normalized code). Value = versioned AEAD envelope + meta.
3. Encrypt the existing export envelope shape (`app`/`v`/`progress`), not a parallel raw `S.prog` schema.
4. Local save stays sync `lsSet`; cloud upload debounce (~8s) + flush on `pagehide`/`visibilitychange` with `keepalive`.
5. SW: never cache `/api/*`.
6. Deploy must ship `functions/` + KV binding via `wrangler.toml` (not `pages deploy public` alone without config).
7. Create: optional Turnstile (bypass if secret unset); size cap; absolute TTL. No list/enumerate API.
8. Multi-device: If-Match / etag, 412 → pull/decrypt/merge via `importData`, retry PUT. Empty local never auto-merges as authority.
9. Code durability is off-device. Local code cache is convenience only.
10. Wrong code / missing blob: opaque client errors. Unlink ≠ delete cloud; delete requires confirm + code possession.

### Pre-mortem mitigations applied
| Topic | Mitigation |
|-------|------------|
| AES-GCM IV reuse | Fresh IV + salt every encrypt |
| Empty-local cloud wipe | Never auto-PUT when `progressWeight()===0`; boot restore prompt |
| TTL immortal abuse | Absolute `expiresAt` from create; KV TTL set from remaining life |
| KV eventual consistency | Create confirm + 409 claim via GET/decrypt; prefer R2 later |
| SW stale / API poison | `hsk-v7` + `/api/*` network-only + `_headers` no-store |
| Mint typo orphan | Re-type confirm before enable |
| iOS kill before flush | `keepalive` PUT on hide; pending status UI |
| Empty merge poison | `importData`: empty local forces replace not merge |
| GDPR delete without code | In-app delete with code; no email lookup |

### Severity leftovers (defer)
- Code = full write capability (warn in UI; rotate later)
- Multi-tab PUT stampede (BroadcastChannel later)
- Turnstile widget UX (secret unset for now)
- R2 not enabled on account yet (HTTP 403 enable R2) → KV shipped
