import { promises as fs } from 'fs';
import * as path from 'path';
import { scanDirectory } from './scanner';
import { processFiles } from './processor';
import { writeReport } from './reporter';

// Fixed paths: workspace root is two levels up from src/ (rename-agent/src -> rename-agent -> workspace)
const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const INPUT_DIR = path.join(WORKSPACE_ROOT, 'compress');
const OUTPUT_ROOT = path.join(WORKSPACE_ROOT, 'done-compress');

const SLUG_PATTERN = /^[a-z0-9-]+$/;

function validateSlug(raw: string): { slug: string; error?: string } {
  const slug = raw.trim();
  if (!slug) return { slug, error: 'Slug cannot be empty.' };
  if (!SLUG_PATTERN.test(slug)) {
    return {
      slug,
      error: `Invalid slug "${slug}". Only lowercase letters (a-z), digits (0-9), and hyphens (-) are allowed.`,
    };
  }
  return { slug };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npm start -- <slug>');
    console.error('Example: npm start -- bangkok-chocolate-village');
    process.exit(1);
  }

  const { slug, error: slugError } = validateSlug(args[0]);
  if (slugError) {
    console.error(`Error: ${slugError}`);
    console.error('Usage: npm start -- <slug>');
    process.exit(1);
  }

  // Validate compress/ input directory
  try {
    const stat = await fs.stat(INPUT_DIR);
    if (!stat.isDirectory()) {
      console.error(`Error: "${INPUT_DIR}" exists but is not a directory.`);
      process.exit(1);
    }
  } catch {
    console.error(`Error: Input directory "${INPUT_DIR}" does not exist.`);
    process.exit(1);
  }

  const outputDir = path.join(OUTPUT_ROOT, slug);

  // Strategy: error-stop if output dir already exists
  try {
    await fs.access(outputDir);
    console.error(
      `Error: Output directory "${outputDir}" already exists.\n` +
        `Remove it first to avoid overwriting: rm -rf "${outputDir}"`,
    );
    process.exit(1);
  } catch {
    // Directory does not exist — safe to proceed
  }

  // Startup info
  console.log('=== Rename + Compress Agent (MVP v0.1) ===');
  console.log(`Slug      : ${slug}`);
  console.log(`Input     : ${INPUT_DIR}`);
  console.log(`Output    : ${outputDir}`);
  console.log('');

  // Scan
  console.log('Scanning input directory...');
  const allEntries = await fs.readdir(INPUT_DIR, { withFileTypes: true });
  const totalFound = allEntries.filter((e) => e.isFile()).length;
  const scannedFiles = await scanDirectory(INPUT_DIR);

  console.log(`Total files found : ${totalFound}`);
  console.log(`JPG/JPEG files    : ${scannedFiles.length}`);
  console.log('');

  if (scannedFiles.length === 0) {
    console.log('No JPG/JPEG files found in compress/. Nothing to process.');
    process.exit(0);
  }

  // Create output directories
  await fs.mkdir(OUTPUT_ROOT, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });

  // Process
  console.log('Processing files...');
  const results = await processFiles(scannedFiles, slug, outputDir);
  console.log('');

  // Write report
  let reportPath: string;
  try {
    reportPath = await writeReport(outputDir, slug, results, totalFound, scannedFiles.length);
  } catch (e: any) {
    console.error(`Warning: Could not write result.json: ${e.message}`);
    reportPath = path.join(outputDir, 'result.json');
  }

  // Final summary
  const processedCount = results.filter(
    (i) => !['read_error', 'compress_error'].includes(i.status),
  ).length;
  const targetMetCount = results.filter((i) => i.targetMet).length;
  const targetNotMetCount = results.filter((i) => i.status === 'cannot_reach_target').length;
  const failedCount = results.filter((i) =>
    (['read_error', 'compress_error', 'write_error'] as string[]).includes(i.status),
  ).length;

  console.log('=== Summary ===');
  console.log(`Total JPG/JPEG  : ${scannedFiles.length}`);
  console.log(`Processed       : ${processedCount}`);
  console.log(`Target met      : ${targetMetCount}`);
  console.log(`Target not met  : ${targetNotMetCount}`);
  console.log(`Failed          : ${failedCount}`);
  console.log(`Output dir      : ${outputDir}`);
  console.log(`Report          : ${reportPath}`);
}

main().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});