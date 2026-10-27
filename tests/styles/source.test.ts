// ソースの静的検査（style-migration の受け入れ条件「ソース」）。
// @types/node を足さずに済むよう、ファイルは Vite の import.meta.glob（?raw / ?inline）で読む。
import { describe, expect, it } from 'vitest';
import packageJson from '../../package.json';

const scssFiles = import.meta.glob<string>('../../src/styles/**/*.scss', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const astroFiles = import.meta.glob<string>('../../src/**/*.astro', {
  query: '?raw',
  import: 'default',
  eager: true,
});

// destyle のコピーを探す対象（src/ 配下の CSS 全部）
const cssFiles = import.meta.glob<string>('../../src/**/*.css', {
  query: '?raw',
  import: 'default',
  eager: true,
});

// ?inline は中身を base64 の data URL で返すので、バイト単位の比較に使える
const srcFonts = import.meta.glob<string>('../../src/assets/fonts/*.otf', {
  query: '?inline',
  import: 'default',
  eager: true,
});
const legacyFonts = import.meta.glob<string>('../../legacy/assets/fonts/*.otf', {
  query: '?inline',
  import: 'default',
  eager: true,
});

const STYLE_ENTRY = '../../src/styles/style.scss';
/** CSS を出力しないパーシャル（どこから @use してもよい） */
const NON_OUTPUT_PARTIALS = new Set(['variables', 'mixins']);

/** @use の対象パスを取り出す */
function usedModules(source: string): string[] {
  return [...source.matchAll(/@use\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);
}

const fileName = (path: string) => path.slice(path.lastIndexOf('/') + 1);

describe('src/styles', () => {
  it('has the expected files', () => {
    expect(Object.keys(scssFiles).length).toBeGreaterThan(0);
    expect(scssFiles[STYLE_ENTRY]).toBeDefined();
  });

  it('has no @import', () => {
    const offenders = Object.entries(scssFiles)
      .filter(([, source]) => /@import\b/.test(source))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  it('only style.scss @uses partials that output CSS', () => {
    const offenders = Object.entries(scssFiles)
      .filter(([path]) => path !== STYLE_ENTRY)
      .flatMap(([path, source]) =>
        usedModules(source)
          .filter((module) => !NON_OUTPUT_PARTIALS.has(fileName(module)))
          .map((module) => `${path} -> ${module}`),
      );
    expect(offenders).toEqual([]);
  });
});

describe('.astro files', () => {
  it('have no <style> except the noscript one in BaseLayout', () => {
    const occurrences = Object.entries(astroFiles).flatMap(([path, source]) =>
      [...source.matchAll(/<style\b[^>]*>/g)].map((match) => `${path}: ${match[0]}`),
    );
    expect(occurrences).toEqual(['../../src/layouts/BaseLayout.astro: <style is:inline>']);
    expect(astroFiles['../../src/layouts/BaseLayout.astro']).toMatch(
      /<noscript>[\s\S]*<style is:inline>[\s\S]*<\/style>[\s\S]*<\/noscript>/,
    );
  });
});

describe('destyle.css', () => {
  it('is pinned to 4.0.1 in dependencies', () => {
    expect(packageJson.dependencies['destyle.css']).toBe('4.0.1');
  });

  it('is not copied into src/', () => {
    const copies = Object.entries(cssFiles)
      .filter(([path, source]) => /destyle/i.test(path) || /destyle\.css v/i.test(source))
      .map(([path]) => path);
    expect(copies).toEqual([]);
  });
});

describe('Objective fonts', () => {
  it.each(['Objective-Regular.otf', 'Objective-Medium.otf', 'Objective-Black.otf'])(
    '%s is byte-identical to legacy',
    (name) => {
      const copied = srcFonts[`../../src/assets/fonts/${name}`];
      const original = legacyFonts[`../../legacy/assets/fonts/${name}`];
      expect(copied).toMatch(/^data:/);
      expect(original).toMatch(/^data:/);
      expect(copied).toBe(original);
    },
  );
});
