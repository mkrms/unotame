// ページ・コンポーネントから使う公開関数（cms-integration「インターフェースと公開関数」）。
// 取得 → 検証 → 変換 → 並べ替えをここでまとめ、ビルド中は結果をメモ化する（API 呼び出しは原則 2 回）。
import type { Category, Work } from '../domain/work';
import { resolveCmsConfig, type CmsConfig } from './config';
import type { RawWork } from './raw-types';
import type { CmsSource } from './source';
import { transformCategory, transformWork } from './transform';
import { assertValidContent, CmsValidationError } from './validate';

export type { CmsConfig } from './config';
export type { CmsSource } from './source';
export { CmsValidationError } from './validate';

export type CmsContent = { works: Work[]; categories: Category[] };

export type LoadOptions = {
  /** 警告（ビルドは続行）の出力先。既定は console.warn */
  warn?: (message: string) => void;
};

const defaultWarn = (message: string) => console.warn(`[cms] ${message}`);

/** 同じ ID は下書き版で置き換え、新しい ID は末尾に足す */
function mergeDrafts(published: readonly RawWork[], drafts: readonly RawWork[]): RawWork[] {
  const merged = [...published];
  for (const draft of drafts) {
    const index = merged.findIndex((work) => work.id === draft.id);
    if (index >= 0) merged[index] = draft;
    else merged.push(draft);
  }
  return merged;
}

const timeOf = (value: string | undefined) => {
  const time = value === undefined ? NaN : Date.parse(value);
  return Number.isNaN(time) ? -Infinity : time;
};

/** date 降順 → publishedAt 降順 → id 昇順（決定的にする） */
function compareWorks(
  a: { work: Work; publishedAt?: string },
  b: { work: Work; publishedAt?: string },
): number {
  if (a.work.date !== b.work.date) return a.work.date < b.work.date ? 1 : -1;
  const published = timeOf(b.publishedAt) - timeOf(a.publishedAt);
  if (published !== 0 && !Number.isNaN(published)) return published > 0 ? 1 : -1;
  if (a.work.id === b.work.id) return 0;
  return a.work.id < b.work.id ? -1 : 1;
}

/**
 * ソースから全件を取り、検証・変換・並べ替えて返す（テストではソースを差し替えて同じ処理を通す）。
 * - 違反はまとめて CmsValidationError
 * - works が 0 件: 本番ビルド（isDev: false）はエラー、開発時は警告のみ
 */
export async function loadContent(
  source: CmsSource,
  config: CmsConfig,
  options: LoadOptions = {},
): Promise<CmsContent> {
  const warn = options.warn ?? defaultWarn;
  if (!config.isDev && config.previewDrafts.length > 0) {
    // resolveCmsConfig で止まるはずだが、本番ビルドに下書きが混ざる経路を二重に塞ぐ
    throw new Error('下書きプレビューは開発時にしか使えません');
  }

  const [rawCategories, publishedWorks] = await Promise.all([
    source.listCategories(),
    source.listWorks(),
  ]);

  const drafts = await Promise.all(
    config.previewDrafts.map(({ id, draftKey }) => source.getDraftWork(id, draftKey)),
  );
  const draftIds = new Set(drafts.map((draft) => draft.id));
  const rawWorks = mergeDrafts(publishedWorks, drafts);

  assertValidContent(rawWorks, rawCategories);

  const categories = rawCategories.map(transformCategory);
  const categoriesById = new Map(categories.map((category) => [category.id, category]));

  const entries = rawWorks.map((raw) => {
    const { work, warnings } = transformWork(raw, categoriesById, {
      isDraftPreview: draftIds.has(raw.id),
    });
    warnings.forEach(warn);
    return { work, publishedAt: raw.publishedAt };
  });
  const works = entries.sort(compareWorks).map((entry) => entry.work);

  if (works.length === 0) {
    const message =
      '公開中の実績（works）が 0 件です。API の不調などで空のサイトを公開しないよう、本番ビルドでは止めます';
    if (!config.isDev) throw new CmsValidationError([message]);
    warn(message);
  }

  return { works, categories };
}

export type CmsStoreDeps = {
  /** 呼ぶたびに設定を解決する（取得の前にエラーで止められるように） */
  getConfig: () => CmsConfig;
  createSource: (config: CmsConfig) => CmsSource | Promise<CmsSource>;
  warn?: (message: string) => void;
};

/**
 * 公開関数の組を作る。本番ビルド（isDev: false）では結果の Promise を保持して 2 回目以降はそれを返し、
 * 開発サーバー（isDev: true）では CMS の更新をすぐ見られるよう毎回取り直す（C-10）。
 */
export function createCmsStore(deps: CmsStoreDeps) {
  let cache: Promise<CmsContent> | undefined;

  function load(): Promise<CmsContent> {
    if (cache) return cache;
    let config: CmsConfig;
    try {
      config = deps.getConfig();
    } catch (error) {
      return Promise.reject(error);
    }
    const promise = Promise.resolve(deps.createSource(config)).then((source) =>
      loadContent(source, config, { warn: deps.warn }),
    );
    if (!config.isDev) cache = promise;
    return promise;
  }

  return {
    /** 検証済み・date 降順 */
    async getAllWorks(): Promise<Work[]> {
      return [...(await load()).works];
    },
    /** 先頭 limit 件（トップの 6 件）。件数が足りなければ全件 */
    async getLatestWorks(limit: number): Promise<Work[]> {
      return (await load()).works.slice(0, Math.max(0, limit));
    },
    async getWorkBySlug(slug: string): Promise<Work | undefined> {
      return (await load()).works.find((work) => work.slug === slug);
    },
    /** 管理画面の並び順 */
    async getAllCategories(): Promise<Category[]> {
      return [...(await load()).categories];
    },
    /** 実績が 1 件以上あるカテゴリ（管理画面の並び順） */
    async getCategoriesInUse(): Promise<Category[]> {
      const { works, categories } = await load();
      const used = new Set(works.map((work) => work.category.id));
      return categories.filter((category) => used.has(category.id));
    },
  };
}

/**
 * 開発サーバー（astro dev）かどうか。src/integrations/dev-server-flag.ts が注入する定数が
 * 厳密に true のときだけ true（未注入・false・文字列などは本番ビルド扱いにして、ガードを外さない）。
 * Vite の DEV フラグ（import.meta.env の DEV）は NODE_ENV=development や --devOutput 付きの astro build でも
 * true になるので使わない。
 */
export function isDevServer(flag: unknown): boolean {
  return flag === true;
}

const defaultStore = createCmsStore({
  // 環境変数を読むのはここだけ（PUBLIC_ を付けないのでクライアントには出ない）
  getConfig: () =>
    resolveCmsConfig(
      {
        MICROCMS_SERVICE_DOMAIN: import.meta.env.MICROCMS_SERVICE_DOMAIN,
        MICROCMS_API_KEY: import.meta.env.MICROCMS_API_KEY,
        CMS_SOURCE: import.meta.env.CMS_SOURCE,
        MICROCMS_PREVIEW_DRAFTS: import.meta.env.MICROCMS_PREVIEW_DRAFTS,
      },
      { isDev: isDevServer(import.meta.env.UNOTAME_IS_DEV_SERVER) },
    ),
  // 使わない側のソース（SDK / フィクスチャの JSON）を読み込まないよう、動的 import にする
  createSource: async (config) => {
    if (config.source === 'fixture') {
      const { createFixtureSource } = await import('./fixture-source');
      return createFixtureSource();
    }
    const { createMicroCmsSource } = await import('./microcms-source');
    return createMicroCmsSource({ serviceDomain: config.serviceDomain, apiKey: config.apiKey });
  },
});

export const { getAllWorks, getLatestWorks, getWorkBySlug, getAllCategories, getCategoriesInUse } =
  defaultStore;
