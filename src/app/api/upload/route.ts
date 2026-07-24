import { NextRequest, NextResponse } from "next/server";
import { readBlobJSON, writeBlobJSON, uploadBlobFile } from "@/lib/blob-db";
import { Release, ReleaseState, HistoryEntry } from "@/lib/types";
import { validateRelease } from "@/lib/validation";
import { randomUUID, createHash } from "crypto";

/**
 * Extracts the JS bundle from a zip buffer and returns its MD5 hash.
 * The Delta SDK computes the hash of the extracted JS bundle (not the zip),
 * so we need to match that behavior.
 *
 * Simple zip parser — finds the first .bundle or .jsbundle file in the zip
 * and computes its MD5 hash from the uncompressed content.
 */
async function computeBundleHash(zipBuffer: Buffer, fileName: string): Promise<string> {
  // If the file is not a zip (raw .jsbundle), hash it directly
  if (fileName.endsWith(".jsbundle") || fileName.endsWith(".bundle")) {
    return createHash("md5").update(zipBuffer).digest("hex");
  }

  // For zip files, we need to extract the JS bundle and hash it
  // Use Node's built-in zip parsing via the local file headers
  try {
    const bundleContent = extractFirstFileFromZip(zipBuffer);
    if (bundleContent) {
      return createHash("md5").update(bundleContent).digest("hex");
    }
  } catch (e) {
    console.warn("Failed to extract bundle from zip for hashing:", e);
  }

  // Fallback: hash the zip itself
  return createHash("md5").update(zipBuffer).digest("hex");
}

/**
 * Simple ZIP file extractor — extracts the first STORED (uncompressed) file from a ZIP.
 * Most OTA bundles are stored uncompressed in the zip for fast access.
 * Falls back to null if we can't parse it.
 */
function extractFirstFileFromZip(buffer: Buffer): Buffer | null {
  // ZIP local file header signature: PK\x03\x04
  const LOCAL_FILE_HEADER_SIG = 0x04034b50;

  let offset = 0;

  while (offset < buffer.length - 30) {
    const sig = buffer.readUInt32LE(offset);
    if (sig !== LOCAL_FILE_HEADER_SIG) break;

    const compressionMethod = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraFieldLength = buffer.readUInt16LE(offset + 28);

    const entryFileName = buffer.toString(
      "utf-8",
      offset + 30,
      offset + 30 + fileNameLength
    );

    const dataOffset = offset + 30 + fileNameLength + extraFieldLength;

    // Check if this is a JS bundle file
    if (
      entryFileName.endsWith(".bundle") ||
      entryFileName.endsWith(".jsbundle") ||
      entryFileName.includes("index.android")
    ) {
      if (compressionMethod === 0) {
        // STORED (no compression)
        return buffer.subarray(dataOffset, dataOffset + uncompressedSize);
      } else if (compressionMethod === 8) {
        // DEFLATE — use zlib to decompress
        const { inflateRawSync } = require("zlib");
        try {
          const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);
          return inflateRawSync(compressed);
        } catch (e) {
          console.warn("Failed to inflate bundle:", e);
          return null;
        }
      }
    }

    // Skip to next entry
    offset = dataOffset + compressedSize;
  }

  return null;
}

/**
 * POST /api/upload
 *
 * Upload a bundle .zip file + metadata to create a new OTA release.
 * The bundle is stored in Vercel Blob (CDN) and a release entry is created.
 *
 * Form fields:
 * - file: The bundle .zip file (required)
 * - appId: e.g. "investor-app-android" (required)
 * - platform: "android" | "ios" (required)
 * - jsVersion: JS version number (required)
 * - bundleVersion: Bundle version number (required)
 * - description: Release description (optional)
 * - appVersion: App version string e.g. "5.2" (optional)
 * - isMandatory: "true" | "false" (optional, defaults to false)
 * - releaseState: Release state number (optional, defaults to LIVE=20 for demo ease)
 * - rollout: Rollout percentage 0-100 (optional, defaults to 100 for demo ease)
 * - hash: Pre-computed MD5 hash of the JS bundle (optional, computed from zip if not provided)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();

    // Extract file
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { error: "No file provided. Send a 'file' field in multipart form data." },
        { status: 400 }
      );
    }

    // Extract metadata
    const appId = formData.get("appId") as string | null;
    const platform = formData.get("platform") as string | null;
    const jsVersionStr = formData.get("jsVersion") as string | null;
    const bundleVersionStr = formData.get("bundleVersion") as string | null;
    const description = (formData.get("description") as string) || "";
    const appVersion = (formData.get("appVersion") as string) || undefined;
    const isMandatory = formData.get("isMandatory") === "true";
    const releaseStateStr = formData.get("releaseState") as string | null;
    const rolloutStr = formData.get("rollout") as string | null;
    const precomputedHash = formData.get("hash") as string | null;

    if (!appId || !platform || !jsVersionStr || !bundleVersionStr) {
      return NextResponse.json(
        {
          error: "Missing required fields: appId, platform, jsVersion, bundleVersion",
        },
        { status: 400 }
      );
    }

    const jsVersion = parseInt(jsVersionStr, 10);
    const bundleVersion = parseInt(bundleVersionStr, 10);

    if (isNaN(jsVersion) || isNaN(bundleVersion)) {
      return NextResponse.json(
        { error: "jsVersion and bundleVersion must be valid numbers" },
        { status: 400 }
      );
    }

    // Read file into buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Compute hash of the JS bundle inside the zip (not the zip itself!)
    // The native Delta SDK verifies: MD5(extracted_js_bundle) == hash from API
    const hash = precomputedHash || await computeBundleHash(buffer, file.name);

    // Upload bundle to Vercel Blob
    const filename = `${appId}/v${jsVersion}-b${bundleVersion}-${file.name}`;
    const { url: bundleUrl } = await uploadBlobFile(buffer, filename);

    // Determine release state and rollout (default to LIVE + 100% for easy demo)
    const releaseState = releaseStateStr
      ? parseInt(releaseStateStr, 10)
      : ReleaseState.LIVE;
    const rollout = rolloutStr ? parseInt(rolloutStr, 10) : 100;

    // Validate release data
    const releaseData = {
      appId,
      platform,
      jsVersion,
      bundleVersion,
      hash,
      bundleUrl,
    };

    const validation = validateRelease(releaseData);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Read existing releases
    const releases = await readBlobJSON<Release[]>("releases.json", []);

    // Check for duplicate
    const duplicate = releases.find(
      (r) =>
        r.appId === appId &&
        r.jsVersion === jsVersion &&
        r.bundleVersion === bundleVersion
    );

    if (duplicate) {
      // Update existing release with new bundle URL and hash
      duplicate.bundleUrl = bundleUrl;
      duplicate.hash = hash;
      duplicate.description = description || duplicate.description;
      duplicate.updatedAt = new Date().toISOString();
      await writeBlobJSON("releases.json", releases);

      return NextResponse.json(
        {
          success: true,
          release: duplicate,
          bundleUrl,
          fileSize: buffer.length,
          hash,
          updated: true,
        },
        { status: 200 }
      );
    }

    // Create release entry
    const now = new Date().toISOString();
    const newRelease: Release = {
      appId,
      platform,
      jsVersion,
      bundleVersion,
      releaseState,
      rollout,
      hash,
      bundleUrl,
      isMandatory,
      description,
      appVersion,
      createdAt: now,
      updatedAt: now,
    };

    releases.push(newRelease);
    await writeBlobJSON("releases.json", releases);

    // Add history entry
    const history = await readBlobJSON<HistoryEntry[]>("history.json", []);
    history.push({
      id: randomUUID(),
      appId,
      jsVersion,
      bundleVersion,
      action: "RELEASE_CREATED",
      newState: releaseState,
      rollout,
      timestamp: now,
      description: `Bundle uploaded and release created: ${description}`,
    });
    await writeBlobJSON("history.json", history);

    return NextResponse.json(
      {
        success: true,
        release: newRelease,
        bundleUrl,
        fileSize: buffer.length,
        hash,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/upload error:", error);
    return NextResponse.json(
      {
        error: `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 }
    );
  }
}
