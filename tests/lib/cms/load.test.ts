import { describe, expect, it } from 'vitest';
import { createCmsStore, loadContent } from '../../../src/lib/cms';
import type { CmsConfig } from '../../../src/lib/cms/config';
import { createFixtureSource, defaultFixtureData } from '../../../src/lib/cms/fixture-source';
import { CmsValidationError } from '../../../src/lib/cms/validate';
import { mockSource, rawCategory, rawWork } from './helpers';

const buildConfig: CmsConfig = { source: 'fixture', previewDrafts: [], isDev: false };
const devConfig: CmsConfig = { source: 'fixture', previewDrafts: [], isDev: true };
const silent = { warn: () => {} };

describe('loadContent with the build fixtures (fixtures/microcms)', () => {
  it('passes validation', async () => {
    const warnings: string[] = [];
    const { works, categories } = await loadContent(createFixtureSource(), buildConfig, {
      warn: (message) => warnings.push(message),
    });
    expect(works.length).toBe(defaultFixtureData.works.contents.length);
    expect(works.length).toBeGreaterThanOrEqual(8);
    expect(categories.length).toBeGreaterThanOrEqual(3);
    // 本文に "assets/ を含むフィクスチャがあり、警告が出る
    expect(warnings.some((message) => message.includes('"assets/'))).toBe(true);
  });

  it('sorts by date desc, then publishedAt desc, then id asc', async () => {
    const { works } = await loadContent(createFixtureSource(), buildConfig, silent);
    expect(works.map((work) => work.id)).toEqual([
      'work01',
      'work02',
      'work03',
      'work05', // work04 と同じ date、publishedAt が新しい
      'work04',
      'work06', // work07 と date も publishedAt も同じ → id 昇順
      'work07',
      'work08',
      'work09',
    ]);
    const dates = works.map((work) => work.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('has works with and without legacyWpId and description', async () => {
    const raw = defaultFixtureData.works.contents;
    expect(raw.some((work) => work.legacyWpId)).toBe(true);
    expect(raw.some((work) => !work.legacyWpId)).toBe(true);
    expect(raw.some((work) => work.description)).toBe(true);
    expect(raw.some((work) => !work.description)).toBe(true);
    expect(raw.some((work) => work.body?.includes('images.microcms-assets.io'))).toBe(true);
  });
});

describe('loadContent', () => {
  it('replaces a published work with its draft and appends new drafts (isDraftPreview)', async () => {
    const published = rawWork({ id: 'w1', slug: 'published', title: '公開版' });
    const other = rawWork({ id: 'w2', slug: 'other' });
    const draftOfW1 = rawWork({ id: 'w1', slug: 'published', title: '下書き版' });
    const newDraft = rawWork({ id: 'w3', slug: 'new-draft', publishedAt: undefined });
    const { source, calls } = mockSource([published, other], [rawCategory()], {
      w1: draftOfW1,
      w3: newDraft,
    });
    const config: CmsConfig = {
      source: 'microcms',
      serviceDomain: 'svc',
      apiKey: 'key',
      previewDrafts: [
        { id: 'w1', draftKey: 'k1' },
        { id: 'w3', draftKey: 'k3' },
      ],
      isDev: true,
    };
    const { works } = await loadContent(source, config, silent);
    expect(calls.getDraftWork).toEqual(['w1:k1', 'w3:k3']);
    expect(works).toHaveLength(3);
    const byId = new Map(works.map((work) => [work.id, work]));
    expect(byId.get('w1')).toMatchObject({ title: '下書き版', isDraftPreview: true });
    expect(byId.get('w3')).toMatchObject({ isDraftPreview: true });
    expect(byId.get('w2')).toMatchObject({ isDraftPreview: false });
  });

  it('refuses draft previews outside dev before fetching', async () => {
    const { source, calls } = mockSource([rawWork()], [rawCategory()]);
    const config: CmsConfig = {
      source: 'microcms',
      serviceDomain: 'svc',
      apiKey: 'key',
      previewDrafts: [{ id: 'w1', draftKey: 'k1' }],
      isDev: false,
    };
    await expect(loadContent(source, config, silent)).rejects.toThrow();
    expect(calls.listWorks).toBe(0);
    expect(calls.listCategories).toBe(0);
  });

  it('fails with 0 works in a build (isDev: false)', async () => {
    const { source } = mockSource([], [rawCategory()]);
    await expect(loadContent(source, buildConfig, silent)).rejects.toThrow(CmsValidationError);
  });

  it('only warns with 0 works in dev and returns an empty array', async () => {
    const { source } = mockSource([], [rawCategory()]);
    const warnings: string[] = [];
    const { works } = await loadContent(source, devConfig, {
      warn: (message) => warnings.push(message),
    });
    expect(works).toEqual([]);
    expect(warnings).toHaveLength(1);
  });

  it('fails on API errors without leaking the API key', async () => {
    const apiKey = 'super-secret-api-key';
    for (const status of [401, 500]) {
      const source = {
        ...mockSource([], []).source,
        async listWorks(): Promise<never> {
          throw Object.assign(new Error(`fetch API response status: ${status}`), { status });
        },
      };
      const config: CmsConfig = {
        source: 'microcms',
        serviceDomain: 'svc',
        apiKey,
        previewDrafts: [],
        isDev: false,
      };
      const logged: string[] = [];
      const error = await loadContent(source, config, {
        warn: (message) => logged.push(message),
      }).catch((e: Error) => e);
      expect(error).toBeInstanceOf(Error);
      expect(String((error as Error).message)).not.toContain(apiKey);
      expect(logged.join('\n')).not.toContain(apiKey);
    }
  });
});

describe('createCmsStore (public functions)', () => {
  function fixtureStore(isDev = false) {
    const { source, calls } = mockSource(
      defaultFixtureData.works.contents,
      defaultFixtureData.categories.contents,
    );
    let configCalls = 0;
    const store = createCmsStore({
      getConfig: () => {
        configCalls += 1;
        return { source: 'fixture', previewDrafts: [], isDev };
      },
      createSource: () => source,
      warn: () => {},
    });
    return { store, calls, configCalls: () => configCalls };
  }

  it('getAllWorks returns works sorted by date desc', async () => {
    const { store } = fixtureStore();
    const expected = (await loadContent(createFixtureSource(), buildConfig, silent)).works;
    expect(await store.getAllWorks()).toEqual(expected);
  });

  it('getLatestWorks returns the first n works, or all when fewer', async () => {
    const { store } = fixtureStore();
    const all = await store.getAllWorks();
    expect(await store.getLatestWorks(6)).toEqual(all.slice(0, 6));
    expect(await store.getLatestWorks(100)).toEqual(all);
  });

  it('getWorkBySlug finds a work or returns undefined', async () => {
    const { store } = fixtureStore();
    expect((await store.getWorkBySlug('unotame-portfolio'))?.id).toBe('work01');
    expect(await store.getWorkBySlug('does-not-exist')).toBeUndefined();
  });

  it('getAllCategories keeps the response order; getCategoriesInUse drops empty ones', async () => {
    const { store } = fixtureStore();
    const responseOrder = defaultFixtureData.categories.contents.map((category) => category.id);
    expect((await store.getAllCategories()).map((category) => category.id)).toEqual(responseOrder);
    const inUse = (await store.getCategoriesInUse()).map((category) => category.id);
    expect(inUse).toEqual(responseOrder.filter((id) => id !== 'cat-design'));
    expect(inUse).not.toContain('cat-design');
  });

  it('calls listWorks / listCategories only once per build', async () => {
    const { store, calls } = fixtureStore(false);
    await Promise.all([store.getAllWorks(), store.getLatestWorks(6)]);
    await store.getWorkBySlug('ec-site');
    await store.getAllCategories();
    await store.getCategoriesInUse();
    expect(calls.listWorks).toBe(1);
    expect(calls.listCategories).toBe(1);
  });

  it('refetches on every call in dev', async () => {
    const { store, calls } = fixtureStore(true);
    await store.getAllWorks();
    await store.getAllWorks();
    expect(calls.listWorks).toBe(2);
  });

  it('does not mutate the cached result when the caller changes the array', async () => {
    const { store } = fixtureStore();
    const first = await store.getAllWorks();
    first.reverse();
    expect((await store.getAllWorks())[0].id).toBe('work01');
  });

  it('rejects before fetching when the config is invalid', async () => {
    let created = 0;
    const store = createCmsStore({
      getConfig: () => {
        throw new Error('MICROCMS_PREVIEW_DRAFTS は開発サーバー専用です');
      },
      createSource: () => {
        created += 1;
        return mockSource([], []).source;
      },
    });
    await expect(store.getAllWorks()).rejects.toThrow(/MICROCMS_PREVIEW_DRAFTS/);
    expect(created).toBe(0);
  });
});
