import { describe, expect, it } from 'vitest';
import { loadContent } from '../../../src/lib/cms';
import type { CmsConfig } from '../../../src/lib/cms/config';
import { createFixtureSource } from '../../../src/lib/cms/fixture-source';
import type { RawCategory, RawListResponse, RawWork } from '../../../src/lib/cms/raw-types';
import {
  CmsValidationError,
  assertValidContent,
  collectViolations,
} from '../../../src/lib/cms/validate';
import invalidWorks from '../../fixtures/invalid-works.json';
import invalidCategories from '../../fixtures/invalid-categories.json';
import { rawCategory, rawWork } from './helpers';

const works = invalidWorks as unknown as RawListResponse<RawWork>;
const categories = invalidCategories as unknown as RawListResponse<RawCategory>;
const buildConfig: CmsConfig = {
  source: 'microcms',
  serviceDomain: 'svc',
  apiKey: 'key',
  previewDrafts: [],
  isDev: false,
};

function violationsFor(workList: RawWork[], categoryList: RawCategory[] = [rawCategory()]) {
  return collectViolations(workList, categoryList);
}

/** 対象（ID と slug）と違反の種類の両方を含む違反を返す */
function matching(violations: readonly string[], label: string, kind: string) {
  return violations.filter((violation) => violation.includes(label) && violation.includes(kind));
}

// [名前, 実績, 対象のラベル, 違反の種類]。既定の rawWork / rawCategory は検証を通るので、違反はちょうど 1 件
const workCases: [string, RawWork[], string, string][] = [
  [
    'slug rule',
    [rawWork({ id: 'w1', slug: 'ABC' })],
    'id=w1 slug="ABC"',
    'slug は英小文字・数字・ハイフンのみ',
  ],
  ['reserved slug', [rawWork({ id: 'w1', slug: 'page' })], 'id=w1 slug="page"', '予約語'],
  ['1-character slug', [rawWork({ id: 'w1', slug: 'a' })], 'id=w1 slug="a"', '3〜60 文字'],
  [
    'duplicate slug',
    [rawWork({ id: 'w1', slug: 'same' }), rawWork({ id: 'w2', slug: 'same' })],
    'id=w2 slug="same"',
    'slug "same" が重複しています',
  ],
  [
    'duplicate legacyWpId',
    [
      rawWork({ id: 'w1', slug: 'one', legacyWpId: 7 }),
      rawWork({ id: 'w2', slug: 'two', legacyWpId: 7 }),
    ],
    'id=w2 slug="two"',
    'legacyWpId 7 が重複しています',
  ],
  [
    'non-positive legacyWpId',
    [rawWork({ id: 'w1', slug: 'one', legacyWpId: 0 })],
    'id=w1 slug="one"',
    'legacyWpId は正の整数',
  ],
  [
    'category null',
    [rawWork({ id: 'w1', slug: 'one', category: null })],
    'id=w1 slug="one"',
    'category の参照がありません',
  ],
  [
    'category not in the list',
    [rawWork({ id: 'w1', slug: 'one', category: rawCategory({ id: 'cat-x' }) })],
    'id=w1 slug="one"',
    'category の参照先（id=cat-x）が公開中のカテゴリ一覧にありません',
  ],
  [
    'blank title',
    [rawWork({ id: 'w1', slug: 'one', title: ' ' })],
    'id=w1 slug="one"',
    'title が空',
  ],
  [
    'missing thumbnail',
    [rawWork({ id: 'w1', slug: 'one', thumbnail: undefined })],
    'id=w1 slug="one"',
    'thumbnail（URL・幅・高さ）がありません',
  ],
  [
    'thumbnail without size',
    [rawWork({ id: 'w1', slug: 'one', thumbnail: { url: 'https://x/a.png' } })],
    'id=w1 slug="one"',
    'thumbnail（URL・幅・高さ）がありません',
  ],
  [
    'blank body',
    [rawWork({ id: 'w1', slug: 'one', body: '<p> </p>' })],
    'id=w1 slug="one"',
    'body が空',
  ],
  [
    'missing date',
    [rawWork({ id: 'w1', slug: 'one', date: undefined })],
    'id=w1 slug="one"',
    'date が日付として解釈できません',
  ],
  [
    'invalid date',
    [rawWork({ id: 'w1', slug: 'one', date: 'foo' })],
    'id=w1 slug="one"',
    'date が日付として解釈できません',
  ],
];

describe('validation of works', () => {
  it.each(workCases)(
    'reports %s with the content ID, slug and kind of violation',
    (_name, workList, label, kind) => {
      const violations = violationsFor(workList);
      expect(violations, violations.join('\n')).toHaveLength(1);
      expect(matching(violations, label, kind), violations.join('\n')).toHaveLength(1);
      expect(() => assertValidContent(workList, [rawCategory()])).toThrow(CmsValidationError);
    },
  );

  it('names both IDs in a duplicate slug violation', () => {
    const violations = violationsFor([
      rawWork({ id: 'w1', slug: 'same' }),
      rawWork({ id: 'w2', slug: 'same' }),
    ]);
    expect(violations).toEqual([
      'slug "same" が重複しています: id=w1 slug="same", id=w2 slug="same"',
    ]);
  });

  it.each([
    ['undefined', undefined],
    ['an empty string', ''],
    ['whitespace only', ' \n '],
    ['empty paragraphs', '<p></p><p><br></p>'],
    ['a comment only', '<!-- memo -->'],
    ['&nbsp; only', '<p>&nbsp;</p>'],
  ])('reports an empty body (%s)', (_name, body) => {
    const violations = violationsFor([rawWork({ id: 'w1', slug: 'one', body })]);
    expect(violations).toEqual(['works[id=w1 slug="one"]: body が空です']);
  });

  it('accepts a body that has only an image', () => {
    expect(violationsFor([rawWork({ body: '<p><img src="https://x/a.png" alt=""></p>' })])).toEqual(
      [],
    );
  });
});

describe('validation of categories', () => {
  it('reports duplicate category slugs with both IDs', () => {
    const violations = violationsFor(
      [],
      [rawCategory({ id: 'c1', slug: 'dup' }), rawCategory({ id: 'c2', slug: 'dup' })],
    );
    expect(violations).toEqual([
      'カテゴリの slug "dup" が重複しています: categories[id=c1 slug="dup"], categories[id=c2 slug="dup"]',
    ]);
  });

  it('reports invalid category slugs', () => {
    const violations = violationsFor([], [rawCategory({ id: 'c1', slug: 'Web_Design' })]);
    expect(violations).toHaveLength(1);
    expect(
      matching(violations, 'id=c1 slug="Web_Design"', 'slug は英小文字・数字・ハイフンのみ'),
    ).toHaveLength(1);
  });

  it('accepts a 1-character category slug', () => {
    expect(violationsFor([], [rawCategory({ id: 'c1', slug: 'a' })])).toEqual([]);
  });

  it('reports legacyWpSlugs that collide with another category', () => {
    const violations = violationsFor(
      [],
      [
        rawCategory({ id: 'c1', slug: 'web' }),
        rawCategory({ id: 'c2', slug: 'design', legacyWpSlugs: 'web' }),
      ],
    );
    expect(violations).toHaveLength(1);
    expect(
      matching(violations, 'id=c2 slug="design"', 'legacyWpSlugs "web" がほかのカテゴリと重複'),
    ).toHaveLength(1);
    expect(violations[0]).toContain('id=c1 slug="web"');
  });

  it('reports legacyWpSlugs that break the slug rule', () => {
    const violations = violationsFor(
      [],
      [rawCategory({ id: 'c1', slug: 'web', legacyWpSlugs: 'Old_Web' })],
    );
    expect(violations).toHaveLength(1);
    expect(
      matching(violations, 'id=c1 slug="web"', 'legacyWpSlugs "Old_Web": slug は英小文字'),
    ).toHaveLength(1);
  });

  it('reports a blank category name', () => {
    expect(violationsFor([], [rawCategory({ id: 'c1', name: ' ' })])).toEqual([
      'categories[id=c1 slug="web"]: name が空です',
    ]);
  });

  it('accepts the same legacy slug as its own slug', () => {
    expect(
      violationsFor([], [rawCategory({ id: 'c1', slug: 'web', legacyWpSlugs: 'web' })]),
    ).toEqual([]);
  });
});

describe('invalid fixture (tests/fixtures)', () => {
  it('reports every violation with its kind, not only the first', async () => {
    const source = createFixtureSource({ works, categories });
    const error = await loadContent(source, buildConfig, { warn: () => {} }).catch((e) => e);
    expect(error).toBeInstanceOf(CmsValidationError);
    const { violations, message } = error as CmsValidationError;
    const expected: [label: string, kind: string][] = [
      ['id=w-bad-slug slug="ABC"', 'slug は英小文字・数字・ハイフンのみ'],
      ['id=w-reserved slug="page"', '予約語'],
      ['id=w-dup-2 slug="dup-slug"', 'slug "dup-slug" が重複しています'],
      ['id=w-legacy-2 slug="legacy-two"', 'legacyWpId 500 が重複しています'],
      ['id=w-legacy-neg slug="legacy-negative"', 'legacyWpId は正の整数'],
      ['id=w-cat-null slug="category-null"', 'category の参照がありません'],
      ['id=w-cat-missing slug="category-missing"', '公開中のカテゴリ一覧にありません'],
      ['id=w-no-title slug="no-title"', 'title が空'],
      ['id=w-no-thumb slug="no-thumbnail"', 'thumbnail（URL・幅・高さ）がありません'],
      ['id=w-empty-body slug="empty-body"', 'body が空'],
      ['id=w-bad-date slug="bad-date"', 'date が日付として解釈できません'],
      ['id=cat-dup-b slug="dup"', 'カテゴリの slug "dup" が重複しています'],
      ['id=cat-legacy-a slug="legacy-a"', 'legacyWpSlugs "old-shared" がほかのカテゴリと重複'],
      ['id=cat-legacy-b slug="legacy-b"', 'legacyWpSlugs "old-shared" がほかのカテゴリと重複'],
      ['id=cat-legacy-b slug="legacy-b"', 'legacyWpSlugs "web" がほかのカテゴリと重複'],
      ['id=cat-bad-slug slug="Bad_Slug"', 'slug は英小文字・数字・ハイフンのみ'],
    ];
    for (const [label, kind] of expected) {
      expect(matching(violations, label, kind).length, `${label} / ${kind}`).toBeGreaterThan(0);
    }
    // 上で全部（ほかの違反が混ざらない）
    expect(violations, violations.join('\n')).toHaveLength(expected.length);
    expect(message).not.toContain('w-valid');
  });
});
