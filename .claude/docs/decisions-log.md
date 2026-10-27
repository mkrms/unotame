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
  - ESLint（flat config）・Prettier・Stylelint（`.scss` のみ）・Vitest を P1 で導入。`.gitattributes` で LF に統一。legacy の CRLF 3 件は正規化しない（F-5）。
  - 開発環境は Git Bash 前提。npm scripts 内で環境変数を前置する必要が出たら `cross-env` を入れる。
  - Objective フォントの WOFF2 化は P2（着手前にライセンスを確認）。FLOCSS に Utility（`u-`）層を追加する。
- **背景**: 退避と導入を分けて履歴を追いやすくし、ローカル・CI で同じコマンドと同じ版で動く土台を最初に作るため。
  TypeScript 7 系は `@astrojs/check`・typescript-eslint が未対応（2026-10-27 時点）。
- **影響**: 以後の機能は本仕様の配置・コマンドに従う。P2 の CI は `lint → check → test → build` をそのまま呼ぶ。
  TypeScript 7 系への更新は、ツール側の対応を確認してから別途判断する。
- **変更（2026-10-27、実装時。いずれもユーザー承認済み）**:
  - F-5 を「正規化しない」から「正規化する」に変更。`eol=lf` を指定すると既存の CRLF ファイルも `git add` 時に LF 化され、
    変換は避けられないため。legacy の CRLF 3 件はコミット 1（`d74bc16`）で改行コードだけを LF 化し、退避コミットを純粋な移動に保った。
  - 受け入れ条件「`dist/_astro/` にコンパイル済み CSS がある」を「HTML の `<style>` または `dist/_astro/*.css` にある」に緩和。
    Astro の既定 `build.inlineStylesheets: 'auto'` では小さい CSS が HTML に埋め込まれるため。設定は既定のまま。
  - レビュー指摘により `engines` を `^24.16.0 || >=26.3.0` に変更（依存パッケージの対応範囲に合わせる）。

## 2026-10-27 P1 ページ仕様の承認

### D-012 P1 ページ仕様 6 本の採用（共通レイアウト・スタイル移植・404・トップ・Works 一覧/詳細）
- **決定**: `spec/feature/` の `layout.md`・`style-migration.md`・`not-found.md`・`top-page.md`・`works-list.md`・`works-detail.md` を、
  すべて推奨どおりで採用する（2026-10-27、ユーザー承認）。主な内容は次のとおり。
  - **ローダー**: トップだけに出す。現行のタイミング（`load` 後のフェード、5 秒の上限）を素の TS ＋ CSS の transition で再現し、
    JS 無効時（`<noscript>` の `<style is:inline>`）と `prefers-reduced-motion: reduce` では出さない。JS が失敗しても 6 秒で消える CSS の保険を付ける。
  - **`<head>` とヘッダー**: `<title>` は `{ページ名} | UNOTAME`（ページ名は現行の h1。L-8）。OGP は現行と同じ項目を出し、`og:image` を https、`og:url` をページごとに直す（L-3）。
    SP（768px 以下）のナビは P1 では現行どおり非表示（L-1）。
  - **スタイル**: P1 はすべてグローバル SCSS（FLOCSS）で書き、`.astro` に `<style>` を書かない（S-2 の案 A。例外は `<noscript>` の 1 か所）。
    `@import` を `@use` に、destyle は npm の 4.0.1、`src/assets/` の画像は `<Image>` で出す（S-7）。
    実績カードは共通の `WorkCard`（`c-work-card`）にまとめる。**768px のブレークポイントの重なりは P1 で直す**（`ov-sp` を `width > 768px` に。S-5）。
  - **Adobe Fonts の継続（前提条件つき）**: 明朝体 `yu-mincho-pr6n`（kit `woq0phd`）を P1 でも使い、CSS 版の埋め込みコード
    `<link rel="stylesheet" href="https://use.typekit.net/woq0phd.css">` を `<head>` に置く（S-1）。**実装前に、ユーザーが Adobe Fonts の管理画面で
    ① Web プロジェクトが有効で `yu-mincho-pr6n` を含むか、② `localhost` と `unotame.com` で配信されるか、を確認する**（2026-10-27 時点で未確認）。
  - **404**: 静的な文言とトップ・一覧への導線だけ（CMS のデータを使わない。N-1・N-2）。
  - **トップ**: 人物情報は `src/data/profile.ts`、プロフィール写真の alt は `新山 慶介`、実績 0 件の文言は「実績はまだ登録されていません。」、SNS は新しいタブ＋`rel="noopener"`＋リンク名（T-3〜T-5）。
  - **Works 一覧**: 全件表示（ページ分割なし）。絞り込みは `<button>`＋`aria-pressed`＋素の TS。履歴は **`replaceState`**（pushState は使わない。U-9）。
    知らない `?category=` は URL から消す。JS 無効時はボタンを表示したまま全件表示。
  - **Works 詳細**: **Latest は表示中の実績自身を除いた**最新 3 件（`selectLatestWorks`）。**カテゴリ名を `/works/?category={slug}` へのリンクにする**。
    ヘッダー画像の alt にタイトルを入れない。本文 HTML は P1 ではサニタイズしない（P2 で判断）。前後の実績へのリンクは入れない。
  - **テスト用パッケージの追加**: 開発依存に `happy-dom`（DOM の挙動のテスト。works-list L-6）と `node-html-parser`、npm script `test:dist`
    （ビルド後に `dist/` の HTML を検査。top-page X-1）を追加する（導入は実装時）。
  - **Message の誤記修正**: 現行の「"アナタ"が笑顔がずっと続くように。」を「"アナタ"の笑顔がずっと続くように。」に直す（2026-10-27 にユーザー確認済み。top-page T-2）。
    About の「2024年現在」の経歴文は、ユーザーから最新の文を受け取って差し替える（届くまでは現行の文。T-1）。
- **背景**: P1 の基準は「現行と同じ見た目・導線で Astro に載せる」ことだが、現行の不具合のうち修正の範囲が小さく利用者に効くもの
  （id の重複・キーボードで操作できない絞り込み・`<main>` の重複・`og:image` の http・768px の重なり・Latest の自己参照）は P1 で直す。
  見た目の大きな変更（SP のナビ、デザイン刷新）は P2 に回す。
- **影響**: 承認済みの仕様を次のとおり修正した（各文書に「2026-10-27 変更（D-012）」と記載）。
  - `cms-integration.md`: 受け入れ条件「`dist/index.html` に現行と同じ文言」を「`src/data/profile.ts` の文言」に変更。`Profile` 型を top-page の案に合わせた
    （`icon` を `ImageMetadata` に、`about.photo` と `SocialLink.id` を追加）。Latest の取得を「自身を除く `selectLatestWorks`」に変更。
    C-8（詳細画像の alt にタイトルを入れない）と C-16（一覧は全件表示）を決定。
  - `url-design.md`: U-9 を「決定：replaceState」に。現行の 404 の記述を「`legacy/404.php` は 0 バイトで、現行の 404 は空白のページ」に訂正（not-found N-4）。
  - `project-foundation.md`: F-8 に `<style>` の使い分け（S-2 の案 A）を反映。テスト用パッケージと `test:dist` の追加を追記。
  - 実装時に確かめる項目（not-found N-3：`astro preview` の 404 ステータス、top-page X-2：コンテナ API など）は各仕様の未決事項に残した。
    お問い合わせ（Contact）は送信方式が未決のため、本決定に含まない。
- **追加の決定（2026-10-27、ユーザー承認）**: 仕様の整理中に見つかった次の点を決めた。
  - 1366px でも 768px と同じブレークポイントの重なりがあるため、`ov-pc` を `width > 1366px` にして P1 で直す（style-migration S-5）。
  - `test:dist` は `npm test` から外し、専用の Vitest 設定で動かす。CI の順序は `lint → check → test → build → test:dist`（project-foundation）。
  - 実績詳細の description は P1 から `work.description` を渡す（空なら本文からの自動生成。works-detail）。
  - 実績 0 件の文言はトップと一覧に出し、詳細には出さない（top-page T-4 と works-detail D-6 の整合）。
  - `.claude/CLAUDE.md` の技術決定事項に、グローバル SCSS と Adobe Fonts の継続を追記した。
- **実装時の変更（2026-10-27、レビュー指摘。ユーザー承認済み）**:
  - ローダーの CSS の保険を 6 秒から **7 秒** に変更（load が遅いとき、通常のフェードの途中で保険が効かないようにするため。layout.md L-1）。
  - JS 無効時用の `<noscript>` の `<style is:inline>` を、`<body>`（Loader.astro）から `BaseLayout.astro` の `<head>` 内へ移動（HTML の仕様に合わせる。L-2）。
