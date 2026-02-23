import { promises as fs } from 'fs';
import * as path from 'path';
import { ScannedFile, ProcessResult } from './types';
import { generateOutputName } from './namer';
import { compressImage } from './compressor';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function getFileSizeKB(filePath: string): Promise<number> {
  const stat = await fs.stat(filePath);
  return stat.size / 1024;
}

/**
 * Process a list of scanned files: compress each one and write to outputDir.
 * Failures per file are recorded and do NOT abort the batch.
 */
export async function processFiles(
  scannedFiles: ScannedFile[],
  slug: string,
  outputDir: string,
): Promise<ProcessResult[]> {
  const results: ProcessResult[] = [];

  for (let i = 0; i < scannedFiles.length; i++) {
    const file = scannedFiles[i];
    const index = i + 1;
    const outputName = generateOutputName(index, slug);
    const outputPath = path.join(outputDir, outputName);

    // Read original size
    let originalSizeKB = 0;
    try {
      originalSizeKB = await getFileSizeKB(file.filePath);
    } catch (e: any) {
      results.push({
        index,
        originalName: file.filename,
        outputName,
        originalSizeKB: 0,
        outputSizeKB: 0,
        quality: null,
        resizeScale: 1.0,
        targetSizeKB: 500,
        targetMet: false,
        status: 'read_error',
        message: e.message,
      });
      console.log(`  [FAIL] ${file.filename} -> read_error: ${e.message}`);
      continue;
    }

    // Compress
    let compressResult;
    try {
      compressResult = await compressImage(file.filePath);
    } catch (e: any) {
      results.push({
        index,
        originalName: file.filename,
        outputName,
        originalSizeKB: round2(originalSizeKB),
        outputSizeKB: 0,
        quality: null,
        resizeScale: 1.0,
        targetSizeKB: 500,
        targetMet: false,
        status: 'compress_error',
        message: e.message,
      });
      console.log(`  [FAIL] ${file.filename} -> compress_error: ${e.message}`);
      continue;
    }

    // Write output
    try {
      await fs.writeFile(outputPath, compressResult.buffer);
    } catch (e: any) {
      results.push({
        index,
        originalName: file.filename,
        outputName,
        originalSizeKB: round2(originalSizeKB),
        outputSizeKB: round2(compressResult.outputSizeKB),
        quality: compressResult.quality,
        resizeScale: compressResult.resizeScale,
        targetSizeKB: 500,
        targetMet: false,
        status: 'write_error',
        message: e.message,
      });
      console.log(`  [FAIL] ${outputName} -> write_error: ${e.message}`);
      continue;
    }

    const status = compressResult.targetMet ? 'ok' : 'cannot_reach_target';
    const marker = compressResult.targetMet ? '[OK  ]' : '[WARN]';
    const origKB = round2(originalSizeKB);
    const outKB = round2(compressResult.outputSizeKB);
    const resizeInfo =
      compressResult.resizeScale < 1.0
        ? `  resize=${Math.round(compressResult.resizeScale * 100)}%`
        : '';

    console.log(
      `  ${marker} ${outputName}  ${origKB}KB -> ${outKB}KB  q=${compressResult.quality}${resizeInfo}`,
    );

    results.push({
      index,
      originalName: file.filename,
      outputName,
      originalSizeKB: origKB,
      outputSizeKB: outKB,
      quality: compressResult.quality,
      resizeScale: compressResult.resizeScale,
      targetSizeKB: 500,
      targetMet: compressResult.targetMet,
      status,
      message: compressResult.targetMet
        ? undefined
        : 'Cannot reach 500KB target at minimum quality and resize thresholds',
    });
  }

  return results;
}
