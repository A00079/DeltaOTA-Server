#!/usr/bin/env tsx

import { Command } from "commander";

const program = new Command();

program
  .name("promote")
  .description("Promote a release to a new state (CREATED → STAGING → LIVE)")
  .requiredOption("--app-id <appId>", "App ID")
  .requiredOption("--js-version <number>", "JS version number")
  .requiredOption("--bundle-version <number>", "Bundle version number")
  .option("--state <state>", "Target state: staging, live, halted, disabled, deleted")
  .option("--rollout <number>", "Rollout percentage (0-100)")
  .option("--server-url <url>", "Server URL", "http://localhost:3000")
  .parse(process.argv);

const opts = program.opts();

const STATE_MAP: Record<string, number> = {
  created: 0,
  staging: 10,
  live: 20,
  halted: 25,
  disabled: 30,
  deleted: 40,
};

async function main() {
  const appId = opts.appId as string;
  const jsVersion = parseInt(opts.jsVersion, 10);
  const bundleVersion = parseInt(opts.bundleVersion, 10);
  const serverUrl = opts.serverUrl as string;

  const body: Record<string, unknown> = {
    appId,
    jsVersion,
    bundleVersion,
  };

  if (opts.state) {
    const stateStr = (opts.state as string).toLowerCase();
    const stateValue = STATE_MAP[stateStr];
    if (stateValue === undefined) {
      console.error(`Error: Invalid state "${opts.state}". Valid: ${Object.keys(STATE_MAP).join(", ")}`);
      process.exit(1);
    }
    body.releaseState = stateValue;
  }

  if (opts.rollout !== undefined) {
    const rollout = parseInt(opts.rollout, 10);
    if (isNaN(rollout) || rollout < 0 || rollout > 100) {
      console.error("Error: rollout must be between 0 and 100");
      process.exit(1);
    }
    body.rollout = rollout;
  }

  if (!opts.state && opts.rollout === undefined) {
    console.error("Error: Provide at least --state or --rollout");
    process.exit(1);
  }

  console.log(`Updating release: ${appId} v${jsVersion}.${bundleVersion}...`);
  if (opts.state) console.log(`  State → ${opts.state}`);
  if (opts.rollout !== undefined) console.log(`  Rollout → ${opts.rollout}%`);

  const res = await fetch(`${serverUrl}/api/releases/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (res.ok) {
    console.log(`\n✅ Release updated successfully!`);
    console.log(`   App ID: ${data.release.appId}`);
    console.log(`   State: ${data.release.releaseState}`);
    console.log(`   Rollout: ${data.release.rollout}%`);
  } else {
    console.error(`\n❌ Update failed: ${data.error}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Promote failed:", error);
  process.exit(1);
});
