import { promises as fs } from 'fs';
import * as path from 'path';

export class RenameAgent {
    private slug?: string;

    constructor() {
        // no-op
    }

    // If first arg is string -> slug-only invocation; if array -> filePaths and slug must be provided
    public async renameFiles(filePathsOrSlug: string | string[], slug?: string): Promise<any> {
        if (typeof filePathsOrSlug === 'string') {
            // CLI invoked with only slug
            this.slug = filePathsOrSlug;
            console.log(`No files provided. Received slug: ${filePathsOrSlug}`);
            return;
        }

        const filePaths = filePathsOrSlug;
        if (!slug) throw new Error('Slug must be provided when providing files to rename');
        this.slug = slug;

        const sortedFiles = await this.sortFilesByCreationTime(filePaths);

        for (let index = 0; index < sortedFiles.length; index++) {
            const filePath = sortedFiles[index];
            const ext = path.extname(filePath) || '.jpeg';
            const newFileName = this.generateNewFileName(index + 1, ext);
            await this.renameFile(filePath, newFileName);
        }

        return filePaths.map((p, i) => ({ originalName: p, newName: this.generateNewFileName(i + 1, path.extname(p) || '.jpeg') }));
    }

    private async sortFilesByCreationTime(filePaths: string[]): Promise<string[]> {
        const entries = await Promise.all(filePaths.map(async (p) => {
            const stats = await fs.stat(p);
            return { path: p, birthtime: stats.birthtime };
        }));
        entries.sort((a, b) => a.birthtime.getTime() - b.birthtime.getTime());
        return entries.map(e => e.path);
    }

    private generateNewFileName(index: number, ext: string): string {
        const formattedIndex = String(index).padStart(2, '0');
        return `${formattedIndex}-${this.slug ?? 'unnamed'}${ext}`;
    }

    private async renameFile(oldPath: string, newFileName: string): Promise<void> {
        const dir = path.dirname(oldPath);
        const newPath = path.join(dir, newFileName);
        await fs.rename(oldPath, newPath);
        console.log(`Renamed: ${oldPath} -> ${newPath}`);
    }
}