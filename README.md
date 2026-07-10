# Investor App OTA Server

A **zero-cost** Delta OTA update server for the Investor App (React Native). Replaces the AWS-based `zepto-labs/delta-server` with a lightweight free stack.

## Architecture

| Component | Technology | Cost |
|-----------|-----------|------|
| Backend | Next.js 15 (App Router) | Free |
| Database | JSON files on disk | Free |
| Storage | Google Drive (15GB free) | Free |
| Hosting | Vercel free tier / localhost | Free |
| Admin UI | Next.js + Tailwind CSS v4 | Free |
| OTA SDK | `@zepto-labs/react-native-delta` | Free |

## Quick Start

```bash
cd /Users/ajaybendre/Projects/investor-app-ota-server

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev
```

Server runs at **http://localhost:3000**

- Admin Dashboard: http://localhost:3000/admin
- API: http://localhost:3000/api/v1/check_update

## Project Structure

```
investor-app-ota-server/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── v1/check_update/route.ts   ← Delta SDK endpoint
│   │   │   ├── releases/route.ts           ← CRUD releases
│   │   │   ├── releases/update/route.ts    ← Update release state
│   │   │   ├── registry/route.ts           ← App registry
│   │   │   ├── upload/route.ts             ← File upload to Drive
│   │   │   ├── rollback/route.ts           ← Trigger rollback
│   │   │   ├── analytics/route.ts          ← Event logging
│   │   │   └── history/route.ts            ← Audit log
│   │   ├── admin/
│   │   │   ├── page.tsx                    ← Dashboard overview
│   │   │   ├── releases/page.tsx           ← Manage releases
│   │   │   ├── upload/page.tsx             ← Upload new bundle
│   │   │   ├── analytics/page.tsx          ← View analytics
│   │   │   ├── history/page.tsx            ← Audit log
│   │   │   └── registry/page.tsx           ← Manage apps
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── lib/
│   │   ├── db.ts                           ← JSON file read/write
│   │   ├── drive.ts                        ← Google Drive API
│   │   ├── types.ts                        ← TypeScript interfaces
│   │   ├── validation.ts                   ← Input validation
│   │   └── constants.ts                    ← Release states, transitions
│   └── components/
│       ├── Sidebar.tsx
│       ├── StatCard.tsx
│       └── ReleaseBadge.tsx
├── data/
│   ├── releases.json                       ← All OTA releases
│   ├── registry.json                       ← Registered apps
│   ├── analytics.json                      ← Event logs
│   └── history.json                        ← Audit trail
├── scripts/
│   ├── release.ts                          ← Full release automation
│   ├── rollback.ts                         ← Rollback a release
│   ├── promote.ts                          ← Promote release state
│   ├── generate-patch.ts                   ← Binary diff generation
│   └── upload-drive.ts                     ← Upload to Google Drive
├── bundles/                                ← Local bundle storage (gitignored)
├── package.json
├── tsconfig.json
├── next.config.ts
└── postcss.config.mjs
```

## Google Drive Setup

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (e.g., "Investor App OTA")
3. Enable the **Google Drive API**

### Step 2: Create a Service Account

1. Go to **IAM & Admin → Service Accounts**
2. Click **Create Service Account**
3. Name: `ota-drive-uploader`
4. Click **Create and Continue**
5. Skip role assignment (not needed for Drive)
6. Click **Done**
7. Click on the service account → **Keys** tab → **Add Key → Create new key → JSON**
8. Download the JSON file

### Step 3: Get Credentials

From the downloaded JSON file, extract:
- `client_email` → put in `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `private_key` → put in `GOOGLE_PRIVATE_KEY`

### Step 4: Create a Shared Folder

1. Go to [Google Drive](https://drive.google.com)
2. Create a folder: `InvestorApp-OTA`
3. Right-click → **Share** → paste the service account email with **Editor** access
4. Copy the folder ID from the URL: `https://drive.google.com/drive/folders/{FOLDER_ID}`
5. Put the folder ID in `GOOGLE_DRIVE_FOLDER_ID`

### Step 5: Update .env

```env
GOOGLE_DRIVE_FOLDER_ID=your_folder_id_here
GOOGLE_SERVICE_ACCOUNT_EMAIL=ota-drive-uploader@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
```

## API Reference

### `GET /api/v1/check_update` (SDK Endpoint)

Called automatically by the `@zepto-labs/react-native-delta` SDK.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `appId` | string | ✅ | App identifier (e.g., `investor-app-android`) |
| `jsVersion` | number | ✅ | Current JS version on device |
| `bundleVersion` | number | ✅ | Current bundle version on device |
| `bucket` | number | ✅ | Rollout bucket (0-100) |
| `iu` | boolean | ❌ | Internal user flag |

**Response:**

```json
// No update
{ "isUpdateAvailable": false }

// Rollback (current version disabled)
{ "rollback": true }

// Update available
{
  "isUpdateAvailable": true,
  "isMandatory": false,
  "hash": "md5-hash",
  "jsVersion": 1,
  "bundleVersion": 2,
  "releaseState": 20,
  "patchUrl": "https://drive.google.com/uc?export=download&id=...",
  "bundleUrl": "https://drive.google.com/uc?export=download&id=..."
}
```

### `GET /api/releases`

List releases with optional filters: `?appId=...&jsVersion=...&releaseState=...`

### `POST /api/releases`

Create a new release.

```json
{
  "appId": "investor-app-android",
  "platform": "android",
  "jsVersion": 1,
  "bundleVersion": 2,
  "hash": "abc123",
  "bundleUrl": "https://drive.google.com/uc?export=download&id=FILE_ID",
  "patchUrl": "https://drive.google.com/uc?export=download&id=PATCH_ID",
  "patches": { "1": "https://..." },
  "description": "Fixed login bug",
  "isMandatory": false,
  "appVersion": "1.3"
}
```

### `POST /api/releases/update`

Update release state or rollout.

```json
{
  "appId": "investor-app-android",
  "jsVersion": 1,
  "bundleVersion": 2,
  "releaseState": 20,
  "rollout": 50
}
```

### `POST /api/rollback`

Disable a release (triggers SDK rollback).

```json
{
  "appId": "investor-app-android",
  "jsVersion": 1,
  "bundleVersion": 2
}
```

### `POST /api/upload`

Upload a file to Google Drive. Use multipart/form-data with field `file`.

### `POST /api/analytics`

Log an analytics event.

```json
{
  "appId": "investor-app-android",
  "event": "UPDATE_INSTALLED",
  "jsVersion": 1,
  "bundleVersion": 2,
  "metadata": {}
}
```

### `GET /api/history`

Get the release audit log.

## Release Lifecycle

```
CREATED (0)
    │
    ├──→ STAGING (10)      ← Internal testers only
    │        │
    │        ├──→ LIVE (20)      ← All users (subject to rollout %)
    │        │        │
    │        │        ├──→ HALTED (25)    ← Temporarily paused
    │        │        │        │
    │        │        │        └──→ LIVE (resume)
    │        │        │
    │        │        └──→ DISABLED (30)  ← Triggers rollback on clients
    │        │                    │
    │        └──→ DISABLED        └──→ DELETED (40)  ← Terminal
    │
    └──→ DISABLED
```

## CLI Scripts

### Create a Release

```bash
npm run release -- --platform android --js-version 1 --description "Bug fix" --app-version 1.3
```

This will:
1. Run `react-native bundle` to generate the JS bundle
2. Compute MD5 hash
3. Generate bsdiff patch (if previous bundle exists in `./bundles/`)
4. Upload to Google Drive
5. Create the release via POST /api/releases

### Promote a Release

```bash
# Promote to staging
npm run promote -- --app-id investor-app-android --js-version 1 --bundle-version 2 --state staging

# Go live with 50% rollout
npm run promote -- --app-id investor-app-android --js-version 1 --bundle-version 2 --state live --rollout 50

# Full rollout
npm run promote -- --app-id investor-app-android --js-version 1 --bundle-version 2 --rollout 100
```

### Rollback

```bash
npm run rollback -- --app-id investor-app-android --js-version 1 --bundle-version 2
```

### Generate Patch Manually

```bash
npm run generate-patch -- --old bundles/bundle-v1.zip --new bundles/bundle-v2.zip --output bundles/patch-01-02.bin
```

### Upload to Google Drive

```bash
npm run upload -- --file bundles/bundle-v2.zip --folder android/js-v1
```

## Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables
vercel env add GOOGLE_DRIVE_FOLDER_ID
vercel env add GOOGLE_SERVICE_ACCOUNT_EMAIL
vercel env add GOOGLE_PRIVATE_KEY
vercel env add NEXT_PUBLIC_SERVER_URL
```

**Note on Vercel:** JSON file writes will only work in `/tmp` on Vercel (read-only filesystem). For a true PoC, run locally or on a VPS. The read endpoints (check_update) work fine on Vercel since the JSON files are bundled at build time.

## Testing

### Verify the check_update endpoint:

```bash
# Should return no update (bundleVersion 99 doesn't exist)
curl "http://localhost:3000/api/v1/check_update?appId=investor-app-android&jsVersion=1&bundleVersion=99&bucket=50"

# Should return update available (bundleVersion 0 is behind)
curl "http://localhost:3000/api/v1/check_update?appId=investor-app-android&jsVersion=1&bundleVersion=0&bucket=50"

# Internal user (sees staging releases)
curl "http://localhost:3000/api/v1/check_update?appId=investor-app-android&jsVersion=1&bundleVersion=0&bucket=50&iu=true"
```

### Create a test release via API:

```bash
curl -X POST http://localhost:3000/api/releases \
  -H "Content-Type: application/json" \
  -d '{
    "appId": "investor-app-android",
    "platform": "android",
    "jsVersion": 1,
    "bundleVersion": 2,
    "hash": "test-hash-123",
    "bundleUrl": "https://example.com/bundle.zip",
    "description": "Test release",
    "isMandatory": false
  }'
```

### Promote to live:

```bash
curl -X POST http://localhost:3000/api/releases/update \
  -H "Content-Type: application/json" \
  -d '{
    "appId": "investor-app-android",
    "jsVersion": 1,
    "bundleVersion": 2,
    "releaseState": 20,
    "rollout": 100
  }'
```

## Connecting to the React Native App

The Delta SDK in the investor-app points to this server via the `DeltaServerUrl` configuration:

- **Android** (`android/app/build.gradle`): `DELTA_SERVER_URL = "http://10.0.2.2:3000"` (emulator) or your Vercel URL
- **iOS** (`ios/Info.plist`): `DeltaServerUrl = "http://localhost:3000"` (simulator) or your Vercel URL

See the integration guide at `/Users/ajaybendre/Projects/investor-app/ota/INTEGRATION_GUIDE.md` for full setup instructions.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `ENOENT: data/releases.json` | Make sure `data/` folder exists with all JSON files |
| Google Drive upload fails | Check service account email has Editor access to the folder |
| SDK not finding updates | Verify `appId` matches between app config and releases.json |
| Rollout not working | `bucket` value (0-100) must be ≤ release `rollout` percentage |
| CORS errors | Add origin to next.config.ts headers if needed |
| Vercel writes fail | JSON writes need writable filesystem; use localhost or VPS |

## License

Private - Internal use only.
