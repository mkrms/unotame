# 機能仕様: プロジェクト基盤（project-foundation）

> 状態: **承認済み（2026-10-27。Node 24・strict、他は推奨どおり。decisions-log D-011）**。D-003（Astro）/ D-005（SCSS・FLOCSS 継続、jQuery 廃止）/ D-006（デプロイ）/
> D-007（legacy 退避）/ D-008（ステージングなし）/ D-009（URL）/ D-010（CMS）を前提とする。
> 承認済みの `url-design.md`・`cms-integration.md` のファイル配置・環境変数・Astro 設定は変更していない（気になる点は「未決事項」に挙げた）。
> **2026-10-27 変更（D-012）**: F-8 に `<style>` の使い分け（style-migration S-2 の案 A）を反映。テスト用パッケージ（`happy-dom`・`node-html-parser`）と `test:dist` の追加を「6. テストの最小構成」に追記。

## 目的
- 現行 WordPress テーマを `legacy/` に退避し（D-007）、リポジトリのルートを **Astro（TypeScript）プロジェクト**にする。
- 以後の機能（共通レイアウト、トップ、Works、CMS 連携、URL/リダイレクトなど）が**置き場所と道具で迷わない**状態を先に作る：
  ディレクトリ構成、Node / パッケージ管理、lint・format・型チェック・テスト、`.gitignore`・`.env.example`・改行コード。
- ここで決める npm scripts を、P2 の CI（PR チェック）と P3 の CD がそのまま呼べるようにする。

## スコープ（対象フェーズ）
- **P1（本書の対象）**
  - legacy 退避（`git mv`）と `.DS_Store`・`.vscode/settings.json` の扱い、コミットの分け方。
  - Astro の初期化（バージョン方針・`astro.config.mjs`・`tsconfig.json`）。
  - ディレクトリ構成（`src/`・`public/`・`fixtures/`・`tests/`）と、legacy 資産の移し先の**割り当て**。
  - ツール類（Node 固定、npm、ESLint・Prettier・Stylelint、sass、Vitest）と npm scripts。
  - 設定ファイル（`.gitignore`・`.gitattributes`・`.editorconfig`・`.env.example`・`.nvmrc`・`.npmrc`）。
  - ゴールは「**空の Astro が起動し、`build`・`check`・`lint`・`test` がすべて通る**」こと。
- **含まない（各機能仕様に任せる）**
  - ページ・レイアウト・コンポーネントの実装（置き場所だけ決める。トップは仮ページ 1 枚のみ）。
  - SCSS の中身の移植・フォント／画像のコピー（「スタイル移植」「共通レイアウト」「トップページ」で行う。本書は移し先を決めるだけ）。
  - `src/lib/cms/`・`routes.ts`・`slug.ts`・`redirects.ts`・`.htaccess` 生成の実装（「CMS 連携」「URL 設計」）。
  - sitemap（`@astrojs/sitemap`）・OGP・favicon（P2「SEO / OGP」）。WOFF2 化・画像最適化（P2「パフォーマンス / a11y」）。
  - GitHub Actions のワークフロー（P2「CI」/ P3「CD」）。本書は scripts を CI から使える形にしておくだけ。

## 現行（WordPress）の振る舞い

リポジトリのルートがそのまま WP テーマ（`wp-content/themes/unotame/` に FTP で配置していたもの）。ビルド工程は無く、
SCSS は VS Code 拡張 Live Sass Compile で手元コンパイルし、出力 `assets/css/style.css` もコミットしている。

| 種別 | ファイル（2026-10-27 時点の `git ls-files`） |
|---|---|
| テンプレート | `404.php`（空）, `archive.php`, `footer.php`, `front-page.php`, `functions.php`, `header.php`, `index.php`（空）, `page-contact.php`, `page.php`, `single.php` |
| テーマ定義 | `style.css`（空。WP のテーマヘッダーも無い） |
| スタイル | `assets/css/style.scss`（`@import` で各パーシャルを集約）, `Foundation/`（`_global.scss`: 変数・ブレークポイント mixin・`@font-face`、`_base.scss`）, `Layout/`（header / footer / layout）, `Object/Component/`（button / loader）, `Object/Project/`（about / contact / front-page / work-detail / works）, `destyle.css`（v4.0.1）, コンパイル済み `style.css` / `style.css.map` |
| フォント | `assets/fonts/Objective-{Regular,Medium,Black}.otf`（各 約 40KB、`@font-face` は OTF 直指定・`font-display` なし） |
| 画像 | `assets/img/` の 13 ファイル（下の「legacy 資産の移し先」参照） |
| JS | `assets/js/jquery-3.4.1.min.js`, `assets/js/script.js`（ローダー・カテゴリ絞り込み） |
| エディタ設定 | `.vscode/settings.json`（Live Sass Compile の出力先 `/assets/css`） |
| OS のゴミ | `.DS_Store`, `assets/.DS_Store`, `assets/css/.DS_Store`, `assets/img/.DS_Store`（4 件が追跡されている） |
| Claude 用 | `CLAUDE.md`, `.claude/**`, `.gitignore`（中身は `.claude/settings.local.json` の 1 行のみ） |

改行コードの現状（`git ls-files --eol`）: リポジトリ内は大半が LF。ただし `assets/css/style.scss`・`assets/css/Foundation/_base.scss`・
`assets/js/script.js` の 3 件は **CRLF のままコミットされている**。利用者のグローバル設定は `core.autocrlf=true` のため、
作業ツリーは CRLF になり、コミット時に「LF will be replaced by CRLF」の警告が出ている。

## データ構造案

本機能はデータを扱わない。ここでは**ファイル配置と設定ファイルの案**を示す（実装時に `implementer` が調整してよい。ただし
承認済み仕様で名前が決まっているもの〈下で ★ 印〉は変えない）。

### 1. legacy 退避後のルート

```
/
├─ .claude/                 … 残す（Claude 用ドキュメント）
├─ CLAUDE.md                … 残す
├─ .git/ .gitignore         … 残す（.gitignore は追記）
├─ .gitattributes           … 新規（改行コード）
├─ .editorconfig            … 新規
├─ .nvmrc  .npmrc           … 新規（Node 固定・engine-strict）
├─ .env.example ★           … 新規（cms-integration の 4 変数）
├─ .prettierrc.json  .prettierignore  eslint.config.js  stylelint.config.mjs  … 新規
├─ .vscode/extensions.json  … 新規（推奨拡張のみ）
├─ astro.config.mjs ★  tsconfig.json  vitest.config.ts  package.json  package-lock.json
├─ legacy/                  … 退避した WP テーマ（配信しない・lint/format/型チェックの対象外）
├─ public/                  … そのまま dist/ にコピーされる静的ファイル
├─ src/
├─ fixtures/microcms/ ★     … ビルド用フィクスチャ（CMS 連携で作成）
└─ tests/ ★                 … Vitest（異常系フィクスチャは tests/fixtures/ ★）
```

### 2. `legacy/` の中身（`git mv` の対応）

| 移動元（ルート） | 移動先 | 備考 |
|---|---|---|
| `404.php` `archive.php` `footer.php` `front-page.php` `functions.php` `header.php` `index.php` `page-contact.php` `page.php` `single.php` | `legacy/` 直下に同名 | 空ファイル（`404.php`・`index.php`）も履歴のため移す |
| `style.css` | `legacy/style.css` | 空ファイル |
| `assets/`（`.DS_Store` を除く全部） | `legacy/assets/` | コンパイル済み `style.css`・`style.css.map`・jQuery も含めてそのまま |
| `.vscode/settings.json` | `legacy/.vscode/settings.json` | **推奨**。ルートから外すことで Live Sass Compile の設定が無効になり、履歴は残る |
| `.DS_Store` ×4 | **退避せず削除**（`git rm`）し、`.gitignore` に追加 | **推奨**。macOS の表示設定ファイルでテーマの資産ではない |

**残すもの**: `.claude/`、`CLAUDE.md`、`.gitignore`、`.git/`。

`.DS_Store` の削除は CLAUDE.md の「legacy を本番切替前に削除しない」に形式上触れうるため、**ユーザーの承認事項**とする（未決 F-1）。
承認されない場合は `legacy/` へ一緒に移す（`.gitignore` には追加する。追跡中のファイルは ignore されないので残る）。

### 3. `src/` の構成

```
src/
├─ pages/
│  └─ index.astro          … 仮ページ（本書で作成。トップページ仕様の実装で置き換える）
│     （以降は url-design ★: works/index.astro, works/[slug].astro, contact.astro, 404.astro）
├─ layouts/                … 共通レイアウト（例 BaseLayout.astro。共通レイアウト仕様）
├─ components/             … Astro コンポーネント（FLOCSS の c-/p- 単位を目安に。命名は各仕様）
├─ lib/                    … ★ 表示から独立したロジック（純粋関数中心・Vitest の対象）
│  ├─ domain/              … ★ Work / Category / ImageAsset / Profile 型
│  ├─ cms/                 … ★ index / config / source / microcms-source / fixture-source / raw-types / transform / body / validate / image
│  ├─ profile.ts           … ★ getProfile()
│  ├─ routes.ts            … ★ URL の組み立て（url-design）
│  ├─ slug.ts              … ★ slug 規則（url-design）
│  └─ redirects.ts         … ★ .htaccess 断片の生成（url-design）
├─ data/
│  └─ profile.ts           … ★ KV・Message・About・SNS（cms-integration）
├─ htaccess/
│  └─ htaccess.template    … ★（url-design の「例」）。dist/.htaccess を生成する元
├─ assets/                 … ビルド時に処理される資産（astro:assets / Vite が URL にハッシュを付ける）
│  ├─ fonts/               … Objective（P1 は OTF のまま）
│  └─ images/              … ロゴ・プロフィール写真・SNS アイコン
└─ styles/                 … SCSS（FLOCSS）
   ├─ style.scss           … エントリ。各レイヤを @use で読む（レイアウトで 1 回 import）
   ├─ foundation/          … 変数・mixin・@font-face・リセット（destyle）・要素の基本スタイル
   ├─ layout/              … l-（ヘッダー・フッター・コンテナ）
   └─ object/
      ├─ component/        … c-（ボタン・ローダーなど）
      ├─ project/          … p-（ページ・機能単位）
      └─ utility/          … u-（現行の .sp-none / .pc-none など）
```

- 本書で作るのは `src/pages/index.astro`（仮）と `src/styles/` の骨格（`style.scss` ＋ `foundation/_variables.scss` 程度の最小限）だけ。
  空のディレクトリは Git で追跡できないので、ほかのディレクトリは**各機能の実装時に最初のファイルと一緒に作る**（`.gitkeep` は置かない）。
- `src/assets/` と `public/` の使い分け:
  - **`src/assets/`**（推奨の既定）: SCSS の `url()` や `import` で参照するもの。ビルドで `/_astro/xxx.[hash].ext` になり、キャッシュの更新を気にしなくてよい。
  - **`public/`**: 固定の URL が必要なもの（例: OGP 画像、`favicon.ico`、`robots.txt`）。加工されずに `dist/` 直下へコピーされる。
  - **`.htaccess` は `public/` に置かない**。url-design の決定どおり `src/htaccess/htaccess.template` から `dist/.htaccess` を生成する
    （`public/.htaccess` があると生成物と二重になるため、置かないことを本書のルールとする）。

### 4. legacy 資産の移し先（割り当て）

方針: **バイナリ（フォント・画像）は `legacy/` からコピー**（`legacy/` は本番切替まで原本として残すので `git mv` しない）、
**SCSS は新構成に合わせて書き直す（移植）**、**JS は持ち込まない**（D-005）。コピー・移植は**使う機能の実装時**に行い、本書では行わない。

| legacy の資産 | 新しい場所 | 方法 | 担当仕様 |
|---|---|---|---|
| `fonts/Objective-*.otf` | `src/assets/fonts/` | コピー（P1 は OTF のまま。WOFF2 化は P2、F-6） | スタイル移植 |
| `css/Foundation/_global.scss`（変数・mixin・`@font-face`） | `src/styles/foundation/`（例 `_variables.scss` `_mixins.scss` `_fonts.scss`） | 書き直し（`@import` → `@use`、ディレクトリ名を小文字に） | スタイル移植 |
| `css/Foundation/_base.scss` | `foundation/_base.scss` ＋ `.sp-none` / `.pc-none` は `object/utility/` へ | 書き直し | スタイル移植 |
| `css/Layout/*`、`Object/Component/*`、`Object/Project/*` | `layout/`、`object/component/`、`object/project/` | 書き直し | スタイル移植（各ページ仕様と連携） |
| `css/destyle.css`（v4.0.1） | npm パッケージ `destyle.css`（同じ 4.0.1）を `foundation` から読む | 置き換え（推奨）。コピーでも可 | スタイル移植 |
| `css/style.css` `style.css.map` | — | 持ち込まない（生成物） | — |
| `img/logo-landscape-removebg.png`（ヘッダーのロゴ） | `src/assets/images/` | コピー | 共通レイアウト |
| `img/profile.png`（About。約 1MB） | `src/assets/images/` | コピー（`<Image>` で縮小して出す） | トップページ |
| `img/logo-black.png`（X）`logo-only.svg`（Zenn）`qiita-icon.png` `square.svg`（note）`github-mark.png` | `src/assets/images/sns/` | コピー（`profile.ts` の `icon` から参照） | トップページ |
| `img/unotame-logo-square.png`（現行の `og:image`） | `public/`（例 `public/ogp.png`） | コピー。OGP の正式対応は P2 | 共通レイアウト（P1 で現行の OGP を保つ場合）／SEO・OGP |
| `img/img-works-unotame.png`（実績の本文から `"assets/` で参照） | — | P1 では持ち込まない。移行時に microCMS へ上げ直す（cms-integration C-7）。`public/assets/` に受け皿を置くかは F-7 | コンテンツ移行 |
| `img/logo-noText-removebg.png` `logo-square-removebg.png` `unotame-logo-landscape.png` `unotame-logo-noText.png` | — | 現行テーマで未使用。必要になったら（favicon など）コピー | SEO / OGP（P2） |
| `js/jquery-3.4.1.min.js` `js/script.js` | — | 持ち込まない。ローダーは共通レイアウト、絞り込みは Works 一覧で TS により作り直す | 各仕様 |

### 5. 設定ファイルの案

**`astro.config.mjs`**（url-design の案に一致させる）
```js
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://unotame.com',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' }, // 既定値だが明示する（url-design）
  // integrations: [] … sitemap は P2「SEO / OGP」で追加
});
```

**`tsconfig.json`**
```jsonc
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist", "legacy", "node_modules", "coverage"]  // 基底の exclude を上書きするので dist も書く
}
```
- 基底の `astro/tsconfigs/base` は `allowJs: true` かつ `include: ["**/*"]` のため、**`legacy` を除外しないと `legacy/assets/js/*.js` が型チェックの対象に入る**。
- `strictest`（`noUncheckedIndexedAccess` など追加）にするかは F-4。推奨は `strict`。

**`vitest.config.ts`**
```ts
/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
```

**`eslint.config.js`**（flat config）
```js
import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import globals from 'globals';

export default defineConfig([
  { ignores: ['dist/', '.astro/', 'node_modules/', 'legacy/', 'coverage/'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  astro.configs.recommended,
  { files: ['*.{js,mjs,ts}'], languageOptions: { globals: globals.node } }, // 設定ファイル用
]);
```
- 現行の各 recommended には書式のルールが無いため、`eslint-config-prettier` は入れない（衝突が出たら追加する）。
- a11y（`eslint-plugin-jsx-a11y` 系）は P2「パフォーマンス / a11y」で検討する。

**`.prettierrc.json` / `.prettierignore`**
```json
{ "plugins": ["prettier-plugin-astro"], "singleQuote": true, "printWidth": 100 }
```
```
dist/
.astro/
node_modules/
coverage/
legacy/
.claude/
CLAUDE.md
package-lock.json
```
- **`legacy/` と `.claude/`・`CLAUDE.md` を必ず除外する**（`npm run format` で旧テーマや仕様書の Markdown 表が書き換わるのを防ぐ）。
- `singleQuote` / `printWidth` は承認済み仕様のコード例（シングルクォート）に合わせた好みの値。変えてよい。

**`stylelint.config.mjs`**
```js
export default {
  extends: ['stylelint-config-standard-scss'],
  ignoreFiles: ['dist/**', 'legacy/**'],
  rules: {
    // FLOCSS の BEM 風クラス名（l-header__nav, is-active など）を許す
    'selector-class-pattern': null,
  },
};
```
- 対象は `src/**/*.scss` のみ。`.astro` の `<style>` まで見るには `postcss-html` が要るので、スコープ付きスタイルを使う方針になったら追加する（F-8）。
  2026-10-27 変更（D-012）: style-migration S-2 で「P1 はすべてグローバル SCSS（案 A）」に決まったため、P1 では `postcss-html` を追加しない。

**`.gitignore`**（現在の 1 行に追記）
```
# Claude Code（ローカル設定）
.claude/settings.local.json

# 依存・生成物
node_modules/
dist/
.astro/
coverage/

# 環境変数（.env.example だけはコミットする）
.env
.env.*
!.env.example

# ログ
npm-debug.log*

# OS・エディタ
.DS_Store
Thumbs.db
/.vscode/*
!/.vscode/extensions.json
```

**`.gitattributes`**
```
# テキストはリポジトリ内で LF に統一（core.autocrlf=true の環境でも作業ツリーは LF になる）
* text=auto eol=lf

# バイナリ（改行変換・差分の対象外）
*.png  binary
*.jpg  binary
*.jpeg binary
*.gif  binary
*.webp binary
*.avif binary
*.ico  binary
*.otf  binary
*.ttf  binary
*.woff binary
*.woff2 binary
```
- `eol=lf` を付けているため、すでに CRLF でコミットされている legacy の 3 件（`style.scss`・`_base.scss`・`script.js`）も `git add` の際に LF へ変換される
  （実装時に判明。当初の想定「変換されない」は誤り）。このためコミット 1 で 3 件を `git add --renormalize` し、改行コードだけを LF 化する（F-5）。
  これで退避コミット（コミット 2）は純粋な移動（`R100`）に保てる。
- SVG はテキストとして扱う（LF に統一されてよい）。

**`.editorconfig`**
```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false

[legacy/**]
end_of_line = unset
insert_final_newline = unset
trim_trailing_whitespace = unset
```

**`.env.example`**（cms-integration の記載どおり。値は空でコミット）
```
# microCMS（API キーは GET 権限のみの読み取り専用キーを使う。値はコミットしない）
MICROCMS_SERVICE_DOMAIN=
MICROCMS_API_KEY=
# データの取得元: microcms（既定）| fixture（API を呼ばずに fixtures/microcms/*.json を使う）
CMS_SOURCE=
# 開発時のみ: 下書きプレビュー。"コンテンツID:draftKey" をカンマ区切り。astro build で設定されているとビルド失敗
MICROCMS_PREVIEW_DRAFTS=
```
（コメント行は cms-integration の `.env.example` 案をそのまま写す。本書の時点ではこれらを読むコードはまだ無い。）

**`.nvmrc` / `package.json`（抜粋）/ `.npmrc`**
```
24
```
```jsonc
{
  "name": "unotame",
  "private": true,
  "type": "module",
  "engines": { "node": "^24.16.0 || >=26.3.0" },
  "scripts": { /* 下の「npm scripts」 */ }
}
```
```
engine-strict=true
```

**`.vscode/extensions.json`**（推奨拡張だけを共有する）
```json
{ "recommendations": ["astro-build.astro-vscode", "esbenp.prettier-vscode", "dbaeumer.vscode-eslint", "stylelint.vscode-stylelint"] }
```

## 振る舞い

### 1. 作業の順序とコミットの分け方（推奨）

コミットは**すべてユーザーの承認後**に行う（CLAUDE.md）。implementer は各段階で差分とコミット文案を示し、承認を得てから次の段階へ進む。

| # | コミット（文案） | 内容 | 分ける理由 |
|---|---|---|---|
| 1 | `chore: add .gitattributes and extend .gitignore, remove .DS_Store` | `.gitattributes`・`.gitignore` 追記・`git rm` で `.DS_Store` ×4 を削除 | 改行・無視の設定を先に入れ、以降のコミットで警告やゴミが混ざらないようにする |
| 2 | `chore: move WordPress theme to legacy/ (D-007)` | 上の表の `git mv` **だけ** | **移動だけのコミット**にすると `git log --follow` や `git blame` で旧テーマの履歴を追える（中身の変更が混ざると rename 判定が崩れうる） |
| 3 | `chore: initialize Astro project` | `package.json`・lock・`astro.config.mjs`・`tsconfig.json`・`.nvmrc`・`.npmrc`・`.editorconfig`・`.env.example`・`.vscode/extensions.json`・`src/pages/index.astro`（仮）・`src/styles/` 骨格 | 「Astro が動く」最小単位でレビューできる |
| 4 | `chore: add lint, format and test tooling` | ESLint・Prettier・Stylelint・Vitest の設定、最初のテスト、`npm run format` の結果 | ツール導入による整形差分を Astro 初期化と分ける。3 と 4 はまとめてもよい（F-2） |

- **退避（2）は Astro 導入（3）と必ず別コミットにする**（推奨）。1 と 2、3 と 4 の統合は任意。
- 2 の確認: `git show -M --name-status HEAD` の全行が `R100`（内容が同一の移動）であること。

### 2. legacy 退避の手順（コミット 1・2）

```sh
# コミット 1
git rm --cached .DS_Store assets/.DS_Store assets/css/.DS_Store assets/img/.DS_Store
rm .DS_Store assets/.DS_Store assets/css/.DS_Store assets/img/.DS_Store   # F-1 で削除が承認された場合
# .gitattributes 追加・.gitignore 追記
git add --renormalize .        # 期待: .gitattributes 以外に変更が出ない。legacy 対象ファイルに差分が出たら止めて報告
git status                     # 意図した 3 種類の変更だけであることを確認

# コミット 2
mkdir -p legacy/.vscode
git mv 404.php archive.php footer.php front-page.php functions.php header.php index.php \
       page-contact.php page.php single.php style.css assets legacy/
git mv .vscode/settings.json legacy/.vscode/settings.json
git status                     # renamed: のみであることを確認
```
- `git mv assets legacy/` はディレクトリごと移る。`.DS_Store` はコミット 1 で消えているので混ざらない。
- 退避後、ルートには `.claude/`・`CLAUDE.md`・`.gitignore`・`.gitattributes` だけが残る。
- `legacy/` は**配信しない**（Astro は `src/` と `public/` からしか成果物を作らない）。lint・format・型チェックからも外す（上の設定）。
- 補足: 作業ツリーにある既存ファイルの改行を LF にそろえたい場合は、コミット後に `git rm --cached -r . && git reset --hard` で
  チェックアウトし直す方法があるが、**作業中の変更を失う操作なので行わない**（必要ならユーザーに確認）。新しく作るファイルは LF になる。

### 3. Astro の初期化（コミット 3）

- **方法**: `npm create astro` は空でないディレクトリへの展開でテンプレートのファイル（README・`.vscode/launch.json` など）が混ざるため、
  **手動で導入する**（推奨）: `npm init -y` 相当の `package.json` を書き、`npm install astro` → 上記の設定ファイルを手で置く。
- **バージョン方針**: その時点の安定版の**最新メジャー**を使い、`package.json` は `^`（メジャー内の更新を許す）、実際の版は
  `package-lock.json` で固定する。メジャーの更新は別作業（別ブランチ）とする。

  確認日 **2026-10-27**（npm レジストリ `npm view <pkg> version` / Node 公式 `nodejs.org/dist/index.json`・`nodejs/Release` の schedule.json）:

  | パッケージ | 最新 | 指定（案） | メモ |
  |---|---|---|---|
  | `astro` | 7.4.2（7.0.0 は 2026-06-22） | `^7.4.2` | engines `node >=22.23.4`。Vite 8 同梱。`trailingSlash` / `build.format` / `output: 'static'` は 7 でも同じ設定名 |
  | `@astrojs/check` | 0.9.12 | `^0.9.12` | peer: `typescript ^5 \|\| ^6` |
  | `typescript` | **7.0.2**（latest） | **`~6.0.3`** | **7 は `@astrojs/check`（^5\|\|^6）と `typescript-eslint`（`<6.1.0`）の peer 範囲外**。`npm install typescript` だけだと 7 が入るので版を指定する |
  | `sass` | 1.106.1 | `^1.106.1` | 現行 SCSS の `@import` は非推奨（Dart Sass 3 で削除）。移植時に `@use` へ書き換える |
  | `vitest` | 5.0.5 | `^5.0.5` | peer `vite ^6\|\|^7\|\|^8`。Astro の `getViteConfig` を使う |
  | `eslint` / `@eslint/js` | 10.13.0 / 10.0.1 | `^10` | flat config のみ |
  | `typescript-eslint` | 8.72.1 | `^8.72.1` | |
  | `eslint-plugin-astro` | 3.2.1 | `^3.2.1` | engines `node ^22.22.3 \|\| ^24.16.0 \|\| >=26.3.0` |
  | `globals` | — | 最新 | 設定ファイル用 |
  | `prettier` / `prettier-plugin-astro` | 3.9.10 / 1.1.2 | `^3` / `^1.1.2` | |
  | `stylelint` / `stylelint-config-standard-scss` | 17.16.0 / 17.0.0 | `^17` / `^17` | |
  | `destyle.css` | 4.0.1 | `^4.0.1` | スタイル移植で追加（本書では入れない） |
  | `microcms-js-sdk` | 3.6.0 | — | CMS 連携で追加（本書では入れない） |
  | `@astrojs/sitemap` | 3.7.4 | — | P2 で追加 |

  - 上表は確認日時点の値。導入時に `npm view` で再確認し、メジャーが変わっていたら本書を更新してから進める。
- **Node**: 24 系（`Krypton`。2026-10-20 から Maintenance LTS、サポート終了 2028-04-30）を推奨。手元に 24.22.0 があり、上表の全パッケージの
  engines を満たす。26 系は 2026-10-28 に Active LTS 入り予定（終了 2029-04-30）で、こちらも全パッケージが対応している。どちらにするかは F-3。
- **Astro の機能で本書では使わないもの**: Content Layer（D-010 で不採用）、`astro:env`（環境変数は cms-integration の `resolveCmsConfig(env)` で読む）、
  Fonts API（`fonts` 設定。P2 の WOFF2 化と合わせて検討）、インテグレーション（sitemap は P2）。
- **仮ページ** `src/pages/index.astro`: `<html lang="ja">`・`<title>UNOTAME</title>`・`../styles/style.scss` の import・見出し 1 つだけ。
  SCSS が通ることの確認用で、トップページ仕様の実装で置き換える。

### 4. Node・パッケージ管理

| 案 | 長所 | 短所 |
|---|---|---|
| **A. `.nvmrc`（`24`）＋ `engines` ＋ `.npmrc` の `engine-strict=true`（推奨）** | ツールに依存しない。GitHub Actions の `actions/setup-node` が `node-version-file: '.nvmrc'` で読める。版違いは `npm install` 時に止まる | nvm-windows は `.nvmrc` を自動で読まない（手で `nvm use 24`） |
| B. Volta（`package.json` の `volta.node`） | Windows でもディレクトリに入るだけで自動で切り替わる | Volta の導入が前提。CI 側は別途指定が要る |
| C. `engines` だけ | 追加ファイルなし | 守られる保証が弱い |

- パッケージマネージャは **npm（暫定のまま確定を推奨）**。`package-lock.json` をコミットし、CI では `npm ci` を使う。`packageManager` 欄・Corepack は使わない。

### 5. npm scripts（CI・Claude の許可コマンドと名前を合わせる）

```jsonc
"scripts": {
  "dev": "astro dev",
  "build": "astro build",
  "preview": "astro preview",
  "check": "astro check",
  "lint": "eslint . && stylelint \"src/**/*.scss\" --allow-empty-input && prettier --check .",
  "lint:fix": "eslint . --fix && stylelint \"src/**/*.scss\" --allow-empty-input --fix && prettier --write .",
  "format": "prettier --write .",
  "test": "vitest run",
  "test:watch": "vitest",
  "astro": "astro"
}
```

| コマンド | 用途 | `.claude/settings.local.json` の許可 | CI（P2）での利用 |
|---|---|---|---|
| `npm run dev` | 開発サーバー | `Bash(npm run dev)` | — |
| `npm run build` | 本番と同じ静的成果物を `dist/` に出力 | `Bash(npm run build)` | ○ |
| `npm run preview` | `dist/` をローカル配信（D-008 の最終確認） | なし（必要なら追加を提案） | — |
| `npm run check` / `npx astro check` | 型チェック（`.astro` 含む） | `Bash(npx astro check)`（同じ処理） | ○ `npm run check` |
| `npm run lint` | ESLint ＋ Stylelint ＋ Prettier の差分検出（書き換えない） | `Bash(npm run lint)` | ○ |
| `npm run format` | Prettier で整形（書き換える） | なし | — |
| `npm test` | Vitest を 1 回実行（watch しない） | `Bash(npm test)` | ○ |

- `build` に `astro check` を含めない（Astro のテンプレートは `astro check && astro build` だが、CI では `check` と `build` を別ステップにして
  失敗箇所を分かりやすくする）。CI（P2）は `npm ci → npm run lint → npm run check → npm test → npm run build` の順で呼ぶ想定（`hosting-and-deploy.md` の CI の項目と一致）。
- `lint` は**書き換えない**（CI と同じ判定）。書き換えは `lint:fix` / `format`。
- npm scripts は Windows では cmd.exe で動くので、引数のクォートは**ダブルクォート**にする（シングルクォートはグロブとして渡らない）。
  環境変数を前置する書き方（`CMS_SOURCE=fixture astro build`）は cmd.exe / PowerShell では動かない（F-9）。

### 6. テストの最小構成
- `tests/` に Vitest のテストを置き、ファイル名は `*.test.ts`。`src/` の構成に合わせてサブディレクトリを切る（例 `tests/lib/cms/transform.test.ts`）。
  異常系のフィクスチャは `tests/fixtures/`（cms-integration）。
- 本書では「`getViteConfig` 経由で Astro の設定が Vitest に読み込まれている」ことだけを確かめるテストを 1 本置く
  （例 `tests/setup.test.ts`: `import.meta.env.SITE` が `https://unotame.com` であること）。テスト 0 件で `vitest run` が失敗するのを避ける意味もある。
- **2026-10-27 追加（D-012）**: P1 のページ仕様の承認で、次のテスト用パッケージとスクリプトの追加が承認された（導入はページの実装時）。
  - 開発依存 `happy-dom`: DOM の挙動のテスト。該当ファイルの先頭で `// @vitest-environment happy-dom` を指定し、全体の `environment: 'node'` は変えない（works-list L-6）。
  - 開発依存 `node-html-parser` と npm script `test:dist`: `CMS_SOURCE=fixture npm run build` の後に `tests/dist/*.test.ts` で `dist/` の HTML を検査する（top-page X-1）。
    **決定（2026-10-27、D-012 追加）**: `vitest.config.ts` の `exclude` に `tests/dist/**` を加えて `npm test` から外し、`test:dist` は専用の設定
    （例 `vitest.dist.config.ts`、`include: ['tests/dist/**/*.test.ts']`）で動かす。`test:dist` はビルド済みの `dist/` を前提とし、ビルドは含めない
    （環境変数の前置は F-9 に従う）。CI の順序は `lint → check → test → build（CMS_SOURCE=fixture）→ test:dist`。

## 受け入れ条件

すべてコマンドの結果で判定する（`tester` は Git Bash を想定。PowerShell の場合は同等のコマンドに読み替える）。

### legacy 退避（コミット 1・2）
- [ ] ルート直下の追跡ファイルに `*.php`・`style.css`・`assets/` が無い: `git ls-files | grep -E '^[^/]+\.php$|^style\.css$|^assets/'` が 0 行。
- [ ] `git ls-files legacy/` に、退避前の 10 個の `*.php`・`style.css`・`assets/` 配下（`.DS_Store` を除く 34 ファイル）・`.vscode/settings.json` がすべてある。
- [ ] 退避コミットが移動だけである: `git show -M --name-status --format= <退避コミット>` の全行が `R100` で始まる。
- [ ] `git log --follow --oneline legacy/front-page.php` に退避前のコミット（例 `cc7a601 add target blank`）が表示される。
- [ ] 退避コミットと Astro 初期化のコミットが別である（`legacy/` の rename と `package.json` の追加が同じコミットに無い）。
- [ ] `git ls-files | grep -c '\.DS_Store$'` が 0。`touch .DS_Store && git check-ignore -q .DS_Store` が成功（終了コード 0）。
- [ ] ルートに `.claude/`・`CLAUDE.md`・`.gitignore` が残っている。

### 設定ファイル
- [ ] `.gitignore` により `node_modules/`・`dist/`・`.astro/`・`.env`・`.env.local`・`.env.production` が無視され（`git check-ignore -q <path>` が成功）、`.env.example` は無視されない（失敗する）。
- [ ] `.env.example` に `MICROCMS_SERVICE_DOMAIN`・`MICROCMS_API_KEY`・`CMS_SOURCE`・`MICROCMS_PREVIEW_DRAFTS` が値なしで並ぶ。
- [ ] `git check-attr text eol -- src/pages/index.astro` が `text: auto` / `eol: lf`、`git check-attr binary -- legacy/assets/fonts/Objective-Black.otf` が `set`。
- [ ] 新規に追加したテキストファイルがすべて LF: `git ls-files --eol -- ':!legacy' ':!.claude' ':!CLAUDE.md' | grep -v 'i/lf' | grep -v 'i/-text'` が 0 行。
- [ ] コミット時に `LF will be replaced by CRLF` の警告が出ない。
- [ ] `.nvmrc` があり、`package.json` の `engines.node` と矛盾しない。`.npmrc` に `engine-strict=true`。

### Astro・ツール（ゴール）
- [ ] クリーンな clone で `.nvmrc` の Node を使い `npm ci` が終了コード 0。`npm ls` が終了コード 0（peer 依存の不整合なし）、`npm ls typescript` が 6.0.x を指す。
- [ ] `npm run build` が終了コード 0 で、`dist/index.html` がある。`dist/` に `legacy`・`*.php`・`.htaccess` が無い（`.htaccess` は URL 設計の実装で追加される）。
- [ ] `src/styles/style.scss` から生成されたコンパイル済みの CSS が、`dist/` の HTML（`<style>`）または `dist/_astro/*.css` にある（SCSS がコンパイルされている）。
  Astro の既定 `build.inlineStylesheets: 'auto'` では小さい CSS は HTML に埋め込まれるため、どちらでも合格とする（2026-10-27 実装時に修正）。
- [ ] `npm run check`（= `npx astro check`）が終了コード 0 で、エラー 0 件。`legacy/` 配下のファイルが検査対象に出てこない。
- [ ] `npm run lint` が終了コード 0。かつ `legacy/` に lint 違反があっても結果に影響しない（対象外）。
- [ ] `npm run format` を実行しても `git status --porcelain -- legacy .claude CLAUDE.md` が 0 行（旧テーマと仕様書を書き換えない）。
- [ ] `npm test` が終了コード 0 で、1 件以上のテストが成功し、watch モードに入らずに終わる。
- [ ] `npm run dev` を起動し `curl -s -o /dev/null -w '%{http_code}' http://localhost:4321/` が `200`。
- [ ] `npm run build && npm run preview` で同様に `/` が `200`。
- [ ] `astro.config.mjs` に `site: 'https://unotame.com'`・`output: 'static'`・`trailingSlash: 'always'`・`build: { format: 'directory' }` がある（url-design の受け入れ条件と同じ）。
- [ ] `tsconfig.json` が `astro/tsconfigs/strict`（または F-4 で決めた設定）を継承し、`exclude` に `legacy` と `dist` がある。
- [ ] `package.json` の依存に `jquery` が無い（D-005）。
- [ ] lint が本当に効いている（手動の確認）: 仮に `src/` に未使用変数のある `.ts`、`src/styles/` に不正な SCSS、整形崩れのファイルを置くと、`npm run lint` がそれぞれ非 0 で終わる（確認後に戻す）。

## 将来拡張（任意）
- P2「CI」: `.github/workflows/ci.yml` で `actions/setup-node`（`node-version-file: '.nvmrc'`, `cache: 'npm'`）→ `npm ci` → `npm run lint` → `npm run check` → `npm test` → `npm run build`
  （必要なら `CMS_SOURCE=fixture` を `env:` で渡す）。scripts は本書のまま使う。
- P2「SEO / OGP」: `@astrojs/sitemap` の追加、favicon・OGP 画像を `public/` に配置。
- P2「パフォーマンス / a11y」: Objective の WOFF2 化（＋ `font-display: swap`、必要なら Fonts API のローカルプロバイダ）、ESLint の a11y ルール。
- Playwright による表示確認（`tests/e2e/`）を足す場合は、`vitest` の `include` と分ける。
- Dependabot / Renovate による依存更新（メジャー更新は別ブランチで）。

## 未決事項

| ID | 内容 | 推奨・決め方 |
|---|---|---|
| F-1 | **`.DS_Store` ×4 を退避せずに削除してよいか**（CLAUDE.md「legacy を本番切替前に削除しない」の対象外と見なしてよいか） | **決定（D-011）**: 削除して `.gitignore` に追加 |
| F-2 | コミットの分け方 | **決定（D-011）**: 4 コミットに分ける |
| F-3 | **Node のメジャー**（24 か 26 か）と固定方法 | **決定（D-011）**: Node 24 ＋ `.nvmrc` |
| F-4 | TypeScript の厳しさ（`strict` か `strictest` か） | **決定（D-011）**: `strict` |
| F-5 | legacy の CRLF 3 件（`style.scss`・`_base.scss`・`script.js`）を LF に正規化するか | **決定（D-011、2026-10-27 変更）**: 正規化する。`eol=lf` により変換は避けられないため、コミット 1 で改行コードだけ LF 化する（中身は変えない） |
| F-6 | Objective の WOFF2 化を P1 でやるか | **決定（D-011）**: WOFF2 化は P2。P1 は OTF をコピー。ライセンス確認は P2 着手前に行う |
| F-7 | 本文の `"assets/` 参照の受け皿として `public/assets/` を用意するか（cms-integration C-7 の「プロジェクト基盤」側） | **決定（D-011）**: P1 では用意しない |
| F-8 | Stylelint を P1 で入れるか、`.astro` の `<style>` も対象にするか（グローバル SCSS とコンポーネントの `<style>` の使い分け） | **決定（D-011）**: P1 で入れる（`.scss` のみ、`selector-class-pattern` は無効化）。**使い分けも決定（2026-10-27 変更、D-012）**: style-migration S-2 の案 A（P1 はすべてグローバル SCSS。`.astro` に `<style>` を書かない。例外は `Loader.astro` の `<noscript>` 内の `<style is:inline>` 1 か所）。`.astro` を Stylelint の対象にする必要は無い。案 B・C へ移る場合（P2 以降）に `postcss-html` を足す |
| F-9 | 環境変数を前置するコマンド（cms-integration の受け入れ条件 `CMS_SOURCE=fixture npm run build` など）が Windows の cmd / PowerShell では動かない | **決定（D-011）**: 開発環境は Git Bash 前提（コマンドラインでの前置は動く）。ただし npm scripts は Windows では cmd で実行されるため、scripts 内で環境変数を前置する場合や Git Bash で動かない場合は `cross-env` を入れる |
| F-10 | `npm run preview`・`npm run format`・`npm run check` を `.claude/settings.local.json` の許可に足すか | **決定（D-011）**: `Bash(npm run preview)`・`Bash(npm run check)` を許可に追加した |
| F-11 | `legacy/README.md`（「配信しない・本番切替後に合意して削除」の注記）を置くか | **決定（D-011）**: 置く（コミット 3 に含める） |
| F-12 | 文書間の小さな食い違い: `.claude/CLAUDE.md` のフェーズ表で「jQuery 除去」が P2 にあるが、D-005 と新構成では P1 から jQuery を使わない | **対応済み**: `.claude/CLAUDE.md` のフェーズ表を「jQuery を使わない実装（P1）」に修正した |
| F-13 | design-policy の FLOCSS は Object を「Component / Project」の 2 つとしているが、本書は `utility/` を加えた | **対応済み**: design-policy に Utility（`u-`）を追加した |
