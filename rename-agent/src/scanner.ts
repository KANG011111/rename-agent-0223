import { promises as fs } from 'fs';
import * as path from 'path';
import { ScannedFile } from './types';

const SUPPORTED_EXTS = new Set(['.jpg', '.jpeg']);

/**
 * Scan a directory (single level) for JPG/JPEG files and return them
 * sorted by mtime ascending, then by filename ascending for ties.
 */
export async function scanDirectory(dirPath: string): Promise<ScannedFile[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const results: ScannedFile[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!SUPPORTED_EXTS.has(ext)) continue;

    const filePath = path.join(dirPath, entry.name);
    const stat = await fs.stat(filePath);
    results.push({ filePath, filename: entry.name, mtime: stat.mtime });
  }

  results.sort((a, b) => {
    const timeDiff = a.mtime.getTime() - b.mtime.getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.filename.localeCompare(b.filename);
  });

  return results;
}
