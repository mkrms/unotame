// 環境変数 → CmsConfig（cms-integration「環境変数と秘密情報」）。
// 環境変数を読むのはここ（の呼び出し元 index.ts）だけ。純粋関数にして Vitest から任意の env を渡せるようにする。
// エラーメッセージには変数「名」だけを出し、値（API キーなど）は出さない。

export type DraftRef = { id: string; draftKey: string };

export type CmsConfig =
  | {
      source: 'microcms';
      serviceDomain: string;
      apiKey: string;
      /** 開発時の下書きプレビュー（isDev のときだけ空でない） */
      previewDrafts: DraftRef[];
      isDev: boolean;
    }
  | {
      source: 'fixture';
      previewDrafts: [];
      isDev: boolean;
    };

export type CmsEnv = Partial<
  Record<
    'MICROCMS_SERVICE_DOMAIN' | 'MICROCMS_API_KEY' | 'CMS_SOURCE' | 'MICROCMS_PREVIEW_DRAFTS',
    string | undefined
  >
>;

export class CmsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CmsConfigError';
  }
}

/** 空文字・空白だけは「未設定」として扱う（.env.example を写しただけの状態を想定） */
function read(env: CmsEnv, name: keyof CmsEnv): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

/** "id:draftKey,id2:draftKey2" を解釈する。形式不正はエラー（値はメッセージに出さない） */
export function parsePreviewDrafts(value: string): DraftRef[] {
  const items = value.split(',').map((item) => item.trim());
  return items.map((item, index) => {
    const parts = item.split(':').map((part) => part.trim());
    if (parts.length !== 2 || parts[0] === '' || parts[1] === '') {
      throw new CmsConfigError(
        `MICROCMS_PREVIEW_DRAFTS の ${index + 1} 番目の要素が "コンテンツID:draftKey" の形式ではありません`,
      );
    }
    return { id: parts[0], draftKey: parts[1] };
  });
}

export function resolveCmsConfig(env: CmsEnv, opts: { isDev: boolean }): CmsConfig {
  const { isDev } = opts;
  const sourceName = read(env, 'CMS_SOURCE') ?? 'microcms';
  if (sourceName !== 'microcms' && sourceName !== 'fixture') {
    throw new CmsConfigError(
      'CMS_SOURCE は "microcms" か "fixture" を指定してください（未指定は microcms）',
    );
  }

  const previewDraftsValue = read(env, 'MICROCMS_PREVIEW_DRAFTS');
  if (previewDraftsValue !== undefined) {
    // 本番ビルドに下書きが混ざる経路を作らない（黙って無視しない）
    if (!isDev) {
      throw new CmsConfigError(
        'MICROCMS_PREVIEW_DRAFTS は開発サーバー（astro dev）専用です。ビルドの前に設定を外してください',
      );
    }
    if (sourceName === 'fixture') {
      throw new CmsConfigError('CMS_SOURCE=fixture と MICROCMS_PREVIEW_DRAFTS は同時に使えません');
    }
  }

  if (sourceName === 'fixture') {
    return { source: 'fixture', previewDrafts: [], isDev };
  }

  const serviceDomain = read(env, 'MICROCMS_SERVICE_DOMAIN');
  const apiKey = read(env, 'MICROCMS_API_KEY');
  const missing = [
    serviceDomain === undefined ? 'MICROCMS_SERVICE_DOMAIN' : undefined,
    apiKey === undefined ? 'MICROCMS_API_KEY' : undefined,
  ].filter((name): name is string => name !== undefined);
  if (serviceDomain === undefined || apiKey === undefined) {
    throw new CmsConfigError(
      `microCMS から取得するための環境変数が設定されていません: ${missing.join(', ')}。` +
        '.env に設定するか、API を使わない場合は CMS_SOURCE=fixture を指定してください',
    );
  }

  return {
    source: 'microcms',
    serviceDomain,
    apiKey,
    previewDrafts: previewDraftsValue === undefined ? [] : parsePreviewDrafts(previewDraftsValue),
    isDev,
  };
}
