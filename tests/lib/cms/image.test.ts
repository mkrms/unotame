import { describe, expect, it } from 'vitest';
import { cmsImageUrl } from '../../../src/lib/cms/image';

const base = 'https://images.microcms-assets.io/assets/abc/def/photo.png';

describe('cmsImageUrl', () => {
  it('appends w and fm', () => {
    expect(cmsImageUrl({ url: base }, { width: 600, format: 'webp' })).toBe(
      `${base}?w=600&fm=webp`,
    );
  });

  it('joins with & when the URL already has a query', () => {
    expect(cmsImageUrl({ url: `${base}?foo=1` }, { width: 600, format: 'webp' })).toBe(
      `${base}?foo=1&w=600&fm=webp`,
    );
  });

  it('leaves SVG untouched', () => {
    const svg = 'https://images.microcms-assets.io/assets/abc/def/logo.SVG';
    expect(cmsImageUrl({ url: svg }, { width: 600, format: 'webp' })).toBe(svg);
  });

  it('returns the URL as is without options', () => {
    expect(cmsImageUrl({ url: base })).toBe(base);
  });

  it('supports height, fit and quality', () => {
    expect(
      cmsImageUrl(
        { url: base },
        { width: 800, height: 600, fit: 'crop', format: 'webp', quality: 80 },
      ),
    ).toBe(`${base}?w=800&h=600&fit=crop&fm=webp&q=80`);
  });
});
