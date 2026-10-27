// 旧 URL → 新 URL の 301 リダイレクト生成（url-design「受け入れ条件 / リダイレクト生成」）。
// 出力したパターンを JS の RegExp として評価して一致範囲を確かめる（模擬は tests/htaccess-rules.ts）。
import { describe, expect, it, vi } from 'vitest';
import template from '../../src/htaccess/htaccess.template?raw';
import { EXPECTED_LEGACY_WORK_REDIRECTS } from '../../src/data/redirects';
import { loadContent } from '../../src/lib/cms';
import { createFixtureSource } from '../../src/lib/cms/fixture-source';
import {
  assertLegacyRedirectCount,
  buildHtaccess,
  buildRedirectRules,
  GENERATED_RULES_PLACEHOLDER,
  legacyCategoryRedirects,
  legacyWorkRedirects,
  RedirectCountError,
  renderHtaccess,
  SITE_ORIGIN_PLACEHOLDER,
  siteOrigin,
} from '../../src/lib/redirects';
import { effectiveLines, firstMatch, rulesOf } from '../htaccess-rules';

const ORIGIN = 'https://unotame.com';
const PATTERN_123 = '^(?![0-9]{4}/|wp-)(?:[^/]+/)*(?!page/)[^/]+/123/?$';
const GENERIC_CATEGORY_RULE =
  'RewriteRule ^category/(?!(?:[^/]+/)*feed(?:/[^/]+)?/?$)(?:[^/]+/)*?([a-z0-9-]+)(?:/page/[0-9]+)?/?$ https://unotame.com/works/?category=$1 [R=301,L]';
const PAGINATION_RULE = 'RewriteRule ^works/page/[0-9]+/?$ https://unotame.com/works/ [R=301,L]';
const quiet = { warn: () => {} };

describe('siteOrigin', () => {
  it('is the origin of astro.config site', () => {
    expect(siteOrigin()).toBe(ORIGIN);
  });
});

describe('buildRedirectRules: works', () => {
  const rules = buildRedirectRules({ works: [{ legacyWpId: 123, slug: 'foo' }], categories: [] });

  it('outputs the path rule and the ?p= rule for a legacy ID, to the absolute URL', () => {
    const lines = effectiveLines(rules);
    expect(lines).toEqual([
      `RewriteRule ${PATTERN_123} ${ORIGIN}/works/foo/ [R=301,L]`,
      'RewriteCond %{QUERY_STRING} (?:^|&)p=123(?:&|$)',
      `RewriteRule ^$ ${ORIGIN}/works/foo/? [R=301,L]`,
    ]);
    for (const rule of rulesOf(rules)) expect(rule.flags).toBe('R=301,L');
  });

  it('matches /{category…}/{ID} with or without a trailing slash, and nothing else', () => {
    const pattern = new RegExp(rulesOf(rules)[0].pattern);
    for (const path of ['web/123', 'web/123/', 'design/sub/123/', 'design/sub/123']) {
      expect(pattern.test(path), path).toBe(true);
    }
    for (const path of [
      'web/1234',
      'web/12',
      'web/0123',
      'works/foo/',
      '123',
      '123/',
      'web/123/x',
      'web/123/2/', // WP の分割ページは扱わない
    ]) {
      expect(pattern.test(path), path).toBe(false);
    }
  });

  it('excludes pagination, date archives and wp- paths', () => {
    const pattern = (id: number) =>
      new RegExp(
        rulesOf(buildRedirectRules({ works: [{ legacyWpId: id, slug: 'foo' }], categories: [] }))[0]
          .pattern,
      );
    for (const path of ['web/2', 'web/2/', 'design/sub/2/', 'page-design/2/']) {
      expect(pattern(2).test(path), path).toBe(true);
    }
    for (const path of [
      'works/page/2/',
      'works/page/2',
      'page/2/',
      'page/2',
      'category/web/page/2',
      'category/web/page/2/',
      '2020/2/',
      'wp-json/wp/v2/posts/2',
      'wp-content/uploads/2020/2/',
    ]) {
      expect(pattern(2).test(path), path).toBe(false);
    }
    for (const path of ['2020/12/', '2020/12', 'page/12/']) {
      expect(pattern(12).test(path), path).toBe(false);
    }
    expect(pattern(12).test('web/12/')).toBe(true);
  });

  it('matches only the exact p= query value', () => {
    const cond = effectiveLines(rules)[1].replace('RewriteCond %{QUERY_STRING} ', '');
    const pattern = new RegExp(cond);
    for (const query of ['p=123', 'a=1&p=123', 'p=123&preview=true']) {
      expect(pattern.test(query), query).toBe(true);
    }
    for (const query of ['p=1234', 'p=12', 'xp=123', 'page_id=123', '']) {
      expect(pattern.test(query), query).toBe(false);
    }
    // ?p= のルールは / だけに一致し、置換先の末尾 ? で元のクエリを捨てる
    const rule = rulesOf(rules)[1];
    expect(new RegExp(rule.pattern).test('')).toBe(true);
    expect(new RegExp(rule.pattern).test('web/')).toBe(false);
    expect(rule.target).toBe(`${ORIGIN}/works/foo/?`);
  });

  it('outputs no work rules for an empty list', () => {
    expect(rulesOf(buildRedirectRules({ works: [], categories: [] }))).toEqual([]);
  });

  it('rejects values that are not safe to write into .htaccess', () => {
    const bad = [
      { legacyWpId: 0, slug: 'foo' },
      { legacyWpId: 1.5, slug: 'foo' },
      { legacyWpId: -1, slug: 'foo' },
      { legacyWpId: 1, slug: 'foo bar' },
      { legacyWpId: 1, slug: 'foo\nRewriteRule' },
      { legacyWpId: 1, slug: 'a.b' },
    ];
    for (const work of bad) {
      expect(() => buildRedirectRules({ works: [work], categories: [] })).toThrow();
    }
    expect(() =>
      buildRedirectRules({ works: [], categories: [{ fromSlug: 'old web', toSlug: 'web' }] }),
    ).toThrow();
  });
});

describe('legacyWorkRedirects', () => {
  it('skips works without legacyWpId and sorts by legacy ID', () => {
    expect(
      legacyWorkRedirects([
        { slug: 'b-work', legacyWpId: 20 },
        { slug: 'new-work' },
        { slug: 'a-work', legacyWpId: 3 },
      ]),
    ).toEqual([
      { legacyWpId: 3, slug: 'a-work' },
      { legacyWpId: 20, slug: 'b-work' },
    ]);
  });

  it('generates no rule for a work without legacyWpId', () => {
    const rules = buildRedirectRules({
      works: legacyWorkRedirects([{ slug: 'new-work' }]),
      categories: [],
    });
    expect(rules).not.toContain('new-work');
    expect(rulesOf(rules)).toEqual([]);
  });
});

describe('category redirects', () => {
  it('maps legacyWpSlugs to the new category slug', () => {
    expect(
      legacyCategoryRedirects([
        { slug: 'web', legacyWpSlugs: ['old-web'] },
        { slug: 'design', legacyWpSlugs: [] },
        { slug: 'system', legacyWpSlugs: ['dev', 'system-dev'] },
      ]),
    ).toEqual([
      { fromSlug: 'old-web', toSlug: 'web' },
      { fromSlug: 'dev', toSlug: 'system' },
      { fromSlug: 'system-dev', toSlug: 'system' },
    ]);
  });

  it('outputs the legacy slug rule before the generic category rule', () => {
    const htaccess = buildHtaccess({
      template,
      works: [],
      categories: [{ slug: 'web', legacyWpSlugs: ['old-web'] }],
      expectedLegacyWorkCount: 0,
    });
    const lines = effectiveLines(htaccess);
    const specific = lines.indexOf(
      `RewriteRule ^category/(?:[^/]+/)*old-web(?:/page/[0-9]+)?/?$ ${ORIGIN}/works/?category=web [R=301,L]`,
    );
    const generic = lines.indexOf(GENERIC_CATEGORY_RULE);
    expect(specific).toBeGreaterThanOrEqual(0);
    expect(generic).toBeGreaterThan(specific);

    const toWeb = { target: `${ORIGIN}/works/?category=web` };
    expect(firstMatch(htaccess, '/category/old-web/')).toEqual(toWeb);
    expect(firstMatch(htaccess, '/category/old-web')).toEqual(toWeb);
    expect(firstMatch(htaccess, '/category/parent/old-web/')).toEqual(toWeb);
    expect(firstMatch(htaccess, '/category/old-web/page/2/')).toEqual(toWeb);
    expect(firstMatch(htaccess, '/category/old-webx/')).toEqual({
      target: `${ORIGIN}/works/?category=old-webx`,
    });
    expect(firstMatch(htaccess, '/category/old-web/feed/')).toBeUndefined();
  });
});

describe('template', () => {
  const htaccess = buildHtaccess({
    template,
    works: [{ slug: 'foo', legacyWpId: 123 }, { slug: 'bar' }],
    categories: [{ slug: 'web', legacyWpSlugs: ['old-web'] }],
    expectedLegacyWorkCount: 1,
  });
  const lines = effectiveLines(htaccess);

  it('orders ③ pagination → ② generated → ③ category → ① canonical host → ④ ErrorDocument', () => {
    const canonical = lines.indexOf('RewriteRule ^ https://unotame.com%{REQUEST_URI} [R=301,L]');
    const pagination = lines.indexOf(PAGINATION_RULE);
    const generated = lines.indexOf(`RewriteRule ${PATTERN_123} ${ORIGIN}/works/foo/ [R=301,L]`);
    const generatedCategory = lines.indexOf(
      `RewriteRule ^category/(?:[^/]+/)*old-web(?:/page/[0-9]+)?/?$ ${ORIGIN}/works/?category=web [R=301,L]`,
    );
    const fixedCategory = lines.indexOf(GENERIC_CATEGORY_RULE);
    const errorDocument = lines.indexOf('ErrorDocument 404 /404.html');
    expect(lines.indexOf('RewriteEngine On')).toBe(0);
    expect(pagination).toBe(1);
    expect(generated).toBeGreaterThan(pagination);
    expect(generatedCategory).toBeGreaterThan(generated);
    expect(fixedCategory).toBeGreaterThan(generatedCategory);
    expect(canonical).toBeGreaterThan(fixedCategory);
    expect(errorDocument).toBe(canonical + 1);
    expect(errorDocument).toBe(lines.length - 1);
  });

  it('puts every legacy URL rule before ① so http / www legacy URLs need only one 301', () => {
    const canonical = lines.indexOf('RewriteRule ^ https://unotame.com%{REQUEST_URI} [R=301,L]');
    const ruleIndexes = lines
      .map((line, index) => (line.startsWith('RewriteRule ') ? index : -1))
      .filter((index) => index >= 0);
    expect(ruleIndexes.at(-1)).toBe(canonical);
    // ① の条件は ① の直前の 2 行だけ（旧 URL のルールの条件と混ざらない）
    expect(
      lines.slice(canonical - 2, canonical).every((l) => l.startsWith('RewriteCond %{HTTP')),
    ).toBe(true);
    expect(lines[canonical - 3]).toBe(GENERIC_CATEGORY_RULE);
  });

  it('ends with a root-relative ErrorDocument 404', () => {
    expect(lines.at(-1)).toBe('ErrorDocument 404 /404.html');
    const targets = lines
      .filter((line) => line.startsWith('ErrorDocument '))
      .map((line) => line.split(/\s+/)[2]);
    expect(targets).toEqual(['/404.html']);
    for (const target of targets) expect(target.startsWith('http')).toBe(false);
  });

  it('canonicalizes http and www to https://unotame.com in one rule', () => {
    const index = lines.indexOf('RewriteRule ^ https://unotame.com%{REQUEST_URI} [R=301,L]');
    expect(lines.slice(index - 2, index)).toEqual([
      'RewriteCond %{HTTPS} !on [OR]',
      'RewriteCond %{HTTP_HOST} ^www\\.unotame\\.com$ [NC]',
    ]);
  });

  it('redirects every rule to an absolute https://unotame.com URL', () => {
    const rules = rulesOf(htaccess);
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) expect(rule.target, rule.pattern).toMatch(/^https:\/\/unotame\.com/);
    expect(htaccess).not.toContain(SITE_ORIGIN_PLACEHOLDER);
  });

  it('redirects paths as the url-design table says', () => {
    expect(firstMatch(htaccess, '/web/123')).toEqual({ target: `${ORIGIN}/works/foo/` });
    expect(firstMatch(htaccess, '/web/123/')).toEqual({ target: `${ORIGIN}/works/foo/` });
    expect(firstMatch(htaccess, '/category/web/')).toEqual({
      target: `${ORIGIN}/works/?category=web`,
    });
    expect(firstMatch(htaccess, '/category/parent/child')).toEqual({
      target: `${ORIGIN}/works/?category=child`,
    });
    expect(firstMatch(htaccess, '/category/parent/child/')).toEqual({
      target: `${ORIGIN}/works/?category=child`,
    });
    expect(firstMatch(htaccess, '/category/web/page/2/')).toEqual({
      target: `${ORIGIN}/works/?category=web`,
    });
    expect(firstMatch(htaccess, '/category/parent/child/page/3')).toEqual({
      target: `${ORIGIN}/works/?category=child`,
    });
    expect(firstMatch(htaccess, '/works/page/2/')).toEqual({ target: `${ORIGIN}/works/` });
    expect(firstMatch(htaccess, '/works/page/2')).toEqual({ target: `${ORIGIN}/works/` });
    // feed を含むだけのスラッグはフィードではない
    expect(firstMatch(htaccess, '/category/feedback/')).toEqual({
      target: `${ORIGIN}/works/?category=feedback`,
    });
    expect(firstMatch(htaccess, '/category/web/myfeed/')).toEqual({
      target: `${ORIGIN}/works/?category=myfeed`,
    });
    // 新 URL・対応表に無い旧 ID・WP 固有の URL（フィードを含む）はリダイレクトしない（404）
    for (const path of [
      '/works/',
      '/works/foo/',
      '/works/bar/',
      '/web/999999/',
      '/feed/',
      '/category/web/feed/',
      '/category/web/feed',
      '/category/parent/child/feed/',
      '/category/web/feed/atom/',
      '/category/web/feed/atom',
      '/category/web/feed/rss2',
      '/category/web/feed/rss2/',
      '/category/parent/child/feed/rdf/',
      '/category/old-web/feed/atom/',
      '/contact/',
    ]) {
      expect(firstMatch(htaccess, path), path).toBeUndefined();
    }
  });

  it('does not send pagination or date archives to a work with a small legacy ID', () => {
    const small = buildHtaccess({
      template,
      works: [
        { slug: 'two', legacyWpId: 2 },
        { slug: 'twelve', legacyWpId: 12 },
      ],
      categories: [],
      expectedLegacyWorkCount: 2,
    });
    const workTargets = [`${ORIGIN}/works/two/`, `${ORIGIN}/works/twelve/`];
    for (const path of ['/works/page/2/', '/page/2/', '/2020/12/', '/category/web/page/2/']) {
      expect(workTargets, path).not.toContain(firstMatch(small, path)?.target);
    }
    expect(firstMatch(small, '/works/page/2/')).toEqual({ target: `${ORIGIN}/works/` });
    expect(firstMatch(small, '/works/page/12/')).toEqual({ target: `${ORIGIN}/works/` });
    expect(firstMatch(small, '/page/2/')).toBeUndefined();
    expect(firstMatch(small, '/2020/12/')).toBeUndefined();
    expect(firstMatch(small, '/category/web/page/2/')).toEqual({
      target: `${ORIGIN}/works/?category=web`,
    });
    expect(firstMatch(small, '/category/web/feed/')).toBeUndefined();
    // 旧詳細はそのまま届く
    expect(firstMatch(small, '/web/2/')).toEqual({ target: `${ORIGIN}/works/two/` });
    expect(firstMatch(small, '/web/12')).toEqual({ target: `${ORIGIN}/works/twelve/` });
  });

  it('uses LF, ends with one newline and keeps no placeholder', () => {
    expect(htaccess).not.toContain('\r');
    expect(htaccess).not.toContain(GENERATED_RULES_PLACEHOLDER);
    expect(htaccess).not.toContain(SITE_ORIGIN_PLACEHOLDER);
    expect(htaccess.endsWith('\n')).toBe(true);
    expect(htaccess.endsWith('\n\n')).toBe(false);
    expect(htaccess.charCodeAt(0)).not.toBe(0xfeff);
  });
});

describe('renderHtaccess', () => {
  it('requires exactly one placeholder', () => {
    expect(() => renderHtaccess('ErrorDocument 404 /404.html\n', '')).toThrow();
    expect(() =>
      renderHtaccess(`${GENERATED_RULES_PLACEHOLDER}\n${GENERATED_RULES_PLACEHOLDER}\n`, ''),
    ).toThrow();
  });

  it('normalizes CRLF to LF and inserts the rules literally', () => {
    expect(renderHtaccess(`a\r\n${GENERATED_RULES_PLACEHOLDER}\r\nb\r\n`, 'x $& $1')).toBe(
      'a\nx $& $1\nb\n',
    );
  });

  it('replaces every origin placeholder with the given origin', () => {
    expect(
      renderHtaccess(
        `${SITE_ORIGIN_PLACEHOLDER}/a\n${GENERATED_RULES_PLACEHOLDER}\n${SITE_ORIGIN_PLACEHOLDER}/b\n`,
        'x',
        'https://example.com',
      ),
    ).toBe('https://example.com/a\nx\nhttps://example.com/b\n');
  });
});

describe('expected legacy redirect count', () => {
  it('fails when the generated count is below the expected count', () => {
    expect(() => assertLegacyRedirectCount(4, 5, quiet.warn)).toThrow(RedirectCountError);
    expect(() => assertLegacyRedirectCount(5, 5, quiet.warn)).not.toThrow();
    expect(() => assertLegacyRedirectCount(6, 5, quiet.warn)).not.toThrow();
  });

  it('warns to raise the expected count when the generated count is above it', () => {
    const warn = vi.fn();
    assertLegacyRedirectCount(5, 5, warn);
    expect(warn).not.toHaveBeenCalled();
    assertLegacyRedirectCount(6, 5, warn);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain('期待件数を 6 に上げてください');
  });

  it('fails buildHtaccess with the fixture when a legacyWpId is lost', async () => {
    const { works, categories } = await loadContent(
      createFixtureSource(),
      { source: 'fixture', previewDrafts: [], isDev: false },
      quiet,
    );
    const count = works.filter((work) => work.legacyWpId !== undefined).length;
    expect(count).toBeGreaterThan(0);
    const input = { template, works, categories, ...quiet };
    expect(() => buildHtaccess({ ...input, expectedLegacyWorkCount: count })).not.toThrow();
    expect(() => buildHtaccess({ ...input, expectedLegacyWorkCount: count + 1 })).toThrow(
      RedirectCountError,
    );
    const warn = vi.fn();
    buildHtaccess({ ...input, warn, expectedLegacyWorkCount: count - 1 });
    expect(warn).toHaveBeenCalledOnce();
  });

  it('is a non-negative integer', () => {
    expect(Number.isSafeInteger(EXPECTED_LEGACY_WORK_REDIRECTS)).toBe(true);
    expect(EXPECTED_LEGACY_WORK_REDIRECTS).toBeGreaterThanOrEqual(0);
  });
});
