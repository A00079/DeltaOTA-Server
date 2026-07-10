#!/usr/bin/env tsx

import { Command } from "commander";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const program = new Command();

program
  .name("release")
  .description("Create a new OTA release")
  .requiredOption("--platform <platform>", "Platform: android or ios")
  .requiredOption("--js-version <number>", "JS version number")
  .option("--description <text>", "Release description", "")
  .option("--app-version <version>", "App version string", "1.0.0")
  .option("--server-url <url>", "Server URL", "http://localhost:3000")
  .option("--entry-file <file>", "React Native entry file", "index.js")
  .option("--skip-bundle", "Skip react-native bundle step")
  .parse(process.argv);

const opts = program.opts();

async function main() {
  const platform = opts.platform as string;
  const jsVersion = parseInt(opts.jsVersion, 10);
  const description = opts.description as string;
  const appVersion = opts.appVersion as string;
  const serverUrl = opts.serverUrl as string;
  const entryFile = opts.entryFile as string;

  if (!["android", "ios"].includes(platform)) {
    console.error("Error: platform must be android or ios");
    process.exit(1);
  }

  const appId = `investor-app-${platform}`;
  const bundlesDir = path.join(process.cwd(), "bundles");

  if (!fs.existsSync(bundlesDir)) {
    fs.mkdirSync(bundlesDir, { recursive: true });
  }

  const existingBundles = fs
    .readdirSync(bundlesDir)
    .filter((f) => f.startsWith(`${appId}-v${jsVersion}-`) && f.endsWith(".bundle"))
    .map((f) => {
      const match = f.match(/v\d+-b(\d+)\.bundle/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .sort((a, b) => a - b);

  const bundleVersion = existingBundles.length > 0 ? existingBundles[existingBundles.length - 1] + 1 : 1;
  const bundleFileName = `${appId}-v${jsVersion}-b${bundleVersion}.bundle`;
  const bundlePath = path.join(bundlesDir, bundleFileName);

  if (!opts.skipBundle) {
    console.log(`Generating bundle for ${platform}...`);
    try {
      const outputDir = path.dirname(bundlePath);
      execSync(
        `npx react-native bundle ` +
          `--platform ${platform} ` +
          `--dev false ` +
          `--entry-file ${entryFile} ` +
          `--bundle-output ${bundlePath} ` +
          `--assets-dest ${outputDir}`,
        { stdio: "inherit" }
      );
    } catch (error) {
      console.error("Failed to generate bundle. Make sure react-native CLI is available.");
      console.error("You can also use --skip-bundle and provide your own bundle file.");
      process.exit(1);
    }
  } else {
    if (!fs.existsSync(bundlePath)) {
      console.error(`Bundle file not found at: ${bundlePath}`);
      console.error("Place your bundle file there or remove --skip-bundle flag.");
      process.exit(1);
    }
  }

  console.log("Computing hash...");
  const bundleContent = fs.readFileSync(bundlePath);
  const hash = crypto.createHash("md5").update(bundleContent).digest("hex");
  console.log(`Hash: ${hash}`);

  let patchUrl: string | undefined;
  if (bundleVersion > 1) {
    const prevBundleVersion = bundleVersion - 1;
    const prevBundleName = `${appId}-v${jsVersion}-b${prevBundleVersion}.bundle`;
    const prevBundlePath = path.join(bundlesDir, prevBundleName);

    if (fs.existsSync(prevBundlePath)) {
      console.log(`Generating patch from bundle v${prevBundleVersion} to v${bundleVersion}...`);
      const patchFileName = `${appId}-v${jsVersion}-b${prevBundleVersion}-to-b${bundleVersion}.patch`;
      const patchPath = path.join(bundlesDir, patchFileName);

      try {
        const bsdiff = await import("bsdiff-node");
        await bsdiff.default.diff(prevBundlePath, bundlePath, patchPath);
        console.log(`Patch generated: ${patchFileName}`);

        console.log("Uploading patch to server...");
        const patchForm = new FormData();
        const patchBuffer = fs.readFileSync(patchPath);
        patchForm.append("file", new Blob([patchBuffer]), patchFileName);

        const patchUploadRes = await fetch(`${serverUrl}/api/upload`, {
          method: "POST",
          body: patchForm,
        });

        if (patchUploadRes.ok) {
          const patchData = await patchUploadRes.json();
          patchUrl = patchData.publicUrl;
          console.log(`Patch uploaded: ${patchUrl}`);
        } else {
          console.warn("Patch upload failed, continuing without patch URL");
        }
      } catch (error) {
        console.warn("Failed to generate patch (bsdiff-node may not be installed):", error);
      }
    }
  }

  console.log("Uploading bundle...");
  const bundleForm = new FormData();
  bundleForm.append("file", new Blob([bundleContent]), bundleFileName);

  const uploadRes = await fetch(`${serverUrl}/api/upload`, {
    method: "POST",
    body: bundleForm,
  });

  if (!uploadRes.ok) {
    const errorData = await uploadRes.json();
    console.error("Bundle upload failed:", errorData.error);
    process.exit(1);
  }

  const uploadData = await uploadRes.json();
  const bundleUrl = uploadData.publicUrl;
  console.log(`Bundle uploaded: ${bundleUrl}`);

  console.log("Creating release...");
  const releaseRes = await fetch(`${serverUrl}/api/releases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      appId,
      platform,
      jsVersion,
      bundleVersion,
      hash,
      bundleUrl,
      patchUrl,
      isMandatory: false,
      description,
      appVersion,
    }),
  });

  if (!releaseRes.ok) {
    const errorData = await releaseRes.json();
    console.error("Failed to create release:", errorData.error);
    process.exit(1);
  }

  const releaseData = await releaseRes.json();
  console.log("\n✅ Release created successfully!");
  console.log(`   App ID: ${releaseData.release.appId}`);
  console.log(`   JS Version: ${releaseData.release.jsVersion}`);
  console.log(`   Bundle Version: ${releaseData.release.bundleVersion}`);
  console.log(`   Hash: ${releaseData.release.hash}`);
  console.log(`   State: CREATED (promote to STAGING → LIVE to make available)`);
}

main().catch((error) => {
  console.error("Release failed:", error);
  process.exit(1);
});
