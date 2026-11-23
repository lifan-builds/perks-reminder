import fs from 'node:fs';
import path from 'node:path';
import { predefinedCardsData } from '@/lib/static-catalog';

interface ManifestImage {
  catalogKey: string;
  filename: string;
  path: string;
  role: 'primary' | 'legacy-alias';
  source: string;
  sourceUrl: string | null;
  width: number;
  height: number;
  sha256: string;
}

const root = process.cwd();
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, 'public/images/cards/manifest.json'), 'utf8')
) as { generator: string; images: ManifestImage[] };

describe('self-owned card art', () => {
  it('ships studio-generated art for every catalog card at the ID-1 aspect ratio', () => {
    for (const card of predefinedCardsData) {
      expect(card.imageUrl).toMatch(/^\/images\/cards\/.+\.(png|webp|avif)$/);
      const entry = manifest.images.find((image) => image.path === card.imageUrl);
      expect(entry).toEqual(expect.objectContaining({ catalogKey: card.catalogKey, role: 'primary', source: 'studio-generated' }));
      expect(fs.existsSync(path.join(root, 'public', card.imageUrl!))).toBe(true);
      expect(Math.abs(entry!.width / entry!.height - 85.6 / 53.98)).toBeLessThan(0.002);
    }
  });

  it('contains no third-party image in the card art directory', () => {
    const files = fs.readdirSync(path.join(root, 'public/images/cards')).filter((file) => file !== 'manifest.json');
    expect(files.sort()).toEqual(manifest.images.map((image) => image.filename).sort());
    for (const image of manifest.images) {
      expect(image.source).toBe('studio-generated');
      expect(image.sourceUrl).toBeNull();
    }
  });

  it('gives each card a distinct artwork', () => {
    const primaries = manifest.images.filter((image) => image.role === 'primary');
    expect(new Set(primaries.map((image) => image.sha256)).size).toBe(primaries.length);
  });
});
