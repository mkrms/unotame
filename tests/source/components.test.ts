// コンポーネントの使い方のソース検査（tests/styles/source.test.ts と同じく import.meta.glob の ?raw で読む）。
// - top-page「共通」: WorkCard は 1 か所で定義され、トップ・一覧・詳細の 3 ページが使っている
// - works-detail「ページ生成」: set:html を使っているのは WorkBody.astro だけ
// - not-found「ビルド成果物」: 404 ページは CMS のデータに依存しない（import をたどって src/lib/cms に届かない）
import { posix } from 'node:path';
import { describe, expect, it } from 'vitest';

const astroFiles = import.meta.glob<string>('../../src/**/*.astro', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const srcFiles = import.meta.glob<string>('../../src/**/*.{astro,ts}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const WORK_CARD = '../../src/components/works/WorkCard.astro';
const WORK_BODY = '../../src/components/works/WorkBody.astro';
const PAGES_USING_WORK_CARD = [
  '../../src/pages/index.astro',
  '../../src/pages/works/index.astro',
  '../../src/pages/works/[slug].astro',
];

/** .astro の frontmatter / script から、相対パスで import している .astro ファイル（glob のキーの形）を返す */
function astroImportsOf(path: string): string[] {
  const source = astroFiles[path] ?? '';
  return [...source.matchAll(/import\s+[^'"]*?from\s+['"](\.{1,2}\/[^'"]+\.astro)['"]/g)].map(
    (match) => posix.normalize(posix.join(posix.dirname(path), match[1])),
  );
}

/** path から import をたどって到達できる .astro ファイル */
function reachableFrom(path: string): Set<string> {
  const seen = new Set<string>();
  const queue = [path];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of astroImportsOf(current)) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

describe('WorkCard', () => {
  it('exists', () => {
    expect(astroFiles[WORK_CARD]).toBeDefined();
  });

  it('is the only .astro file with the card markup (c-work-card)', () => {
    const files = Object.entries(astroFiles)
      .filter(([, source]) => /\bc-work-card\b/.test(source))
      .map(([path]) => path);
    expect(files).toEqual([WORK_CARD]);
  });

  it('is the only file named WorkCard', () => {
    const files = Object.keys(srcFiles).filter((path) => /\/WorkCard\.[^/]+$/.test(path));
    expect(files).toEqual([WORK_CARD]);
  });

  it.each(PAGES_USING_WORK_CARD)('is used by %s', (page) => {
    expect(astroFiles[page]).toBeDefined();
    expect(reachableFrom(page)).toContain(WORK_CARD);
  });
});

/** .astro / .ts の相対 import をたどって到達できるファイル（拡張子なしの import は .ts とみなす） */
function reachableModulesFrom(path: string): Set<string> {
  const seen = new Set<string>([path]);
  const queue = [path];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const source = srcFiles[current] ?? '';
    const specifiers = [
      ...source.matchAll(/(?:import|export)\s[^'"]*?from\s+['"](\.{1,2}\/[^'"]+)['"]/g),
      ...source.matchAll(/import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g),
    ].map((match) => match[1]);
    for (const specifier of specifiers) {
      const joined = posix.normalize(posix.join(posix.dirname(current), specifier));
      const candidates = [joined, `${joined}.ts`, `${joined}/index.ts`];
      const next = candidates.find((candidate) => candidate in srcFiles);
      if (next && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

describe('404 page', () => {
  const NOT_FOUND = '../../src/pages/404.astro';

  it('does not depend on the CMS', () => {
    expect(srcFiles[NOT_FOUND]).toBeDefined();
    const reachable = [...reachableModulesFrom(NOT_FOUND)];
    // たどれていること（BaseLayout まで届く）
    expect(reachable).toContain('../../src/layouts/BaseLayout.astro');
    expect(reachable.filter((path) => path.startsWith('../../src/lib/cms/'))).toEqual([]);
  });

  it('detects a CMS dependency (the check itself works)', () => {
    const reachable = [...reachableModulesFrom('../../src/pages/works/index.astro')];
    expect(reachable).toContain('../../src/lib/cms/index.ts');
  });
});

describe('set:html', () => {
  it('is used only in WorkBody.astro', () => {
    const files = Object.entries(srcFiles)
      .filter(([, source]) => /set:html\s*=/.test(source))
      .map(([path]) => path);
    expect(files).toEqual([WORK_BODY]);
  });
});
