// 取得の流れ（設定 → ソース → loadContent / 公開関数）を通した確認。実際の API は呼ばない。
import { describe, expect, it } from 'vitest';
import { createCmsStore, loadContent } from '../../../src/lib/cms';
import { resolveCmsConfig, type CmsConfig } from '../../../src/lib/cms/config';
import { createFixtureSource, defaultFixtureData } from '../../../src/lib/cms/fixture-source';
import {
  createMicroCmsSource,
  type MicroCmsClientLike,
} from '../../../src/lib/cms/microcms-source';
import type { CmsSource } from '../../../src/lib/cms/source';
import { CmsValidationError } from '../../../src/lib/cms/validate';
import { mockSource, rawCategory, rawWork } from './helpers';

const buildConfig: CmsConfig = { source: 'fixture', previewDrafts: [], isDev: false };
const silent = { warn: () => {} };

describe('API key masking through the fetch flow (microcms-source → loadContent / store)', () => {
  const apiKey = 'super-secret-api-key-0123456789';
  const credentials = { MICROCMS_SERVICE_DOMAIN: 'svc', MICROCMS_API_KEY: apiKey };

  /** SDK のクライアントの偽物。エラーのメッセージ（ヘッダー・URL 風の文字列）に API キーを含めて投げる */
  function leakyClient(): MicroCmsClientLike {
    const fail = async (): Promise<never> => {
      throw Object.assign(
        new Error(
          `fetch API response status: 401 X-MICROCMS-API-KEY=${apiKey} ` +
            `https://svc.microcms.io/api/v1/works?apiKey=${apiKey}`,
        ),
        { status: 401, headers: { 'X-MICROCMS-API-KEY': apiKey } },
      );
    };
    return { getAllContents: fail, getListDetail: fail } as unknown as MicroCmsClientLike;
  }

  function expectNoKey(error: unknown, logged: string[]) {
    expect(error).toBeInstanceOf(Error);
    const e = error as Error;
    expect(e.message).toContain('HTTP 401');
    expect(e.message).toContain('***');
    expect(e.message).not.toContain(apiKey);
    expect(String(e.stack)).not.toContain(apiKey);
    expect(e.cause).toBeUndefined();
    expect(JSON.stringify(e)).not.toContain(apiKey);
    expect(logged.join('\n')).not.toContain(apiKey);
  }

  it('loadContent rejects without the key', async () => {
    const config = resolveCmsConfig(credentials, { isDev: false });
    expect(config.source).toBe('microcms');
    const logged: string[] = [];
    const source = createMicroCmsSource({ serviceDomain: 'svc', apiKey }, leakyClient());
    const error = await loadContent(source, config, {
      warn: (message) => logged.push(message),
    }).catch((e: unknown) => e);
    expectNoKey(error, logged);
  });

  it('the public functions (createCmsStore) reject without the key', async () => {
    const logged: string[] = [];
    const store = createCmsStore({
      getConfig: () => resolveCmsConfig(credentials, { isDev: false }),
      createSource: (config) => {
        if (config.source !== 'microcms') throw new Error('unexpected source');
        return createMicroCmsSource(
          { serviceDomain: config.serviceDomain, apiKey: config.apiKey },
          leakyClient(),
        );
      },
      warn: (message) => logged.push(message),
    });
    expectNoKey(await store.getAllWorks().catch((e: unknown) => e), logged);
  });

  it('draft previews reject without the key or the draftKey', async () => {
    const config = resolveCmsConfig(
      { ...credentials, MICROCMS_PREVIEW_DRAFTS: 'w1:secret-draft-key' },
      { isDev: true },
    );
    const client = {
      getAllContents: async ({ endpoint }: { endpoint: string }) =>
        endpoint === 'works' ? [rawWork()] : [rawCategory()],
      getListDetail: async (): Promise<never> => {
        throw Object.assign(new Error(`status: 404 ${apiKey} draftKey=secret-draft-key`), {
          status: 404,
        });
      },
    } as unknown as MicroCmsClientLike;
    const logged: string[] = [];
    const error = await loadContent(
      createMicroCmsSource({ serviceDomain: 'svc', apiKey }, client),
      config,
      {
        warn: (message) => logged.push(message),
      },
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain('HTTP 404');
    expect(message).not.toContain(apiKey);
    expect(message).not.toContain('secret-draft-key');
    expect(logged.join('\n')).not.toContain(apiKey);
  });
});

describe('fixture totalCount', () => {
  it.each(['works', 'categories'] as const)(
    'fails when the %s contents do not match totalCount',
    async (endpoint) => {
      const data = {
        ...defaultFixtureData,
        [endpoint]: {
          ...defaultFixtureData[endpoint],
          totalCount: defaultFixtureData[endpoint].contents.length + 1,
        },
      };
      const error = await loadContent(createFixtureSource(data), buildConfig, silent).catch(
        (e: unknown) => e,
      );
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain(`フィクスチャ ${endpoint}`);
      expect((error as Error).message).toContain('totalCount');
    },
  );
});

describe('duplicate draft IDs in MICROCMS_PREVIEW_DRAFTS', () => {
  it('fetches every entry in order and the last draft wins (one work per ID)', async () => {
    const config = resolveCmsConfig(
      {
        MICROCMS_SERVICE_DOMAIN: 'svc',
        MICROCMS_API_KEY: 'key',
        MICROCMS_PREVIEW_DRAFTS: 'w1:k1,w1:k2',
      },
      { isDev: true },
    );
    expect(config.previewDrafts).toEqual([
      { id: 'w1', draftKey: 'k1' },
      { id: 'w1', draftKey: 'k2' },
    ]);
    const requested: string[] = [];
    const source: CmsSource = {
      async listWorks() {
        return [rawWork({ id: 'w1', slug: 'published', title: '公開版' })];
      },
      async listCategories() {
        return [rawCategory()];
      },
      async getDraftWork(id, draftKey) {
        requested.push(`${id}:${draftKey}`);
        return rawWork({ id, slug: 'published', title: `下書き ${draftKey}` });
      },
    };
    const { works } = await loadContent(source, config, silent);
    expect(requested).toEqual(['w1:k1', 'w1:k2']);
    expect(works).toHaveLength(1);
    expect(works[0]).toMatchObject({ id: 'w1', title: '下書き k2', isDraftPreview: true });
  });
});

describe('loadContent: order of the guards', () => {
  it('checks the draft guard before fetching', async () => {
    let fetched = 0;
    const fail = async (): Promise<never> => {
      fetched += 1;
      throw new Error('fetch failed');
    };
    const source: CmsSource = { listWorks: fail, listCategories: fail, getDraftWork: fail };
    const config: CmsConfig = {
      source: 'microcms',
      serviceDomain: 'svc',
      apiKey: 'key',
      previewDrafts: [{ id: 'w1', draftKey: 'k1' }],
      isDev: false,
    };
    await expect(loadContent(source, config, silent)).rejects.toThrow(/下書きプレビュー/);
    expect(fetched).toBe(0);
  });

  it('a fetch error comes before validation', async () => {
    const source: CmsSource = {
      ...mockSource([], [rawCategory({ id: 'c1', slug: 'Bad_Slug' })]).source,
      async listWorks(): Promise<never> {
        throw new Error('fetch failed');
      },
    };
    await expect(loadContent(source, buildConfig, silent)).rejects.toThrow('fetch failed');
  });

  it('reports validation errors (and not the 0-works guard) when both apply', async () => {
    const { source } = mockSource([], [rawCategory({ id: 'c1', slug: 'Bad_Slug' })]);
    const error = (await loadContent(source, buildConfig, silent).catch(
      (e: unknown) => e,
    )) as CmsValidationError;
    expect(error).toBeInstanceOf(CmsValidationError);
    expect(error.violations).toHaveLength(1);
    expect(error.violations[0]).toContain('id=c1 slug="Bad_Slug"');
  });

  it('fails with the 0-works message when everything else is valid', async () => {
    const { source } = mockSource([], [rawCategory()]);
    const error = (await loadContent(source, buildConfig, silent).catch(
      (e: unknown) => e,
    )) as CmsValidationError;
    expect(error).toBeInstanceOf(CmsValidationError);
    expect(error.violations).toHaveLength(1);
    expect(error.violations[0]).toContain('0 件');
  });
});
