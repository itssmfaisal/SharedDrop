# SharedDrop — Local Network File Sharing

A Next.js web app that turns your machine into a local file server with a polished UI. Files are stored in `./shared_files/` and any device on your LAN can upload, download, and manage them via browser.

## Quick Start

```bash
npm install
npm run dev        # dev mode, binds to 0.0.0.0:3000
# OR
npm run build && npm start   # production
```

Then open `http://<your-local-ip>:3000` from any device on the network.

## Features

| Feature | Details |
|---|---|
| 📁 Auto-create folder | `shared_files/` created automatically |
| ⬆️ Upload | Drag & drop or click, up to 500MB, real progress bar |
| ⬇️ Download | One-click streaming download |
| 👁️ Preview | In-browser image, video, and audio preview |
| 📂 Folders | Create subfolders, breadcrumb navigation |
| ✏️ Rename | Rename any file or folder |
| 🗑️ Delete | Single or bulk delete with confirmation |
| 🔍 Search & Sort | Filter by name, sort by name/size/date |
| 📱 QR Code | Scan to connect from phone (tap 📱 in header) |
| 🔐 PIN Protection | Set `SHAREDDROP_PIN` env var to enable |

## PIN Protection

```bash
SHAREDDROP_PIN=1234 npm start
```

Devices must enter the PIN once per day. If the env var is unset, no auth is required.

## Find Your Local IP

```bash
# macOS / Linux
ifconfig | grep "inet " | grep -v 127.0.0.1

# Windows
ipconfig
```

## Project Structure

```
fileshare/
├── pages/
│   ├── index.tsx          ← Full UI
│   └── api/
│       ├── files.ts       ← List files (subfolder support)
│       ├── upload.ts      ← Upload handler
│       ├── download.ts    ← Stream downloads
│       ├── delete.ts      ← Delete files/folders
│       ├── rename.ts      ← Rename files/folders
│       ├── mkdir.ts       ← Create folders
│       ├── serverinfo.ts  ← Returns local IP for QR
│       └── auth.ts        ← PIN authentication
├── lib/files.ts           ← Shared utilities
├── shared_files/          ← Auto-created storage
└── package.json
```
# SharedDrop
