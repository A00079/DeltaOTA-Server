import { NextRequest, NextResponse } from "next/server";
import { uploadBuffer } from "@/lib/drive";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folder = formData.get("folder") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided. Send a 'file' field in multipart form data." },
        { status: 400 }
      );
    }

    const folderId = folder || process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) {
      return NextResponse.json(
        { error: "No folder ID provided. Set GOOGLE_DRIVE_FOLDER_ID env var or send 'folder' field." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const { fileId, publicUrl } = await uploadBuffer(buffer, folderId, file.name);

    return NextResponse.json({
      success: true,
      fileId,
      publicUrl,
      fileName: file.name,
      size: buffer.length,
    });
  } catch (error) {
    console.error("POST /api/upload error:", error);
    return NextResponse.json(
      { error: `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}
