// microCMS（SDK）版の CmsSource（cms-integration「6-1」）。microcms-js-sdk を import するのはこのファイルだけ。
import { createClient } from 'microcms-js-sdk';
import type { RawCategory, RawWork } from './raw-types';
import type { CmsSource } from './source';

/** テストで差し替えられるよう、使うメソッドだけに絞った SDK クライアントの型 */
export type MicroCmsClientLike = Pick<
  ReturnType<typeof createClient>,
  'getAllContents' | 'getListDetail'
>;

export type MicroCmsSourceOptions = { serviceDomain: string; apiKey: string };

const WORKS_QUERIES = {
  // category（コンテンツ参照）を展開する
  depth: 1,
  // richEditorV2 の本文を HTML で受け取る（既定も HTML だが明示する）
  richEditorFormat: 'html',
} as const;

/**
 * SDK のエラーを、秘密情報を含まないエラーに置き換える。
 * - API キーはリクエストヘッダーで送られ、SDK のメッセージ・URL には入らないが、念のため値を伏せる
 * - 元のエラー（cause）は付けない（リクエストの詳細がログに出ないようにする）
 */
function toSafeError(error: unknown, action: string, secrets: readonly string[]): Error {
  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? (error as { status?: unknown }).status
      : undefined;
  let detail = error instanceof Error ? error.message : String(error);
  for (const secret of secrets) {
    if (secret) detail = detail.split(secret).join('***');
  }
  const statusText = typeof status === 'number' ? `（HTTP ${status}）` : '';
  return new Error(`microCMS からの${action}に失敗しました${statusText}: ${detail}`);
}

export function createMicroCmsSource(
  options: MicroCmsSourceOptions,
  // 一時的な 5xx / 429 は SDK のリトライ（retry: true で最大 2 回）に任せる
  client: MicroCmsClientLike = createClient({ ...options, retry: true }),
): CmsSource {
  const secrets = [options.apiKey];

  return {
    async listWorks() {
      try {
        // getAllContents は内部で limit=100 ずつページングする
        return await client.getAllContents<RawWork>({ endpoint: 'works', queries: WORKS_QUERIES });
      } catch (error) {
        throw toSafeError(error, '実績（works）の取得', secrets);
      }
    },

    async listCategories() {
      try {
        // orders を指定しない = 管理画面の並び順
        return await client.getAllContents<RawCategory>({ endpoint: 'categories' });
      } catch (error) {
        throw toSafeError(error, 'カテゴリ（categories）の取得', secrets);
      }
    },

    async getDraftWork(contentId, draftKey) {
      try {
        return await client.getListDetail<RawWork>({
          endpoint: 'works',
          contentId,
          queries: { ...WORKS_QUERIES, draftKey },
        });
      } catch (error) {
        throw toSafeError(error, `下書き（id=${contentId}）の取得`, [...secrets, draftKey]);
      }
    },
  };
}
