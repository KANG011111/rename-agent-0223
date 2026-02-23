import { promises as fs } from 'fs';
import * as path from 'path';
import { ProcessResult, Report, ReportSummary } from './types';

/**
 * Write result.json to outputDir with item-level details and a batch summary.
 */
export async function writeReport(
  outputDir: string,
  slug: string,
  items: ProcessResult[],
  totalFound: number,
  processableCount: number,
): Promise<string> {
  const processedCount = items.filter(
    (i) => !['read_error', 'compress_error'].includes(i.status),
  ).length;
  const targetMetCount = items.filter((i) => i.targetMet).length;
  const targetNotMetCount = items.filter((i) => i.status === 'cannot_reach_target').length;
  const failedCount = items.filter((i) =>
    (['read_error', 'compress_error', 'write_error'] as string[]).includes(i.status),
  ).length;
  const skippedCount = items.filter((i) => i.status === 'skipped_unsupported').length;

  const summary: ReportSummary = {
    slug,
    inputDir: 'compress',
    outputDir: `done-compress/${slug}`,
    totalFound,
    processableCount,
    processedCount,
    targetMetCount,
    targetNotMetCount,
    failedCount,
    skippedCount,
  };

  const report: Report = { summary, items };
  const reportPath = path.join(outputDir, 'result.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  return reportPath;
}
