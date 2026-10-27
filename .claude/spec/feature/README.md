# 機能仕様（feature specs）

本ディレクトリは、プロジェクトの**機能面の仕様**を機能単位で分割して保存する。スコープの全体像と
フェーズ付与は `.claude/docs/unotame-inventory.md`（棚卸）を参照。

## 機能仕様一覧

| ファイル | 範囲 |
|---|---|
| [project-foundation.md](./project-foundation.md) | プロジェクト基盤（P1）：WP テーマの `legacy/` 退避手順とコミットの分け方、Astro の初期化（バージョン方針・`astro.config.mjs`・`tsconfig.json`）、ディレクトリ構成と legacy 資産の移し先、Node 固定・npm・ESLint/Prettier/Stylelint・sass・Vitest、npm scripts、`.gitignore`/`.gitattributes`/`.editorconfig`/`.env.example`（状態: 承認済み・D-011） |
| [url-design.md](./url-design.md) | URL 設計（P1）：新 URL 体系・末尾スラッシュ・slug 規則・カテゴリ絞り込みのクエリ・旧 URL からの 301 リダイレクト生成・canonical/sitemap の URL 規則（状態: 承認済み・D-009） |
| [cms-integration.md](./cms-integration.md) | CMS 連携（P1）：microCMS の API 設計（works / categories）、データ取得層（`src/lib/cms/`・SDK・全件取得・ドメイン型への変換・ビルド時の検証）、画像 URL、環境変数と秘密情報、下書きプレビューとフィクスチャモード、無料プランの制約（状態: 承認済み・D-010） |
| [layout.md](./layout.md) | 共通レイアウト（P1）：`BaseLayout`・`BaseHead`（title の組み立て・description・noindex・最小限の OGP・Adobe Fonts）・ヘッダー（ナビ・`aria-current`）・フッター・ローダー（jQuery なし、JS 無効と `prefers-reduced-motion` では出さない）（状態: 承認済み・D-012） |
| [style-migration.md](./style-migration.md) | スタイル移植（P1）：legacy SCSS の `src/styles/` への対応表（`@use` 化）、destyle の npm 化、Objective・Adobe Fonts（前提条件つき）、`<Image>` の利用、グローバル SCSS に統一（`<style>` は書かない）、768px の重なりの修正、見た目の比較手順（状態: 承認済み・D-012） |
| [not-found.md](./not-found.md) | 404 ページ（P1）：`src/pages/404.astro` の文言と導線、noindex、ルート相対のパス、`ErrorDocument` との関係、ローカルでの確かめ方（状態: 承認済み・D-012） |
| [top-page.md](./top-page.md) | トップページ（P1）：KV / Message / Works 最新 6 件 / About・SNS、`src/data/profile.ts` と `Profile` 型、共通の実績カード `WorkCard`・`ViewMoreLink`、`dist/` の検査方法（`test:dist`）（状態: 承認済み・D-012） |
| [works-list.md](./works-list.md) | 実績一覧（P1）：`/works/` の全件表示、カテゴリ絞り込み（`<button>`・`aria-pressed`・素の TS）、`?category=` と `replaceState`、絞り込みの純粋関数、happy-dom による DOM テスト（状態: 承認済み・D-012） |
| [works-detail.md](./works-detail.md) | 実績詳細（P1）：`/works/{slug}/` の生成、サムネイル・カテゴリ（一覧の絞り込みへのリンク）・本文（`set:html` の範囲と信頼の前提）、自身を除いた Latest 3 件（状態: 承認済み・D-012） |

## 記法ルール

- 各仕様は「目的 / スコープ / データ構造案 / 振る舞い / 受け入れ条件 / 未決事項」を含める。
- データ構造は実装言語（TypeScript）前提の**案**であり、実装時に `implementer` が調整してよい。
- 移行元の現行 WP テーマに該当機能がある場合は、「現行の振る舞い」を明記して差分を示す。
- 後フェーズの要素は本書では「将来拡張」として軽く触れるに留める。
- 新規作成は `feature-spec` スキルを使うと標準フォーマットで書ける。
