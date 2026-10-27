// ソースの静的検査（cms-integration「設定・秘密情報」）。
import { describe, expect, it } from 'vitest';
import envExample from '../../../.env.example?raw';
import gitignore from '../../../.gitignore?raw';

const sources = import.meta.glob<string>('../../../src/**/*.{ts,astro}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('microcms-js-sdk boundary', () => {
  it('is imported only by src/lib/cms/microcms-source.ts', () => {
    const importers = Object.entries(sources)
      .filter(([, source]) =>
        /from\s+['"]microcms-js-sdk['"]|import\(\s*['"]microcms-js-sdk['"]/.test(source),
      )
      .map(([path]) => path);
    // raw-types.ts は型だけを import する（import type。実行時には消える）
    const runtimeImporters = importers.filter(
      (path) => !/^import type [^;]+ from ['"]microcms-js-sdk['"]/m.test(sources[path]),
    );
    expect(runtimeImporters).toEqual(['../../../src/lib/cms/microcms-source.ts']);
    expect(importers.sort()).toEqual([
      '../../../src/lib/cms/microcms-source.ts',
      '../../../src/lib/cms/raw-types.ts',
    ]);
  });
});

describe('environment variables', () => {
  it('.env.example lists the 4 variables without values', () => {
    for (const name of [
      'MICROCMS_SERVICE_DOMAIN',
      'MICROCMS_API_KEY',
      'CMS_SOURCE',
      'MICROCMS_PREVIEW_DRAFTS',
    ]) {
      expect(envExample).toMatch(new RegExp(`^${name}=$`, 'm'));
    }
  });

  it('.env is ignored by git', () => {
    expect(gitignore).toMatch(/^\.env$/m);
  });

  it('no source uses PUBLIC_ for the CMS variables', () => {
    const offenders = Object.entries(sources)
      .filter(([, source]) => /PUBLIC_MICROCMS|PUBLIC_CMS/.test(source))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  it('only src/lib/cms/index.ts reads the CMS variables from import.meta.env', () => {
    const readers = Object.entries(sources)
      .filter(([, source]) => /import\.meta\.env\.(MICROCMS_|CMS_SOURCE)/.test(source))
      .map(([path]) => path);
    expect(readers).toEqual(['../../../src/lib/cms/index.ts']);
  });
});
