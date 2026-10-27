# 機能仕様: トップページ（top-page）

> 状態: **承認済み（2026-10-27、推奨どおり。decisions-log D-012）**。`url-design.md`（D-009）・`cms-integration.md`（D-010）・`project-foundation.md`（D-011）を前提とする。
> `Profile` 型と受け入れ条件の文言は、本書の承認に合わせて cms-integration 側を更新した（T-6・T-7）。
> 共通レイアウト（ヘッダー・フッター・ローダー・`<head>`）は `layout.md`、スタイル（クラス名・SCSS の移植）は `style-migration.md` に従う（どちらも承認済み・D-012）。
> **ユーザー側の宿題**: About の最新の経歴文（T-1）。届くまでは現行の文を転記する。

## 目的
- 訪問者が最初に見るページとして、**人物（名前・肩書き・スキル）→ メッセージ → 最新の実績 → 自己紹介と SNS** を現行どおりの順で届ける。
- 現行 `front-page.php` に直書きされている文言を `src/data/profile.ts` に移し、**実績は CMS、人物情報はリポジトリ内データ**という出どころの分離（D-010）を
  ページの構造でも守る。
- 実績カードを、Works 一覧・Works 詳細（Latest）と**共通のコンポーネント**にして、見た目とリンク規則を 1 か所で保つ。

## スコープ（対象フェーズ）
- **P1（本書の主対象）**
  - `src/pages/index.astro`（URL `/`）と、セクションごとのコンポーネント（KV / Message / Works / About）。
  - `src/data/profile.ts` の中身と型（`cms-integration.md` の `Profile` 型案の具体化）。
  - 共通の実績カード `WorkCard`（本書で定義し、`works-list.md`・`works-detail.md` から使う）と「View More」リンク。
  - About セクションの `id="about"`（ヘッダーの ABOUT → `/#about`。url-design U-10）。
  - SNS リンクの `rel`・新しいタブの扱い、画像の `alt`、見出し構造などの最低限の a11y。
- **P2**: デザイン刷新（余白・アニメーション）、OGP・`<title>`・`description`（「SEO / OGP」）、画像の `srcset`・astro:assets 化の判断（「パフォーマンス / a11y」）。
- **含まない**: ヘッダー・フッター・ローダー（`layout.md`）、SCSS の移植方法（`style-migration.md`）、プロフィールの CMS 化（`cms-integration.md` の将来拡張）。

## 現行（WordPress）の振る舞い
`legacy/front-page.php`・`legacy/assets/css/Object/Project/_front-page.scss` より。

| セクション | 現行のマークアップ・内容 | 気になる点 |
|---|---|---|
| ローダー | `front-page.php` の先頭に `.loader-bg > .loader`（**トップにだけ**ある）。`script.js` の jQuery でフェードアウト | 扱いは `layout.md` に委ねる |
| KV `.p-front-page-kv` | `<h1>Niiyama Keisuke</h1>`、`<span>full-stack web engineer</span>`、`<ul>` にスキル 9 項目（サイトコーディング / WordPress構築 / フロントエンド構築 / バックエンド構築 / API構築 / Webライティング / 広告運用 / ディレクション / システム設計） | 肩書きが `<span>` |
| Message `.p-front-page-message` | `<h2>Message</h2>`、その中に **`<main>`**、`<h3>ただ、"アナタ"のために。</h3>`、`<p>` に 5 行＋空行（`<br>` 区切り）、署名を **`<aside>`** で `UNOTAME - 新山慶介` | セクション内の `<main>`（ページに 1 つであるべき）と、署名に `<aside>` は意味が合わない |
| Works `.p-front-page-works` | `<h2>WORKS</h2>`、`WP_Query`（`posts_per_page: 6`、投稿日の新しい順）でカード 6 件。カードは `<li><a><img alt=""><div><h3>タイトル</h3><span>カテゴリ名</span></div></a></li>`。0 件なら `<li>` に「お知らせはまだ登録されておりません。」。最後に `View More`（`home_url('works')` = `/works`） | カード画像の alt は空。カテゴリは先頭 1 件 |
| About `.p-front-page-about` | `<h2>ABOUT</h2>`、`profile.png`（alt 空）、`<h3>新山 慶介</h3>`、`<span>Niiyama Keisuke</span>`、`<p>` に 3 行（「2021年より…」「2023年に…」「**2024年現在**、会社員 兼 フリーランスとして…」）、SNS 5 件（X / Zenn / Qiita / note / GitHub）。各リンクは `target="_blank"` で **`rel` なし**、アイコン画像の alt は空 | セクションに `id` が無い（ABOUT ナビはトップへのリンクのみ）。SNS リンクに名前が無い（読み上げで区別できない） |

カードのホバー表現（PC）: 画像の上に黒 80% の帯が `opacity: 0 → 1` で出て、タイトルとカテゴリが見える。スマホでは画像の下に常時表示。
同じスタイルが `_front-page.scss`・`_works.scss`・`_work-detail.scss` に 3 回コピーされている。

## データ構造案

### データの出どころ

| セクション | 出どころ | 取得関数 |
|---|---|---|
| KV（名前・肩書き・スキル） | `src/data/profile.ts` | `getProfile()`（`src/lib/profile.ts`） |
| Message | `src/data/profile.ts` | `getProfile()` |
| Works 最新 6 件 | microCMS（`works`） | `getLatestWorks(6)`（`src/lib/cms`） |
| About（プロフィール・SNS） | `src/data/profile.ts` ＋ `src/assets/images/` の画像 | `getProfile()` |

ページ（`index.astro`）は上の 2 関数だけを呼び、コンポーネントには**ドメイン型の値を props で渡す**。コンポーネントは CMS もデータファイルも import しない。

### `Profile` 型（`src/lib/domain/profile.ts`。cms-integration の案を具体化）

```ts
import type { ImageMetadata } from 'astro';

export type SocialLink = {
  id: 'x' | 'zenn' | 'qiita' | 'note' | 'github'; // 並び・テスト用の識別子
  label: string;          // サービス名。リンクのアクセシブルネームに使う（例 'X'）
  url: string;            // https の絶対 URL
  icon: ImageMetadata;    // src/assets/images/sns/ の画像を import した値（T-6。cms-integration も 2026-10-27 に合わせた）
};

export type Profile = {
  kv: {
    name: string;         // 'Niiyama Keisuke'（ページの h1）
    role: string;         // 'full-stack web engineer'
    skills: string[];     // 9 項目。表示順どおり
  };
  message: {
    heading: string;      // 'ただ、"アナタ"のために。'
    lines: string[];      // 1 要素 = 1 行。'' は空行（現行の <br><br>）
    signature: string;    // 'UNOTAME - 新山慶介'
  };
  about: {
    nameJa: string;       // '新山 慶介'
    nameEn: string;       // 'Niiyama Keisuke'
    bio: string[];        // 1 要素 = 1 行（現行は 3 行）
    photo: { src: ImageMetadata; alt: string }; // profile.png（T-6。cms-integration も 2026-10-27 に合わせた）
  };
  socials: SocialLink[];  // X / Zenn / Qiita / note / GitHub の順
};
```

- 文言はすべて**プレーンテキスト**で持ち、HTML を含めない（`set:html` を使わない。表示側で改行を `<br>` にする）。
- `src/data/profile.ts` は `satisfies Profile` で型を当てる。画像は `import xLogo from '../assets/images/sns/logo-black.png'` のように import する
  （ファイルが無ければビルドが失敗する）。
- 初期値（現行からの転記）:

| 項目 | 値 |
|---|---|
| `kv.name` / `kv.role` | `Niiyama Keisuke` / `full-stack web engineer` |
| `kv.skills` | サイトコーディング、WordPress構築、フロントエンド構築、バックエンド構築、API構築、Webライティング、広告運用、ディレクション、システム設計 |
| `message.lines` | `"アナタ"のビジネスをもっと多くの人に。` / `"アナタ"の考えがすぐにカタチにできるように。` / `"アナタ"の笑顔がずっと続くように。` / `''` / `私は、"アナタ"に合わせた、` / `最適なWebソリューションを提供しています。` |
| `about.bio` | `2021年よりWeb系フリーランスとして活動。` / `2023年にWebディレクターとして制作会社へ就職。` / `2024年現在、会社員 兼 フリーランスとしてIT全般の業務に従事。`（**3 行目は最新の経歴文に差し替える。ユーザーからの受け取り待ち。T-1**） |
| `about.photo` | `src/assets/images/profile.png`、alt は `新山 慶介`（T-3。D-012） |
| `socials` | X `https://x.com/niiyamakeisuke/`（`logo-black.png`）、Zenn `https://zenn.dev/niiyama_k`（`logo-only.svg`）、Qiita `https://qiita.com/unotame/`（`qiita-icon.png`）、note `https://note.com/unotame/`（`square.svg`）、GitHub `https://github.com/mkrms`（`github-mark.png`） |

※ 現行の「"アナタ"が笑顔がずっと続くように。」は誤記のため、「"アナタ"の笑顔がずっと続くように。」に直す（T-2、2026-10-27 ユーザー確認）。

### コンポーネント構成（案）

```
src/pages/index.astro                 … getProfile() と getLatestWorks(6) を呼び、各セクションへ渡す
src/components/top/TopKv.astro        … props: { kv: Profile['kv'] }
src/components/top/TopMessage.astro   … props: { message: Profile['message'] }
src/components/top/TopWorks.astro     … props: { works: Work[] }（WorkCard と ViewMoreLink を使う）
src/components/top/TopAbout.astro     … props: { about: Profile['about']; socials: SocialLink[] }
src/components/works/WorkCard.astro   … 共通の実績カード（下記。一覧・詳細でも使う）
src/components/common/ViewMoreLink.astro … props: { href: string }。現行 .c-btn-view-more
```
クラス名（`p-front-page-*`・`c-*`）とファイル内の `<style>` の有無は `style-migration.md` に従う。

### 共通コンポーネント `WorkCard`（トップ・一覧・詳細の Latest で共通）

現行の 3 つのカード（`p-front-page-works`・`p-works__body`・`p-work-detail__latest`）は**マークアップも見た目も同じ**で、違いはグリッド（列数）だけ。
そこで**カード 1 枚分**を共通コンポーネントにし、並べ方（`<ul>` のグリッド）は各ページの Project 側に残す。

```ts
// WorkCard.astro の props（案）
type Props = {
  work: Work;                 // ドメイン型（cms-integration）
  headingLevel?: 2 | 3;       // 既定 3。一覧ページ（h1 の直下に並ぶ）では 2
};
```

出力するマークアップ（`<li>` は呼び出し側が持つ。一覧では `<li>` に `data-category` を付けるため）:

```html
<a class="c-work-card" href="/works/{slug}/">
  <img class="c-work-card__img" src="{cmsImageUrl(thumbnail, { width: 800, format: 'webp' })}"
       width="{thumbnail.width}" height="{thumbnail.height}" alt="" loading="lazy" decoding="async">
  <div class="c-work-card__detail">
    <h3 class="c-work-card__title">{title}</h3>
    <span class="c-work-card__category">{category.name}</span>
  </div>
</a>
```

- `href` は `routes.work(work.slug)` で作る（直書きしない。url-design）。
- 画像 URL は `cmsImageUrl()`（cms-integration）。P1 は幅 800・WebP の 1 種類。`srcset` は P2。
- **画像の `alt` は空**にする。リンクの中に作品名（見出し）とカテゴリ名が文字であり、画像に同じ説明を付けると読み上げが重複するため（装飾扱い）。
  CMS で代替テキストを入れられる場合（cms-integration C-8）でも、カードでは使わない。
- `width`・`height` を必ず出す（レイアウトのずれ防止。CSS 側で `aspect-ratio: 3/2` と `object-fit: cover` にする。`style-migration.md`）。
- 見出しレベルは `headingLevel` で切り替える（トップ・詳細の Latest は `h2` セクションの中なので `h3`、一覧は `h2`）。
- **要件（スタイルは `style-migration.md` に委ねる）**: PC でタイトル帯がホバー時だけ見える現行の表現を引き継ぐ場合、**キーボードのフォーカス時（`:focus-visible`）にも
  同じように表示**すること。帯の `transform: scale(90%)` などの動きは `prefers-reduced-motion: reduce` で止めること。

## 振る舞い

### ページ全体
- ページは `layout.md` の `BaseLayout` を使う。props は `title` を**渡さない**（`<title>` はサイト名 `UNOTAME` だけ）、`loader: true`（ローダーは現行どおりトップだけ。挙動は `layout.md`）。
  `description` などの値は `layout.md` / P2「SEO / OGP」に従う。
- ページ本文は共通レイアウトの `<main>` の中に入る前提。**Message 内の `<main>` は使わず `<div>` にする**（`<main>` はページに 1 つ）。
- セクションの順序は現行どおり: KV → Message → Works → About。
- 見出し構造: `h1`（KV の名前）は**ページに 1 つ**。各セクションは `h2`（`Message` / `WORKS` / `ABOUT`）、その下を `h3` にする。
- 各セクションは `<section aria-labelledby="{見出しの id}">` とし、見出しに固定の id を付ける（`top-message-heading`・`top-works-heading`・`top-about-heading`）。
  支援技術でセクションに名前が付くことと、ビルド成果物のテストでセクションを特定できることが目的。KV は `<section aria-labelledby="top-kv-heading">`（h1 に id）。

### KV（`TopKv`）
- `<h1 id="top-kv-heading">{kv.name}</h1>`、肩書きは `<p>{kv.role}</p>`（現行の `<span>` を段落にする）、スキルは `<ul>` に `<li>` を `skills` の順で並べる。
- テキストは Astro の通常の式展開（自動エスケープ）で出す。

### Message（`TopMessage`）
- `<h2 id="top-message-heading">Message</h2>` → `<div>` の中に `<h3>{heading}</h3>`、`<p>`（`lines` を `<br>` でつなぐ。`''` の行は空行になる）、署名 `<p>{signature}</p>`。
  - 現行の `<aside>` は使わない（補足情報ではなく本文の署名のため）。見た目は現行（右寄せ・Objective）を `style-migration.md` で再現する。
- 文言に含まれる `"` などはエスケープされて出る（HTML として解釈しない）。

### Works（`TopWorks`）
- `index.astro` で `getLatestWorks(6)` を呼び、`date` 降順（cms-integration）の先頭 6 件を渡す。6 件未満なら全件。
- `<h2 id="top-works-heading">WORKS</h2>` → `<ul>` の各 `<li>` に `WorkCard`（`headingLevel` 3）→ `ViewMoreLink`（`href = routes.works()` = `/works/`）。
- 0 件のとき: `<ul>` を出さず `<p>` で空のメッセージ「実績はまだ登録されていません。」を出す（T-4。D-012。`<ul>` の中に説明文の `<li>` を置く現行の形はやめる）。
  `View More` は 0 件でも出す。なお本番ビルドでは works 0 件はエラーになる（cms-integration C-12）ので、0 件表示は開発時だけ起こる。

### About（`TopAbout`）
- `<section id="about" aria-labelledby="top-about-heading">` とする（ヘッダーの ABOUT `/#about` の着地点。url-design U-10）。
  ヘッダーが固定表示になる場合の `scroll-margin-top` は `layout.md` / `style-migration.md` で扱う。
- プロフィール写真は `astro:assets` の `<Image>` で出す（`profile.png` は約 1MB のため。project-foundation の割り当てどおり）。
  表示は 150px 角（現行 `15rem`）なので `width={300} height={300}`（2 倍密度）、`alt = about.photo.alt`。
- `<h3>{nameJa}</h3>`、英名は `<p>`（または `<span>`。現行の並び〈和名の横に英名〉を保てる方。`style-migration.md` と合わせる）、`bio` は `<p>` に `<br>` 区切り。
- SNS リンク（`socials` の順）:
  ```html
  <ul class="…__logos">
    <li><a href="https://x.com/niiyamakeisuke/" target="_blank" rel="noopener" aria-label="X（新しいタブで開きます）">
      <img src="…" width="60" height="60" alt=""></a></li>
    …
  </ul>
  ```
  - **`rel="noopener"` を付ける**（現行の不足を直す）。今のブラウザは `target="_blank"` で暗黙に noopener になるが、明示しておく。
    `noreferrer` は付けない（自分の SNS へのリンクで、参照元を隠す理由が無い）。
  - **新しいタブで開く挙動は現行どおり残す**（T-5。D-012）。そのうえで、アイコンだけのリンクに名前が無い現行の問題を直し、
    `aria-label="{label}（新しいタブで開きます）"` を付け、アイコン画像の `alt` は空にする（名前の二重読み上げを避ける）。
  - 現行は `<div>` に `<a>` を並べていたが、リンクの集合なので `<ul>`/`<li>` にする。
  - アイコンも `<Image>` で出す（表示 30px → `width={60} height={60}`）。SVG（Zenn・note）はそのまま出る。

### 画像の alt（まとめ）
| 画像 | alt | 理由 |
|---|---|---|
| 実績カードのサムネイル | `''` | 同じリンク内に作品名とカテゴリ名の文字がある |
| プロフィール写真 | `about.photo.alt`（`新山 慶介`。T-3） | 人物写真は情報を持つ。隣に名前の見出しがあるので短くする |
| SNS アイコン | `''` | リンク側の `aria-label` で名前を付ける |

## 受け入れ条件

前提: `CMS_SOURCE=fixture npm run build` の成果物（`dist/index.html`）と Vitest で判定する。期待値はハードコードせず、
**フィクスチャを `loadContent(fixtureSource, config)` に通した結果**と `getProfile()` の値から作る（データを変えてもテストが追従する）。
HTML の検査方法は X-1（`node-html-parser` と `test:dist`。D-012 で決定）。

### データ（Vitest）
- [ ] `getProfile()` の `kv.skills` が 9 件で、上の表の順・文言と一致する。
- [ ] `getProfile().socials` が 5 件で、`id` が `x, zenn, qiita, note, github` の順。`url` はすべて `https://` で始まり、`label` は空でなく重複しない。
- [ ] `src/data/profile.ts` が `Profile` 型を満たす（`npm run check` が通る）。

### KV・Message（`dist/index.html`）
- [ ] `<h1>` がちょうど 1 つで、テキストが `kv.name`（`Niiyama Keisuke`）。
- [ ] KV のセクション（`aria-labelledby="top-kv-heading"`）に `kv.role` の文言と、スキルの `<li>` が 9 個、`skills` の順で含まれる。
- [ ] Message のセクション（`aria-labelledby="top-message-heading"`）に `<h3>` の `heading`、`lines` の各行（空行を除く）、`signature` が含まれる。
      `lines` の空行の位置で `<br>` が 2 つ続く。
- [ ] ページ内に `<main>` が 2 つ以上無い（共通レイアウトの 1 つだけ）。`<aside>` が Message セクション内に無い。

### Works（`dist/index.html`）
- [ ] Works のセクション（`aria-labelledby="top-works-heading"`）の実績リンクが、フィクスチャの全実績を `date` 降順に並べた**先頭 6 件**と同じ順で並び、
      各 `href` が `/works/{slug}/`。
- [ ] 各カードに作品名（`<h3>`）とカテゴリ名が含まれ、カード内の `<img>` は `alt=""`・`width`・`height`・`loading="lazy"` を持ち、
      `src` が `cmsImageUrl()` と同じ規則（`w=800&fm=webp`）の URL。
- [ ] セクション内の `View More` の `href` が `/works/`。
- [ ] 実績 0 件のソース（`isDev: true` 相当のテスト、または WorkCard を使う TopWorks の単体レンダリング）では `<ul>` が無く、空のメッセージの `<p>` と `View More` がある。
      （Astro のコンテナ API で描画して確認する。方法は未決 X-2）

### About（`dist/index.html`）
- [ ] `id="about"` を持つ要素がちょうど 1 つあり、それが ABOUT の `<section>`。ヘッダーの ABOUT リンク（`layout.md`）が `/#about` を指す。
- [ ] プロフィール写真の `<img>` の `alt` が `about.photo.alt` と一致し、`src` が `/_astro/` 配下（astro:assets で処理済み）で、元の `profile.png`（約 1MB）より小さいファイルを指す。
- [ ] `bio` の各行が含まれる。
- [ ] SNS リンクが 5 つ、`socials` の順で並び、すべて `target="_blank"` と、`noopener` を含む `rel` を持つ。各リンクの `aria-label` に `label` が含まれ、中の `<img>` は `alt=""`。
- [ ] `href` の値が `socials[].url` と一致する。

### 共通
- [ ] `dist/index.html` 内の `id` 属性の値に重複が無い。
- [ ] `WorkCard` は `src/components/works/WorkCard.astro` の 1 か所で定義され、トップ・一覧・詳細の 3 ページがこれを使っている（`grep` で `c-work-card` 相当のカードのマークアップがほかに無いことを確認）。
      （2026-10-27: トップの実装時点では一覧・詳細が無いため保留。一覧・詳細の実装時に、ソースを検査する自動テストとして足して判定する）
      → 一覧・詳細の実装で `tests/source/components.test.ts` に追加した（`c-work-card` が `WorkCard.astro` だけにあり、3 ページの import が WorkCard に届く）
- [ ] `npm run check`・`npm run lint`・`CMS_SOURCE=fixture npm run build` が通る。

## 将来拡張（任意）
- プロフィールを microCMS のオブジェクト形式 API へ移す（`getProfile()` の中身だけ差し替え。cms-integration）。
- SNS リンクに `rel="me"`（プロフィールの相互確認）を付ける。
- KV・Message の登場アニメーション（P2 デザイン刷新。`prefers-reduced-motion` を尊重）。
- カード画像の `srcset`・`sizes`、astro:assets 化（P2「パフォーマンス / a11y」）。
- 「2024年現在」のような年の表記を、ビルド時の年から作る（T-1 で「自動にする」を選んだ場合）。

## 未決事項

2026-10-27 に推奨どおりで決定した（D-012）。実装時に確かめる項目（X-2）と、ユーザーからの受け取り待ち（T-1 の文面）が残っている。

| ID | 内容 | 決定・決め方 |
|---|---|---|
| T-1 | About の「2024年現在、会社員 兼 フリーランスとして…」（2026-10-27 時点で 2 年前の表記） | **ユーザー確認済み（2026-10-27）**: 最新の経歴文を後日もらって差し替える。届くまでは現行の文を転記する（**受け取り待ち**） |
| T-2 | Message の「"アナタ"が笑顔がずっと続くように。」（「が」が 2 回） | **決定（2026-10-27 ユーザー確認。D-012 に記録）**: 誤記。「"アナタ"の笑顔がずっと続くように。」に直す |
| T-3 | プロフィール写真の `alt` | **決定（D-012）**: `新山 慶介`（現行は空） |
| T-4 | 実績 0 件のときの文言（現行「お知らせはまだ登録されておりません。」は実績に対して「お知らせ」になっている） | **決定（D-012）**: 「実績はまだ登録されていません。」。一覧でも同じ文言を使う。本番では 0 件はビルドエラーなので開発時のみの表示 |
| T-5 | SNS を新しいタブで開くか | **決定（D-012）**: 現行どおり新しいタブ。`rel="noopener"` と、リンク名に「新しいタブで開きます」を含める |
| T-6 | cms-integration の `Profile` 型との差分: `SocialLink.icon` を `string` から `ImageMetadata` に、`about.photo`（写真と alt）と `SocialLink.id` を追加 | **対応済み（2026-10-27、D-012）**: cms-integration の型の記述を本書の案に合わせた |
| T-7 | cms-integration の受け入れ条件「`dist/index.html` に現行と同じ文言が含まれる」 | **対応済み（2026-10-27、D-012）**: cms-integration 側を「`src/data/profile.ts` の文言が含まれる」に変更した |
| T-8 | ローダー（現行はトップにだけある） | **決定（D-012）**: `layout.md` の `loader` props（トップだけ true）で扱う。本書は `loader: true` を渡すだけ |
| X-1 | ビルド成果物（`dist/*.html`）の検査方法。今の Vitest は `environment: 'node'` で HTML パーサが無い | **決定（D-012）**: 開発依存に `node-html-parser` を入れ、`tests/dist/*.test.ts` を「`CMS_SOURCE=fixture npm run build` の後に実行する」別スクリプト `test:dist` にする（top-page・works-list・works-detail で共通）。パッケージ追加は承認済み（インストールは実装時）。通常の `npm test`（`include: tests/**/*.test.ts`）から `tests/dist/` を外す方法は実装時に決める。**実装（2026-10-27）**: `vitest.config.ts` の `exclude` で外し、`vitest.dist.config.ts` で `tests/dist/` だけを実行する。`test:dist` はビルドを含まず、フィクスチャでビルドされた `dist/` でなければ分かるメッセージで止まる。`dist/` を無視する `.gitignore`・`.prettierignore` の指定は `/dist/`（ルートだけ）にした（`tests/dist/` まで無視されていたため）。**P2 の CI（PR チェック）で `CMS_SOURCE=fixture` のビルド → `test:dist` を組み込むこと**（2026-10-27 レビュー指摘。今は手動実行のみ） |
| X-2 | コンポーネント単体の描画テスト（0 件表示など、フィクスチャでは起きない状態） | 実装時に確認: Astro のコンテナ API（`experimental_AstroContainer`。Astro 7 での名前・安定性）で `TopWorks` を描画して検査する。使えない場合は開発サーバーでの目視確認に落とす。**確認済み（2026-10-27）**: `experimental_AstroContainer` で描画でき、`npm test` の中で実行している（`tests/components/`） |
| X-3 | 共通カードのクラス名（`c-work-card` を新設し、現行の重複を 1 つにまとめる） | **決定（D-012）**: `c-work-card`（style-migration S-3） |
