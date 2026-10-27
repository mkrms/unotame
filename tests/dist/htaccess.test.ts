// dist/.htaccess の検査（url-design「受け入れ条件 / リダイレクト生成」）。期待値はフィクスチャから作る。
// ErrorDocument の条件（not-found）は tests/dist/not-found.test.ts。
import { existsSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import template from '../../src/htaccess/htaccess.template?raw';
import { EXPECTED_LEGACY_WORK_REDIRECTS } from '../../src/data/redirects';
import type { Category, Work } from '../../src/lib/domain/work';
import {
  buildHtaccess,
  legacyCategoryPathPattern,
  legacyWorkPathPattern,
} from '../../src/lib/redirects';
import { absoluteUrl, routes } from '../../src/lib/routes';
import { effectiveLines } from '../htaccess-rules';
import { distPath, FIXTURE_BUILD_HINT, loadFixtureContent } from './helpers';

const GENERIC_CATEGORY_RULE = `RewriteRule ^category/(?!(?:[^/]+/)*feed(?:/[^/]+)?/?$)(?:[^/]+/)*?([a-z0-9-]+)(?:/page/[0-9]+)?/?$ ${absoluteUrl('/works/')}?category=$1 [R=301,L]`;
const PAGINATION_RULE = `RewriteRule ^works/page/[0-9]+/?$ ${absoluteUrl(routes.works())} [R=301,L]`;

let htaccess: string;
let lines: string[];
let works: Work[];
let categories: Category[];

beforeAll(async () => {
  const path = distPath('.htaccess');
  if (!existsSync(path)) throw new Error(`${path} がありません。${FIXTURE_BUILD_HINT}`);
  htaccess = readFileSync(path, 'utf8');
  lines = effectiveLines(htaccess);
  ({ works, categories } = await loadFixtureContent());
});

describe('dist/.htaccess: output', () => {
  it('exists and the intermediate htaccess.txt does not', () => {
    expect(existsSync(distPath('.htaccess'))).toBe(true);
    expect(existsSync(distPath('htaccess.txt'))).toBe(false);
  });

  it('equals the rules built from the fixture', () => {
    expect(htaccess).toBe(
      buildHtaccess({
        template,
        works,
        categories,
        expectedLegacyWorkCount: EXPECTED_LEGACY_WORK_REDIRECTS,
        warn: () => {},
      }),
    );
  });

  it('is LF without BOM and ends with exactly one newline', () => {
    expect(htaccess).not.toContain('\r');
    expect(htaccess.charCodeAt(0)).not.toBe(0xfeff);
    expect(htaccess.endsWith('\n')).toBe(true);
    expect(htaccess.endsWith('\n\n')).toBe(false);
    expect(htaccess).not.toContain('{{');
  });
});

describe('dist/.htaccess: rules', () => {
  it('has the path and ?p= rules for every work with legacyWpId, and none for the others', () => {
    const legacy = works.filter((work) => work.legacyWpId !== undefined);
    expect(legacy.length).toBeGreaterThan(0);
    expect(legacy.length).toBeLessThan(works.length); // フィクスチャに「なし」も含まれる
    for (const work of legacy) {
      const id = work.legacyWpId as number;
      const target = absoluteUrl(routes.work(work.slug));
      expect(lines).toContain(`RewriteRule ${legacyWorkPathPattern(id)} ${target} [R=301,L]`);
      const cond = lines.indexOf(`RewriteCond %{QUERY_STRING} (?:^|&)p=${id}(?:&|$)`);
      expect(cond).toBeGreaterThanOrEqual(0);
      expect(lines[cond + 1]).toBe(`RewriteRule ^$ ${target}? [R=301,L]`);
    }
    const pathRules = lines.filter((line) => line.startsWith('RewriteRule ^(?![0-9]{4}/|wp-)'));
    expect(pathRules).toHaveLength(legacy.length);
    expect(pathRules.length).toBeGreaterThanOrEqual(EXPECTED_LEGACY_WORK_REDIRECTS);

    // ?p= のルール（条件 + ^$ のルール）は旧 ID を持つ実績の分だけ
    const queryConds = lines.filter((line) => line.startsWith('RewriteCond %{QUERY_STRING} '));
    expect(queryConds).toHaveLength(legacy.length);
    const queryRules = lines.filter((line) => line.startsWith('RewriteRule ^$ '));
    expect(queryRules).toHaveLength(legacy.length);
    for (const work of works.filter((w) => w.legacyWpId === undefined)) {
      const target = absoluteUrl(routes.work(work.slug));
      expect(htaccess).not.toContain(routes.work(work.slug));
      expect(queryRules.some((line) => line.includes(target))).toBe(false);
    }
  });

  it('has the legacy category rules before the generic category rule', () => {
    const generic = lines.indexOf(GENERIC_CATEGORY_RULE);
    expect(generic).toBeGreaterThan(0);
    const legacy = categories.flatMap((category) =>
      category.legacyWpSlugs.map((fromSlug) => ({ fromSlug, toSlug: category.slug })),
    );
    expect(legacy.length).toBeGreaterThan(0);
    for (const { fromSlug, toSlug } of legacy) {
      const index = lines.indexOf(
        `RewriteRule ${legacyCategoryPathPattern(fromSlug)} ${absoluteUrl(routes.works({ category: toSlug }))} [R=301,L]`,
      );
      expect(index, fromSlug).toBeGreaterThanOrEqual(0);
      expect(index, fromSlug).toBeLessThan(generic);
    }
  });

  it('orders ③ pagination → ② generated → ③ category → ① canonical host → ④ ErrorDocument', () => {
    const canonical = lines.indexOf('RewriteRule ^ https://unotame.com%{REQUEST_URI} [R=301,L]');
    const pagination = lines.indexOf(PAGINATION_RULE);
    const firstGenerated = lines.findIndex((line) =>
      line.startsWith('RewriteRule ^(?![0-9]{4}/|wp-)'),
    );
    const lastGenerated = lines.findLastIndex((line) =>
      /^RewriteRule \^category\/\(\?:\[\^\/\]\+\/\)\*[a-z0-9-]+\(/.test(line),
    );
    const fixed = lines.indexOf(GENERIC_CATEGORY_RULE);
    const errorDocument = lines.indexOf('ErrorDocument 404 /404.html');
    expect(lines[0]).toBe('RewriteEngine On');
    expect(pagination).toBe(1);
    expect(firstGenerated).toBeGreaterThan(pagination);
    expect(lastGenerated).toBeGreaterThan(firstGenerated);
    expect(fixed).toBeGreaterThan(lastGenerated);
    expect(canonical).toBeGreaterThan(fixed);
    expect(errorDocument).toBe(canonical + 1);
    expect(errorDocument).toBe(lines.length - 1);
  });

  it('uses 301 to an absolute URL for every redirect', () => {
    const rules = lines.filter((line) => line.startsWith('RewriteRule '));
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(rule, rule).toMatch(/ \[R=301,L\]$/);
      expect(rule.split(' ')[2], rule).toMatch(/^https:\/\/unotame\.com[/%]/);
    }
  });
});
