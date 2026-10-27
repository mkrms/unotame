// 旧 URL リダイレクトの設定（url-design「対応表の持ち方」の安全策）。
// 対応の「正」は CMS の works.legacyWpId（案 R）。ここには件数の下限だけを持つ。

/**
 * 生成する旧 WP 実績詳細のリダイレクト（legacyWpId を持つ実績）の期待件数。これを下回るとビルドが失敗する。
 * コンテンツ移行（P2、url-design U-2）で旧投稿 ID を CMS に入力し終えたら、その件数に上げる。
 * 旧 ID は増えない前提なので、上げたあとは下げない（下げるのは移行の対象を見直したときだけ）。
 */
export const EXPECTED_LEGACY_WORK_REDIRECTS = 0;
