#!/usr/bin/env tsx

import { Command } from "commander";
import * as path from "path";
import * as fs from "fs";

const program = new Command();

program
  .name("generate-patch")
  .description("Generate a binary diff patch between two bundle files using bsdiff")
  .requiredOption("--old <path>", "Path to the old bundle file")
  .requiredOption("--new <path>", "Path to the new bundle file")
  .requiredOption("--output <path>", "Path for the output patch file")
  .parse(process.argv);

const opts = program.opts();

async function main() {
  const oldPath = path.resolve(opts.old as string);
  const newPath = path.resolve(opts.new as string);
  const outputPath = path.resolve(opts.output as string);

  if (!fs.existsSync(oldPath)) {
    console.error(`Error: Old bundle file not found: ${oldPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(newPath)) {
    console.error(`Error: New bundle file not found: ${newPath}`);
    process.exit(1);
  }

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Generating patch...`);
  console.log(`  Old: ${oldPath}`);
  console.log(`  New: ${newPath}`);
  console.log(`  Output: ${outputPath}`);

  try {
    const bsdiff = await import("bsdiff-node");
    await bsdiff.default.diff(oldPath, newPath, outputPath);

    const oldSize = fs.statSync(oldPath).size;
    const newSize = fs.statSync(newPath).size;
    const patchSize = fs.statSync(outputPath).size;
    const savings = ((1 - patchSize / newSize) * 100).toFixed(1);

    console.log(`\n✅ Patch generated successfully!`);
    console.log(`   Old bundle: ${(oldSize / 1024).toFixed(1)} KB`);
    console.log(`   New bundle: ${(newSize / 1024).toFixed(1)} KB`);
    console.log(`   Patch size: ${(patchSize / 1024).toFixed(1)} KB (${savings}% smaller than full bundle)`);
  } catch (error) {
    console.error("Failed to generate patch:", error);
    console.error("Make sure bsdiff-node is installed: npm install bsdiff-node");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Patch generation failed:", error);
  process.exit(1);
});
