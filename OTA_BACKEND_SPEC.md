# OTA (Over-The-Air) Update System — Backend Technical Specification

## Overview

This document describes the complete OTA update system for the **Investor App** (React Native). The mobile app uses the `@zepto-labs/react-native-delta` native SDK which checks for JS bundle updates at runtime, downloads them, and applies them on the next cold start — without requiring a Play Store / App Store release.

The current POC uses a Next.js server with Vercel Blob storage. This document provides everything needed to build a production backend.

---

## Architecture

```
┌─────────────────────┐         ┌─────────────────────────┐
│   React Native App  │         │      Backend Server      │
│                     │         │                         │
│  Native Delta SDK   │────────▶│  GET /api/v1/check_update│
│  (com.delta.Delta)  │         │                         │
│                     │         │  Responds with bundle   │
│                     │◀────────│  download URL + hash    │
│                     │         │                         │
│  Downloads .zip     │────────▶│  Bundle Storage (S3/DB) │
│  from bundleUrl     │         │  (serves the zip file)  │
└─────────────────────┘         └─────────────────────────┘
```

---

## What the Mobile App Does (SDK Behavior)

The native Delta SDK (`com.delta.Delta`) is embedded in the Android/iOS app binary. Here's its lifecycle:

### On Every App Cold Start:
1. SDK reads its local `manifest.json` (baked into APK at build time):
   ```json
   {
     "appId": "investor-app-android",
     "appVersion": "5.2",
     "jsVersion": 1,
     "bundleVersion": 0,
     "hash": "8f9648c14170cd431fa9d05a0b54aab5"
   }
   ```
2. If a previously downloaded bundle exists locally, it uses that instead of the bundled one.
3. SDK calls the **check_update** endpoint.
4. If an update is available, SDK downloads the zip from `bundleUrl`.
5. SDK extracts `index.android.bundle` from the zip.
6. SDK computes **MD5 hash** of the extracted JS bundle file.
7. **If hash matches** the `hash` field from the API response → saves bundle locally.
8. **On the NEXT cold start**, the app loads the new JS bundle.

### SDK Configuration (Baked at Build Time via Gradle):
```groovy
// android/app/build.gradle
ext {
    DELTA_JS_VERSION = "1"                    // Increment when native code changes
    ANDROID_DELTA_ID = "investor-app-android" // Unique app identifier
    DELTA_SERVER_URL = "https://your-server.com" // Backend base URL
}
```

---

## CRITICAL API: GET /api/v1/check_update

This is the **only API the mobile app calls**. Everything else is for admin/management.

### Request

```
GET /api/v1/check_update?appId={appId}&jsVersion={jsVersion}&bundleVersion={bundleVersion}&bucket={bucket}&iu={iu}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `appId` | string | Yes | App identifier, e.g. `investor-app-android` or `investor-app-ios` |
| `jsVersion` | integer | Yes | JS version number (increments when native code changes requiring new binary) |
| `bundleVersion` | integer | Yes | Current bundle version on device (starts at 0, increments with each OTA update) |
| `bucket` | integer | Yes | Random number 1-100 assigned to device (used for gradual rollout) |
| `iu` | string | No | `"true"` if internal/beta user (sees STAGING releases too) |

### Response — No Update Available

```json
{
  "data": {
    "isUpdateAvailable": false
  }
}
```

### Response — Update Available

```json
{
  "data": {
    "isUpdateAvailable": true,
    "isMandatory": false,
    "hash": "fbd034dc6ba66152d7372f3185c7e5e1",
    "jsVersion": 1,
    "bundleVersion": 10,
    "patchUrl": null,
    "bundleUrl": "https://your-cdn.com/bundles/investor-app-android/v1-b10-bundle.zip"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `isUpdateAvailable` | boolean | Whether an update exists |
| `isMandatory` | boolean | If true, SDK forces update (user can't skip) |
| `hash` | string | **MD5 hash of the extracted JS bundle file** (NOT the zip!) |
| `jsVersion` | integer | JS version of the update |
| `bundleVersion` | integer | Bundle version of the update |
| `patchUrl` | string\|null | URL for delta/binary patch (optimization, can be null) |
| `bundleUrl` | string | **Direct download URL** for the bundle .zip file |

### Response — Rollback (Client's current version was disabled)

```json
{
  "data": {
    "isUpdateAvailable": false,
    "rollback": true
  }
}
```

### Business Logic for check_update:

```
1. Find all releases matching appId + jsVersion
2. If client's current bundleVersion is DISABLED/DELETED → return rollback
3. Filter releases where:
   - releaseState is LIVE (or STAGING if internal user)
   - bundleVersion > client's bundleVersion
   - bucket <= rollout percentage (for gradual rollout)
4. Return the LATEST eligible release (highest bundleVersion)
5. If patchUrl exists for client's current bundleVersion → include it (optimization)
```

---

## ⚠️ CRITICAL: Hash Computation

**The hash MUST be the MD5 of the EXTRACTED JS bundle, NOT the zip file.**

```
bundle.zip
  └── index.android.bundle    ← MD5 of THIS file = hash field in API

hash = MD5(contents of index.android.bundle)
hash ≠ MD5(bundle.zip)
```

If the hash doesn't match, the SDK silently discards the download and the update never applies.

---

## Bundle File Format

The bundle is a **ZIP file** containing:
```
bundle.zip
  └── index.android.bundle    (the JS bundle, ~2-8 MB compressed)
```

For iOS:
```
bundle.zip
  └── main.jsbundle
```

The zip may optionally contain asset folders, but the critical file is the JS bundle.

### How to Generate a Bundle:
```bash
npx react-native bundle \
  --platform android \
  --dev false \
  --entry-file index.js \
  --bundle-output ./output/index.android.bundle \
  --assets-dest ./output/assets

cd output && zip -r bundle.zip index.android.bundle && cd ..
```

---

## Data Model: Release

```sql
CREATE TABLE releases (
  id              UUID PRIMARY KEY,
  app_id          VARCHAR(100) NOT NULL,      -- "investor-app-android"
  platform        VARCHAR(10) NOT NULL,        -- "android" | "ios"
  js_version      INTEGER NOT NULL,            -- 1, 2, 3... (native version track)
  bundle_version  INTEGER NOT NULL,            -- 1, 2, 3... (OTA version, auto-increment)
  release_state   INTEGER NOT NULL DEFAULT 0,  -- See states below
  rollout         INTEGER NOT NULL DEFAULT 0,  -- 0-100 percentage
  hash            VARCHAR(32) NOT NULL,        -- MD5 of extracted JS bundle
  bundle_url      VARCHAR(500) NOT NULL,       -- CDN URL to download the .zip
  patch_url       VARCHAR(500),                -- Optional: delta patch URL
  patches         JSONB,                       -- Optional: {fromVersion: patchUrl} map
  is_mandatory    BOOLEAN DEFAULT FALSE,
  description     TEXT,
  app_version     VARCHAR(20),                 -- e.g. "5.2" (min native app version)
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(app_id, js_version, bundle_version)
);
```

### Release States:
| State | Value | Description |
|-------|-------|-------------|
| CREATED | 0 | Uploaded but not yet released |
| STAGING | 10 | Available to internal/beta users only |
| LIVE | 20 | Available to all users (subject to rollout %) |
| HALTED | 25 | Temporarily paused (no new downloads) |
| DISABLED | 30 | Disabled — triggers rollback on devices that have it |
| DELETED | 40 | Permanently removed |

### Valid State Transitions:
```
CREATED  → STAGING, DELETED
STAGING  → LIVE, DISABLED, DELETED
LIVE     → HALTED, DISABLED, DELETED
HALTED   → LIVE, DISABLED, DELETED
DISABLED → DELETED
```

---

## Bundle Storage Options (Production)

The `bundleUrl` must be a **publicly accessible direct download URL**. Options:

| Option | Pros | Cons |
|--------|------|------|
| **AWS S3 + CloudFront** | Fast CDN, scalable, cost-effective | Setup needed |
| **Azure Blob Storage** | Good if already on Azure | - |
| **Database (BLOB column)** | Simple, no external service | Not recommended for files >1MB; no CDN |
| **Signed URL from S3** | More secure | URL expires, complicates caching |

**Recommended:** S3 bucket with CloudFront CDN. Upload zip to S3, serve via CloudFront URL.

If storing in database: you'll need a **download endpoint** like `GET /api/bundles/:id/download` that streams the binary — this becomes your `bundleUrl`.

---

## Admin/Management APIs (Optional, for Dashboard)

These are NOT called by the mobile app. They're for your release management dashboard/CI pipeline.

### POST /api/upload
Upload a bundle and create a release in one step.

### POST /api/releases
Create a release entry (when bundle is already hosted elsewhere).

### POST /api/releases/update
Change release state (STAGING → LIVE) or update rollout percentage.

### POST /api/rollback
Disable the current live release (triggers rollback on devices).

### GET /api/releases
List all releases with optional filters.

### GET /api/history
Audit log of all release actions.

### POST /api/analytics
Receive events from the mobile app (update checks, downloads, errors).

---

## Gradual Rollout

The `bucket` parameter (1-100) is a random number assigned to each device installation. The release's `rollout` field (0-100) controls what percentage of users get the update.

```
If device.bucket <= release.rollout → eligible for update
If device.bucket > release.rollout → not eligible yet
```

Example rollout strategy:
1. Create release → state=STAGING, rollout=100 (all internal testers)
2. Promote → state=LIVE, rollout=5 (5% of users)
3. Monitor for crashes
4. Increase → rollout=25, then 50, then 100

---

## Versioning Strategy

### jsVersion (Native Version Track)
- Increment when native code changes (new native module, RN version upgrade, etc.)
- All OTA updates are scoped to a jsVersion
- A device on jsVersion=1 will NEVER receive an update for jsVersion=2

### bundleVersion (OTA Update Number)
- Auto-incrementing within a jsVersion
- Each new OTA upload gets the next bundleVersion
- Device always gets the LATEST bundleVersion > its current

### appVersion (Minimum Native Version)
- Optional field to restrict OTA updates to specific native app versions
- e.g., "5.2" means only native app v5.2+ gets this update

---

## Security Considerations for Production

1. **Hash verification** — SDK verifies MD5 of downloaded bundle (already handled)
2. **HTTPS** — bundleUrl must be HTTPS
3. **API authentication** — Consider adding an API key or JWT for the check_update endpoint
4. **Bundle signing** — For extra security, sign bundles and verify signature on device
5. **Rate limiting** — The SDK checks every 5 minutes on foreground; rate limit per device
6. **Audit trail** — Log every state change, rollout change, and rollback

---

## Summary: What Backend Team Needs to Build

### Minimum Viable (for production):

1. **One GET endpoint**: `/api/v1/check_update` with the exact request/response format above
2. **Bundle storage**: S3 or equivalent with CDN for fast downloads
3. **Database table**: `releases` table as described above
4. **Upload mechanism**: API or admin tool to upload bundles and create release entries
5. **Hash computation**: MD5 of the extracted JS bundle (not the zip)

### Nice to Have:
- Release management dashboard
- Gradual rollout controls
- Rollback mechanism
- Analytics ingestion
- Delta/binary patching (smaller downloads)
- Multi-platform support (same server for Android + iOS)

---

## Current POC Implementation Reference

- **Server**: Next.js on Vercel (https://investor-app-ota-server.vercel.app)
- **Storage**: Vercel Blob (CDN for bundles, JSON for releases data)
- **Source code**: `/Users/ajaybendre/Projects/investor-app-ota-server/`
- **Key file**: `src/app/api/v1/check_update/route.ts` — the core endpoint logic
- **Mobile SDK config**: `android/app/build.gradle` → `DELTA_SERVER_URL`, `DELTA_JS_VERSION`, `ANDROID_DELTA_ID`
