# 機能仕様: 共通レイアウト（layout）

> 状態: **承認済み（2026-10-27、推奨どおり。decisions-log D-012）**。`url-design.md`（D-009）・`cms-integration.md`（D-010）・`project-foundation.md`（D-011）を前提とする。
> スタイルの書き方（SCSS の置き場所・`<style>` の扱い）は `style-migration.md`（承認済み・D-012）に従う。

## 目的
- 全ページで共通の骨格（`<head>` の共通部分・ヘッダー・フッター・`<main>`）を **1 つのレイアウト**にまとめ、各ページは中身だけを書けばよい状態にする。
- 現行テーマの `header.php` / `footer.php` の見た目と導線（ロゴ、ナビ ABOUT / WORKS / CONTACT、フッターの大きな CONTACT、コピーライト）を引き継ぐ。
- 現行トップのローダー演出を **jQuery なし**（D-005）で再現する。JavaScript が無効でも、動きを減らす設定でも、ページが必ず見える状態にする。
- ナビの URL は `src/lib/routes.ts`（url-design）だけで作り、直書きしない。

## スコープ（対象フェーズ）
- **P1（本書の対象）**
  - `src/layouts/BaseLayout.astro` と、ヘッダー・フッター・`<head>`・ローダーのコンポーネント、その props。
  - ナビ項目のデータ（`src/data/navigation.ts`）と、現在ページの判定（`aria-current`）を行う純粋関数。
  - `<head>` の共通部分: `lang`・`charset`・`viewport`・`<title>` の組み立て規則・`description`・`noindex` の切り替え・最小限の OGP。
  - ローダー（トップだけで使う）の構造・タイミング・JS 無効時と `prefers-reduced-motion` の扱い。
  - ヘッダーのロゴ画像（`src/assets/images/`）と OGP 画像（`public/ogp.png`）の配置。
- **P2 に回すもの**
  - 「SEO / OGP」: canonical・ページ別の OGP 画像・Twitter Card・sitemap・robots・favicon・構造化データ。
  - 「パフォーマンス / a11y」: スキップリンク、SP のナビ（現行は SP で非表示。L-1）、現在ページの見た目上の表示、ロゴ画像の最適化（サイズ別出力）。
  - デザイン刷新（ローダーの要否を含む。design-policy の「改善候補」）。
- **含まない**: 各ページの中身（トップ・Works 一覧/詳細・Contact・404 は各仕様）、SCSS の移植作業そのもの（`style-migration.md`）、
  `.htaccess` の生成（url-design）。

## 現行（WordPress）の振る舞い

`legacy/header.php`・`legacy/footer.php`・`legacy/front-page.php`・`legacy/assets/js/script.js` から読み取れること。

| 部分 | 現行の実装 | 新サイトでの扱い |
|---|---|---|
| `<html>` | `lang="ja"` | 同じ |
| `<head>` | `charset=UTF-8`、`viewport` は `width=device-width, initial-scale=1.0`。`<title>` は**全ページ固定で `UNOTAME`**（`title-tag` のテーマサポートも無い）。`<meta name="description">` は**無い** | title をページ別に組み立てる。description を出す |
| OGP | `og:url`（**常にトップの URL**）・`og:type=website`・`og:title=UNOTAME`・`og:description=「あなた」のために。`・`og:image=`**`http://`**`unotame.com/wp-content/themes/unotame/assets/img/unotame-logo-square.png` | 同じ項目を出す。`og:image` は **https** の絶対 URL、`og:url` はそのページの URL に直す（L-3） |
| CSS | `destyle.css` と `style.css?v=1.2`（手動のキャッシュ対策） | `destyle.css`（npm）と `src/styles/style.scss` をレイアウトで 1 回読み込む。キャッシュ対策はビルドのハッシュ付きファイル名に任せる |
| フォント | `script.js` の末尾で **Adobe Fonts（Typekit、kit `woq0phd`）を JS で読み込み**、見出しの明朝体 `yu-mincho-pr6n` を使っている | CSS 版の埋め込みコードを `<head>` に置く（`style-migration.md` の S-1。D-012。実装前にユーザーが Adobe Fonts の管理画面を確認する前提条件つき） |
| favicon | テーマには無い（WP の「サイトアイコン」設定の有無は未確認） | P2（L-4） |
| ヘッダー | `header#header.l-header` に、ロゴ（`logo-landscape-removebg.png`、`alt="UNOTAME LOGO"`、トップへのリンク）と `nav#nav.l-header__nav > ul > li × 3`。リンクは ABOUT=`home_url()`（トップ）、WORKS=`home_url("works")`、CONTACT=`home_url("contact")`（どちらも**末尾スラッシュなし**） | ABOUT は `/#about`（D-009 / U-10）、WORKS・CONTACT は `/works/`・`/contact/` |
| ヘッダーの見た目 | 高さ 8rem・`position: fixed`・背景なし・`z-index: 99`。各項目の前に黒丸、ホバーで 105% に拡大。**SP（768px 以下）ではナビの `ul` が `display: none`**（代わりのメニューは無い） | 見た目は同じ（L-1） |
| ナビのリンクのクラス | `header__nav__list__item-link`（`l-` が抜けている。スタイルは空） | `l-header__nav__list__item-link` に直す（スタイルは空のまま） |
| 現在ページの表示 | 無い | `aria-current` を付ける（見た目は変えない。L-5） |
| `<main>` | 無い（各テンプレートがヘッダー直後に `div` / `section` を並べる）。トップの Message セクション内に `<main>` がある | レイアウトが `<main>` を 1 つ持つ（L-6） |
| フッター | `footer.l-footer > section.l-footer-contact > a[href=contact] > h2 "CONTACT"` と `div.l-footer-copy > span "© UNOTAME"`（年なし）。CONTACT は高さ 50vh の黒い帯で、ホバーで背景がグレー・文字が拡大 | 同じ。リンクは `routes.contact()` |
| JS | フッターで jQuery 3.4.1 と `script.js` を全ページに読み込む | 読み込まない。ローダーだけを素の TS で書く |
| ローダー | **トップ（`front-page.php`）にだけ** `div.loader-bg > div.loader` がある（ヘッダーの直後）。`script.js` が `window` の `load` 後に `.loader` を 600ms 待って 600ms でフェードアウト、`.loader-bg` を 900ms 待って 800ms でフェードアウト。さらに DOM 準備完了から **5 秒後には読み込み中でも** `.loader-bg` を 600ms でフェードアウト | 同じタイミングを CSS の transition で再現する。JS 無効時・`prefers-reduced-motion: reduce` 時は出さない |
| ローダーの見た目 | 全画面の `#f5f5f5` 背景、中央に直径 20px の黒丸と、広がって消える影の波紋（1.5 秒周期、3 つずらし） | 同じ（クラス名は `c-loader` に改める。`style-migration.md`） |

## データ構造案

### ファイル構成（案）

```
src/
├─ layouts/
│  └─ BaseLayout.astro            … 全ページ共通の骨格（html/head/body、Header、main、Footer、Loader の出し分け）
├─ components/
│  ├─ layout/
│  │  ├─ BaseHead.astro           … <head> の中身（meta・title・OGP・CSS・フォント）
│  │  ├─ Header.astro             … l-header（ロゴ＋ナビ）
│  │  └─ Footer.astro             … l-footer（CONTACT 導線＋コピーライト）
│  └─ common/
│     └─ Loader.astro             … c-loader（マークアップ＋フェードアウトの script）
├─ data/
│  ├─ site.ts                     … サイト共通の値（サイト名・既定の説明文・OGP 画像のパス・コピーライト）
│  └─ navigation.ts               … ナビ項目（routes.* から href を作る）
├─ lib/
│  ├─ meta.ts                     … buildPageTitle()（純粋関数・Vitest の対象）
│  └─ navigation.ts               … resolveAriaCurrent()（純粋関数・Vitest の対象）
└─ assets/images/
   └─ logo-landscape.png          … legacy/assets/img/logo-landscape-removebg.png のコピー
public/
└─ ogp.png                        … legacy/assets/img/unotame-logo-square.png のコピー（1000×1000）
```

- `components/` の下の分け方（`layout/`・`common/`）は、`top-page.md` の案（`components/top/`・`components/works/`・`components/common/`）に合わせた（L-7。D-012 で確定）。
- `src/lib/routes.ts`（url-design）が未実装の場合は、本機能の実装で url-design のシグネチャどおりに作る（`home`・`about`・`works`・`work`・`contact`・`absoluteUrl`）。

### サイト共通の値（`src/data/site.ts`）

```ts
export const site = {
  name: 'UNOTAME',
  description: '「あなた」のために。',       // 現行の og:description。ページが description を渡さないときの既定値
  locale: 'ja',
  ogLocale: 'ja_JP',                          // og:locale の値（2026-10-27 実装時に追加）
  ogImagePath: '/ogp.png',                    // public/ に置く。absoluteUrl() で https の絶対 URL にして出す
  copyright: '© UNOTAME',                     // 現行どおり年は入れない
} as const;
```

### ナビ項目（`src/data/navigation.ts`）

```ts
import { routes } from '../lib/routes';

export type NavItem = {
  key: 'about' | 'works' | 'contact';
  label: string;   // 表示文字列（現行どおり大文字）
  href: string;    // routes.* で作る。直書きしない
};

export const globalNav: readonly NavItem[] = [
  { key: 'about', label: 'ABOUT', href: routes.about() },     // '/#about'
  { key: 'works', label: 'WORKS', href: routes.works() },     // '/works/'
  { key: 'contact', label: 'CONTACT', href: routes.contact() }, // '/contact/'
];
```

### 純粋関数（`src/lib/`）

```ts
// src/lib/meta.ts
/** ページ名があれば「{ページ名} | UNOTAME」、無ければ（トップ）「UNOTAME」。前後の空白は除く。空文字は「無し」扱い */
export function buildPageTitle(pageTitle?: string, siteName?: string /* 既定 site.name */): string;

// src/lib/navigation.ts
/**
 * リンク先と現在のパスから aria-current の値を決める。
 * - href に '#' か '?' を含む（ページ内リンク・クエリ付き）→ undefined（ABOUT は常に付けない）
 * - pathname を末尾スラッシュありに正規化（'/works' → '/works/'、'/404.html' はそのまま）
 * - pathname === href → 'page'
 * - href !== '/' かつ pathname が href で始まる（例 '/works/foo/'）→ 'true'（その区画の中にいる）
 * - それ以外 → undefined
 */
export function resolveAriaCurrent(href: string, pathname: string): 'page' | 'true' | undefined;
```

### props

```ts
// BaseLayout.astro
type Props = {
  title?: string;        // ページ名。未指定ならサイト名だけ（トップ）。組み立ては buildPageTitle()
  description?: string;  // 未指定なら site.description
  noindex?: boolean;     // 既定 false。404 で true
  loader?: boolean;      // 既定 false。トップだけ true（現行どおり）
};
// スロット: 既定スロット = <main> の中身 / 名前付きスロット "head" = ページ固有の <head> 要素（P2 の構造化データなどの受け口）

// BaseHead.astro
type Props = { title: string /* 組み立て済み */; description: string; noindex: boolean; pathname: string };

// Header.astro / Footer.astro
type Props = { pathname: string };   // BaseLayout が Astro.url.pathname を渡す（aria-current の判定用）

// Loader.astro
type Props = Record<string, never>;  // props なし
```

## 振る舞い

### ページの骨格（`BaseLayout.astro`）
- frontmatter で `import 'destyle.css';` → `import '../styles/style.scss';` の順に読み込む（この順で CSS が出力されること。`style-migration.md`）。
  これに伴い、仮ページ `src/pages/index.astro` の `import '../styles/style.scss'` はレイアウトへ移す。
- 出力する骨格:

```html
<!doctype html>
<html lang="ja">
  <head>…BaseHead…<slot name="head" /></head>
  <body>
    <!-- loader=true のときだけ --> <Loader />
    <Header pathname={Astro.url.pathname} />
    <main id="main"><slot /></main>
    <Footer pathname={Astro.url.pathname} />
  </body>
</html>
```

- `<main>` はページに 1 つだけ。各ページはこの中に書く（トップの Message 内の `<main>` は `<div>` に変える。`top-page.md` で確定。L-6）。
- ヘッダーは固定表示（高さ 8rem）なので、`/#about` などのアンカーで飛んだ先が隠れないよう、`style-migration.md` で
  `html { scroll-padding-top: 8rem; }` を入れる（現行には無い追加。見た目は変わらない）。

### `<head>` の共通部分（`BaseHead.astro`）
出力順と中身:

| 順 | 要素 | 値・規則 |
|---|---|---|
| 1 | `<meta charset="utf-8">` | 先頭に置く |
| 2 | `<meta name="viewport" content="width=device-width, initial-scale=1">` | 現行と同じ意味（`1.0` と `1` は同じ） |
| 3 | `<title>` | `buildPageTitle(title)`。区切りは半角スペース＋`\|`＋半角スペース。例: `WORKS \| UNOTAME`、トップは `UNOTAME` |
| 4 | `<meta name="description">` | `description ?? site.description`。現行は無かった項目 |
| 5 | `<meta name="robots" content="noindex">` | `noindex` が true のときだけ（404） |
| 6 | OGP（最小限。L-3） | `og:type=website`、`og:site_name=UNOTAME`、`og:title`＝3 と同じ文字列、`og:description`＝4 と同じ、`og:url`＝`absoluteUrl(pathname)`（**noindex のページでは出さない**）、`og:image`＝`absoluteUrl(site.ogImagePath)`（`https://unotame.com/ogp.png`）、`og:locale=ja_JP` |
| 7 | Adobe Fonts の `<link rel="stylesheet">` | `<link rel="stylesheet" href="https://use.typekit.net/woq0phd.css">`（`style-migration.md` の S-1。D-012） |
| 8 | ページ固有（`head` スロット） | P1 では使わない |

- **現行の `og:image` が `http://` になっている点を直す**。`og:image` は絶対 URL が必要で、http のままだと https のページから
  混在コンテンツ扱いになったり、SNS 側で取得できなかったりする。新サイトは `absoluteUrl()`（`https://unotame.com` 固定）で作るので常に https になる。
- 現行の OGP 画像 URL（`/wp-content/themes/unotame/assets/img/unotame-logo-square.png`）を本番切替後も残すかは url-design の U-11（本書では扱わない）。
- canonical・favicon・Twitter Card・ページ別の OGP 画像は出さない（P2「SEO / OGP」）。
- ページ名（`title` props）の値は各ページ仕様で決める。承認済みの各ページ仕様は現行の h1 に合わせている（L-8。D-012）。`/contact/` は Contact 仕様で決める:

| ページ | `title` props の例 | `<title>` |
|---|---|---|
| `/` | （渡さない） | `UNOTAME` |
| `/works/` | `記事・実績一覧`（現行の h1） | `記事・実績一覧 \| UNOTAME` |
| `/works/{slug}/` | 実績のタイトル | `{実績のタイトル} \| UNOTAME` |
| `/contact/` | `お問い合わせ`（現行の h1。Contact 仕様で確定） | `お問い合わせ \| UNOTAME` |
| 404 | `ページが見つかりません`（`not-found.md`） | `ページが見つかりません \| UNOTAME` |

### ヘッダー（`Header.astro`）

```html
<header class="l-header">
  <a href="/" class="l-header__logo">
    <img class="l-header__logo-img" src="/_astro/…" alt="UNOTAME" width="1000" height="400" loading="eager" decoding="async">
  </a>
  <nav class="l-header__nav" aria-label="メイン">
    <ul class="l-header__nav__list">
      <li class="l-header__nav__list__item"><a class="l-header__nav__list__item-link" href="/#about">ABOUT</a></li>
      <li class="l-header__nav__list__item"><a class="l-header__nav__list__item-link" href="/works/" aria-current="page">WORKS</a></li>
      <li class="l-header__nav__list__item"><a class="l-header__nav__list__item-link" href="/contact/">CONTACT</a></li>
    </ul>
  </nav>
</header>
```

- ロゴは `src/assets/images/logo-landscape.png` を `astro:assets` の `<Image>` で出す（`style-migration.md` の S-7）。
  - `alt` は `UNOTAME`（リンクの名前になるため。現行の「UNOTAME LOGO」から「LOGO」を外す）。
  - `<Image>` は既定で `loading="lazy"` になるので、**ファーストビューにあるロゴは `loading="eager"` を指定**する。
  - サイズ指定は P1 では元画像の寸法（1000×400）のまま。表示サイズに合わせた縮小・`srcset` は P2。
- ロゴのリンク先は `routes.home()`。
- ナビは `globalNav` を `map` して出す。`aria-current` は `resolveAriaCurrent(item.href, pathname)` の値（undefined なら属性を出さない）。
  - `/works/` では WORKS に `aria-current="page"`、`/works/{slug}/` では WORKS に `aria-current="true"`、`/contact/` では CONTACT に `page`。
  - ABOUT（`/#about`）には付けない。トップ・404 ではどの項目にも付かない。
  - 現在ページの見た目上の強調は P1 では付けない（現行に無いため。L-5）。
- 現行の `id="header"`・`id="nav"` は CSS・JS から使われていないので付けない。
- SP（768px 以下）でナビが消える現行の振る舞いはそのまま（L-1）。

### フッター（`Footer.astro`）

```html
<footer class="l-footer">
  <section class="l-footer-contact">
    <a href="/contact/"><h2>CONTACT</h2></a>
  </section>
  <div class="l-footer-copy"><span>© UNOTAME</span></div>
</footer>
```

- CONTACT のリンクは `routes.contact()`。`/contact/` 上ではこのリンクにも `aria-current="page"` を付ける（`resolveAriaCurrent` を共用）。
- コピーライトは `site.copyright`。
- `<a>` の中に `<h2>` を入れる現行の構造は HTML として正しいので変えない（見た目の再現を優先）。

### ローダー（`Loader.astro`。トップだけ）
- `BaseLayout` の `loader` props が true のときだけ、`<body>` の先頭に出す（現行どおりトップだけ。他のページには要素も script も出さない）。
- マークアップ:

```html
<div class="c-loader" data-loader aria-hidden="true">
  <div class="c-loader__dot"></div>
</div>
```

- JS 無効時用のスタイルは、`BaseLayout.astro` の **`<head>` の中**に `{loader && <noscript><style is:inline>.c-loader { display: none !important; }</style></noscript>}` として置く
  （HTML の仕様では `<style>` は `<head>` 内にしか置けないため。2026-10-27 レビュー指摘 L-2 で `<body>` から移動）。

- **タイミング（現行の再現）**: 状態はクラスで表し、時間は CSS の `transition` で持つ。

| 契機 | JS がすること | CSS（`object/component/_loader.scss`） |
|---|---|---|
| `window` の `load`（script 実行時に `document.readyState === 'complete'` なら即時） | ルートに `is-loaded` を付ける | `.is-loaded .c-loader__dot`: `opacity: 0`、600ms・遅延 600ms。`.c-loader.is-loaded`: `opacity: 0`、800ms・遅延 900ms、`pointer-events: none`（フェード中も下の要素を操作できる） |
| script 実行から 5,000ms 経っても `is-loaded` でない | `is-timeout` を付ける | `.c-loader.is-timeout`: `opacity: 0`、600ms・遅延なし、`pointer-events: none` |
| ルートの `opacity` の `transitionend`（取りこぼし対策で、`is-loaded` 後 1,800ms / `is-timeout` 後 700ms のタイマーも併用） | `hidden` 属性を付ける | `.c-loader[hidden] { display: none; }`（`.c-loader { display: flex }` が UA の `hidden` に勝つので明示する） |

- **script**: `Loader.astro` の中の `<script>`（Astro が処理・バンドルするモジュール）で書く。jQuery は使わない。数十行程度の素の TS。
  - モジュール script は HTML の解析後に実行されるため、実行時点で `load` が終わっている場合を `document.readyState` で必ず拾う。
- **JS が無効のとき**: `<noscript>` 内のスタイルでローダーを最初から出さない（ページは普通に見える）。
  - `<noscript>` 内の `<style>` は Astro に処理（スコープ化・移動）されないよう **`is:inline` を付ける**。
- **JS が途中で失敗したとき（保険）**: `.c-loader` に、7 秒後に `visibility: hidden; opacity: 0; pointer-events: none` にする CSS アニメーション
  （`animation: c-loader-failsafe 0s 7s forwards`）を付けておく。load が来なければ 5 秒で消え始めて 5.6 秒で消え終わり、
  load が遅れて来た場合も、ほぼ 7 秒までに通常のフェードが終わる（2026-10-27 レビュー指摘 L-1 で 6 秒から変更。6 秒では遅い load のフェードの途中で保険が効いてしまうため）。
- **`prefers-reduced-motion: reduce` のとき**: ローダーを出さない（`@media (prefers-reduced-motion: reduce) { .c-loader { display: none; } }`）。
  ローダーは装飾で、波紋のアニメーションと待ち時間の両方が動きを減らしたい利用者の負担になるため（L-2）。
- 支援技術: `aria-hidden="true"`。フォーカスを受ける要素は置かない。
- ローダーの下のページは最初から描画されている（ローダーは上に重ねているだけ）。ローダーが消えるまでの間、ページの読み上げ・スクロールは妨げない。

### 画像資産
- `legacy/assets/img/logo-landscape-removebg.png` → `src/assets/images/logo-landscape.png`（コピー。`legacy/` の原本は残す）。
- `legacy/assets/img/unotame-logo-square.png` → `public/ogp.png`（コピー。固定 URL が要るため `public/`。project-foundation の割り当てどおり）。

## 受け入れ条件

前提: `CMS_SOURCE=fixture npm run build` の成果物（`dist/`）で判定する。ブラウザ確認は `npm run build && npm run preview`。

### ユニットテスト（Vitest）
- [ ] `buildPageTitle()` が `UNOTAME`、`buildPageTitle('WORKS')` が `WORKS | UNOTAME`、`buildPageTitle('  ')` と `buildPageTitle('')` が `UNOTAME` を返す。
- [ ] `resolveAriaCurrent` が次を返す: (`/works/`, `/works/`) → `page`、(`/works/`, `/works`) → `page`、(`/works/`, `/works/foo/`) → `true`、
      (`/contact/`, `/contact/`) → `page`、(`/#about`, `/`) → undefined、(`/works/`, `/`) → undefined、(`/works/`, `/worksx/`) → undefined、
      (`/works/`, `/404`) → undefined、(`/contact/`, `/404.html`) → undefined。
- [ ] `globalNav` の `href` が順に `/#about`・`/works/`・`/contact/` で、`routes.*` から作られている（`src/data/navigation.ts` に `'/works/'` などの直書きが無い）。

### ビルド成果物（`dist/` の HTML を検査）
- [ ] すべての HTML が `<html lang="ja">` で、`<head>` の先頭が `<meta charset="utf-8">`、`<meta name="viewport" content="width=device-width, initial-scale=1">` を持つ。
- [ ] `dist/index.html` の `<title>` が `UNOTAME`、ほかのページの `<title>` が `{ページ名} | UNOTAME` の形。
- [ ] すべての HTML に `<meta name="description">` があり、中身が空でない。description を渡さないページは `「あなた」のために。`。
- [ ] すべての HTML の `og:image` が `https://unotame.com/ogp.png` で、`http://` で始まる `og:image` がどこにも無い。`dist/ogp.png` が存在する。
- [ ] `og:url` が各ページの絶対 URL（例 `dist/works/index.html` は `https://unotame.com/works/`）。`dist/404.html` には `og:url` が無く、`<meta name="robots" content="noindex">` がある。ほかのページには `noindex` が無い。
- [ ] すべてのページに `header.l-header`・`main` がちょうど 1 つ・`footer.l-footer` がある。
- [ ] ヘッダーのナビのリンクが順に `/#about`・`/works/`・`/contact/`、フッターの CONTACT が `/contact/`、ロゴのリンクが `/`。
- [ ] `aria-current`: `dist/works/index.html` は WORKS が `page`、`dist/works/{slug}/index.html` は WORKS が `true`、`dist/contact/index.html` はヘッダーとフッターの CONTACT が `page`、
      `dist/index.html` と `dist/404.html` には `aria-current` が無い。
- [ ] ロゴの `<img>` が `alt="UNOTAME"`・`loading="eager"`・`width`・`height` を持ち、`src` が `/_astro/` で始まる。
- [ ] `.c-loader` 要素とローダーの script は `dist/index.html` にだけあり、ほかの HTML には無い。`dist/index.html` の `.c-loader` は `aria-hidden="true"` を持ち、`<head>` 内の `<noscript>` に `.c-loader` を隠すスタイルがある（ほかの HTML には無い）。
- [ ] `dist/` のどこにも `jquery` という文字列（ファイル名・`src`）が無い。

### ブラウザ確認（`npm run preview`。手動、または Playwright）
- [ ] `/` を開くと、ローダー（黒丸の波紋）が出て、読み込み完了から約 1.7 秒以内に消え、その後 `.c-loader` が `hidden` になっている。消えたあとロゴ・ナビをクリックできる。
- [ ] 画像の応答を止めて `load` が起きない状態にしても、ローダーは 7 秒以内に消える（Playwright なら `page.route` で画像を保留にして確認）。
- [ ] JavaScript を無効にして `/` を開くと、ローダーは一度も表示されず、ページが見える。
- [ ] DevTools の Rendering で `prefers-reduced-motion: reduce` をエミュレートすると、ローダーは表示されない。
- [ ] `/works/` から ABOUT を押すと `/#about` に移動し、About の見出しが固定ヘッダーに隠れない。
- [ ] ヘッダー・フッターの見た目（ロゴの高さ、黒丸付きのナビ、ホバーの拡大、CONTACT 帯の高さとホバー、コピーライト）が現行サイトと同じ（比較の手順と画面幅は `style-migration.md`）。
- [ ] 768px 以下ではナビが表示されない（現行どおり。L-1）。

### 品質
- [ ] `npm run lint`・`npm run check`・`npm test`・`npm run build` が通る。

## 将来拡張（任意）
- P2「SEO / OGP」: canonical（`absoluteUrl(routes.*)`）、ページ別 OGP 画像（実績のアイキャッチ）、`og:type=article`（実績詳細）、Twitter Card、favicon 一式、構造化データ（`head` スロットを使う）。
- P2「パフォーマンス / a11y」: スキップリンク（「本文へ移動」→ `#main`）、SP のナビ（ハンバーガー等）、現在ページの見た目上の強調、ロゴの `widths`/`srcset`。
- P2 デザイン刷新: ローダー自体の要否（design-policy の改善候補）。廃止する場合は `loader` props と `Loader.astro` を消すだけで済む。

## 未決事項

2026-10-27 にすべて推奨どおりで決定した（D-012）。

| ID | 内容 | 決定 |
|---|---|---|
| L-1 | SP（768px 以下）でヘッダーのナビが消え、代わりのメニューが無い（現行どおり）。SP では WORKS への導線がトップの「View More」だけになる | **決定（D-012）**: P1 は現行どおり非表示。SP のナビは P2 のデザイン刷新・a11y で作る |
| L-2 | ローダーの扱い（トップだけに出す／JS 無効と `prefers-reduced-motion: reduce` では出さない／5 秒の上限と CSS の保険） | **決定（D-012）**: 本書のとおり |
| L-3 | P1 で OGP をどこまで出すか | **決定（D-012）**: 現行と同じ項目（＋ `og:site_name`・`og:locale`）を出し、`og:image` を https に、`og:url` をページごとの URL に直す |
| L-4 | favicon | **決定（D-012）**: P2「SEO / OGP」。P1 では `<link rel="icon">` を出さない。本番の WP にサイトアイコンが設定されているか（`https://unotame.com/favicon.ico` などが返るか）は P2 着手時に確認する |
| L-5 | `aria-current` の値（完全一致は `page`、実績詳細で WORKS は `true`）と、見た目の強調を P1 で付けないこと | **決定（D-012）**: 本書のとおり |
| L-6 | レイアウトが `<main>` を持つことで、トップの Message 内の `<main>` を `<div>` に変える | **決定（D-012）**: `top-page.md` の承認で確定。セレクタの書き換えは `style-migration.md` の S-9 |
| L-7 | コンポーネントのディレクトリ名 | **決定（D-012）**: 本書と `top-page.md` の構成（`components/layout/`・`common/`・`top/`・`works/`）で確定 |
| L-8 | ページ名（`title` props）の値。現行の h1 に合わせるか、ナビの表記（`WORKS`・`CONTACT`）に合わせるか | **決定（D-012）**: 現行の h1 に合わせる（`記事・実績一覧`・`ページが見つかりません`・実績のタイトル。各ページ仕様に記載）。`/contact/` の値は Contact 仕様で決める |
