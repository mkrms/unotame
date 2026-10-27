// SDK のクライアントを差し替えて確認する（API は呼ばない）。
import { describe, expect, it } from 'vitest';
import {
  createMicroCmsSource,
  type MicroCmsClientLike,
} from '../../../src/lib/cms/microcms-source';
import { rawCategory, rawWork } from './helpers';

const options = { serviceDomain: 'svc', apiKey: 'super-secret-api-key' };

function fakeClient(overrides: Partial<Record<keyof MicroCmsClientLike, unknown>> = {}) {
  const requests: { method: string; args: unknown }[] = [];
  const client = {
    getAllContents: async (args: { endpoint: string }) => {
      requests.push({ method: 'getAllContents', args });
      if (overrides.getAllContents) throw overrides.getAllContents;
      return args.endpoint === 'works' ? [rawWork()] : [rawCategory()];
    },
    getListDetail: async (args: unknown) => {
      requests.push({ method: 'getListDetail', args });
      if (overrides.getListDetail) throw overrides.getListDetail;
      return rawWork();
    },
  } as unknown as MicroCmsClientLike;
  return { client, requests };
}

describe('createMicroCmsSource', () => {
  it('fetches all works with endpoint "works" and depth 1 (getAllContents pages internally)', async () => {
    const { client, requests } = fakeClient();
    const works = await createMicroCmsSource(options, client).listWorks();
    expect(works).toHaveLength(1);
    expect(requests).toEqual([
      {
        method: 'getAllContents',
        args: { endpoint: 'works', queries: { depth: 1, richEditorFormat: 'html' } },
      },
    ]);
  });

  it('fetches all categories without orders (admin order)', async () => {
    const { client, requests } = fakeClient();
    await createMicroCmsSource(options, client).listCategories();
    expect(requests).toEqual([{ method: 'getAllContents', args: { endpoint: 'categories' } }]);
  });

  it('fetches a draft with its draftKey', async () => {
    const { client, requests } = fakeClient();
    await createMicroCmsSource(options, client).getDraftWork('w1', 'dk');
    expect(requests[0]).toEqual({
      method: 'getListDetail',
      args: {
        endpoint: 'works',
        contentId: 'w1',
        queries: { depth: 1, richEditorFormat: 'html', draftKey: 'dk' },
      },
    });
  });

  it.each([401, 403, 404, 429, 500])(
    'turns HTTP %i into an error without the API key or draftKey',
    async (status) => {
      const sdkError = Object.assign(
        new Error(`fetch API response status: ${status} super-secret-api-key secret-draft`),
        { status },
      );
      const { client } = fakeClient({ getAllContents: sdkError, getListDetail: sdkError });
      const source = createMicroCmsSource(options, client);
      const errors = await Promise.all([
        source.listWorks().catch((e: Error) => e),
        source.listCategories().catch((e: Error) => e),
        source.getDraftWork('w1', 'secret-draft').catch((e: Error) => e),
      ]);
      for (const error of errors) {
        expect(error).toBeInstanceOf(Error);
        const message = (error as Error).message;
        expect(message).toContain(`HTTP ${status}`);
        expect(message).not.toContain('super-secret-api-key');
        expect((error as Error).cause).toBeUndefined();
      }
      // draftKey は下書きの取得時だけ使うので、そのエラーで伏せられていること
      expect((errors[2] as Error).message).not.toContain('secret-draft');
    },
  );

  it('handles network errors without a status', async () => {
    const { client } = fakeClient({ getAllContents: new Error('Network Error.') });
    await expect(createMicroCmsSource(options, client).listWorks()).rejects.toThrow(
      /Network Error/,
    );
  });
});
