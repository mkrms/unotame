// テスト用の生データ（RawWork / RawCategory）を作る小さなヘルパー。
import type { RawCategory, RawWork } from '../../../src/lib/cms/raw-types';
import type { CmsSource } from '../../../src/lib/cms/source';

const T = '2024-01-01T00:00:00.000Z';

export function rawCategory(overrides: Partial<RawCategory> = {}): RawCategory {
  return {
    id: 'cat-web',
    createdAt: T,
    updatedAt: T,
    publishedAt: T,
    revisedAt: T,
    name: 'Web制作',
    slug: 'web',
    ...overrides,
  };
}

export function rawWork(overrides: Partial<RawWork> = {}): RawWork {
  return {
    id: 'work01',
    createdAt: T,
    updatedAt: '2024-02-03T04:05:06.000Z',
    publishedAt: T,
    revisedAt: T,
    title: 'サンプル実績',
    slug: 'sample-work',
    category: rawCategory(),
    thumbnail: {
      url: 'https://images.microcms-assets.io/assets/dummy/thumb.png',
      width: 1200,
      height: 800,
    },
    body: '<p>本文です。</p>',
    date: '2024-01-31T15:00:00.000Z',
    ...overrides,
  };
}

/** 呼び出し回数を数えるモックのソース */
export function mockSource(
  works: RawWork[],
  categories: RawCategory[],
  drafts: Record<string, RawWork> = {},
) {
  const calls = { listWorks: 0, listCategories: 0, getDraftWork: [] as string[] };
  const source: CmsSource = {
    async listWorks() {
      calls.listWorks += 1;
      return works;
    },
    async listCategories() {
      calls.listCategories += 1;
      return categories;
    },
    async getDraftWork(id, draftKey) {
      calls.getDraftWork.push(`${id}:${draftKey}`);
      const draft = drafts[id];
      if (!draft) throw new Error(`no draft ${id}`);
      return draft;
    },
  };
  return { source, calls };
}
