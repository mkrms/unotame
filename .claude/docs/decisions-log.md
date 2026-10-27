# 意思決定ログ（Decisions Log）

プロジェクトの重要な設計・技術判断を時系列で記録する。各エントリは「決定 / 背景 / 影響」を残す。
日付は相対表現を避け、絶対日付（YYYY-MM-DD）で記す。

---

## 2026-10-27 初期セットアップ

### D-001 開発基盤の構成: 2 段 CLAUDE.md ＋ .claude/ 構造
- **決定**: ルート `CLAUDE.md`（概要）と `.claude/CLAUDE.md`（詳細）の 2 段構成とし、`.claude/` 配下に
  `agents` / `docs` / `spec`（feature / infra / design / quality）/ `skills` を置く。
- **背景**: 初期読み込みを軽くし、ドキュメントの所在を固定して複数エージェント・将来の自分が迷わないようにするため。
- **影響**: 以後、機能仕様は `spec/feature/`、機能外仕様は `spec/{infra,design,quality}/`、決定はこのログに集約する。

### D-002 エージェント構成: 4 役
- **決定**: designer / implementer / code-reviewer / tester の 4 役で進める。
- **背景**: 設計・実装・レビュー・テストの責務を分離するため。
- **影響**: `.claude/agents/` に 4 種を定義。code-reviewer は既存 `/code-review` skill も活用する。

### D-003 フレームワーク: Astro（静的出力）
- **決定**: WordPress テーマを廃し、Astro（TypeScript、`output: 'static'`）で再構築する。
- **背景**: 公開先が Xserver レンタルサーバーであり、静的ファイル配信が最も安定・高速。コンテンツ中心の
  ポートフォリオでは JS を最小化できる Astro が適する。Next.js（static export）・Nuxt/SvelteKit も比較した。
- **影響**: ビルド成果物（`dist/`）をサーバーへ配置する運用になる。PHP 実行に依存する機能（お問い合わせ送信）は別手段が必要。

### D-004 コンテンツ管理: ヘッドレス CMS（第一候補 microCMS）
- **決定**: Works（実績）はヘッドレス CMS で管理し、ビルド時に API から取得して静的生成する。第一候補は microCMS
  （P1 冒頭で最終確定する）。
- **背景**: 管理画面からの更新性を残しつつ、WordPress のサーバー運用（PHP/DB/プラグイン更新）から解放されるため。
  Markdown のリポジトリ管理・WP のヘッドレス化も比較した。
- **影響**: CMS 更新時に再ビルドする仕組み（Webhook → GitHub Actions `repository_dispatch`）が必要（P3）。
  API キーは `.env` / GitHub Secrets で管理。既存 WP 投稿の CMS への移行作業が発生する（P2）。

### D-005 デザイン方針: 現行デザインを踏襲して刷新（SCSS/FLOCSS 継続・jQuery 廃止）
- **決定**: ロゴ・Objective フォント・ページ構成など現行デザインを踏襲しつつ、コードをモダン化し細部を改善する。
  スタイルは SCSS ＋ FLOCSS を継続、jQuery は廃止する。
- **背景**: 既存のブランド資産を活かしつつ、移行リスクと作業量を抑えるため。
- **影響**: 既存 `assets/css`・`assets/fonts`・`assets/img` を移植元として流用する。デザイン方針は `spec/design/` に記す。

### D-006 デプロイ: GitHub Actions ＋ SSH/rsync で Xserver へ
- **決定**: `main` への push（および CMS Webhook）を契機に GitHub Actions でビルドし、SSH/rsync で Xserver へ配信する。
  FTP による手動アップロードは本番切替後に廃止する。
- **背景**: 手動 FTP は再現性・安全性に欠ける。Xserver は SSH を利用でき、rsync による差分同期は高速・確実。
  GitHub Actions ＋ FTP も比較した。
- **影響**: Xserver で SSH 有効化・公開鍵登録が必要。SSH 秘密鍵・ホスト情報は GitHub Secrets に置く。詳細は
  `spec/infra/hosting-and-deploy.md`。

### D-007 リポジトリ構成: 現行 WordPress テーマは `legacy/` へ退避
- **決定**: 本リポジトリで Astro を始める。現行 WordPress テーマ（ルートの `*.php`・`style.css`・`assets/`）は
  `legacy/` へ退避（`git mv`）し、本番切替が完了するまで残す。
- **背景**: Git 履歴を 1 本に保ちつつ、ルートを Astro プロジェクトとして使うため。移植元として参照できる状態を残したい。
- **影響**: P1「プロジェクト基盤」で退避と Astro の初期化を行う。デプロイ対象は `dist/` のみで、`legacy/` は配信しない。
  `legacy/` の削除は本番切替完了後に別途合意する。

### D-008 ステージング環境は置かない（ローカル確認で代替）
- **決定**: Xserver 上のステージングは用意しない。公開前の確認はローカルの `npm run dev`（開発）と
  `npm run build && npm run preview`（本番と同じ静的成果物の確認）で行う。
- **背景**: 静的サイトのため、ローカルでビルドした成果物を確認すれば本番とほぼ同じ状態を再現できる。
  運用コストを抑えたい。
- **影響**: 本番だけで起きる差分（`.htaccess` のリダイレクト、サーバー側のお問い合わせ処理など）は、本番切替の手順で
  個別に確認する。microCMS の下書きは、ローカルから「下書きも含めて取得」する仕組みで確認する案を P2 で検討する。

### D-009 URL 設計: `/works/{slug}/` ＋ 旧 URL からの 301 を自動生成
- **決定**: `spec/feature/url-design.md` の推奨案を採用する。主な内容は次のとおり。
  - 実績詳細は `/works/{slug}/`、カテゴリ絞り込みは `/works/?category={slug}`（canonical は `/works/`）。About は `/#about`。
  - 末尾スラッシュありで統一（Astro `trailingSlash: 'always'`、`build.format: 'directory'`）。正規ホストは `https://unotame.com`（www なし）。
  - slug は microCMS の専用フィールドで持つ（英小文字・数字・ハイフン、英字必須、3〜60 文字、予約語あり）。ビルド時に検証する。
  - 旧 URL `/{category}/{投稿ID}`・`/?p={ID}`・`/category/{slug}/` などは、microCMS の `legacyWpId` などからビルド時に生成する
    `.htaccess` で 301 リダイレクトする。カテゴリのスラッグは WordPress の現行のものを引き継ぐ。
  - `.htaccess` はリポジトリで管理し、デプロイ対象に含める。
- **背景**: 数値 ID の URL は意味を持たず、カテゴリ変更で URL が変わる。カテゴリを URL から外し、意味のある slug にすることで
  URL の安定性と SEO を改善する。旧 URL の評価とリンクは 301 で引き継ぐ。
- **影響**: 「CMS 連携」仕様で `slug`・`legacyWpId` を含むスキーマを確定する。rsync の `--delete` で `.htaccess` を除外する案は取りやめる。
  旧投稿 ID と slug の対応表づくり、現行パーマリンク・`.htaccess`・カテゴリ一覧の確認はコンテンツ移行（P2）と本番切替（P3）で行う。

### D-010 CMS 連携: microCMS で確定、取得は自作関数＋ビルド時検証
- **決定**: `spec/feature/cms-integration.md` を採用する。主な内容は次のとおり。
  - CMS は microCMS で確定（D-004 の「第一候補」を確定）。API は `works` と `categories` の 2 つ。本文はリッチエディタ、並び順は専用の `date` フィールド。
  - slug は「必須・重複不可」だけを microCMS に設定し、**正規表現・文字数の入力制限は付けない**。命名規則（D-009）はビルド時の検証だけで守る。
  - トップの KV・Message・About・SNS は CMS で持たず、`src/data/profile.ts` で管理する。
  - 取得は `microcms-js-sdk` ＋ `src/lib/cms/` の自作関数（Content Layer は使わない）。取得元はフィクスチャに差し替え可能（`CMS_SOURCE=fixture`）。
  - ビルド時に slug・legacyWpId・参照切れなどを全件検証し、違反や API エラー、本番での実績 0 件はビルド失敗とする。
  - API キーは GET 権限のみ。下書きは `MICROCMS_PREVIEW_DRAFTS` で個別に指定してローカル確認し、本番ビルドでは設定されていたら止める。
- **背景**: 無料プラン（API 5 個・キー 1 個・転送量 20GB/月）の範囲で運用できる。microCMS の正規表現が先読みに対応しているか確認できず、
  CMS とコードで規則を二重に持つより、ビルド時の検証 1 か所にまとめるほうが保守しやすい。
- **影響**: 入力ミスは公開前のビルドで初めて分かる（CI で検出してデプロイを止める）。url-design.md のスキーマ表もこれに合わせて更新した。

### D-011 プロジェクト基盤: legacy 退避・Astro 7・Node 24・ツール構成
- **決定**: `spec/feature/project-foundation.md` を採用する。主な内容は次のとおり。
  - 現行テーマ（`*.php`・`style.css`・`assets/`・`.vscode/settings.json`）を `git mv` で `legacy/` へ移す。追跡中の `.DS_Store` は削除して gitignore に入れる。
  - コミットは 4 つ（準備 / 退避のみ / Astro 初期化 / lint・format・test 導入）に分ける。
  - Astro 7 系（`^7`、lock で固定）を手動で導入。TypeScript は `strict`、ツール対応のため TypeScript 本体は 6.0 系に固定する。
  - Node 24 系（`.nvmrc`・`engines`・`engine-strict`）。パッケージマネージャは npm（`package-lock.json` をコミット、CI は `npm ci`）。
  - ESLint（flat config）・Prettier・Stylelint（`.scss` のみ）・Vitest を P1 で導入。`.gitattributes` で LF に統一。
  - 開発環境は Git Bash 前提。npm scripts 内で環境変数を前置する必要が出たら `cross-env` を入れる。
  - Objective フォントの WOFF2 化は P2（着手前にライセンスを確認）。FLOCSS に Utility（`u-`）層を追加する。
- **背景**: 退避と導入を分けて履歴を追いやすくし、ローカル・CI で同じコマンドと同じ版で動く土台を最初に作るため。
  TypeScript 7 系は `@astrojs/check`・typescript-eslint が未対応（2026-10-27 時点）。
- **影響**: 以後の機能は本仕様の配置・コマンドに従う。P2 の CI は `lint → check → test → build` をそのまま呼ぶ。
  TypeScript 7 系への更新は、ツール側の対応を確認してから別途判断する。
