// 開発サーバー判定（src/integrations/dev-server-flag.ts → isDevServer → resolveCmsConfig / loadContent）。
// import.meta.env.DEV は NODE_ENV=development や --devOutput 付きの astro build でも true になるので使わない。
import { describe, expect, it } from 'vitest';
import devServerFlag, {
  DEV_SERVER_FLAG,
  devServerFlagDefine,
} from '../../../src/integrations/dev-server-flag';
import { isDevServer, loadContent } from '../../../src/lib/cms';
import { resolveCmsConfig } from '../../../src/lib/cms/config';
import { mockSource, rawCategory } from './helpers';
import cmsIndexSource from '../../../src/lib/cms/index.ts?raw';

/** astro:config:setup フックを、指定のコマンドで呼んだときの define を返す */
function defineFor(command: string): Record<string, string> {
  const updates: { vite?: { define?: Record<string, string> } }[] = [];
  const hook = devServerFlag().hooks['astro:config:setup'];
  if (!hook) throw new Error('astro:config:setup hook is missing');
  // テストに必要な引数だけを渡す
  void hook({
    command,
    updateConfig: (config: (typeof updates)[number]) => {
      updates.push(config);
      return {};
    },
  } as unknown as Parameters<typeof hook>[0]);
  expect(updates).toHaveLength(1);
  return updates[0].vite?.define ?? {};
}

/** 注入された値（JSON）を、実行時の import.meta.env の値に戻す */
const injected = (command: string) => JSON.parse(defineFor(command)[DEV_SERVER_FLAG]) as unknown;

describe('dev-server-flag integration', () => {
  it('injects import.meta.env.UNOTAME_IS_DEV_SERVER', () => {
    expect(DEV_SERVER_FLAG).toBe('import.meta.env.UNOTAME_IS_DEV_SERVER');
  });

  it('is true only for astro dev', () => {
    expect(defineFor('dev')).toEqual({ [DEV_SERVER_FLAG]: 'true' });
  });

  it.each(['build', 'preview', 'sync'])('is false for astro %s', (command) => {
    expect(defineFor(command)).toEqual({ [DEV_SERVER_FLAG]: 'false' });
    expect(devServerFlagDefine(command)).toEqual({ [DEV_SERVER_FLAG]: 'false' });
  });
});

describe('isDevServer', () => {
  it('is true only for the injected true', () => {
    expect(isDevServer(injected('dev'))).toBe(true);
    expect(isDevServer(true)).toBe(true);
  });

  it.each([
    ['injected by astro build', injected('build')],
    ['not injected', undefined],
    ['false', false],
    ['the string "true"', 'true'],
    ['1', 1],
  ])('is false when %s', (_name, value) => {
    expect(isDevServer(value)).toBe(false);
  });
});

describe('guards outside the dev server (astro build / preview)', () => {
  const isDev = isDevServer(injected('build'));

  it('MICROCMS_PREVIEW_DRAFTS makes the build fail', () => {
    expect(() =>
      resolveCmsConfig({ CMS_SOURCE: 'fixture', MICROCMS_PREVIEW_DRAFTS: 'a1:k1' }, { isDev }),
    ).toThrow(/開発サーバー（astro dev）専用/);
  });

  it('0 works makes the build fail', async () => {
    const config = resolveCmsConfig({ CMS_SOURCE: 'fixture' }, { isDev });
    const { source } = mockSource([], [rawCategory()]);
    await expect(loadContent(source, config, { warn: () => {} })).rejects.toThrow(/0 件/);
  });

  it('both are relaxed only on the dev server', async () => {
    const devIsDev = isDevServer(injected('dev'));
    const warnings: string[] = [];
    const config = resolveCmsConfig({ CMS_SOURCE: 'fixture' }, { isDev: devIsDev });
    const { source } = mockSource([], [rawCategory()]);
    await expect(
      loadContent(source, config, { warn: (message) => warnings.push(message) }),
    ).resolves.toEqual({ works: [], categories: [expect.objectContaining({ id: 'cat-web' })] });
    expect(warnings).toHaveLength(1);
  });
});

describe('src/lib/cms/index.ts', () => {
  it('decides "dev" by the injected flag, not by import.meta.env.DEV / MODE / PROD', () => {
    expect(cmsIndexSource).toContain('isDevServer(import.meta.env.UNOTAME_IS_DEV_SERVER)');
    expect(cmsIndexSource).not.toMatch(/import\.meta\.env\.(DEV|PROD|MODE)\b/);
  });
});
