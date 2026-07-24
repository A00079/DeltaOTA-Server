# OTA (Over-The-Air) Update System — Complete Backend Documentation

> **Author:** Ajay Bendre  
> **Last Updated:** July 2026  
> **Status:** POC Complete — Ready for Production Migration  
> **Target Audience:** Backend Team  

---

## Table of Contents

1. [What This System Does](#1-what-this-system-does)
2. [Architecture Overview](#2-architecture-overview)
3. [Tech Stack (Current POC)](#3-tech-stack-current-poc)
4. [Project Structure](#4-project-structure)
5. [How the Mobile App Works (SDK Behavior)](#5-how-the-mobile-app-works-sdk-behavior)
6. [The Core API: check_update — Complete Deep Dive](#6-the-core-api-check_update--complete-deep-dive)
7. [Hash Generation — The Most Critical Part](#7-hash-generation--the-most-critical-part)
8. [Bundle Storage — Where & How Bundles Are Stored](#8-bundle-storage--where--how-bundles-are-stored)
9. [Data Model & Storage Layer](#9-data-model--storage-layer)
10. [Release Lifecycle (State Machine)](#10-release-lifecycle-state-machine)
11. [All API Endpoints — Complete Reference](#11-all-api-endpoints--complete-reference)
12. [CLI Scripts — Release Management Tools](#12-cli-scripts--release-management-tools)
13. [Gradual Rollout System](#13-gradual-rollout-system)
14. [Versioning Strategy Explained](#14-versioning-strategy-explained)
15. [Environment Configuration](#15-environment-configuration)
16. [Deployment (Vercel)](#16-deployment-vercel)
17. [End-to-End Flow — Step by Step](#17-end-to-end-flow--step-by-step)
18. [Migrating to Your Own Infrastructure](#18-migrating-to-your-own-infrastructure)
19. [Security Considerations](#19-security-considerations)
20. [Troubleshooting & Common Pitfalls](#20-troubleshooting--common-pitfalls)

---

## 1. What This System Does

This is a custom OTA (Over-The-Air) update system for the **Investor App** (React Native). It allows pushing JavaScript bundle updates directly to users' devices WITHOUT going through Play Store / App Store.

The mobile app uses the `@zepto-labs/react-native-delta` native SDK which:
- Checks for new JS bundle updates at runtime
- Downloads them in the background
- Applies them on the next cold start

**Think of it like:** CodePush (now dead) or Expo Updates, but self-hosted with full control.

---

## 2. Architecture Overview

```
┌──────────────────────────────┐           ┌───────────────────────────────────────┐
│       MOBILE APP             │           │         BACKEND SERVER                │
│   (React Native + SDK)       │           │      (This Next.js Project)           │
│                              │           │                                       │
│  ┌────────────────────────┐  │           │  ┌─────────────────────────────────┐  │
│  │ Native Delta SDK       │  │  HTTP     │  │  GET /api/v1/check_update       │  │
│  │ (com.delta.Delta)      │──│──────────▶│  │  (Core endpoint)                │  │
│  │                        │  │           │  │                                 │  │
│  │ - Sends: appId,        │  │           │  │  Returns: bundleUrl, hash,      │  │
│  │   jsVersion,           │  │           │  │   bundleVersion, isMandatory    │  │
│  │   bundleVersion,       │  │◀──────────│  │                                 │  │
│  │   bucket               │  │  JSON     │  └─────────────────────────────────┘  │
│  │                        │  │           │                                       │
│  │ - Downloads .zip from  │  │           │  ┌─────────────────────────────────┐  │
│  │   bundleUrl            │──│──────────▶│  │  BUNDLE STORAGE                 │  │
│  │                        │  │  GET zip  │  │  (Vercel Blob / CDN)            │  │
│  │ - Extracts JS bundle   │  │           │  │                                 │  │
│  │ - Verifies MD5 hash    │  │           │  │  Stores: .zip files containing  │  │
│  │ - Saves locally        │  │           │  │  the JS bundles                 │  │
│  └────────────────────────┘  │           │  └─────────────────────────────────┘  │
│                              │           │                                       │
│  ON NEXT COLD START:         │           │  ┌─────────────────────────────────┐  │
│  App loads new JS bundle     │           │  │  DATA STORAGE                   │  │
│                              │           │  │  (Vercel Blob JSON files)        │  │
│                              │           │  │                                 │  │
│                              │           │  │  - releases.json                │  │
│                              │           │  │  - history.json                 │  │
│                              │           │  │  - registry.json                │  │
│                              │           │  │  - analytics.json               │  │
│                              │           │  └─────────────────────────────────┘  │
└──────────────────────────────┘           └───────────────────────────────────────┘
```

**Key principle:** The mobile SDK only calls ONE endpoint (`/api/v1/check_update`). Everything else is admin/management APIs.

---

## 3. Tech Stack (Current POC)

| Component | Technology | Notes |
|-----------|-----------|-------|
| **Server Framework** | Next.js 15 (App Router) | API routes in `src/app/api/` |
| **Language** | TypeScript | Strict typing throughout |
| **Hosting** | Vercel | Serverless functions, auto-scaling |
| **Bundle Storage** | Vercel Blob | CDN-backed, public URLs for download |
| **Data Storage** | Vercel Blob (JSON files) | Simple key-value JSON storage |
| **Local Dev Data** | File system (`data/` folder) | JSON files for development |
| **CLI Scripts** | tsx (TypeScript executor) | For release management |
| **Build** | Next.js built-in | `npm run build` |

### Dependencies (package.json)

```json
{
  "dependencies": {
    "@vercel/blob": "^0.27.0",     // Blob storage for bundles + data
    "next": "^15.0.0",             // Server framework
    "react": "^19.0.0",            // Admin UI
    "tailwindcss": "^4.0.0"        // Admin UI styling
  },
  "devDependencies": {
    "bsdiff-node": "^2.5.0",       // Binary diff for patch generation
    "commander": "^12.0.0",        // CLI argument parsing
    "tsx": "^4.19.0"               // TypeScript script runner
  }
}
```

---

## 4. Project Structure

```
investor-app-ota-server/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── v1/
│   │   │   │   └── check_update/
│   │   │   │       └── route.ts        ← THE CORE ENDPOINT (what the app calls)
│   │   │   ├── upload/
│   │   │   │   └── route.ts            ← Upload bundle + create release
│   │   │   ├── releases/
│   │   │   │   ├── route.ts            ← List/create releases
│   │   │   │   └── update/
│   │   │   │       └── route.ts        ← Update release state/rollout
│   │   │   ├── rollback/
│   │   │   │   └── route.ts            ← Disable live release (trigger rollback)
│   │   │   ├── history/
│   │   │   │   └── route.ts            ← Audit log
│   │   │   ├── analytics/
│   │   │   │   └── route.ts            ← Event tracking
│   │   │   └── registry/
│   │   │       └── route.ts            ← App registration
│   │   └── admin/                       ← Admin dashboard pages (UI)
│   ├── lib/
│   │   ├── blob-db.ts                   ← Vercel Blob storage layer (PRODUCTION)
│   │   ├── db.ts                        ← Local file system storage (DEV ONLY)
│   │   ├── types.ts                     ← TypeScript interfaces & enums
│   │   ├── constants.ts                 ← Release state machine & transitions
│   │   └── validation.ts               ← Input validation functions
│   ├── types/
│   │   └── bsdiff-node.d.ts            ← Type declarations for bsdiff
│   └── components/                      ← Admin UI components
├── scripts/
│   ├── release.ts                       ← Full release automation script
│   ├── promote.ts                       ← State transition CLI
│   ├── rollback.ts                      ← Rollback CLI
│   ├── generate-patch.ts               ← Binary diff patch generator
│   ├── upload-drive.ts                  ← Upload to server CLI
│   └── upload-bundle.sh                 ← Quick shell script for uploads
├── data/                                ← LOCAL dev data (not used in production)
│   ├── releases.json
│   ├── history.json
│   ├── registry.json
│   └── analytics.json
├── bundles/                             ← LOCAL bundle files (for reference/testing)
├── vercel.json                          ← Vercel deployment config
├── .env.example                         ← Environment variables template
├── package.json
└── tsconfig.json
```

---

## 5. How the Mobile App Works (SDK Behavior)

The native Delta SDK (`com.delta.Delta`) is embedded in the Android/iOS app binary. You DON'T need to change anything about the SDK — it's already configured. But you need to understand what it does to ensure the backend works correctly.

### SDK Configuration (Already Baked in at Build Time)

```groovy
// android/app/build.gradle
ext {
    DELTA_JS_VERSION = "1"                    // Current native version track
    ANDROID_DELTA_ID = "investor-app-android" // App identifier sent to backend
    DELTA_SERVER_URL = "https://your-server.com" // Backend base URL
}
```

### On Every App Cold Start — SDK Lifecycle:

```
1. App launches
2. SDK reads its local manifest.json (baked into APK):
   {
     "appId": "investor-app-android",
     "appVersion": "5.2",
     "jsVersion": 1,
     "bundleVersion": 0,       ← starts at 0 (no OTA update applied yet)
     "hash": "8f9648c14170cd431fa9d05a0b54aab5"
   }

3. If a previously downloaded OTA bundle exists locally → SDK loads THAT instead of the bundled one

4. SDK calls: GET /api/v1/check_update?appId=investor-app-android&jsVersion=1&bundleVersion=0&bucket=42

5. If response says isUpdateAvailable: true:
   a. SDK downloads the .zip from bundleUrl
   b. SDK extracts "index.android.bundle" from inside the zip
   c. SDK computes MD5 hash of the EXTRACTED file
   d. If hash matches the "hash" field from API → saves bundle locally
   e. If hash DOESN'T match → SILENTLY DISCARDS the download (no error shown to user)

6. ON THE NEXT COLD START (not this one!):
   - App loads the newly downloaded bundle
   - bundleVersion increments in local state
   - Next check_update call will use the new bundleVersion
```

### Important SDK Behaviors:
- **Hash mismatch = silent failure** — The SDK will NOT apply an update if hash doesn't match
- **Update applies on NEXT cold start** — Not immediately
- **SDK checks every ~5 minutes while app is foregrounded**
- **bucket is randomly assigned once per device install** (1-100)
- **Rollback:** If server returns `rollback: true`, SDK deletes the local OTA bundle and reverts to the original bundled JS

---

## 6. The Core API: check_update — Complete Deep Dive

**File:** `src/app/api/v1/check_update/route.ts`

This is the ONLY API the mobile app calls. If this endpoint works correctly, the entire OTA system works.

### Request

```
GET /api/v1/check_update?appId={appId}&jsVersion={jsVersion}&bundleVersion={bundleVersion}&bucket={bucket}&iu={iu}
```

| Parameter | Type | Required | Example | Description |
|-----------|------|----------|---------|-------------|
| `appId` | string | ✅ | `investor-app-android` | Unique app identifier |
| `jsVersion` | integer | ✅ | `1` | Native version track number |
| `bundleVersion` | integer | ✅ | `0` | Current OTA version on device (0 = no OTA applied) |
| `bucket` | integer | ✅ | `42` | Random 1-100 (for gradual rollout) |
| `iu` | string | ❌ | `"true"` | Internal user flag (sees STAGING releases) |

### Response Scenarios

**Scenario 1: No Update Available**
```json
{
  "data": {
    "isUpdateAvailable": false
  }
}
```

**Scenario 2: Update Available**
```json
{
  "data": {
    "isUpdateAvailable": true,
    "isMandatory": false,
    "hash": "fbd034dc6ba66152d7372f3185c7e5e1",
    "jsVersion": 1,
    "bundleVersion": 6,
    "patchUrl": null,
    "bundleUrl": "https://abcdef.public.blob.vercel-storage.com/ota-bundles/investor-app-android/v1-b6-bundle-ota.zip"
  }
}
```

**Scenario 3: Rollback (Client's current version was disabled)**
```json
{
  "data": {
    "isUpdateAvailable": false,
    "rollback": true
  }
}
```

### The Actual Logic (Pseudocode)

```
function check_update(appId, jsVersion, bundleVersion, bucket, isInternalUser):

    // Step 1: Get all releases from storage
    releases = readBlobJSON("releases.json")

    // Step 2: Filter to matching app + JS version
    appReleases = releases.filter(r => r.appId == appId AND r.jsVersion == jsVersion)

    // Step 3: If no releases exist for this app → no update
    if appReleases is empty:
        return { isUpdateAvailable: false }

    // Step 4: Check if client's CURRENT version is disabled (rollback scenario)
    clientRelease = appReleases.find(r => r.bundleVersion == bundleVersion)
    if clientRelease AND (clientRelease.state == DISABLED OR clientRelease.state == DELETED):
        return { isUpdateAvailable: false, rollback: true }

    // Step 5: Determine which states are visible to this user
    if isInternalUser:
        visibleStates = [STAGING, LIVE]
    else:
        visibleStates = [LIVE]

    // Step 6: Filter eligible releases
    eligibleReleases = appReleases.filter(r =>
        r.releaseState in visibleStates           // Must be visible to user
        AND r.bundleVersion > bundleVersion       // Must be newer than what device has
        AND (isInternalUser OR bucket <= r.rollout) // Must pass rollout check
    )

    // Step 7: If no eligible releases → no update
    if eligibleReleases is empty:
        return { isUpdateAvailable: false }

    // Step 8: Pick the LATEST eligible release (highest bundleVersion)
    latestRelease = eligibleReleases.max(by: bundleVersion)

    // Step 9: Check if there's a patch available (optimization for smaller download)
    patchUrl = null
    if latestRelease.patches AND latestRelease.patches[String(bundleVersion)]:
        patchUrl = latestRelease.patches[String(bundleVersion)]
    else if latestRelease.patchUrl:
        patchUrl = latestRelease.patchUrl

    // Step 10: Return the update
    return {
        isUpdateAvailable: true,
        isMandatory: latestRelease.isMandatory,
        hash: latestRelease.hash,
        jsVersion: latestRelease.jsVersion,
        bundleVersion: latestRelease.bundleVersion,
        patchUrl: patchUrl,
        bundleUrl: latestRelease.bundleUrl
    }
```

### Actual TypeScript Implementation

```typescript
// src/app/api/v1/check_update/route.ts (COMPLETE FILE)

import { NextRequest, NextResponse } from "next/server";
import { readBlobJSON } from "@/lib/blob-db";
import { Release, ReleaseState } from "@/lib/types";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;

    const appId = searchParams.get("appId");
    const jsVersionStr = searchParams.get("jsVersion");
    const bundleVersionStr = searchParams.get("bundleVersion");
    const bucketStr = searchParams.get("bucket");
    const iuStr = searchParams.get("iu");

    // Validate required params
    if (!appId || !jsVersionStr || !bundleVersionStr || !bucketStr) {
      return NextResponse.json(
        { data: { isUpdateAvailable: false } },
        { status: 400 }
      );
    }

    const jsVersion = parseInt(jsVersionStr, 10);
    const bundleVersion = parseInt(bundleVersionStr, 10);
    const bucket = parseInt(bucketStr, 10);
    const isInternalUser = iuStr === "true" || iuStr === "1";

    if (isNaN(jsVersion) || isNaN(bundleVersion) || isNaN(bucket)) {
      return NextResponse.json(
        { data: { isUpdateAvailable: false } },
        { status: 400 }
      );
    }

    // Read releases from Vercel Blob
    const releases = await readBlobJSON<Release[]>("releases.json", []);

    // Filter to this app + jsVersion
    const appReleases = releases.filter(
      (r) => r.appId === appId && r.jsVersion === jsVersion
    );

    if (appReleases.length === 0) {
      return NextResponse.json({ data: { isUpdateAvailable: false } });
    }

    // Check if client's current version is disabled (rollback)
    const clientRelease = appReleases.find(
      (r) => r.bundleVersion === bundleVersion
    );

    if (
      clientRelease &&
      (clientRelease.releaseState === ReleaseState.DISABLED ||
        clientRelease.releaseState === ReleaseState.DELETED)
    ) {
      return NextResponse.json({ data: { isUpdateAvailable: false, rollback: true } });
    }

    // Determine visible states
    const visibleStates: ReleaseState[] = isInternalUser
      ? [ReleaseState.STAGING, ReleaseState.LIVE]
      : [ReleaseState.LIVE];

    // Filter eligible releases
    const eligibleReleases = appReleases.filter((r) => {
      if (!visibleStates.includes(r.releaseState)) return false;
      if (r.bundleVersion <= bundleVersion) return false;
      if (r.releaseState === ReleaseState.LIVE && !isInternalUser) {
        if (bucket > r.rollout) return false;
      }
      return true;
    });

    if (eligibleReleases.length === 0) {
      return NextResponse.json({ data: { isUpdateAvailable: false } });
    }

    // Get latest eligible
    const latestRelease = eligibleReleases.reduce((latest, current) =>
      current.bundleVersion > latest.bundleVersion ? current : latest
    );

    // Check for patch
    const patchKey = String(bundleVersion);
    const patchUrl =
      latestRelease.patches && latestRelease.patches[patchKey]
        ? latestRelease.patches[patchKey]
        : latestRelease.patchUrl;

    return NextResponse.json({
      data: {
        isUpdateAvailable: true,
        isMandatory: latestRelease.isMandatory,
        hash: latestRelease.hash,
        jsVersion: latestRelease.jsVersion,
        bundleVersion: latestRelease.bundleVersion,
        patchUrl: patchUrl || null,
        bundleUrl: latestRelease.bundleUrl,
      }
    });
  } catch (error) {
    console.error("check_update error:", error);
    return NextResponse.json({ data: { isUpdateAvailable: false } }, { status: 500 });
  }
}
```

---

## 7. Hash Generation — The Most Critical Part

⚠️ **If the hash is wrong, the update will SILENTLY FAIL on the device. No error. No log. Nothing.**

### The Rule

```
hash = MD5( contents of the EXTRACTED JS bundle file )
hash ≠ MD5( the .zip file )
```

### What's Inside a Bundle ZIP

```
bundle-ota.zip
  └── index.android.bundle      ← THIS file's MD5 = the hash

For iOS:
bundle-ota.zip
  └── main.jsbundle             ← THIS file's MD5 = the hash
```

### How Hash is Computed in the Upload API

The upload endpoint (`/api/upload`) does this automatically:

```typescript
// From src/app/api/upload/route.ts

async function computeBundleHash(zipBuffer: Buffer, fileName: string): Promise<string> {
  // If the file is a raw .jsbundle (not zipped), hash it directly
  if (fileName.endsWith(".jsbundle") || fileName.endsWith(".bundle")) {
    return createHash("md5").update(zipBuffer).digest("hex");
  }

  // For zip files: extract the JS bundle first, then hash it
  const bundleContent = extractFirstFileFromZip(zipBuffer);
  if (bundleContent) {
    return createHash("md5").update(bundleContent).digest("hex");
  }

  // Fallback: hash the zip itself (NOT recommended — may cause mismatch)
  return createHash("md5").update(zipBuffer).digest("hex");
}
```

### How to Manually Compute the Hash

```bash
# Method 1: From a zip file (extract first, then hash)
unzip -p bundle-ota.zip index.android.bundle | md5

# Method 2: From a raw jsbundle file
md5 bundle-v1.jsbundle

# Method 3: In Node.js
const crypto = require('crypto');
const fs = require('fs');
const content = fs.readFileSync('index.android.bundle');
const hash = crypto.createHash('md5').update(content).digest('hex');
console.log(hash); // e.g., "fbd034dc6ba66152d7372f3185c7e5e1"
```

### ZIP Extraction Logic (Built into Upload API)

The upload API contains a custom ZIP parser that finds the first `.bundle` or `.jsbundle` file:

```typescript
function extractFirstFileFromZip(buffer: Buffer): Buffer | null {
  // Reads ZIP local file headers
  // Finds first file ending in .bundle or .jsbundle
  // Supports STORED (uncompressed) and DEFLATE (compressed) entries
  // Returns the raw file content for hashing
}
```

---

## 8. Bundle Storage — Where & How Bundles Are Stored

### Current POC: Vercel Blob

Bundles are uploaded to **Vercel Blob Storage**, which provides:
- CDN-backed public URLs (fast downloads globally)
- No expiration (URLs are permanent)
- Public access (no auth needed to download)

**Storage Path Pattern:**
```
ota-bundles/{appId}/v{jsVersion}-b{bundleVersion}-{originalFilename}
```

**Example URL returned:**
```
https://abcdef.public.blob.vercel-storage.com/ota-bundles/investor-app-android/v1-b6-bundle-ota.zip
```

### How Upload Works (blob-db.ts)

```typescript
// src/lib/blob-db.ts

export async function uploadBlobFile(
  buffer: Buffer,
  filename: string,
  contentType: string = "application/zip"
): Promise<{ url: string; pathname: string }> {
  const blobPath = `ota-bundles/${filename}`;

  const blob = await put(blobPath, buffer, {
    access: "public",          // ← Must be public for SDK to download
    addRandomSuffix: false,    // ← Predictable paths
    contentType,               // ← "application/zip"
  });

  return {
    url: blob.url,             // ← This becomes the bundleUrl in releases.json
    pathname: blob.pathname,
  };
}
```

### For Production (Your Infrastructure)

You need a storage solution that provides **publicly accessible direct download URLs**:

| Option | How it Would Work |
|--------|------------------|
| **AWS S3 + CloudFront** | Upload zip to S3, serve via CloudFront CDN URL |
| **Azure Blob Storage** | Upload zip, generate public URL |
| **Your Own Server (file serving)** | Store zip on disk, serve via `GET /bundles/:filename` |
| **Google Cloud Storage** | Upload zip, use public URL |

**Requirements for bundleUrl:**
- Must be a direct download URL (no redirects that confuse the SDK)
- Must be HTTPS
- Must be publicly accessible (no auth — SDK doesn't send headers)
- Should be CDN-backed for fast downloads (bundles are ~2MB)

---

## 9. Data Model & Storage Layer

### How Data is Stored (Current POC)

The POC stores data as JSON files in Vercel Blob:

```
Vercel Blob:
  ota-data/releases.json     ← All release entries
  ota-data/history.json      ← Audit log
  ota-data/registry.json     ← Registered apps
  ota-data/analytics.json    ← Event tracking
```

The `readBlobJSON` / `writeBlobJSON` functions in `blob-db.ts` handle all reads/writes:

```typescript
// Reading data
const releases = await readBlobJSON<Release[]>("releases.json", []);

// Writing data
await writeBlobJSON("releases.json", releases);
```

### For Production: Database Schema

Replace the JSON file storage with a proper database. Here's the SQL schema:

```sql
-- Main releases table
CREATE TABLE releases (
  id              SERIAL PRIMARY KEY,
  app_id          VARCHAR(100) NOT NULL,      -- "investor-app-android"
  platform        VARCHAR(10) NOT NULL,        -- "android" | "ios"
  js_version      INTEGER NOT NULL,            -- 1, 2, 3...
  bundle_version  INTEGER NOT NULL,            -- 1, 2, 3... (auto-increment per app+jsVersion)
  release_state   INTEGER NOT NULL DEFAULT 0,  -- See state enum below
  rollout         INTEGER NOT NULL DEFAULT 0,  -- 0-100 percentage
  hash            VARCHAR(32) NOT NULL,        -- MD5 hash (32 hex chars)
  bundle_url      VARCHAR(500) NOT NULL,       -- CDN URL to download the .zip
  patch_url       VARCHAR(500),                -- Optional: delta patch URL
  patches         JSONB,                       -- Optional: {"fromVersion": "patchUrl"} map
  is_mandatory    BOOLEAN DEFAULT FALSE,       -- Force update
  description     TEXT,                        -- Release notes
  app_version     VARCHAR(20),                 -- e.g. "5.2" (min native app version)
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),

  UNIQUE(app_id, js_version, bundle_version)
);

-- Index for the check_update query (most critical query)
CREATE INDEX idx_releases_lookup ON releases(app_id, js_version, release_state);

-- Audit history table
CREATE TABLE release_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id          VARCHAR(100) NOT NULL,
  js_version      INTEGER NOT NULL,
  bundle_version  INTEGER NOT NULL,
  action          VARCHAR(50) NOT NULL,        -- 'RELEASE_CREATED', 'STATE_CHANGED', etc.
  previous_state  INTEGER,
  new_state       INTEGER,
  rollout         INTEGER,
  description     TEXT,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- App registry
CREATE TABLE app_registry (
  app_id          VARCHAR(100) NOT NULL,
  platform        VARCHAR(10) NOT NULL,
  app_name        VARCHAR(200) NOT NULL,
  created_at      TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY(app_id, platform)
);

-- Analytics events
CREATE TABLE analytics_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id          VARCHAR(100) NOT NULL,
  event           VARCHAR(50) NOT NULL,
  js_version      INTEGER,
  bundle_version  INTEGER,
  metadata        JSONB,
  created_at      TIMESTAMP DEFAULT NOW()
);
```

### TypeScript Data Types

```typescript
// src/lib/types.ts

export enum ReleaseState {
  CREATED = 0,    // Uploaded, not yet released
  STAGING = 10,   // Available to internal/beta users only
  LIVE = 20,      // Available to all users (subject to rollout %)
  HALTED = 25,    // Temporarily paused
  DISABLED = 30,  // Triggers rollback on devices
  DELETED = 40,   // Permanently removed
}

export interface Release {
  appId: string;           // "investor-app-android"
  platform: string;        // "android" | "ios"
  jsVersion: number;       // 1
  bundleVersion: number;   // 6
  releaseState: ReleaseState; // 20 (LIVE)
  rollout: number;         // 0-100
  hash: string;            // "fbd034dc6ba66152d7372f3185c7e5e1"
  bundleUrl: string;       // CDN URL
  patchUrl?: string;       // Optional delta patch
  patches?: Record<string, string>; // { "5": "patch_url_from_v5_to_v6" }
  isMandatory: boolean;    // Force update
  description: string;     // Release notes
  appVersion?: string;     // Minimum native app version
  createdAt: string;       // ISO timestamp
  updatedAt: string;       // ISO timestamp
}
```

### Sample Release Entry (What's in releases.json)

```json
{
  "appId": "investor-app-android",
  "platform": "android",
  "jsVersion": 1,
  "bundleVersion": 6,
  "releaseState": 20,
  "rollout": 100,
  "hash": "fbd034dc6ba66152d7372f3185c7e5e1",
  "bundleUrl": "https://drive.google.com/uc?export=download&id=1XXvPIqF9VnHMr5Zc7A1lV3LNcKmzSszZ",
  "isMandatory": false,
  "description": "OTA v1: Added version indicator on IntroScreen",
  "appVersion": "5.2",
  "createdAt": "2026-07-10T17:00:00.000Z",
  "updatedAt": "2026-07-10T17:00:00.000Z"
}
```

---

## 10. Release Lifecycle (State Machine)

### States

| State | Value | Meaning | Who can see it? |
|-------|-------|---------|----------------|
| **CREATED** | 0 | Uploaded but not yet released | Nobody (admin only) |
| **STAGING** | 10 | Available for testing | Internal users (`iu=true`) |
| **LIVE** | 20 | Available to all users | Everyone (subject to rollout %) |
| **HALTED** | 25 | Temporarily paused | Nobody |
| **DISABLED** | 30 | Disabled — triggers rollback | Nobody (but devices with this version get rollback signal) |
| **DELETED** | 40 | Permanently removed | Nobody |

### Valid State Transitions

```
CREATED  →  STAGING  →  LIVE  →  HALTED  →  LIVE (resume)
                                         →  DISABLED  →  DELETED
CREATED  →  DELETED (skip everything)
STAGING  →  DISABLED  →  DELETED
LIVE     →  DISABLED  →  DELETED
```

Defined in `src/lib/constants.ts`:

```typescript
export const VALID_TRANSITIONS: Record<ReleaseState, ReleaseState[]> = {
  [ReleaseState.CREATED]: [ReleaseState.STAGING, ReleaseState.DELETED],
  [ReleaseState.STAGING]: [ReleaseState.LIVE, ReleaseState.DISABLED, ReleaseState.DELETED],
  [ReleaseState.LIVE]: [ReleaseState.HALTED, ReleaseState.DISABLED, ReleaseState.DELETED],
  [ReleaseState.HALTED]: [ReleaseState.LIVE, ReleaseState.DISABLED, ReleaseState.DELETED],
  [ReleaseState.DISABLED]: [ReleaseState.DELETED],
  [ReleaseState.DELETED]: [],
};
```

### Typical Release Flow

```
1. Upload bundle       → State: CREATED,  Rollout: 0%
2. Push to staging     → State: STAGING,  Rollout: 100%  (testers see it)
3. Promote to live     → State: LIVE,     Rollout: 5%   (5% of users)
4. Monitor for issues  
5. Increase rollout    → State: LIVE,     Rollout: 25%  
6. Increase rollout    → State: LIVE,     Rollout: 100% (everyone)
7. (If problem found)  → State: DISABLED               (triggers rollback)
```

---

## 11. All API Endpoints — Complete Reference

### Mobile App API (What the SDK calls)

#### `GET /api/v1/check_update`
See [Section 6](#6-the-core-api-check_update--complete-deep-dive) for full details.

---

### Admin/Management APIs

#### `POST /api/upload`

Upload a bundle file and create a release in one step.

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `file` | File | ✅ | - | The .zip bundle file |
| `appId` | string | ✅ | - | e.g., `investor-app-android` |
| `platform` | string | ✅ | - | `android` or `ios` |
| `jsVersion` | number | ✅ | - | JS version number |
| `bundleVersion` | number | ✅ | - | Bundle version number |
| `description` | string | ❌ | `""` | Release notes |
| `appVersion` | string | ❌ | - | Min native app version |
| `isMandatory` | string | ❌ | `"false"` | `"true"` or `"false"` |
| `releaseState` | number | ❌ | `20` (LIVE) | Initial state |
| `rollout` | number | ❌ | `100` | Initial rollout % |
| `hash` | string | ❌ | auto-computed | Pre-computed MD5 hash |

**What it does behind the scenes:**
1. Reads the zip file into a Buffer
2. Extracts the JS bundle from inside the zip
3. Computes MD5 hash of the extracted JS bundle (unless pre-computed hash is provided)
4. Uploads the zip to Vercel Blob → gets a CDN URL
5. Creates a release entry in releases.json with the CDN URL and hash
6. Adds history entry

**Success Response (201):**
```json
{
  "success": true,
  "release": { ... },
  "bundleUrl": "https://...",
  "fileSize": 1991260,
  "hash": "fbd034dc6ba66152d7372f3185c7e5e1"
}
```

**Example cURL:**
```bash
curl -X POST https://your-server.com/api/upload \
  -F "file=@./bundles/bundle-ota.zip" \
  -F "appId=investor-app-android" \
  -F "platform=android" \
  -F "jsVersion=1" \
  -F "bundleVersion=7" \
  -F "description=Fix splash screen" \
  -F "releaseState=20" \
  -F "rollout=100"
```

---

#### `GET /api/releases`

List releases with optional filters.

| Param | Type | Description |
|-------|------|-------------|
| `appId` | string | Filter by app ID |
| `jsVersion` | number | Filter by JS version |
| `releaseState` | number | Filter by state |

**Response:**
```json
{
  "releases": [
    {
      "appId": "investor-app-android",
      "platform": "android",
      "jsVersion": 1,
      "bundleVersion": 6,
      "releaseState": 20,
      "rollout": 100,
      "hash": "fbd034dc6ba66152d7372f3185c7e5e1",
      "bundleUrl": "https://...",
      "isMandatory": false,
      "description": "OTA v1: Added version indicator",
      "createdAt": "2026-07-10T17:00:00.000Z",
      "updatedAt": "2026-07-10T17:00:00.000Z"
    }
  ]
}
```

---

#### `POST /api/releases`

Create a release entry (when bundle is already hosted elsewhere — e.g., Google Drive, your own S3).

**Body (JSON):**
```json
{
  "appId": "investor-app-android",
  "platform": "android",
  "jsVersion": 1,
  "bundleVersion": 7,
  "hash": "fbd034dc6ba66152d7372f3185c7e5e1",
  "bundleUrl": "https://your-cdn.com/bundle.zip",
  "patchUrl": null,
  "patches": { "6": "https://your-cdn.com/patch-6-to-7.bsdiff" },
  "isMandatory": false,
  "description": "New feature",
  "appVersion": "5.2"
}
```

**Notes:**
- Creates in CREATED state with 0% rollout
- You need to manually promote to STAGING/LIVE using the update endpoint
- Validates for duplicate (appId + jsVersion + bundleVersion must be unique)

---

#### `POST /api/releases/update`

Change release state and/or rollout percentage.

**Body (JSON):**
```json
{
  "appId": "investor-app-android",
  "jsVersion": 1,
  "bundleVersion": 6,
  "releaseState": 20,
  "rollout": 50,
  "description": "Updated notes"
}
```

**Validations:**
- State transition must be valid (see state machine)
- Rollout can only INCREASE (not decrease) — to prevent pulling updates from users mid-download
- At least one of `releaseState` or `rollout` must be provided

---

#### `POST /api/rollback`

Disable a live release, triggering rollback on devices.

**Body (JSON):**
```json
{
  "appId": "investor-app-android",
  "jsVersion": 1,
  "bundleVersion": 6
}
```

If `bundleVersion` is omitted, it rolls back the LATEST live release for that app+jsVersion.

**What happens after rollback:**
1. Release state → DISABLED
2. Next time a device with that bundleVersion calls check_update → gets `{ rollback: true }`
3. SDK deletes the local OTA bundle → app reverts to the bundle baked into the APK

---

#### `GET /api/history`

Get audit log of all release actions.

| Param | Type | Description |
|-------|------|-------------|
| `appId` | string | Filter by app ID |
| `limit` | number | Max entries (default: 50) |

**Response:**
```json
{
  "history": [
    {
      "id": "uuid",
      "appId": "investor-app-android",
      "jsVersion": 1,
      "bundleVersion": 6,
      "action": "STATE_CHANGED",
      "previousState": 10,
      "newState": 20,
      "timestamp": "2026-07-10T11:34:06.786Z",
      "description": "State changed from 10 to 20"
    }
  ],
  "total": 15
}
```

---

#### `GET /api/analytics` & `POST /api/analytics`

Track events from the mobile app or admin actions.

**POST Body:**
```json
{
  "appId": "investor-app-android",
  "event": "update_downloaded",
  "jsVersion": 1,
  "bundleVersion": 6,
  "metadata": { "downloadTime": 3500 }
}
```

---

#### `GET /api/registry` & `POST /api/registry`

Register new apps in the system.

**POST Body:**
```json
{
  "appId": "investor-app-android",
  "platform": "android",
  "appName": "Investor App"
}
```

---

## 12. CLI Scripts — Release Management Tools

These scripts are in the `scripts/` directory and run with `tsx`.

### upload-bundle.sh — Quick Upload

```bash
# Upload a bundle zip to the server
./scripts/upload-bundle.sh ./bundles/bundle-ota.zip 7 "Fix splash screen"

# Environment variable for production
OTA_SERVER_URL=https://your-server.com ./scripts/upload-bundle.sh ./bundles/bundle-ota.zip 7 "Fix"
```

### release.ts — Full Release Automation

```bash
# Creates a bundle + uploads + creates release
npm run release -- --platform android --js-version 1 --description "New feature" --server-url http://localhost:3000
```

What it does:
1. Runs `react-native bundle` to generate the JS bundle
2. Computes MD5 hash
3. (Optional) Generates binary diff patch from previous version
4. Uploads bundle to server
5. Creates release entry

### promote.ts — Change Release State

```bash
# Promote to staging
npm run promote -- --app-id investor-app-android --js-version 1 --bundle-version 6 --state staging

# Promote to live with 25% rollout
npm run promote -- --app-id investor-app-android --js-version 1 --bundle-version 6 --state live --rollout 25

# Increase rollout to 100%
npm run promote -- --app-id investor-app-android --js-version 1 --bundle-version 6 --rollout 100
```

### rollback.ts — Emergency Rollback

```bash
# Rollback latest live release
npm run rollback -- --app-id investor-app-android --js-version 1

# Rollback specific version
npm run rollback -- --app-id investor-app-android --js-version 1 --bundle-version 6
```

### generate-patch.ts — Binary Diff

```bash
# Generate a bsdiff patch between two bundles
npm run generate-patch -- --old ./bundles/bundle-v5.jsbundle --new ./bundles/bundle-v6.jsbundle --output ./bundles/patch-5-to-6.bsdiff
```

This creates a small binary patch (~50-200KB) instead of downloading the full bundle (~2-8MB).

---

## 13. Gradual Rollout System

### How it Works

Each device is assigned a random `bucket` number (1-100) at install time by the SDK. This bucket NEVER changes for that install.

Each release has a `rollout` field (0-100) that controls what percentage of users get the update.

**The rule is simple:**
```
If device.bucket <= release.rollout → device gets the update
If device.bucket > release.rollout → device does NOT get the update
```

### Example

```
Release with rollout = 25%:
  - Device bucket 1-25  → gets the update  ✅
  - Device bucket 26-100 → does NOT get it  ❌

Increase rollout to 50%:
  - Device bucket 1-50  → gets the update  ✅
  - Device bucket 51-100 → does NOT get it  ❌
```

### Important Notes:
- Rollout can only be INCREASED, never decreased (validation enforced)
- Internal users (`iu=true`) bypass rollout check — always see STAGING + LIVE
- Setting rollout to 0 on a LIVE release = nobody gets it (but it's still "live" technically)

---

## 14. Versioning Strategy Explained

### jsVersion (Native Version Track)

- **Increments when:** Native code changes (new native module, React Native version upgrade, new permissions, etc.)
- **Significance:** OTA updates are scoped to a jsVersion. A device on jsVersion=1 will NEVER receive a bundle meant for jsVersion=2.
- **Why:** A JS bundle built for jsVersion=2 might use native APIs that don't exist on jsVersion=1 devices, causing crashes.

### bundleVersion (OTA Update Number)

- **Increments with:** Each new OTA upload (within a jsVersion)
- **Starts at:** 0 (on device — meaning no OTA applied, using the APK's original bundle)
- **Significance:** Device always gets the LATEST bundleVersion that's higher than its current

### appVersion (Minimum Native App Version)

- **Purpose:** Optional field to restrict OTA updates to specific native app versions
- **Example:** `"5.2"` means only native app v5.2+ gets this OTA update
- **Note:** Not currently enforced in check_update (potential improvement)

### Practical Example

```
Device state: appVersion=5.2, jsVersion=1, bundleVersion=3

Server has:
  - bundleVersion=4 (jsVersion=1, LIVE) → ELIGIBLE ✅
  - bundleVersion=5 (jsVersion=1, LIVE) → ELIGIBLE ✅ (latest, this wins)
  - bundleVersion=6 (jsVersion=2, LIVE) → NOT eligible (different jsVersion) ❌
  - bundleVersion=3 (jsVersion=1, LIVE) → NOT eligible (not newer) ❌

Device gets: bundleVersion=5
```

---

## 15. Environment Configuration

### Required Environment Variables

```bash
# .env.example

# Vercel Blob storage token (auto-set when you link a Blob store in Vercel dashboard)
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxx

# Public URL of this OTA server (used in admin UI)
NEXT_PUBLIC_SERVER_URL=https://investor-app-ota-server.vercel.app
```

### For Vercel Deployment

The `BLOB_READ_WRITE_TOKEN` is automatically injected when you:
1. Go to Vercel Dashboard → your project → Storage
2. Create a Blob store
3. Link it to your project

### For Local Development

```bash
# Copy the example
cp .env.example .env.local

# Add your Vercel Blob token (get from Vercel dashboard → Storage → Blob)
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_your_token_here
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
```

Or use the local file-system DB (`src/lib/db.ts`) which reads/writes from the `data/` folder.

---

## 16. Deployment (Vercel)

### vercel.json Configuration

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "GET, POST, OPTIONS" },
        { "key": "Access-Control-Allow-Headers", "value": "Content-Type" }
      ]
    }
  ]
}
```

**CORS headers are set to allow all origins** (`*`) because the mobile SDK makes direct HTTP calls.

### Deployment Steps

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Link project
vercel link

# 3. Deploy
vercel --prod
```

### Current Production URL
```
https://investor-app-ota-server.vercel.app
```

---

## 17. End-to-End Flow — Step by Step

### Flow 1: Publishing a New OTA Update

```
Developer Machine:
  1. Make code changes in React Native app
  2. Generate bundle:
     npx react-native bundle --platform android --dev false \
       --entry-file index.js \
       --bundle-output ./output/index.android.bundle
  3. Zip the bundle:
     cd output && zip bundle-ota.zip index.android.bundle && cd ..
  4. Upload to OTA server:
     curl -X POST https://investor-app-ota-server.vercel.app/api/upload \
       -F "file=@./output/bundle-ota.zip" \
       -F "appId=investor-app-android" \
       -F "platform=android" \
       -F "jsVersion=1" \
       -F "bundleVersion=7" \
       -F "description=Fix splash screen" \
       -F "releaseState=20" \
       -F "rollout=100"

OTA Server (Behind the scenes):
  5. Receives zip file
  6. Extracts index.android.bundle from zip
  7. Computes MD5 hash of extracted bundle → "abc123..."
  8. Uploads zip to Vercel Blob → gets CDN URL
  9. Creates release entry in releases.json:
     { appId, jsVersion:1, bundleVersion:7, hash:"abc123...", bundleUrl:"https://...", state:LIVE, rollout:100 }

Mobile App:
  10. User opens app (cold start)
  11. SDK calls: GET /api/v1/check_update?appId=investor-app-android&jsVersion=1&bundleVersion=6&bucket=42
  12. Server finds bundleVersion=7 is LIVE, rollout=100, bucket 42 <= 100 → eligible
  13. Server responds: { isUpdateAvailable:true, hash:"abc123...", bundleUrl:"https://..." }
  14. SDK downloads zip from bundleUrl
  15. SDK extracts index.android.bundle from zip
  16. SDK computes MD5 of extracted file
  17. SDK verifies: computed hash == "abc123..." from server → MATCH ✅
  18. SDK saves bundle locally
  19. User closes and reopens app
  20. App loads new bundle → update applied! 🎉
```

### Flow 2: Emergency Rollback

```
  1. Admin sees crash reports from bundleVersion=7
  2. Admin calls:
     POST /api/rollback
     { "appId": "investor-app-android", "jsVersion": 1, "bundleVersion": 7 }
  3. Server sets bundleVersion=7 state → DISABLED
  4. Next time a device on bundleVersion=7 calls check_update:
     Response: { isUpdateAvailable: false, rollback: true }
  5. SDK deletes local OTA bundle
  6. On next cold start → app loads original APK bundle (reverts to pre-OTA state)
```

### Flow 3: Gradual Rollout

```
  1. Upload new bundle → bundleVersion=8, state=CREATED, rollout=0
  2. Promote to staging: POST /api/releases/update { state:10 }
     → Internal users can now test it
  3. Promote to live with 5%: POST /api/releases/update { state:20, rollout:5 }
     → Only devices with bucket 1-5 get the update
  4. Monitor for 24 hours
  5. Increase: POST /api/releases/update { rollout:25 }
     → Devices with bucket 1-25 get it
  6. After 3 days: POST /api/releases/update { rollout:100 }
     → Everyone gets it
```

---

## 18. Migrating to Your Own Infrastructure

### What You Need to Implement

| Component | Current (POC) | Your Production Equivalent |
|-----------|--------------|--------------------------|
| **API Server** | Next.js on Vercel | Your Node/Java/.NET server (or keep Next.js) |
| **Bundle Storage** | Vercel Blob | S3 + CloudFront / Azure Blob / GCS |
| **Data Storage** | Vercel Blob (JSON) | PostgreSQL / MySQL / MongoDB |
| **Deployment** | Vercel | Your infrastructure |

### Option A: Ship This Code Directly to Your Server

If you're using a Node.js server, you can deploy this Next.js project as-is:

```bash
# On your server:
git clone <this-repo>
npm install
npm run build
npm start  # Runs on port 3000
```

Replace the Blob storage layer by:
1. Modifying `src/lib/blob-db.ts` to use your database instead
2. Replacing `uploadBlobFile` with your S3/storage upload logic
3. Setting up CORS headers for your domain

### Option B: Implement from Scratch

At minimum, implement:

1. **`GET /api/v1/check_update`** — Copy the logic from section 6
2. **Bundle Upload** — Accept zip, compute hash, store, create release record
3. **Releases Table** — Store release metadata (see section 9 for schema)
4. **File Storage** — Store and serve zip files via CDN URL

### Key Things to Get Right

1. **Hash computation** — MD5 of the EXTRACTED JS bundle (not the zip). If this is wrong, updates silently fail.
2. **bundleUrl must be publicly downloadable** — No auth, HTTPS, direct download
3. **Response format must match exactly** — The SDK expects the exact JSON structure shown in section 6
4. **CORS** — Allow all origins (or at least your app's requests)
5. **Rollout logic** — `bucket <= rollout` check
6. **Rollback** — Return `{ rollback: true }` when device's current version is DISABLED

### Minimal Production check_update (Pseudocode for Any Language)

```python
# In any language — this is the core logic:

def check_update(app_id, js_version, bundle_version, bucket, is_internal):
    
    # Query DB for matching releases
    releases = db.query("""
        SELECT * FROM releases 
        WHERE app_id = ? AND js_version = ?
    """, app_id, js_version)
    
    # Check rollback
    client_release = find(releases, bundle_version=bundle_version)
    if client_release and client_release.state in (DISABLED, DELETED):
        return {"data": {"isUpdateAvailable": False, "rollback": True}}
    
    # Find eligible updates
    if is_internal:
        visible = [STAGING, LIVE]
    else:
        visible = [LIVE]
    
    eligible = [r for r in releases 
                if r.state in visible 
                and r.bundle_version > bundle_version
                and (is_internal or bucket <= r.rollout)]
    
    if not eligible:
        return {"data": {"isUpdateAvailable": False}}
    
    # Get latest
    latest = max(eligible, key=lambda r: r.bundle_version)
    
    return {"data": {
        "isUpdateAvailable": True,
        "isMandatory": latest.is_mandatory,
        "hash": latest.hash,
        "jsVersion": latest.js_version,
        "bundleVersion": latest.bundle_version,
        "patchUrl": get_patch_url(latest, bundle_version),
        "bundleUrl": latest.bundle_url
    }}
```

---

## 19. Security Considerations

### Current POC (No Auth)

The POC has NO authentication on any endpoints. For production:

1. **check_update** — Consider adding an API key header (SDK can be configured to send it)
2. **Admin APIs** — Add proper authentication (JWT, API keys, etc.)
3. **Bundle URLs** — Currently public. Could use signed URLs (but SDK doesn't support auth headers for download)

### Production Recommendations

| Concern | Solution |
|---------|----------|
| Unauthorized uploads | API key or JWT on admin endpoints |
| Bundle tampering | Hash verification (already done by SDK) |
| Rate limiting | Add rate limiting per device/IP on check_update |
| HTTPS | Always use HTTPS for bundleUrl |
| Audit trail | Already implemented (history table) |
| Rollback capability | Already implemented |

---

## 20. Troubleshooting & Common Pitfalls

### "Update not applying on device"

1. **Most likely: Hash mismatch** — Verify hash is MD5 of the EXTRACTED JS bundle, not the zip
2. Check that `bundleUrl` is accessible (try downloading in browser)
3. Check that the zip contains `index.android.bundle` (exact filename matters)
4. Check device's bundleVersion vs server's bundleVersion (server must be higher)
5. Check rollout % vs device's bucket number

### "check_update returns no update"

1. Is the release state LIVE (20)?
2. Is rollout > 0?
3. Does `appId` match exactly? (case sensitive)
4. Does `jsVersion` match?
5. Is `bundleVersion` on server > device's `bundleVersion`?

### "Rollback not working"

1. Rollback only triggers when the device's CURRENT bundleVersion is DISABLED
2. If device is on bundleVersion=0 (never received OTA), rollback has no effect
3. Device must call check_update to receive the rollback signal

### Testing the API Manually

```bash
# Check if there's an update for a fresh device (bundleVersion=0)
curl "http://localhost:3000/api/v1/check_update?appId=investor-app-android&jsVersion=1&bundleVersion=0&bucket=50"

# Check as internal user
curl "http://localhost:3000/api/v1/check_update?appId=investor-app-android&jsVersion=1&bundleVersion=0&bucket=50&iu=true"

# List all releases
curl "http://localhost:3000/api/releases?appId=investor-app-android"
```

### Verifying Hash Manually

```bash
# 1. Download the bundle zip
curl -o test-bundle.zip "https://your-cdn.com/bundle.zip"

# 2. Extract the JS bundle
unzip -p test-bundle.zip index.android.bundle > extracted.bundle

# 3. Compute MD5
md5 extracted.bundle
# Should match the "hash" field in the release entry
```

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────────┐
│                    OTA SYSTEM QUICK REFERENCE                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  CORE ENDPOINT (what mobile app calls):                             │
│  GET /api/v1/check_update?appId=X&jsVersion=N&bundleVersion=N&bucket=N │
│                                                                     │
│  HASH = MD5(extracted_js_bundle_from_zip), NOT MD5(zip_file)        │
│                                                                     │
│  STATES: CREATED(0) → STAGING(10) → LIVE(20) → DISABLED(30)        │
│                                                                     │
│  ROLLOUT: device.bucket <= release.rollout → gets update            │
│                                                                     │
│  BUNDLE FORMAT: .zip containing index.android.bundle                │
│                                                                     │
│  UPLOAD: POST /api/upload (multipart: file + metadata)              │
│  PROMOTE: POST /api/releases/update (state + rollout)               │
│  ROLLBACK: POST /api/rollback (sets state to DISABLED)              │
│                                                                     │
│  CRITICAL: bundleUrl must be public HTTPS direct download           │
│  CRITICAL: Hash mismatch = silent update failure on device          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Contact

For questions about this system, reach out to **Ajay Bendre** (original author).

**POC Server URL:** https://investor-app-ota-server.vercel.app  
**Repository:** investor-app-ota-server  
**SDK:** `@zepto-labs/react-native-delta` (com.delta.Delta on Android)
