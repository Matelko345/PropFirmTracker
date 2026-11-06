# PropFirm Tracker

Track prop firm **evals**, **payouts**, and **net profit** in a dark desktop app — with FX conversion from the **exact date** of each transaction.

## Download

Installers: **[GitHub Releases](https://github.com/Matelko345/PropFirmTracker/releases)**

| Platform | File |
|----------|------|
| **macOS** (Apple Silicon) | `PropFirm Tracker-1.2.0-arm64.dmg` |
| **Windows** (x64) | `PropFirm Tracker Setup 1.2.0.exe` |

### macOS
1. Open the `.dmg` → drag to **Applications**
2. First launch: right‑click → **Open** (unsigned build)

### Windows
1. Run the installer
2. If SmartScreen appears: **More info** → **Run anyway**

### Updates
- **Auto-update is ON by default** (⚙ Settings → can disable)
- Or click **Check for updates** / **Install and restart**
- Updates replace the app only — **your local data is kept** (same `appId` + `userData`)

---

## Features

- Evals & payouts per firm, ROI, net profit chart, custom checklist  
- Link payouts to a passed account  
- FX on transaction day (USD → PLN / EUR / GBP / …)  
- Polish / English  
- Export / import JSON  
- Data stays on device (`localStorage` in app userData)

Published source uses an **empty** seed (`src/seed.js`) — no personal trades in the repo.

---

## Develop

```bash
npm install
npm run dev          # browser
npm run dev:app      # Electron window
```

### Build installers

```bash
npm run build:mac    # → release/*.dmg (+ latest-mac.yml for updates)
npm run build:win    # → release/*Setup*.exe (+ latest.yml)
npm run build:app    # both
```

After building, upload the installer **and** the generated `latest*.yml` / `.blockmap` files to a GitHub Release tagged as the version (e.g. `v1.2.0`) so in-app updates work.

---

## Privacy

- Runtime data: app **userData** / localStorage  
- Uninstall on Windows does **not** delete app data by default  
- Export JSON anytime as a backup  

---

## License

Personal / educational use.
