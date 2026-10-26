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
- [ ] Optional: reinstall Cloudflare GitHub App (error 8000011 blocks native Git connect)
