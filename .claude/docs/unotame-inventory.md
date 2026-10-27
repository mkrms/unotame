# UNOTAME スコープ棚卸（inventory）

プロジェクトで作るものを要素単位で洗い出し、各要素に**フェーズ**（P1/P2/P3）を付与する。
designer はここを起点に機能仕様（`spec/feature/`）へ展開する。スコープが変わったらここを更新する。

## フェーズの定義

| フェーズ | 目的 |
|---|---|
| P1 | 現行サイトを Astro で再構築し、ローカルで動く状態にする |
| P2 | デザイン刷新・品質向上・コンテンツ移行 |
| P3 | CI/CD による公開と本番切替 |

## 要素一覧（フェーズ付き）

| 要素 | フェーズ | 概要 | 仕様ファイル |
|---|---|---|---|
| プロジェクト基盤 | P1 | 現行 WP テーマを `legacy/` へ退避（D-007）、Astro + TS 初期化、ディレクトリ構成、lint/format、`.env.example`、`.gitignore` | 未作成 |
| 共通レイアウト | P1 | ヘッダー（ロゴ・ナビ ABOUT/WORKS/CONTACT）、フッター（CONTACT 導線・コピーライト）、ローダー | 未作成 |
| スタイル移植 | P1 | destyle + SCSS（FLOCSS）の移植、Objective フォント、画像資産 | `spec/design/design-policy.md`（枠） |
| CMS 連携 | P1 | microCMS スキーマ（works / category）、API クライアント、レスポンス→ドメイン型変換 | `spec/feature/cms-integration.md`（承認済み・D-010） |
| トップページ | P1 | KV（スキル一覧）、Message、Works 最新6件、About（プロフィール・SNSリンク） | 未作成 |
| Works 一覧 | P1 | `/works/` 実績一覧、カテゴリ絞り込み（jQuery なし） | 未作成 |
| Works 詳細 | P1 | 実績詳細（アイキャッチ・カテゴリ・本文）、Latest 3件 | 未作成 |
| URL 設計 | P1 | 現行 `/{category}/{投稿ID}` を見直して新しい URL 体系を決め、旧 URL からの 301 リダイレクト方針を定める | `spec/feature/url-design.md`（承認済み・D-009） |
| お問い合わせ | P1 | `/contact/`。送信方式を比較検討して決める（下記「お問い合わせ方式の候補」） | 未作成 |
| 404 ページ | P1 | 静的 404 と Xserver 側の ErrorDocument 設定 | 未作成 |
| デザイン刷新 | P2 | 現行踏襲のうえ細部（余白・タイポ・アニメーション・レスポンシブ）を改善 | `spec/design/design-policy.md`（枠） |
| SEO / OGP | P2 | ページ別 title/description/OGP、sitemap、robots、canonical | 未作成 |
| パフォーマンス / a11y | P2 | 画像最適化（astro:assets）、Lighthouse 目標、アクセシビリティ | 未作成 |
| コンテンツ移行 | P2 | WP 投稿・カテゴリ・アイキャッチを microCMS へ移行 | 未作成 |
| CI（PR チェック） | P2 | PR 時に lint / `astro check` / test / build を実行 | `spec/infra/hosting-and-deploy.md` |
| CD（自動デプロイ） | P3 | GitHub Actions → SSH/rsync で Xserver へ | `spec/infra/hosting-and-deploy.md` |
| CMS Webhook 再ビルド | P3 | microCMS 更新 → `repository_dispatch` → ビルド・デプロイ | `spec/infra/hosting-and-deploy.md` |
| 本番切替 | P3 | WP 撤去手順、URL 互換・リダイレクト（.htaccess）、ロールバック手順 | `spec/infra/hosting-and-deploy.md` |

## 未決事項（まとめ）

- **お問い合わせの送信方式**: 比較検討中（下記の候補）。
- **URL 設計の残り**: 方針は D-009 で確定。現行パーマリンク・カテゴリ一覧・`.htaccess` の確認、旧 ID ⇔ slug の
  対応表づくり、`/feed/` と旧画像 URL の扱いが残っている（`url-design.md` の未決事項）。
- **CMS 連携の残り**: 方針は D-010 で確定。無料プランで使える機能（Webhook・並べ替え等）の確認などが残っている（`cms-integration.md` の未決事項）。
- **パッケージマネージャ / Node バージョン**: 暫定 npm・Node LTS。

### お問い合わせ方式の候補（比較検討用）

| 方式 | 概要 | 主な観点 |
|---|---|---|
| Xserver 上の PHP スクリプト | 静的サイトと一緒に `contact.php` を置き、Xserver の mail 機能で送信 | 追加費用なし・外部依存なし／スパム対策・バリデーションを自前で実装・保守 |
| フォーム SaaS（Formspree / Formrun / Getform 等） | フォームの送信先を SaaS にする | 実装が最小・スパム対策込み／無料枠の制限・外部依存 |
| Google フォーム | 埋め込みまたはリンク | 無料・手軽／デザインの統一感が出にくい |
| サーバーレス関数 + メール API | Cloudflare Workers 等 + Resend 等 | 柔軟・モダン／構成要素が増える |
| メールリンク / SNS DM のみ | フォームを置かない | 最も簡素／スパム・利便性 |

→ `designer` で評価軸（費用・スパム対策・デザイン自由度・保守性・確認ステップ）を決めて比較し、決定したら decisions-log に記録する。
- 比較資料: [`contact-options.md`](./contact-options.md)（評価軸・候補比較・推奨案・決めてほしい質問）

## 次のアクション

- `designer` で「プロジェクト基盤」（legacy 退避と Astro 初期化）の仕様を起こす。
- お問い合わせ方式を `contact-options.md` の質問への回答をもとに決める。
