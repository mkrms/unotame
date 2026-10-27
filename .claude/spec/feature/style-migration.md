# 機能仕様: スタイル移植（style-migration）

> 状態: **承認済み（2026-10-27、推奨どおり。decisions-log D-012）**。D-005（SCSS・FLOCSS 継続、jQuery 廃止）、D-011（`project-foundation.md`：`src/styles/` の構成・`src/assets/` と `public/` の使い分け・
> Stylelint の設定・Objective は P1 で OTF のまま）を前提とする。
> **前提条件（S-1）**: Adobe Fonts の読み込みを実装する前に、ユーザーが Adobe Fonts の管理画面で ① この Web プロジェクト（kit `woq0phd`）が有効で `yu-mincho-pr6n` を含むか、
> ② `localhost` と `unotame.com` で配信されるか、を確認する。

## 目的
- 現行テーマの SCSS（`legacy/assets/css/`：Foundation / Layout / Object）・`destyle.css`・Objective フォント・画像資産を、Astro の新構成
  （`src/styles/` の FLOCSS、`src/assets/`、`public/`）へ移し、**P1 では見た目を現行サイトと同じに保つ**。
- 非推奨の `@import` をやめて `@use` にし、変数・mixin の置き場所を決めて、以後の機能が同じ書き方でスタイルを足せるようにする。
- グローバルな SCSS と Astro コンポーネントの `<style>` の使い分けを決める（project-foundation で `.astro` の `<style>` を Stylelint の対象にするかが
  「スコープ付きスタイルを使う方針になったら」と保留になっている点）。
- 「見た目が現行と同じ」を確かめる手順を決める。

## スコープ（対象フェーズ）
- **P1（本書の対象）**
  - legacy の各 SCSS ファイルの移し先（対応表）と、書き換えの規則（`@import` → `@use`、Stylelint への適合）。
  - 変数・mixin・`@font-face`・リセット（destyle）・要素の基本スタイル・Utility の置き場所。
  - destyle を npm の `destyle.css` に置き換える方法。
  - Objective（OTF のまま）と、明朝体（Adobe Fonts）の読み込み方。
  - 画像の置き場所と、`astro:assets` の `<Image>` を P1 で使うか。
  - グローバル SCSS と `<style>` の使い分け。
  - 見た目の比較手順（比べるページ・画面幅・観点）。
- **P2 に回すもの**: デザイントークン化（CSS カスタムプロパティ）、WOFF2 化と `font-display`（project-foundation F-6）、
  `html` の `font-size` を画面幅で決める方式（ブラウザの文字サイズ設定が効かない）の見直し、画像の `srcset`、ダークモード、`.astro` の `<style>` への移行の再検討。
- **含まない**: 各ページのマークアップ（各ページ仕様）。お問い合わせフォームのスタイル（`_contact.scss`。Contact 仕様でフォームの実現手段が決まってから）。

## 現行（WordPress）の振る舞い

### ファイルと読み込み
- `header.php` が `destyle.css`（v4.0.1、415 行）と `style.css?v=1.2` を `<link>` で読む。`style.css` は `style.scss` を VS Code 拡張（Live Sass Compile）で
  手元コンパイルしたもの（コミット済み）。
- `style.scss` は `@import` で次の順に読む: `Foundation/global` → `Foundation/base` → `Layout/header` → `Layout/footer` → `Layout/layout` →
  `Object/Component/button` → `Object/Component/loader` → `Object/Project/front-page` → `works` → `work-detail` → `contact`。
  **`Object/Project/_about.scss` は空で、読み込まれていない**（About のスタイルは `_front-page.scss` にある）。

### 中身の要点

| ファイル | 中身 | 気づいた点 |
|---|---|---|
| `Foundation/_global.scss` | 色 3 つ（`$color-primary: #333`・`$color-secondary: #005321`・`$color-bg: #f8f8f8`）、`$BREAKPOINT_PC: 1366px`・`$BREAKPOINT_SP: 768px`、mixin `ov-pc`（min 1366）・`pc`（max 1366）・`ov-sp`（min 768）・`sp`（max 768）、Objective の `@font-face` ×3（Regular 400・Medium 500・Black 700、OTF、`font-display` なし）、mixin `objective`（`font-weight: bold` → Black が当たる）・`mincho`（`"yu-mincho-pr6n", sans-serif`）、クラス `.objective`・`.mincho` | `$color-secondary` は未使用。`.objective`・`.mincho` クラスはテンプレートで未使用。`mincho` の代替が `sans-serif`（明朝が読めないとゴシックになる） |
| `Foundation/_base.scss` | `.sp-none`・`.pc-none`、`html`（システムフォント、`font-size: calc(10 / 1366 * 100vw)`、SP は `calc(10 / 375 * 100vw)` → 1rem が画面幅に比例）、`body`（1.6rem・行間 1.75・`overflow-x: hidden`・背景 `$color-bg`・文字 `$color-primary`、SP は 1.2rem）、`h1〜h3`、`.bg-color`、`.container` | `.sp-none`・`.pc-none`・`.bg-color`・`.container` はテンプレートで未使用 |
| `Layout/_header.scss` `_footer.scss` | `l-header`（固定・高さ 8rem・黒丸付きナビ）、`l-footer`（CONTACT 帯 50vh・コピーライト） | 空のルール `&-link {}` がある |
| `Layout/_layout.scss` | `.l-container`（65%／SP 95%）、`.l-section-title`（明朝・3.2rem）、**要素セレクタ `section { padding: 5rem 0 }`**、`.l-page__wrapper`・`.l-page-title`（明朝・3.6rem）、`.l-single__wrapper` | 要素セレクタが Layout にある |
| `Object/Component/_button.scss` | `.c-btn-view-more`（角丸の枠線ボタン・明朝） | — |
| `Object/Component/_loader.scss` | `.loader-bg`・`.loader`・`@keyframes l2` | FLOCSS の接頭辞が無い |
| `Object/Project/_front-page.scss` | `p-front-page-kv`・`-message`（**`main` 要素セレクタ**・`aside`）・`-works`（カード）・`-about`（カード・SNS） | 実績カードのスタイルが `_works.scss`・`_work-detail.scss` と**ほぼ同じ内容で 3 回**書かれている |
| `Object/Project/_works.scss` | `p-works`（本文 80%＋サイドバー 20%、カード、`.is-show`・`.is-active`） | 同上 |
| `Object/Project/_work-detail.scss` | `p-work-detail__content`（本文の h2/h3/ul/ol）・`__latest`（カード） | 同上 |
| `Object/Project/_contact.scss` | Contact Form 7 用（`.cf7__*`・`.wpcf7-*`）。**`input[type="checkbox"]`・`input[type="submit"]` などの要素セレクタがグローバル** | フォームの実現手段に依存 |

### フォント・画像・JS
- Objective: `assets/fonts/Objective-{Regular,Medium,Black}.otf`（各約 40KB）。
- **明朝体は Adobe Fonts**: `script.js` の末尾で Typekit の JS 埋め込みコード（kit `woq0phd`）を実行し、`yu-mincho-pr6n` を読み込んでいる。
  セクション見出し（`.l-section-title`）・ページ見出し（`.l-page-title`）・「View More」ボタンがこの書体。JS が動かないと `sans-serif` になる。
- 画像: `assets/img/` の 13 ファイル（project-foundation の「legacy 資産の移し先」に割り当て済み）。テーマ内の `<img>` で直接参照。
- 画面幅の基準: PC は 1366px で 1rem = 10px、SP は 375px で 1rem = 10px（それ以外の幅では比例して拡大縮小する）。

## データ構造案

### 新しいディレクトリ構成（`src/styles/`）

```
src/styles/
├─ style.scss                      … エントリ。@use の並び＝CSS の出力順（下記）
├─ foundation/
│  ├─ _variables.scss              … 色・ブレークポイント（CSS を出力しない）
│  ├─ _mixins.scss                 … ブレークポイント・書体の mixin（CSS を出力しない）
│  ├─ _fonts.scss                  … Objective の @font-face ×3
│  └─ _base.scss                   … html / body / h1〜h3 / section / scroll-padding-top
├─ layout/
│  ├─ _header.scss                 … l-header
│  ├─ _footer.scss                 … l-footer
│  └─ _layout.scss                 … l-container / l-section-title / l-page / l-single
└─ object/
   ├─ component/
   │  ├─ _button.scss              … c-btn-view-more
   │  ├─ _loader.scss              … c-loader（旧 .loader-bg / .loader）
   │  └─ _work-card.scss           … c-work-card（トップ・一覧・詳細の Latest で共通。S-3）
   ├─ project/
   │  ├─ _front-page.scss          … p-front-page-*
   │  ├─ _works.scss               … p-works
   │  └─ _work-detail.scss         … p-work-detail
   │     （_contact.scss は Contact 仕様で作る。_about.scss は作らない）
   └─ utility/
      └─ _display.scss             … u-sp-none / u-pc-none / u-visually-hidden（works-list L-7。2026-10-27 追加、D-012）
```

- destyle は `src/styles/` に置かず、npm パッケージ `destyle.css`（4.0.1。legacy と同じ版）を `BaseLayout.astro` で `style.scss` より先に import する（後述）。

### legacy → 新構成の対応表

| legacy（`legacy/assets/css/`） | 新しい場所（`src/styles/`） | 書き換え |
|---|---|---|
| `style.scss` | `style.scss` | `@import` を `@use` に。順序は下の「`style.scss`」のとおり |
| `destyle.css` | npm `destyle.css@4.0.1`（`BaseLayout.astro` で `import 'destyle.css'`） | コピーしない |
| `Foundation/_global.scss` の色・ブレークポイント | `foundation/_variables.scss` | `$BREAKPOINT_PC` → `$breakpoint-pc`、`$BREAKPOINT_SP` → `$breakpoint-sp`（Stylelint の変数名規則に合わせる）。`$color-secondary` は未使用だが残す（ブランド色の記録） |
| 同 mixin `ov-pc` `pc` `ov-sp` `sp` | `foundation/_mixins.scss` | 名前は変えない（各ファイルの差分を小さくするため）。メディアクエリは範囲記法に。`ov-sp` は `width > 768px`、`ov-pc` は `width > 1366px` にして、768px と 1366px の重なりを直す（S-5。2026-10-27 変更、D-012） |
| 同 `@font-face` ×3 | `foundation/_fonts.scss` | `src` を `url('../../assets/fonts/Objective-*.otf') format('opentype')` に |
| 同 mixin `objective` `mincho` | `foundation/_mixins.scss` | そのまま（`mincho` の代替フォントも現行どおり。S-1） |
| 同 クラス `.objective` `.mincho` | — | 移さない（未使用）。必要になったら `u-` の Utility として足す |
| `Foundation/_base.scss` の `html` `body` `h1〜h3` | `foundation/_base.scss` | 値は変えない。`html { scroll-padding-top: 8rem; }` を追加（固定ヘッダーでアンカー先が隠れないように。`layout.md`） |
| 同 `.sp-none` `.pc-none` | `object/utility/_display.scss` の `.u-sp-none` `.u-pc-none` | 接頭辞 `u-` を付ける（現在は未使用だが design-policy の方針どおり受け皿を作る） |
| 同 `.bg-color` `.container` | — | 移さない（未使用。`.l-container` が使われている） |
| `Layout/_header.scss` | `layout/_header.scss` | 空のルール（`&-link {}`）を削除 |
| `Layout/_footer.scss` | `layout/_footer.scss` | そのまま |
| `Layout/_layout.scss` の `section {}` | `foundation/_base.scss` | 要素セレクタは Foundation に置く（FLOCSS）。クラスより詳細度が低いので、出力位置が前に移っても結果は同じ |
| 同 その他 | `layout/_layout.scss` | そのまま |
| `Object/Component/_button.scss` | `object/component/_button.scss` | そのまま |
| `Object/Component/_loader.scss` | `object/component/_loader.scss` | `.loader-bg` → `.c-loader`、`.loader` → `.c-loader__dot`、`@keyframes l2` → `c-loader-pulse`。`layout.md` の状態クラス（`is-loaded`・`is-timeout`）・`[hidden]`・保険のアニメーション・`prefers-reduced-motion` を追加 |
| `Object/Project/_front-page.scss` | `object/project/_front-page.scss` | `.p-front-page-message main` → `.p-front-page-message__body`（`<main>` をやめるため。S-9）。`aside` → 署名の要素に合わせる（`top-page.md`）。カード部分は S-3 |
| `Object/Project/_works.scss` | `object/project/_works.scss` | カード部分は S-3。`li { display: none }`・`.is-show`・`.is-active` は移さない（下の「ほかの P1 仕様からの要件」。works-list L-8、D-012） |
| `Object/Project/_work-detail.scss` | `object/project/_work-detail.scss` | カード部分は S-3。本文（`__body`）のセレクタは microCMS のリッチエディタの出力に合わせて Works 詳細仕様で確認 |
| `Object/Project/_contact.scss` | （Contact 仕様で決める） | 本書では移さない。移す場合も要素セレクタ（`input[type=…]`）は `.p-contact` の下に閉じ込める |
| `Object/Project/_about.scss` | — | 空なので作らない |
| `style.css` `style.css.map` | — | 生成物なので持ち込まない |

### 変数・mixin（案）

```scss
// foundation/_variables.scss（CSS を出力しない）
$color-primary: #333;
$color-secondary: #005321;
$color-bg: #f8f8f8;
$breakpoint-pc: 1366px;
$breakpoint-sp: 768px;

// foundation/_mixins.scss（CSS を出力しない）
@use 'variables' as *;

@mixin ov-pc { @media screen and (width > $breakpoint-pc) { @content; } }   // S-5（2026-10-27 追加、D-012）: legacy の min-width: 1366px から変更。1366px では pc だけが当たる
@mixin pc    { @media screen and (width <= $breakpoint-pc) { @content; } }
@mixin ov-sp { @media screen and (width > $breakpoint-sp) { @content; } }   // S-5（D-012）: legacy の min-width: 768px から変更。768px では sp だけが当たる
@mixin sp    { @media screen and (width <= $breakpoint-sp) { @content; } }

@mixin objective { font-family: objective, sans-serif; font-weight: bold; }
@mixin mincho    { font-family: yu-mincho-pr6n, sans-serif; }
```

- 各パーシャルは、使うものだけを**相対パスで明示的に** `@use` する（例 `layout/_header.scss` なら `@use '../foundation/variables' as *;` と
  `@use '../foundation/mixins' as *;`、`object/project/` からは `../../foundation/…`）。
  - 名前空間なし（`as *`）にするのは、legacy の `$color-primary`・`@include sp` をそのまま使えて移植の差分が小さいため。
  - Vite の `additionalData` で全ファイルに自動注入する方法は使わない（どこから来た変数か分からなくなり、`style.scss` 自身にも注入されるため）。
  - パスが長くて困る場合は `astro.config.mjs` の `vite.css.preprocessorOptions.scss.loadPaths` に `src/styles` を足して `@use 'foundation/mixins'` と
    書ける（P1 では入れない。必要になったら提案する）。
- `@use` は同じファイルを何度読んでも CSS を 1 回しか出さないが、**CSS を出力するファイル（`_fonts`・`_base`・各レイヤ）を読むのは `style.scss` だけ**にする。
  パーシャルから読むのは CSS を出さない `_variables`・`_mixins` だけ。

### `style.scss`（出力順）

```scss
// destyle は BaseLayout.astro で先に import 済み
@use 'foundation/fonts';
@use 'foundation/base';

@use 'layout/header';
@use 'layout/footer';
@use 'layout/layout';

@use 'object/component/button';
@use 'object/component/loader';
@use 'object/component/work-card';   // S-3

@use 'object/project/front-page';
@use 'object/project/works';
@use 'object/project/work-detail';

@use 'object/utility/display';       // Utility は最後（ほかのレイヤより優先させる）
```

- legacy の順序（Foundation → Layout → Component → Project）を保ち、FLOCSS どおり Utility を最後に置く。
- 現在の `style.scss` の仮のルール（`body { color: $color-primary; }`）は `foundation/_base.scss` に置き換わるので消す。

### destyle の置き換え
- `npm install destyle.css@4.0.1`（`dependencies`。実装時に行う。版は legacy と同じにして見た目の差を出さない）。
- 読み込みは `BaseLayout.astro` の frontmatter で `import 'destyle.css';` → `import '../styles/style.scss';` の順（`layout.md`）。
  Vite は import の順に CSS を並べるので、destyle がリセットとして先に来る。
- Sass の `@use` で npm の CSS を読む方法（`pkg:` 形式の読み込みなど）は、Vite・Sass の設定が要るので採らない。

### フォント
- `legacy/assets/fonts/Objective-{Regular,Medium,Black}.otf` → `src/assets/fonts/`（コピー。`legacy/` の原本は残す）。
- `foundation/_fonts.scss`:

```scss
@font-face {
  font-family: objective;
  src: url('../../assets/fonts/Objective-Regular.otf') format('opentype');
  font-weight: 400;
}
// Medium 500 / Black 700 も同じ形
```

- Vite が `@use` 先のファイルの `url()` をそのファイルからの相対で解決し、`/_astro/Objective-Regular.[hash].otf` として出力する（約 40KB なのでインライン化されない）。
- `font-display` は現行どおり付けない（WOFF2 化と一緒に P2。project-foundation F-6）。
- **明朝体（Adobe Fonts）**: 使い続け、`<head>` に CSS 版の埋め込みコード `<link rel="stylesheet" href="https://use.typekit.net/woq0phd.css">` を置く（`layout.md` の BaseHead。S-1、D-012）。
  JS 版（現行）と違い、JS が無効でも読み込まれ、`wf-loading` クラスの付け外しも要らない。
  実装前に、冒頭の「前提条件」（Adobe Fonts の管理画面での 2 点の確認）をユーザーが済ませていること。

### グローバル SCSS と `.astro` の `<style>` の使い分け（決定：案 A。S-2、D-012）

| 案 | 内容 | 長所 | 短所 |
|---|---|---|---|
| **A. すべてグローバル SCSS（推奨）** | スタイルは `src/styles/` の FLOCSS だけに書く。`.astro` には `<style>` を書かない | legacy と同じ構成・クラス名のまま移せて、現行との比較がしやすい。FLOCSS の接頭辞で衝突は防げている。Stylelint（`.scss` のみ）の対象から漏れない。CSS が 1 つにまとまり、全ページで同じファイルをキャッシュできる | コンポーネントとスタイルが別ファイルになる。使わないページにも全 CSS が載る（サイトが小さいので問題は小さい） |
| B. コンポーネントの `<style lang="scss">`（スコープ付き） | 各コンポーネントにスタイルを同居させる | 置き場所が分かりやすい。使うページにだけ CSS が載る | Astro が `data-astro-cid-*` 属性でスコープを付けるため、詳細度・出力順が legacy と変わり、見た目の再現の確認が難しくなる。microCMS の本文 HTML（スコープ外）には `:global()` が要る。各ファイルで `@use` が要る。Stylelint で見るには `postcss-html` の追加が要る（F-8） |
| C. 併用（Foundation・Layout はグローバル、Component・Project は `<style>`） | — | B の長所を一部得られる | 書き方が 2 通りになり、どちらに書くかの判断が毎回要る |

**決定（D-012）: A（P1 はすべてグローバル SCSS）**。
- P1 の目的は「現行と同じ見た目で Astro に載せる」ことで、legacy の FLOCSS をそのまま移すのが最も確実。
- 例外として、`<noscript>` 内でローダーを隠す 1 行だけは `<style is:inline>` で書く（`layout.md`。Astro に処理させないため）。
- B・C への移行は P2 のデザイン刷新で必要になったら再検討する（その際に Stylelint へ `postcss-html` を足す）。

### 画像の置き場所と `<Image>`
- 置き場所は project-foundation の割り当てどおり: ロゴ・プロフィール写真・SNS アイコンは `src/assets/images/`、OGP 画像は `public/ogp.png`。
  実績の画像は microCMS の画像 URL（cms-integration）で、リポジトリには置かない。
- **P1 でも `src/assets/` の画像は `astro:assets` の `<Image>` で出す（S-7。D-012 で決定）**。
  - 理由: ファイル名にハッシュが付く・`width`/`height` が自動で付いてレイアウトのずれを防げる・`profile.png`（約 1MB）を縮小できる。
    `sharp` は Astro の `optionalDependencies` に含まれ、npm では通常そのまま入る（2026-10-27 時点の `node_modules` に存在することを確認）。CI など入らない環境があれば `sharp` を明示的に依存へ足す。
  - 既定の出力形式は WebP。透過 PNG（ロゴ）も WebP で透過が保たれる。SVG（Zenn・note のアイコン）はそのまま出る。
  - 既定で `loading="lazy"` になるため、ファーストビューの画像（ヘッダーのロゴ・トップの KV 付近）は `loading="eager"` を指定する。
  - P1 では元の寸法のまま出す（`widths`・`srcset` による出し分けは P2）。ただし `profile.png` の縮小幅はトップページ仕様で決める。
- CSS の `background-image` で使う画像は現行に無い。使う場合も `src/assets/` に置き、SCSS の相対 `url()` で参照する。

### ほかの P1 仕様からの要件（2026-10-27 追加、D-012）
承認済みの各ページ仕様が本書に求めているスタイル。該当するレイヤのファイルに追加する。

| 要件 | 置き場所 | 出典 |
|---|---|---|
| `[hidden] { display: none !important; }`（作者 CSS の `display` に `hidden` 属性が負けないように） | `foundation/_base.scss` | works-list L-8 |
| `.u-visually-hidden`（見た目は隠して読み上げる。結果件数の `role="status"` に使う） | `object/utility/_display.scss` | works-list L-7 |
| 一覧の `li { display: none }`・`.is-show`・`.is-active` を移さない。選択中の絞り込みボタンは `[aria-pressed="true"]` で装飾する。PC で絞り込みを右に置くのは CSS（`order` 等）で行う（DOM では一覧より前）。「→」の矢印は読み上げさせない | `object/project/_works.scss` | works-list L-8 |
| 表示されたカードのフェードは 300ms（現行 600ms）。`prefers-reduced-motion: reduce` では動かさない | `object/project/_works.scss`（または JS 側の `animate`） | works-list L-9 |
| 実績カードの帯を `:focus-visible` でもホバーと同じに表示する。帯の `transform` などの動きは `prefers-reduced-motion: reduce` で止める。画像は `aspect-ratio: 3/2`・`object-fit: cover` | `object/component/_work-card.scss` | top-page（WorkCard） |

### Stylelint への適合
- 移植したファイルは `npm run lint`（`stylelint-config-standard-scss`、`selector-class-pattern` は無効）を通す。
- `stylelint --fix` で直る差分（色の表記 `rgba(0, 0, 0, 0.8)` → `rgb(0 0 0 / 80%)`、フォント名の引用符、空行など）は、**見た目が変わらない書き換え**なので受け入れる。
- 変数名（`$BREAKPOINT_*` → `$breakpoint-*`）、メディアクエリの範囲記法（`min-width: 768px` → `width >= 768px`。意味は同じ）、空ルールの削除は手で直す。
- ルールを無効にする場合は、その行にコメントで理由を書く（ファイル全体・設定での無効化は承認事項）。
- 値（色・寸法・時間）は変えない。現行の不具合も P1 では直さない。ただし 768px と 1366px のブレークポイントの重なり（S-5 ①）だけは P1 で直す（2026-10-27 変更、D-012）。

### 見た目の比較手順（P1 の確認方法）
- **比較対象**: 現行の本番サイト `https://unotame.com/`（WordPress。本番切替まで稼働している）と、ローカルの `npm run build && npm run preview`。
  - ローカルのデータは microCMS（またはフィクスチャ）で、現行の投稿と内容が一致しない（コンテンツ移行は P2）。**比べるのは文言・件数ではなく、書体・大きさ・余白・色・配置・動き**。
- **画面幅**（DevTools のデバイスツールバーで幅を固定。高さは 900px 程度）:

| 幅 | 理由 |
|---|---|
| 375px | SP の基準（1rem = 10px） |
| 768px | SP の上限。現行は `sp` と `ov-sp` が両方当たるが、新サイトは `sp` だけが当たる（S-5 で P1 に直す。この幅の差分は「意図した変更」として記録する） |
| 769px | PC 側の下限（ヘッダーのナビが出る最初の幅） |
| 1366px | PC の基準（1rem = 10px）。現行は `pc` と `ov-pc` が両方当たるが、新サイトは `pc` だけが当たる（S-5 で P1 に直す。差分は「意図した変更」として記録する） |
| 1920px | 大きい画面（rem が比例して大きくなることの確認） |

- **ページ**: `/`、`/works/`、実績詳細 1 件、`/contact/`（フォーム部分は除く）。404 は現行が空白ページなので比較しない（`not-found.md`）。
- **観点チェックリスト**:
  - 書体: KV の名前・肩書き・Works 一覧のサイドバー見出しが Objective、セクション見出し・ページ見出し・View More が明朝（DevTools の「Rendered Fonts」で確認）。
  - 背景色 `#f8f8f8`・文字色 `#333`、本文の大きさと行間。
  - ヘッダー: ロゴの高さ 8rem、ナビの黒丸、ホバーで拡大、固定表示、SP でナビが消える。
  - フッター: CONTACT 帯の高さ（50vh）・ホバーで背景グレーと文字の拡大、コピーライト。
  - トップ: KV・Message・Works のカード（PC のホバーで帯が出る／SP では下に表示）・About のカードと SNS アイコン。
  - ローダー: 見た目（中央の黒丸の波紋）と消えるまでの時間。
- **記録**: 幅ごとに現行とローカルのフルページのスクリーンショットを撮り、並べて確認する（PR に添付してよい。リポジトリには入れない）。
  差分があれば「意図した変更（本書・各ページ仕様に書いたもの）」か「移植ミス」かを分けて記録する。
- 画像の自動比較（Playwright のスクリーンショット差分など）は P1 では行わない（データが一致しないため誤検知が多い）。必要になったら P2 で提案する。

## 振る舞い
- 作業の順序（推奨）:
  1. `destyle.css` の導入と `BaseLayout.astro` での読み込み（`layout.md` と同時）。
  2. Foundation（`_variables`・`_mixins`・`_fonts`・`_base`）とフォントのコピー。
  3. Layout・Component・Utility の移植（共通レイアウトの実装と同時に確認できる）。
  4. Project の移植（各ページの実装と同時。マークアップが変わる箇所〈S-3・S-9〉は各ページ仕様に合わせる）。
- 各ページ仕様が新しいスタイルを要求した場合（例: `top-page.md` の「カードの帯をキーボードのフォーカス時にも表示」「動きを `prefers-reduced-motion` で止める」）は、
  該当するレイヤのファイルに追加する。それ以外の見た目の変更は P1 では行わない。
- `legacy/assets/css/` は参照のみで、変更・削除しない。

## 受け入れ条件

### ソース
- [ ] `src/styles/` の構成が「新しいディレクトリ構成」のとおりで、各ファイルの中身が対応表のとおりに移っている（未使用で移さないと決めたもの以外が欠けていない）。
- [ ] `src/styles/` 配下に `@import` が無い（`grep -rn "@import" src/styles` が 0 件）。
- [ ] CSS を出力するパーシャル（`_fonts`・`_base`・layout・object）を `@use` しているのは `style.scss` だけ。
- [ ] `src/**/*.astro` に `<style` が無い（例外は `Loader.astro` の `<noscript>` 内の `<style is:inline>` 1 か所のみ）。
- [ ] `package.json` の `dependencies` に `destyle.css` が `4.0.1` で入っており、`src/` に destyle の CSS のコピーが無い。
- [ ] `src/assets/fonts/` に `Objective-{Regular,Medium,Black}.otf` があり、`legacy/assets/fonts/` の同名ファイルとバイト単位で同じ（`legacy/` 側も残っている）。

### ビルド成果物
- [ ] `npm run build` が Sass の非推奨警告（`@import`・グローバル関数など）を出さずに通る。
- [ ] 出力された CSS（`dist/_astro/*.css` または HTML 内の `<style>`）に、destyle のルール（例 `*,:before,:after{box-sizing:border-box` 相当）が `l-header` のルールより**前**に出ている。
- [ ] 出力された CSS に `font-family:objective` の `@font-face` が 3 つあり、それぞれの `src` が `dist/_astro/` に存在する `.otf` を指している。
- [ ] 出力された CSS に `.l-header`・`.l-footer-contact`・`.c-loader`・`.c-btn-view-more`・`.u-sp-none`・`.u-pc-none`・`.p-front-page-kv` が含まれ、`.loader-bg`・`.sp-none`（接頭辞なし）が含まれない。
- [ ] `dist/` の HTML の `<img>` のうち `src/assets/` 由来のものは `src` が `/_astro/` で始まり、`width`・`height` を持つ。
- [ ] （S-1）すべての HTML の `<head>` に `https://use.typekit.net/woq0phd.css` の `<link>` があり、`use.typekit.net/…js` の読み込みが無い。

### 品質・見た目
- [ ] `npm run lint`（Stylelint を含む）・`npm run check`・`npm run build` が通る。
- [ ] 「見た目の比較手順」の 5 つの幅 × 4 ページで、観点チェックリストに移植ミスが無い（意図した変更のみ）。結果（スクリーンショットと差分メモ）が PR に添付されている。

## 将来拡張（任意）
- P2 デザイン刷新: 色・余白・文字サイズを CSS カスタムプロパティ（デザイントークン）へ。`mincho` の代替を `serif` 系に。
- P2 パフォーマンス / a11y: Objective の WOFF2 化・`font-display: swap`・サブセット化（ライセンス確認後）、`html` の `font-size` を `vw` だけで決める方式の見直し
  （ブラウザの文字サイズ設定を反映させる）、画像の `widths`/`srcset`、Adobe Fonts の `preconnect`。
- `.astro` の `<style>` への移行（案 B・C）を選ぶ場合は、Stylelint に `postcss-html` を足して `.astro` も対象にする。

## 未決事項

2026-10-27 に推奨どおりで決定した（D-012）。S-5 は推奨のうち「①は P1 で直してもよい」を採り、768px の重なりを P1 で直す。同じ重なりが 1366px にもあることが分かったため、こちらも P1 で直す（2026-10-27 追加承認）。

| ID | 内容 | 決定 |
|---|---|---|
| S-1 | Adobe Fonts（kit `woq0phd`、`yu-mincho-pr6n`）を P1 でも使い続けるか、どう読み込むか。現行は `script.js` の中で JS 版の埋め込みコードを実行している | **決定（D-012）**: 使い続け、CSS 版の埋め込みコード（`<link rel="stylesheet" href="https://use.typekit.net/woq0phd.css">`）を `<head>` に置く。**前提条件**: 実装前に、ユーザーが Adobe Fonts の管理画面で ① この Web プロジェクトが有効で `yu-mincho-pr6n` を含むか、② `localhost` と `unotame.com` で配信されるか、を確認する（設定はアカウント側にしか無い。**2026-10-27 時点で未確認**）。確認できなかった場合は代替の明朝を決め直す（見た目が変わるので改めて承認を得る） |
| S-2 | グローバル SCSS と `.astro` の `<style>` の使い分け | **決定（D-012）**: 案 A（P1 はすべてグローバル SCSS。例外は `<noscript>` の `<style is:inline>` 1 か所）。B・C は P2 で必要になったら再検討。project-foundation F-8 にも反映済み |
| S-3 | 実績カードのスタイルが 3 か所に重複している | **決定（D-012）**: `top-page.md` の共通 `WorkCard`（`c-work-card`）が承認されたため、カード 1 枚分を `object/component/_work-card.scss` にまとめ、並べ方（グリッド・列数）は各 Project に残す |
| S-4 | 未使用のクラス（`.objective`・`.mincho`・`.bg-color`・`.container`）を移さないこと。未使用の `.sp-none`・`.pc-none` は `u-sp-none`・`u-pc-none` として移すこと | **決定（D-012）**: 本書のとおり |
| S-5 | 現行の不具合・癖: ① `sp`（≤768px）と `ov-sp`（≥768px）が 768px ちょうどで、`pc`（≤1366px）と `ov-pc`（≥1366px）が 1366px ちょうどで両方当たる、② `html` の `font-size` が画面幅だけで決まり、ブラウザの文字サイズ設定が効かない、③ `mincho` の代替が `sans-serif` | **決定（D-012）**: ① は **P1 で直す**（`ov-sp` を `width > 768px`、`ov-pc` を `width > 1366px` に。2 つの幅での見た目の差は意図した変更として記録する。1366px は 2026-10-27 追加承認）。②・③ は P1 では現行どおり、P2 で直す |
| S-6 | destyle を npm で入れ、JS の import で読むこと | **決定（D-012）**: 本書のとおり（同じ 4.0.1 を使う） |
| S-7 | P1 で `<Image>` を使うこと（ロゴ・プロフィール・SNS アイコン。WebP に変換される） | **決定（D-012）**: 使う。WebP への変換で画質が気になる場合は `format` を元の形式に指定する |
| S-8 | 見た目の比較を手動（スクリーンショットの並べ比べ）で行い、画像差分の自動化は P1 では行わないこと | **決定（D-012）**: 本書のとおり |
| S-9 | トップの `.p-front-page-message main`・`aside` のセレクタを、`<main>` をやめる変更に合わせて書き換えること | **決定（D-012）**: 書き換える。クラス名は `top-page.md` のマークアップに合わせて実装時に付ける（本書の `__body` は仮の名前） |
| S-10 | `_contact.scss`（Contact Form 7 用）の扱い | 未決: Contact 仕様でフォームの実現手段が決まってから。移す場合は `input[type=…]` などの要素セレクタを `.p-contact` の下に閉じ込める（グローバルに効かせない） |
