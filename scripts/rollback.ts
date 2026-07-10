#!/usr/bin/env tsx

import { Command } from "commander";

const program = new Command();

program
  .name("rollback")
  .description("Rollback a live release (disables it, triggering SDK rollback)")
  .requiredOption("--app-id <appId>", "App ID to rollback")
  .requiredOption("--js-version <number>", "JS version number")
  .option("--bundle-version <number>", "Specific bundle version to rollback (defaults to latest live)")
  .option("--server-url <url>", "Server URL", "http://localhost:3000")
  .parse(process.argv);

const opts = program.opts();

async function main() {
  const appId = opts.appId as string;
  const jsVersion = parseInt(opts.jsVersion, 10);
  const bundleVersion = opts.bundleVersion ? parseInt(opts.bundleVersion, 10) : undefined;
  const serverUrl = opts.serverUrl as string;

  console.log(`Rolling back ${appId} (jsVersion=${jsVersion})...`);

  const body: Record<string, unknown> = { appId, jsVersion };
  if (bundleVersion !== undefined) {
    body.bundleVersion = bundleVersion;
  }

  const res = await fetch(`${serverUrl}/api/rollback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (res.ok) {
    console.log("\n✅ Rollback successful!");
    console.log(`   ${data.message}`);
    console.log(`   Bundle Version: ${data.release.bundleVersion}`);
    console.log(`   New State: DISABLED`);
    console.log(`   SDK will trigger rollback on next check_update call.`);
  } else {
    console.error(`\n❌ Rollback failed: ${data.error}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Rollback failed:", error);
  process.exit(1);
});
