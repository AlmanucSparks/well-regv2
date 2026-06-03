# Packaging MediReg as a Windows Desktop App (.exe)

MediReg is built as a standard React + TanStack web app that can be wrapped as
a desktop application using Electron. The web build is fully static after
`vite build`, so no Node server is needed at runtime — Electron just loads the
generated `dist/index.html`.

> All Supabase / cloud functionality continues to work from inside the
> Electron shell because it talks to the same HTTPS endpoints.

---

## 1. Prerequisites

- Node.js 20+ and `npm` (or `bun`)
- A Windows machine **OR** Wine on Linux/macOS for cross-compiling `.exe`
- These project files (already in repo):
  - `vite.config.ts` with `base: './'`
  - `electron/main.cjs`
  - `electron/preload.cjs` (optional)

> **Why `base: './'`?** Electron loads files via `file://`. Vite's default
> `base: '/'` produces absolute paths that 404 inside Electron, leaving a
> blank white window.

---

## 2. Install Electron tooling

```bash
npm install --save-dev electron @electron/packager
```

If you want a polished installer (`.exe` setup wizard) instead of a raw
folder, also install:

```bash
npm install --save-dev electron-builder
```

---

## 3. Add the Electron main process

Create **`electron/main.cjs`** (the `.cjs` extension is required because
`package.json` has `"type": "module"`):

```js
const { app, BrowserWindow } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "MediReg",
    icon: path.join(__dirname, "icon.ico"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
```

---

## 4. Update `package.json`

Add the Electron entry point and convenience scripts:

```json
{
  "main": "electron/main.cjs",
  "scripts": {
    "build:web": "vite build",
    "electron:dev": "npm run build:web && electron .",
    "electron:pack:win": "npm run build:web && electron-packager . MediReg --platform=win32 --arch=x64 --out=electron-release --overwrite --icon=electron/icon.ico",
    "electron:installer:win": "npm run build:web && electron-builder --win --x64"
  }
}
```

---

## 5. Build a raw `.exe` folder (no installer)

```bash
npm run electron:pack:win
```

Output: `electron-release/MediReg-win32-x64/MediReg.exe`. Zip and ship.

---

## 6. Build a Windows installer (`.exe` setup wizard)

Add an `electron-builder` block to `package.json`:

```json
{
  "build": {
    "appId": "app.medireg.desktop",
    "productName": "MediReg",
    "files": ["dist/**/*", "electron/**/*"],
    "directories": { "output": "electron-release" },
    "win": {
      "target": ["nsis"],
      "icon": "electron/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "perMachine": false,
      "allowToChangeInstallationDirectory": true
    }
  }
}
```

Then build:

```bash
npm run electron:installer:win
```

Output: `electron-release/MediReg Setup x.y.z.exe` (NSIS installer).

---

## 7. Code signing (recommended for production)

Unsigned Windows builds trigger SmartScreen warnings. Buy a code-signing
certificate (DigiCert, Sectigo, etc.), then add to the `build.win` block:

```json
"win": {
  "target": ["nsis"],
  "certificateFile": "cert.pfx",
  "certificatePassword": "${env.CSC_KEY_PASSWORD}"
}
```

Set `CSC_KEY_PASSWORD` as an env var at build time.

---

## 8. Environment variables in the desktop app

Vite inlines `VITE_*` env vars at build time. Make sure your `.env` has the
correct production Supabase URL/keys **before** running `npm run build:web`.

`process.env` server secrets (e.g. `PII_ENCRYPTION_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`) **never** ship to the desktop binary — those
remain server-only on the cloud deployment.

---

## 9. Common issues

| Symptom | Fix |
| --- | --- |
| Blank white window | Set `base: './'` in `vite.config.ts`, rebuild |
| `__dirname is not defined` | Use `.cjs` extension (not `.js`) for the main process file |
| Assets 404 in Electron | Re-run `vite build` after fixing `base` |
| Auto-logout fires immediately | Inactivity timer needs `localStorage`; ensure `nodeIntegration: false` and rely on web APIs only |
| Login redirect loop | Supabase auth uses `localStorage`; works in Electron by default |

---

## 10. Auto-update (optional)

Use `electron-updater` with `electron-builder` to ship signed delta updates
from a GitHub release or S3 bucket. See https://www.electron.build/auto-update.
