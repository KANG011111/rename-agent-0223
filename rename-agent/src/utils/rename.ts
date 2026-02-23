function generateNewFileName(slug: string, index: number): string {
    const formattedIndex = String(index).padStart(2, '0');
    return `${formattedIndex}-${slug}.jpeg`;
}