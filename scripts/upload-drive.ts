#!/usr/bin/env tsx

import { Command } from "commander";
import * as path from "path";
import * as fs from "fs";

const program = new Command();

program
  .name("upload-drive")
  .description("Upload a file to Google Drive via the OTA server")
  .requiredOption("--file <path>", "Path to the file to upload")
  .option("--folder <folderId>", "Google Drive folder ID (uses env default if not set)")
  .option("--server-url <url>", "Server URL", "http://localhost:3000")
  .parse(process.argv);

const opts = program.opts();

async function main() {
  const filePath = path.resolve(opts.file as string);
  const serverUrl = opts.serverUrl as string;
  const folder = opts.folder as string | undefined;

  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  const fileName = path.basename(filePath);
  const fileSize = fs.statSync(filePath).size;

  console.log(`Uploading ${fileName} (${(fileSize / 1024).toFixed(1)} KB)...`);

  const fileBuffer = fs.readFileSync(filePath);
  const formData = new FormData();
  formData.append("file", new Blob([fileBuffer]), fileName);
  if (folder) {
    formData.append("folder", folder);
  }

  const res = await fetch(`${serverUrl}/api/upload`, {
    method: "POST",
    body: formData,
  });

  const data = await res.json();

  if (res.ok) {
    console.log(`\n✅ Upload successful!`);
    console.log(`   File ID: ${data.fileId}`);
    console.log(`   Public URL: ${data.publicUrl}`);
    console.log(`   Size: ${(data.size / 1024).toFixed(1)} KB`);
  } else {
    console.error(`\n❌ Upload failed: ${data.error}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Upload failed:", error);
  process.exit(1);
});
