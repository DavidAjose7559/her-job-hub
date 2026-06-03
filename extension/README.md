# Her Job Hub Chrome Extension

Auto-fill job applications with your saved profile from the Her Job Hub web app.

## Features

- Reads your saved profile from the Her Job Hub web app
- Detects form fields on LinkedIn, Indeed, Greenhouse, Lever, and Workday
- Auto-fills name, email, phone, location, LinkedIn, portfolio, cover letter, and resume fields
- Simple one-click popup UI

## Install Instructions

### Step 1 — Build or use the source directly

No build step needed. The extension runs as-is from the `/extension` folder.

### Step 2 — Load in Chrome

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `/extension` folder from this project

The extension icon will appear in your toolbar.

### Step 3 — Add icons (optional)

The manifest references icon files at `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`.  
You can add your own icons there, or remove the `"icons"` field from `manifest.json` to use Chrome's default.

### Step 4 — Connect to your web app

1. Open the Her Job Hub web app at `http://localhost:5173` (dev) or your Vercel URL
2. Complete your Profile and click **Save Profile**
3. The extension automatically syncs your profile data in the background

> **Deployed app:** If you deploy to Vercel, open `popup.js` and update the `APP_URL` constant to your Vercel URL. Also add your Vercel domain to `host_permissions` in `manifest.json`.

## Usage

1. Navigate to a job application page (LinkedIn Easy Apply, Greenhouse, Indeed, etc.)
2. Click the Her Job Hub icon in the Chrome toolbar
3. Click **Auto-fill this page**
4. The extension fills detected fields instantly

## Supported Sites

| Site | Support Level |
|------|--------------|
| LinkedIn Easy Apply | ✅ Name, email, phone, cover letter |
| Indeed | ✅ Name, email, phone |
| Greenhouse | ✅ All standard fields |
| Lever | ✅ All standard fields |
| Workday | ⚠️ Partial (shadow DOM limits full auto-fill) |

## Privacy

All data stays local. Your profile is stored in `chrome.storage.local` — never sent to any server.
