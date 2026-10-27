import { describe, expect, it } from 'vitest';
import { parsePreviewDrafts, resolveCmsConfig } from '../../../src/lib/cms/config';

const credentials = { MICROCMS_SERVICE_DOMAIN: 'svc', MICROCMS_API_KEY: 'secret-key-value' };

function messageOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error('expected to throw');
}

describe('resolveCmsConfig', () => {
  it('defaults to microcms and names the missing variables', () => {
    expect(messageOf(() => resolveCmsConfig({}, { isDev: false }))).toMatch(
      /MICROCMS_SERVICE_DOMAIN, MICROCMS_API_KEY/,
    );
  });

  it('names only the missing variable and never includes values', () => {
    const message = messageOf(() =>
      resolveCmsConfig({ MICROCMS_API_KEY: 'secret-key-value' }, { isDev: false }),
    );
    expect(message).toContain('MICROCMS_SERVICE_DOMAIN');
    expect(message).not.toContain('MICROCMS_API_KEY');
    expect(message).not.toContain('secret-key-value');
  });

  it('treats empty values (a copied .env.example) as unset', () => {
    expect(() =>
      resolveCmsConfig(
        {
          MICROCMS_SERVICE_DOMAIN: '',
          MICROCMS_API_KEY: ' ',
          CMS_SOURCE: '',
          MICROCMS_PREVIEW_DRAFTS: '',
        },
        { isDev: false },
      ),
    ).toThrow(/MICROCMS_SERVICE_DOMAIN/);
  });

  it('returns a microcms config when the credentials are set', () => {
    expect(resolveCmsConfig(credentials, { isDev: false })).toEqual({
      source: 'microcms',
      serviceDomain: 'svc',
      apiKey: 'secret-key-value',
      previewDrafts: [],
      isDev: false,
    });
  });

  it('does not need credentials with CMS_SOURCE=fixture', () => {
    expect(resolveCmsConfig({ CMS_SOURCE: 'fixture' }, { isDev: false })).toEqual({
      source: 'fixture',
      previewDrafts: [],
      isDev: false,
    });
  });

  it('rejects an unknown CMS_SOURCE', () => {
    expect(() => resolveCmsConfig({ ...credentials, CMS_SOURCE: 'foo' }, { isDev: true })).toThrow(
      /CMS_SOURCE/,
    );
  });

  it('rejects MICROCMS_PREVIEW_DRAFTS outside dev (build / preview)', () => {
    expect(() =>
      resolveCmsConfig({ ...credentials, MICROCMS_PREVIEW_DRAFTS: 'a1:k1' }, { isDev: false }),
    ).toThrow(/MICROCMS_PREVIEW_DRAFTS/);
  });

  it('rejects MICROCMS_PREVIEW_DRAFTS outside dev even without credentials', () => {
    expect(() => resolveCmsConfig({ MICROCMS_PREVIEW_DRAFTS: 'a1:k1' }, { isDev: false })).toThrow(
      /MICROCMS_PREVIEW_DRAFTS/,
    );
  });

  it('rejects CMS_SOURCE=fixture together with MICROCMS_PREVIEW_DRAFTS', () => {
    expect(() =>
      resolveCmsConfig(
        { CMS_SOURCE: 'fixture', MICROCMS_PREVIEW_DRAFTS: 'a1:k1' },
        { isDev: true },
      ),
    ).toThrow(/fixture/);
  });

  it('parses preview drafts in dev', () => {
    const config = resolveCmsConfig(
      { ...credentials, MICROCMS_PREVIEW_DRAFTS: 'a1:k1,b2:k2' },
      { isDev: true },
    );
    expect(config.previewDrafts).toEqual([
      { id: 'a1', draftKey: 'k1' },
      { id: 'b2', draftKey: 'k2' },
    ]);
  });
});

describe('parsePreviewDrafts', () => {
  it('parses "id:draftKey" pairs and trims spaces', () => {
    expect(parsePreviewDrafts(' a1 : k1 , b2:k2')).toEqual([
      { id: 'a1', draftKey: 'k1' },
      { id: 'b2', draftKey: 'k2' },
    ]);
  });

  it.each(['a1', 'a1:', ':k1', 'a1:k1:x', 'a1:k1,', 'a1:k1,b2'])(
    'rejects %j without echoing the value',
    (value) => {
      const message = messageOf(() => parsePreviewDrafts(value));
      expect(message).toMatch(/MICROCMS_PREVIEW_DRAFTS/);
      expect(message).not.toContain('k1');
    },
  );

  it('keeps duplicate IDs as separate entries (in order)', () => {
    expect(parsePreviewDrafts('a1:k1,a1:k2')).toEqual([
      { id: 'a1', draftKey: 'k1' },
      { id: 'a1', draftKey: 'k2' },
    ]);
  });
});

// 複数のガードが同時に当てはまるとき、どのエラーが先に出るか（resolveCmsConfig の順序を固定する）:
// 1. CMS_SOURCE の値 → 2. 開発サーバー以外での MICROCMS_PREVIEW_DRAFTS → 3. fixture と下書きの併用
// → 4. 認証情報の不足 → 5. MICROCMS_PREVIEW_DRAFTS の形式
describe('resolveCmsConfig: order of the guards', () => {
  const CMS_SOURCE_ERROR = /CMS_SOURCE は "microcms" か "fixture"/;
  const NOT_DEV_ERROR = /開発サーバー（astro dev）専用/;
  const FIXTURE_DRAFTS_ERROR = /CMS_SOURCE=fixture と MICROCMS_PREVIEW_DRAFTS は同時に使えません/;
  const MISSING_ERROR = /環境変数が設定されていません/;
  const FORMAT_ERROR = /番目の要素が/;

  it.each([
    [
      '1 before 2: unknown CMS_SOURCE + drafts outside dev',
      { CMS_SOURCE: 'foo', MICROCMS_PREVIEW_DRAFTS: 'a1:k1' },
      false,
      CMS_SOURCE_ERROR,
    ],
    [
      '2 before 3: fixture + drafts outside dev',
      { CMS_SOURCE: 'fixture', MICROCMS_PREVIEW_DRAFTS: 'a1:k1' },
      false,
      NOT_DEV_ERROR,
    ],
    [
      '2 before 4 and 5: malformed drafts outside dev without credentials',
      { MICROCMS_PREVIEW_DRAFTS: 'broken' },
      false,
      NOT_DEV_ERROR,
    ],
    [
      '3 before 5: fixture + malformed drafts in dev',
      { CMS_SOURCE: 'fixture', MICROCMS_PREVIEW_DRAFTS: 'broken' },
      true,
      FIXTURE_DRAFTS_ERROR,
    ],
    [
      '4 before 5: malformed drafts in dev without credentials',
      { MICROCMS_PREVIEW_DRAFTS: 'broken' },
      true,
      MISSING_ERROR,
    ],
    [
      '5: malformed drafts in dev with credentials',
      { ...credentials, MICROCMS_PREVIEW_DRAFTS: 'broken' },
      true,
      FORMAT_ERROR,
    ],
  ] as const)('%s', (_name, env, isDev, expected) => {
    expect(messageOf(() => resolveCmsConfig(env, { isDev }))).toMatch(expected);
  });
});
