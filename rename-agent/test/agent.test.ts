import * as os from 'os';
import * as path from 'path';
import { promises as fs } from 'fs';
import { scanDirectory } from '../src/scanner';
import { generateOutputName } from '../src/namer';
import { writeReport } from '../src/reporter';
import { ProcessResult } from '../src/types';

// ─── Namer ────────────────────────────────────────────────────────────────────

describe('generateOutputName', () => {
  it('formats index with leading zero below 10', () => {
    expect(generateOutputName(1, 'my-slug')).toBe('01-my-slug.jpg');
    expect(generateOutputName(9, 'my-slug')).toBe('09-my-slug.jpg');
  });

  it('uses two-digit index for numbers >= 10', () => {
    expect(generateOutputName(10, 'my-slug')).toBe('10-my-slug.jpg');
    expect(generateOutputName(25, 'my-slug')).toBe('25-my-slug.jpg');
  });

  it('always outputs .jpg extension', () => {
    expect(generateOutputName(1, 'test')).toMatch(/\.jpg$/);
  });

  it('embeds slug correctly', () => {
    expect(generateOutputName(3, 'bangkok-chocolate-village')).toBe(
      '03-bangkok-chocolate-village.jpg',
    );
  });
});

// ─── Scanner ──────────────────────────────────────────────────────────────────

describe('scanDirectory', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rename-agent-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns only jpg/jpeg files, ignores png/txt/json', async () => {
    await fs.writeFile(path.join(tmpDir, 'a.jpg'), 'x');
    await fs.writeFile(path.join(tmpDir, 'b.jpeg'), 'x');
    await fs.writeFile(path.join(tmpDir, 'c.png'), 'x');
    await fs.writeFile(path.join(tmpDir, 'd.txt'), 'x');
    await fs.writeFile(path.join(tmpDir, 'e.json'), 'x');

    const results = await scanDirectory(tmpDir);
    const names = results.map((r) => r.filename);
    expect(names).toContain('a.jpg');
    expect(names).toContain('b.jpeg');
    expect(names).not.toContain('c.png');
    expect(names).not.toContain('d.txt');
    expect(names).not.toContain('e.json');
  });

  it('ignores subdirectories', async () => {
    await fs.mkdir(path.join(tmpDir, 'subdir'));
    await fs.writeFile(path.join(tmpDir, 'a.jpg'), 'x');

    const results = await scanDirectory(tmpDir);
    expect(results).toHaveLength(1);
  });

  it('returns empty array when no jpg/jpeg files exist', async () => {
    await fs.writeFile(path.join(tmpDir, 'doc.txt'), 'hello');
    const results = await scanDirectory(tmpDir);
    expect(results).toHaveLength(0);
  });

  it('sorts by mtime ascending, then filename ascending for ties', async () => {
    const older = new Date('2024-01-01T00:00:00Z');
    const newer = new Date('2024-06-01T00:00:00Z');

    const fileA = path.join(tmpDir, 'a.jpg');
    const fileB = path.join(tmpDir, 'b.jpg');
    const fileC = path.join(tmpDir, 'c.jpg');

    await fs.writeFile(fileA, 'x');
    await fs.writeFile(fileB, 'x');
    await fs.writeFile(fileC, 'x');

    // Set mtimes: b=older, c=newer, a=older (same as b -> sorts by name)
    await fs.utimes(fileA, older, older);
    await fs.utimes(fileB, older, older);
    await fs.utimes(fileC, newer, newer);

    const results = await scanDirectory(tmpDir);
    expect(results.map((r) => r.filename)).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
  });

  it('is case-insensitive for extensions (.JPG, .JPEG)', async () => {
    await fs.writeFile(path.join(tmpDir, 'upper.JPG'), 'x');
    await fs.writeFile(path.join(tmpDir, 'mixed.Jpeg'), 'x');

    const results = await scanDirectory(tmpDir);
    const names = results.map((r) => r.filename);
    expect(names).toContain('upper.JPG');
    expect(names).toContain('mixed.Jpeg');
  });
});

// ─── Reporter ─────────────────────────────────────────────────────────────────

describe('writeReport', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rename-agent-report-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  function makeItem(overrides: Partial<ProcessResult> = {}): ProcessResult {
    return {
      index: 1,
      originalName: 'img.jpg',
      outputName: '01-test.jpg',
      originalSizeKB: 800,
      outputSizeKB: 450,
      quality: 85,
      resizeScale: 1.0,
      targetSizeKB: 500,
      targetMet: true,
      status: 'ok',
      ...overrides,
    };
  }

  it('writes a valid result.json', async () => {
    const items: ProcessResult[] = [makeItem()];
    await writeReport(tmpDir, 'test-slug', items, 3, 1);

    const raw = await fs.readFile(path.join(tmpDir, 'result.json'), 'utf-8');
    const report = JSON.parse(raw);

    expect(report.summary.slug).toBe('test-slug');
    expect(report.summary.inputDir).toBe('compress');
    expect(report.summary.outputDir).toBe('done-compress/test-slug');
    expect(report.summary.totalFound).toBe(3);
    expect(report.summary.processableCount).toBe(1);
    expect(report.items).toHaveLength(1);
  });

  it('counts targetMetCount and targetNotMetCount correctly', async () => {
    const items: ProcessResult[] = [
      makeItem({ index: 1, targetMet: true, status: 'ok' }),
      makeItem({ index: 2, targetMet: false, status: 'cannot_reach_target' }),
      makeItem({ index: 3, targetMet: false, status: 'read_error' }),
    ];
    await writeReport(tmpDir, 'slug', items, 3, 3);

    const raw = await fs.readFile(path.join(tmpDir, 'result.json'), 'utf-8');
    const report = JSON.parse(raw);

    expect(report.summary.targetMetCount).toBe(1);
    expect(report.summary.targetNotMetCount).toBe(1);
    expect(report.summary.failedCount).toBe(1);
  });
});