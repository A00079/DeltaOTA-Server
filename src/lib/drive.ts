import { google } from "googleapis";
import fs from "fs";
import path from "path";

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!email || !privateKey) {
    throw new Error(
      "Missing Google Drive credentials. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY environment variables."
    );
  }

  return new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
}

function getDrive() {
  const auth = getAuth();
  return google.drive({ version: "v3", auth });
}

export async function uploadFile(
  filePath: string,
  folderId: string,
  fileName: string
): Promise<{ fileId: string; publicUrl: string }> {
  const drive = getDrive();

  const fileMetadata = {
    name: fileName,
    parents: [folderId],
  };

  const media = {
    mimeType: "application/octet-stream",
    body: fs.createReadStream(filePath),
  };

  try {
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: "id",
    });

    const fileId = response.data.id;
    if (!fileId) {
      throw new Error("Failed to get file ID from upload response");
    }

    await drive.permissions.create({
      fileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });

    const publicUrl = getPublicUrl(fileId);
    return { fileId, publicUrl };
  } catch (error) {
    console.error("Error uploading file to Google Drive:", error);
    throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export async function deleteFile(fileId: string): Promise<void> {
  const drive = getDrive();

  try {
    await drive.files.delete({ fileId });
  } catch (error) {
    console.error("Error deleting file from Google Drive:", error);
    throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export async function createFolder(
  name: string,
  parentId?: string
): Promise<{ folderId: string }> {
  const drive = getDrive();

  const fileMetadata: Record<string, unknown> = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };

  if (parentId) {
    fileMetadata.parents = [parentId];
  }

  try {
    const response = await drive.files.create({
      requestBody: fileMetadata,
      fields: "id",
    });

    const folderId = response.data.id;
    if (!folderId) {
      throw new Error("Failed to get folder ID from create response");
    }

    return { folderId };
  } catch (error) {
    console.error("Error creating folder in Google Drive:", error);
    throw new Error(`Failed to create folder: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export function getPublicUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

export async function uploadBuffer(
  buffer: Buffer,
  folderId: string,
  fileName: string
): Promise<{ fileId: string; publicUrl: string }> {
  const drive = getDrive();
  const { Readable } = await import("stream");

  const fileMetadata = {
    name: fileName,
    parents: [folderId],
  };

  const media = {
    mimeType: "application/octet-stream",
    body: Readable.from(buffer),
  };

  try {
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: "id",
    });

    const fileId = response.data.id;
    if (!fileId) {
      throw new Error("Failed to get file ID from upload response");
    }

    await drive.permissions.create({
      fileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });

    const publicUrl = getPublicUrl(fileId);
    return { fileId, publicUrl };
  } catch (error) {
    console.error("Error uploading buffer to Google Drive:", error);
    throw new Error(`Failed to upload buffer: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
