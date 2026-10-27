// microCMS の生のレスポンス型（cms-integration）。必須フィールドでも欠ける可能性があるものとして受け、
// 変換・検証（transform.ts / validate.ts）で必須を保証する（CMS 側の設定変更に耐えるため）。
import type { MicroCMSImage, MicroCMSListContent, MicroCMSListResponse } from 'microcms-js-sdk';

export type RawCategory = MicroCMSListContent & {
  name?: string;
  slug?: string;
  /** カンマ区切り（例 "old-a,old-b"） */
  legacyWpSlugs?: string | null;
};

export type RawWork = MicroCMSListContent & {
  title?: string;
  slug?: string;
  /** depth=1 で展開される。参照先が非公開・削除なら null / 欠落の可能性 → 検証で落とす */
  category?: RawCategory | null;
  thumbnail?: MicroCMSImage | null;
  /** リッチエディタ（richEditorV2）の HTML */
  body?: string;
  /** ISO 8601（UTC）。日付のみの指定でも JST 0 時を UTC で表した値が入る */
  date?: string;
  description?: string | null;
  legacyWpId?: number | null;
};

/** 一覧 API のレスポンス（fixtures/microcms/*.json もこの形） */
export type RawListResponse<T> = MicroCMSListResponse<T>;
