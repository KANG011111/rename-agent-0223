import sharp from 'sharp';

export const TARGET_SIZE_KB = 500;

// Phase 1: quality-only steps (high → low)
const QUALITY_STEPS = [90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40];

// Phase 2: resize fallback — apply at the lowest quality
const RESIZE_QUALITY = 40;
const RESIZE_SCALE_STEP = 0.8; // shrink to 80% each round
const MIN_RESIZE_SCALE = 0.1;  // stop if we've scaled below 10% of original

export interface CompressResult {
  buffer: Buffer;
  quality: number;
  targetMet: boolean;
  outputSizeKB: number;
  /** resize scale applied (1.0 = no resize, 0.8 = 80%, etc.) */
  resizeScale: number;
}

/**
 * Compress a JPEG image to try to reach TARGET_SIZE_KB.
 *
 * Strategy:
 *  1. Try descending JPEG quality steps (90 → 40). Stop as soon as target is met.
 *  2. If still over target at quality 40, progressively resize (0.8x each round)
 *     at quality 40 until target is met or scale drops below MIN_RESIZE_SCALE.
 *  3. Always saves the best-effort result; targetMet will be false if we give up.
 */
export async function compressImage(inputPath: string): Promise<CompressResult> {
  let buffer: Buffer = Buffer.alloc(0);
  let finalQuality = QUALITY_STEPS[QUALITY_STEPS.length - 1];
  let resizeScale = 1.0;
  let targetMet = false;

  // ── Phase 1: quality reduction ────────────────────────────────────────────
  for (const quality of QUALITY_STEPS) {
    buffer = await sharp(inputPath)
      .jpeg({ quality, mozjpeg: false })
      .toBuffer();

    finalQuality = quality;

    if (buffer.length / 1024 <= TARGET_SIZE_KB) {
      targetMet = true;
      break;
    }
  }

  // ── Phase 2: resize fallback ───────────────────────────────────────────────
  if (!targetMet) {
    const meta = await sharp(inputPath).metadata();
    const origWidth = meta.width ?? 0;
    const origHeight = meta.height ?? 0;

    let scale = RESIZE_SCALE_STEP; // start at 80%

    while (scale >= MIN_RESIZE_SCALE) {
      const newWidth = Math.round(origWidth * scale);
      const newHeight = Math.round(origHeight * scale);

      buffer = await sharp(inputPath)
        .resize(newWidth, newHeight, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: RESIZE_QUALITY, mozjpeg: false })
        .toBuffer();

      resizeScale = scale;

      if (buffer.length / 1024 <= TARGET_SIZE_KB) {
        targetMet = true;
        break;
      }

      scale = Math.round(scale * RESIZE_SCALE_STEP * 100) / 100;
    }
  }

  const outputSizeKB = buffer.length / 1024;

  return { buffer, quality: finalQuality, targetMet, outputSizeKB, resizeScale };
}

