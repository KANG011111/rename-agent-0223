/**
 * Generate the output filename for a given sequential index and slug.
 * Format: NN-<slug>.jpg  (e.g. 01-bangkok-chocolate-village.jpg)
 */
export function generateOutputName(index: number, slug: string): string {
  const formattedIndex = String(index).padStart(2, '0');
  return `${formattedIndex}-${slug}.jpg`;
}
