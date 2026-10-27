import { describe, expect, it } from 'vitest';
import {
  RESERVED_SLUGS,
  assertValidWorkSlugs,
  categorySlugProblems,
  collectWorkSlugViolations,
  workSlugProblems,
} from '../../src/lib/slug';

describe('workSlugProblems (url-design)', () => {
  it.each(['unotame-portfolio', 'site2024', 'abc', 'a1-b2', 'a'.repeat(60)])(
    'accepts %s',
    (slug) => {
      expect(workSlugProblems(slug)).toEqual([]);
    },
  );

  it.each([
    'ABC',
    'abc_def',
    '-abc',
    'abc-',
    'a--b',
    '123',
    'ポートフォリオ',
    'page',
    'a'.repeat(61),
    'ab',
    'a',
    'z',
    '',
    'abc def',
  ])('rejects %j', (slug) => {
    expect(workSlugProblems(slug).length).toBeGreaterThan(0);
  });

  it('rejects every reserved word', () => {
    for (const slug of RESERVED_SLUGS) {
      expect(workSlugProblems(slug).length, slug).toBeGreaterThan(0);
    }
  });
});

describe('categorySlugProblems', () => {
  it.each(['web', '2024', 'a', 'web-design'])('accepts %s', (slug) => {
    expect(categorySlugProblems(slug)).toEqual([]);
  });

  it.each(['Web', 'web_design', '-web', 'web-', 'w--b', '', 'a'.repeat(41)])(
    'rejects %j',
    (slug) => {
      expect(categorySlugProblems(slug).length).toBeGreaterThan(0);
    },
  );
});

describe('collectWorkSlugViolations / assertValidWorkSlugs', () => {
  it('passes valid, unique input', () => {
    expect(() =>
      assertValidWorkSlugs([
        { slug: 'foo-bar', legacyWpId: 1 },
        { slug: 'baz', legacyWpId: 2 },
        { slug: 'qux' },
      ]),
    ).not.toThrow();
  });

  it('throws on duplicate slugs with the slug in the message', () => {
    expect(() => assertValidWorkSlugs([{ slug: 'same-slug' }, { slug: 'same-slug' }])).toThrow(
      /same-slug/,
    );
  });

  it('throws on duplicate legacyWpId with the ID and slugs in the message', () => {
    expect(() =>
      assertValidWorkSlugs([
        { slug: 'first', legacyWpId: 123 },
        { slug: 'second', legacyWpId: 123 },
      ]),
    ).toThrow(/123[\s\S]*first[\s\S]*second/);
  });

  it('collects every violation instead of stopping at the first', () => {
    const violations = collectWorkSlugViolations([
      { id: 'a', slug: 'ABC' },
      { id: 'b', slug: 'dup' },
      { id: 'c', slug: 'dup' },
      { id: 'd', slug: 'page' },
    ]);
    const text = violations.join('\n');
    expect(text).toContain('id=a slug="ABC"');
    expect(text).toContain('id=d slug="page"');
    expect(text).toMatch(/"dup".*id=b.*id=c/);
  });
});
