// 実績詳細の Latest の選び方（works-detail「受け入れ条件 / 純粋関数」）
import { describe, expect, it } from 'vitest';
import type { Work } from '../../src/lib/domain/work';
import { selectLatestWorks } from '../../src/lib/related-works';

/** date 降順に並んだ n 件の実績 */
function worksOf(count: number): Work[] {
  const category = { id: 'cat-web', slug: 'web', name: 'Web', legacyWpSlugs: [] };
  return Array.from({ length: count }, (_, index) => ({
    id: `id-${index}`,
    slug: `work-${index}`,
    title: `Work ${index}`,
    category,
    thumbnail: {
      url: 'https://images.microcms-assets.io/x.png',
      width: 1200,
      height: 800,
      alt: '',
    },
    bodyHtml: '<p>body</p>',
    description: 'body',
    date: `2024-01-${String(28 - index).padStart(2, '0')}`,
    updatedAt: '2024-02-01T00:00:00.000Z',
    isDraftPreview: false,
  }));
}

const slugs = (works: Work[]) => works.map((work) => work.slug);

describe('selectLatestWorks', () => {
  const works = worksOf(5);

  it('excludes the first work and returns the next 3', () => {
    expect(selectLatestWorks(works, { excludeSlug: works[0].slug, limit: 3 })).toEqual(
      works.slice(1, 4),
    );
  });

  it('excludes a work in the middle', () => {
    expect(selectLatestWorks(works, { excludeSlug: works[2].slug, limit: 3 })).toEqual([
      works[0],
      works[1],
      works[3],
    ]);
  });

  it('returns the first 3 without excludeSlug or with an unknown slug', () => {
    expect(slugs(selectLatestWorks(works, { limit: 3 }))).toEqual(slugs(works.slice(0, 3)));
    expect(slugs(selectLatestWorks(works, { excludeSlug: 'nope', limit: 3 }))).toEqual(
      slugs(works.slice(0, 3)),
    );
  });

  it('returns what is left when fewer works remain', () => {
    const two = worksOf(2);
    expect(selectLatestWorks(two, { excludeSlug: two[0].slug, limit: 3 })).toEqual([two[1]]);
    const one = worksOf(1);
    expect(selectLatestWorks(one, { excludeSlug: one[0].slug, limit: 3 })).toEqual([]);
  });

  it('does not change the original array', () => {
    const before = [...works];
    selectLatestWorks(works, { excludeSlug: works[1].slug, limit: 3 });
    expect(works).toEqual(before);
    expect(slugs(works)).toEqual(slugs(before));
  });
});
