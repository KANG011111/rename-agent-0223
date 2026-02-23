export type StatusCode =
  | 'ok'
  | 'cannot_reach_target'
  | 'read_error'
  | 'compress_error'
  | 'write_error'
  | 'skipped_unsupported';

export interface ScannedFile {
  filePath: string;
  filename: string;
  mtime: Date;
}

export interface ProcessResult {
  index: number;
  originalName: string;
  outputName: string;
  originalSizeKB: number;
  outputSizeKB: number;
  quality: number | null;
  /** 1.0 = no resize; < 1.0 = scaled down (e.g. 0.64 = 64% of original dimensions) */
  resizeScale: number;
  targetSizeKB: number;
  targetMet: boolean;
  status: StatusCode;
  message?: string;
}

export interface ReportSummary {
  slug: string;
  inputDir: string;
  outputDir: string;
  totalFound: number;
  processableCount: number;
  processedCount: number;
  targetMetCount: number;
  targetNotMetCount: number;
  failedCount: number;
  skippedCount: number;
}

export interface Report {
  summary: ReportSummary;
  items: ProcessResult[];
}

// Legacy – kept for backward compatibility
export interface FileInfo {
  name: string;
  creationTime: Date;
}