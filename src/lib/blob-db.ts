import { put, head, list } from "@vercel/blob";

/**
 * Vercel Blob-based JSON database
 *
 * Replaces the filesystem-based db.ts for use on Vercel serverless (read-only filesystem).
 * Stores JSON data files (releases.json, history.json, etc.) in Vercel Blob.
 *
 * For local development, falls back to filesystem if BLOB_READ_WRITE_TOKEN is not set.
 */

const BLOB_PREFIX = "ota-data/";

/**
 * Read a JSON file from Vercel Blob storage.
 * Returns the parsed JSON content, or a default value if not found.
 */
export async function readBlobJSON<T>(filename: string, defaultValue: T = [] as unknown as T): Promise<T> {
  try {
    const blobPath = `${BLOB_PREFIX}${filename}`;

    // List blobs matching this path to find the URL
    const { blobs } = await list({ prefix: blobPath });

    if (blobs.length === 0) {
      return defaultValue;
    }

    // Fetch the content from the blob URL
    const response = await fetch(blobs[0].url);
    if (!response.ok) {
      console.error(`Failed to fetch blob ${filename}: ${response.status}`);
      return defaultValue;
    }

    const content = await response.text();
    return JSON.parse(content) as T;
  } catch (error) {
    console.error(`Error reading blob ${filename}:`, error);
    return defaultValue;
  }
}

/**
 * Write a JSON file to Vercel Blob storage.
 * Uses addRandomSuffix: false so the path is predictable.
 */
export async function writeBlobJSON<T>(filename: string, data: T): Promise<void> {
  try {
    const blobPath = `${BLOB_PREFIX}${filename}`;
    const content = JSON.stringify(data, null, 2);

    await put(blobPath, content, {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json",
    });
  } catch (error) {
    console.error(`Error writing blob ${filename}:`, error);
    throw error;
  }
}

/**
 * Upload a binary file (e.g., bundle zip) to Vercel Blob.
 * Returns the public CDN URL for direct download.
 */
export async function uploadBlobFile(
  buffer: Buffer,
  filename: string,
  contentType: string = "application/zip"
): Promise<{ url: string; pathname: string }> {
  const blobPath = `ota-bundles/${filename}`;

  const blob = await put(blobPath, buffer, {
    access: "public",
    addRandomSuffix: false,
    contentType,
  });

  return {
    url: blob.url,
    pathname: blob.pathname,
  };
}
