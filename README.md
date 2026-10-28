# HSK Zeichentrainer

Statische Lern-App für HSK-Zeichen (HSK 3.0). Offline-fähige PWA mit optionalem Cloud-Backup (Recovery-Code + clientseitig verschlüsselter Blob).

Live: https://hsk-trainer-eno.pages.dev

## Lokal starten (nur Static)

```bash
cd public && python3 -m http.server 8080
```

Windows PowerShell:

```powershell
cd public; py -3 -m http.server 8080
```

Cloud-API (`/api/*`) fehlt in diesem Modus. Für Backup lokal:

```bash
npx wrangler pages dev public --kv=BACKUP_KV
```

## Deploy (Cloudflare Pages)

Projekt: `hsk-trainer`  
Account-ID: `80d41f9e23a0f4af1bc6ffd553c5d5c8`  
Output: `public` + Pages Functions in `functions/`  
Config: `wrangler.toml` (KV-Binding `BACKUP_KV`)

### Push-Deploy (GitHub Actions)

Jeder Push auf `main` deployt über `.github/workflows/deploy-pages.yml` mit Wrangler (nimmt `functions/` und Bindings aus `wrangler.toml` mit).

Secret: `CLOUDFLARE_API_TOKEN` (Account → Cloudflare Pages → Edit; für KV ggf. Workers KV Storage Edit).

### Cloud-Backup

- Client erzeugt 128-bit Crockford-Code, leitet `id = SHA-256(...)` ab, verschlüsselt Export-JSON mit AES-GCM (HKDF), speichert Ciphertext in KV.
- Kein Login. Code = Capability (lesen + schreiben). Ohne Code kein Restore.
- Upload nur im Vordergrund (debounce + `pagehide`/`keepalive`). Leerer lokaler Stand überschreibt die Cloud nie automatisch.
- Optional später: Turnstile Site Key in `wrangler.toml` `TURNSTILE_SITE_KEY`, Secret `TURNSTILE_SECRET` via `wrangler pages secret put TURNSTILE_SECRET --project-name=hsk-trainer`.
- R2 statt KV: R2 im Dashboard aktivieren, Binding in `wrangler.toml` einkommentieren (Code bevorzugt `BACKUP_BUCKET`).

### Smoke nach Deploy

```bash
curl -s https://hsk-trainer-eno.pages.dev/api/health
```

Erwartung: `{"ok":true,"storage":"kv",...}`

## Struktur

- `public/index.html` – App (HTML/CSS/JS)
- `public/hsk-data.json` – Wortdaten
- `public/kai.woff2` – eingebettete Kaiti-Schrift
- `public/icons/` – PWA-Icons
- `public/manifest.webmanifest` – Web-App-Manifest
- `public/sw.js` – Service Worker (`/api/*` wird nicht gecacht)
- `functions/` – Pages Functions (Backup-API)
- `wrangler.toml` – Pages + KV Binding
