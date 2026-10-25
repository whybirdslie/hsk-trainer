# HSK Zeichentrainer

Statische Lern-App für HSK-Zeichen (HSK 3.0). Offline-fähige PWA, ohne Build-Schritt und ohne externe Requests.

Live: https://hsk-trainer-eno.pages.dev

## Lokal starten

```bash
cd public && python3 -m http.server 8080
```

Dann im Browser: http://localhost:8080

Unter Windows mit PowerShell:

```powershell
cd public; py -3 -m http.server 8080
```

## Deploy (Cloudflare Pages)

Projekt: `hsk-trainer`  
Account: Cloudflare (Pages)  
Build-Befehl: leer  
Ausgabeverzeichnis: `public`  
Production branch: `main`

### Push-Deploy (GitHub Actions)

Jeder Push auf `main` deployt über `.github/workflows/deploy-pages.yml`.

Einmalig GitHub Secret setzen:

1. API Token erstellen: https://dash.cloudflare.com/profile/api-tokens  
   Permission: Account → Cloudflare Pages → Edit
2. In GitHub: Repo → Settings → Secrets and variables → Actions  
   Secret-Name: `CLOUDFLARE_API_TOKEN`

### Native Git-Integration (optional)

Die Cloudflare GitHub App auf diesem Account meldet aktuell Fehler `8000011`. Zum Reparieren:

1. https://github.com/settings/installations → Cloudflare Workers and Pages deinstallieren
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git → GitHub neu autorisieren
3. Repo `whybirdslie/hsk-trainer` verbinden, Output-Dir `public`, Build-Befehl leer

Danach kann die Actions-Pipeline entfallen.

## Struktur

- `public/index.html` – App (HTML/CSS/JS)
- `public/hsk-data.json` – Wortdaten
- `public/kai.woff2` – eingebettete Kaiti-Schrift
- `public/icons/` – PWA-Icons
- `public/manifest.webmanifest` – Web-App-Manifest
- `public/sw.js` – Service Worker (Offline-Cache)
- `public/_headers` – Cache-Control für Cloudflare Pages
