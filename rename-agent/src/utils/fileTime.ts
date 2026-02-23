export function getFileCreationTime(filePath: string): Promise<Date> {
    return new Promise((resolve, reject) => {
        const fs = require('fs');
        fs.stat(filePath, (err: NodeJS.ErrnoException | null, stats: fs.Stats) => {
            if (err) {
                reject(err);
            } else {
                resolve(stats.birthtime);
            }
        });
    });
}