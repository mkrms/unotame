// 実績まわりのドメイン型（cms-integration）。表示側はこの型だけを見る（CMS のレスポンス型を使わない）。

export type ImageAsset = {
  /** 加工前の元 URL（サイズ・形式のパラメータは src/lib/cms/image.ts の cmsImageUrl で付ける） */
  url: string;
  width: number;
  height: number;
  /** 代替テキスト。無ければ '' */
  alt: string;
};

export type Category = {
  /** CMS のコンテンツ ID（内部用。URL に使わない） */
  id: string;
  /** 検証済み（?category= の値） */
  slug: string;
  name: string;
  /** WP 時代のカテゴリスラッグ（旧 URL のリダイレクト生成用）。空配列可 */
  legacyWpSlugs: string[];
};

export type Work = {
  /** CMS のコンテンツ ID（内部用。URL に使わない） */
  id: string;
  /** 検証済み（/works/{slug}/） */
  slug: string;
  /** 旧 WP 投稿 ID（旧 URL のリダイレクト生成用）。未入力なら undefined */
  legacyWpId?: number;
  title: string;
  category: Category;
  thumbnail: ImageAsset;
  /** 変換層で加工済みの本文 HTML（assets パス・img 属性） */
  bodyHtml: string;
  /** 入力値、または本文からの自動生成（必ず埋まる） */
  description: string;
  /** 'YYYY-MM-DD'（JST） */
  date: string;
  /** ISO 8601。sitemap の lastmod 用（P2） */
  updatedAt: string;
  /** 開発時の下書きプレビューで差し込まれたものだけ true */
  isDraftPreview: boolean;
};
