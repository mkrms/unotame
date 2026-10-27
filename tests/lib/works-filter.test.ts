// 実績一覧の絞り込みの純粋関数（works-list「受け入れ条件 / 純粋関数」）
import { describe, expect, it } from 'vitest';
import { routes } from '../../src/lib/routes';
import {
  buildFilterUrl,
  CATEGORY_QUERY_KEY,
  describeFilterResult,
  isWorkVisible,
  resolveFilterFromSearch,
} from '../../src/lib/works-filter';

const known = ['web', 'design'];

describe('resolveFilterFromSearch', () => {
  it('returns the slug when it is known', () => {
    expect(resolveFilterFromSearch('?category=web', known)).toBe('web');
  });

  it.each(['', '?category=', '?category=unknown', '?category=WEB', '?foo=bar'])(
    'returns null for %j',
    (search) => {
      expect(resolveFilterFromSearch(search, known)).toBeNull();
    },
  );

  it('uses the first value when the key is repeated', () => {
    expect(resolveFilterFromSearch('?category=design&category=web', known)).toBe('design');
  });

  it('uses "category" as the query key', () => {
    expect(CATEGORY_QUERY_KEY).toBe('category');
  });
});

describe('isWorkVisible', () => {
  it('shows everything for null and the matching category only otherwise', () => {
    expect(isWorkVisible('web', null)).toBe(true);
    expect(isWorkVisible('web', 'web')).toBe(true);
    expect(isWorkVisible('web', 'design')).toBe(false);
  });
});

describe('buildFilterUrl', () => {
  it('sets and removes the category', () => {
    expect(buildFilterUrl('/works/', 'web')).toBe('/works/?category=web');
    expect(buildFilterUrl('/works/?category=web', null)).toBe('/works/');
  });

  it('keeps other queries and the hash', () => {
    const result = buildFilterUrl('/works/?utm_source=x&category=web#top', 'design');
    const url = new URL(result, 'http://localhost');
    expect(url.pathname).toBe('/works/');
    expect(url.searchParams.get('utm_source')).toBe('x');
    expect(url.searchParams.getAll('category')).toEqual(['design']);
    expect(url.hash).toBe('#top');
  });

  it('keeps other queries when removing the category', () => {
    expect(buildFilterUrl('/works/?utm_source=x&category=web#top', null)).toBe(
      '/works/?utm_source=x#top',
    );
  });

  it('matches routes.works()', () => {
    expect(buildFilterUrl('/works/', 'web')).toBe(routes.works({ category: 'web' }));
    expect(buildFilterUrl('/works/?category=web', null)).toBe(routes.works());
  });
});

describe('describeFilterResult', () => {
  it('describes "all" with the count', () => {
    const text = describeFilterResult(null, undefined, 12);
    expect(text).toContain('すべて');
    expect(text).toContain('12');
  });

  it('describes a category with its name and the count', () => {
    const text = describeFilterResult('web', 'Web', 3);
    expect(text).toContain('Web');
    expect(text).toContain('3');
    expect(text).toBe('Web の実績 3 件を表示しています');
  });
});
