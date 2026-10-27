// データの取得元の差し替え口（cms-integration「6-1」）。microCMS 版とフィクスチャ版がこれを実装する。
import type { RawCategory, RawWork } from './raw-types';

export interface CmsSource {
  /** 公開中の全件（ページング済み） */
  listWorks(): Promise<RawWork[]>;
  /** 公開中の全件（管理画面の並び順） */
  listCategories(): Promise<RawCategory[]>;
  /** 開発時の下書きプレビュー用。1 件の下書きを draftKey で取る */
  getDraftWork(contentId: string, draftKey: string): Promise<RawWork>;
}
