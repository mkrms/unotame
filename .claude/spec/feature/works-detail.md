# 機能仕様: 実績詳細（works-detail）

> 状態: **承認済み（2026-10-27、推奨どおり。decisions-log D-012）**。`url-design.md`（D-009。`/works/{slug}/`・旧 URL の 301・404）、`cms-integration.md`（D-010。
> `getAllWorks()`・`Work` 型・本文 HTML の加工・`cmsImageUrl()`）、`top-page.md`（共通カード `WorkCard`・`ViewMoreLink`）を前提とする。
> Latest から自身を除くこと（D-1）とヘッダー画像の alt（D-5）は、cms-integration 側（`getStaticPaths` の説明・C-8）も合わせて更新した。
> 共通レイアウトは `layout.md`、スタイルの移植は `style-migration.md` に従う（どちらも承認済み・D-012）。

## 目的
- 実績 1 件ごとに `/works/{slug}/` の静的ページを出力し、**サムネイル・カテゴリ・本文**を現行どおり見せる。
- 詳細の下に**ほかの最新の実績（Latest）**と一覧への導線（View More）を置き、回遊を保つ。
- CMS のリッチエディタの HTML を表示する際の前提（信頼の範囲）と注意点を明文化する。

## スコープ（対象フェーズ）
- **P1（本書の主対象）**
  - `src/pages/works/[slug].astro` と `getStaticPaths`（全 slug のページを生成）。
  - 詳細のヘッダー（タイトル・サムネイル・カテゴリ）、本文（`set:html`）、Latest 3 件、View More。
  - Latest の選び方の純粋関数とテスト。
- **P2**: `<title>`・description・OGP（`Work.description`・サムネイルを使う。「SEO / OGP」）、本文 HTML のサニタイズ導入の判断、本文画像のリサイズ、
  サムネイルの `srcset`・astro:assets 化（「パフォーマンス / a11y」）。
- **含まない**: 前後の実績へのリンク（将来拡張。D-2）、実績日の表示（D-7）、コメント・共有ボタン、下書きプレビュー専用ページ（cms-integration の将来拡張）。
  旧 URL `/{category}/{ID}` からの 301 は url-design（`.htaccess` 生成）の範囲で、本書では扱わない。

## 現行（WordPress）の振る舞い
`legacy/single.php`・`legacy/functions.php`・`legacy/assets/css/Object/Project/_work-detail.scss` より。

- URL は `/{category}/{投稿ID}`（url-design で `/works/{slug}/` に変更し、旧 URL は 301）。
- `<h1 class="l-page-title">` に `the_title()`（`echo the_title()` と二重の出力指定になっているが表示上は問題ない）。
- ヘッダー `.p-work-detail__content__header`: アイキャッチ `<img alt="">`（全幅）、その下に右寄せで `<span>カテゴリー：{先頭カテゴリ名}</span>`（リンクなし）。
- 本文 `.p-work-detail__content__body`: `the_content()`。`functions.php` の `replaceAssetsPath` で `"assets/` をテーマのパスに置換（cms-integration で扱い済み）。
  スタイルは本文内の `h2`（下線）・`h3`（左線）・`ul`/`ol`（枠線）・`li`（`disc`）。
- Latest `.p-work-detail__latest`: `<h2>Latest</h2>`、`WP_Query`（`posts_per_page: 3`、新しい順）。**表示中の実績自身も含む**。カードはトップと同じ構造（`<h3>`）。0 件なら「お知らせはまだ登録されておりません。」。
- 最後に `View More`（`home_url('works')` = `/works`）。
- 前後の実績へのリンク・日付の表示は無い。

## データ構造案

### ページのデータの流れ
```ts
// src/pages/works/[slug].astro
import { getAllWorks } from '../../lib/cms';
import { selectLatestWorks } from '../../lib/related-works';

export async function getStaticPaths() {
  const works = await getAllWorks();            // 検証済み・date 降順・メモ化済み（cms-integration）
  return works.map((work) => ({
    params: { slug: work.slug },
    props: { work, latest: selectLatestWorks(works, { excludeSlug: work.slug, limit: 3 }) },
  }));
}
const { work, latest } = Astro.props;           // Work と Work[]
```
- `getStaticPaths` の中で一度だけ全件を取り、Latest も props で渡す（ページごとに取得関数を呼ばない。メモ化に頼らなくても API 呼び出しが増えない）。
- 存在しない slug のページは生成しない → `/works/does-not-exist/` は Apache が 404（url-design）。

### 純粋関数（`src/lib/related-works.ts`）
```ts
/** works は date 降順に並んでいる前提（getAllWorks の戻り値）。excludeSlug を除いた先頭 limit 件を返す。元の配列は変更しない */
export function selectLatestWorks(
  works: readonly Work[],
  opts: { limit: number; excludeSlug?: string },
): Work[];
```
- cms-integration の `getLatestWorks(limit)` は変更しない（トップの 6 件はそのまま使う）。自分を除く処理だけを表示側の純粋関数として足す。

### コンポーネント構成（案）
```
src/pages/works/[slug].astro                … 上記。WorkDetail と Latest を並べる
src/components/works/WorkDetailHeader.astro … props: { work: Work }（サムネイル・カテゴリ）
src/components/works/WorkBody.astro         … props: { html: string }（set:html はここだけ）
src/components/works/LatestWorks.astro      … props: { works: Work[] }（WorkCard ×n ＋ ViewMoreLink）
src/components/works/WorkCard.astro         … top-page.md の共通カード（headingLevel 3）
src/components/common/ViewMoreLink.astro    … top-page.md
```

## 振る舞い

### ページ構成
```html
<div class="l-single__wrapper l-container">
  <h1 class="l-page-title">{work.title}</h1>
  <div class="p-work-detail">
    <article class="p-work-detail__content">
      <div class="p-work-detail__content__header">
        <img src="{cmsImageUrl(thumbnail, { width: 1600, format: 'webp' })}" width="…" height="…" alt="{thumbnail.alt}"
             fetchpriority="high" decoding="async">
        <p class="p-work-detail__category">カテゴリー：<a href="/works/?category={category.slug}">{category.name}</a></p>
      </div>
      <div class="p-work-detail__content__body"><!-- set:html={work.bodyHtml} --></div>
    </article>
    <section class="p-work-detail__latest" aria-labelledby="work-latest-heading">
      <h2 id="work-latest-heading" class="l-section-title">Latest</h2>
      <ul>…WorkCard（headingLevel 3）×最大 3…</ul>
      <a class="c-btn-view-more" href="/works/">View More</a>
    </section>
  </div>
</div>
```
- `<h1>` は作品名でページに 1 つ。`BaseLayout`（`layout.md`）に `title={work.title}` を渡す（`<title>` は `{作品名} | UNOTAME`）。
  `description` に `work.description` を渡すかは `layout.md` の props と P2「SEO / OGP」に従う。
- 本文とヘッダーを `<article>` で囲む（実績 1 件として独立した内容のため）。クラス名は `style-migration.md` に従う。

### サムネイル
- `cmsImageUrl(work.thumbnail, { width: 1600, format: 'webp' })`（コンテナ幅いっぱいの表示を高密度画面で荒れない幅。P2 で `srcset` を検討）。
- `width`・`height` に `thumbnail.width`・`thumbnail.height` を出す。**ページの最初に見える大きな画像なので `loading="lazy"` を付けない**（`fetchpriority="high"`）。
- **alt は `thumbnail.alt`（CMS に代替テキストがあればそれ、無ければ空）**。作品名は直前の `<h1>` にあるため、alt にタイトルを入れると読み上げが重複する。
  CMS で代替テキストを入力できるか（cms-integration C-8。要確認のまま）が分かったら、入力する運用（「どんな画面か」を書く）を推奨する。（D-5。D-012）

### カテゴリ
- 「カテゴリー：{name}」を表示する（現行の `<span>` は `<p>` にする）。
- **カテゴリ名を一覧の絞り込み `/works/?category={slug}` へのリンクにする**（`routes.works({ category })` で作る。D-3。D-012 で承認）。
  url-design のクエリ設計をそのまま活かせ、追加の実装はリンク 1 つだけ。現行に無い導線の追加。

### 本文（リッチエディタの HTML）
- `WorkBody.astro` で `<div class="p-work-detail__content__body" set:html={html} />` として出す。`set:html` を使うのは**このコンポーネントだけ**にする（使用箇所を限定し、レビューしやすくする）。
- `work.bodyHtml` は cms-integration の変換層で加工済み（`"assets/` → `"/assets/`、`<img>` に `loading="lazy"`・`decoding="async"`）。表示側では追加の加工をしない。
- **信頼の前提**: 本文を書くのはサイトの持ち主 1 人で、microCMS の管理画面のリッチエディタが出力した HTML をそのまま信頼する（cms-integration 設計判断 1）。
  ビルド時に静的な HTML へ埋め込まれ、閲覧者の入力が混ざる経路は無い。
- **注意点**（運用と将来の対策）:
  - microCMS のアカウントが乗っ取られると、本文に入れた `<script>` やイベント属性（`onerror` 等）がそのまま公開サイトで動く（stored XSS）。
    → microCMS のアカウントに 2 段階認証を設定し、メンバーを最小にする（運用。本書の範囲外だが前提として記す）。
  - リッチエディタの「埋め込み」や HTML の貼り付けで `<iframe>`・`<script>` が入りうる。表示崩れや外部スクリプトの読み込みに注意する。
  - 本文の見出しは `h2` 以下を使う前提（ページの `h1` は作品名）。本文に `h1` があっても P1 では直さない（入力時の運用で避ける）。
  - **P1 はサニタイズしない**。P2 で、ビルド時に許可リスト方式でサニタイズする（例 `sanitize-html` を `body.ts` で使う。実行時のコストは 0）かを判断する（D-4。D-012）。
    入れる場合も `src/lib/cms/body.ts` の中に閉じ、表示側（本書）は変えない。
- 本文内のリンク（外部サイト）に `target`・`rel` を付ける加工は P1 ではしない（CMS で入力したまま）。

### Latest（`selectLatestWorks`）
- **表示中の実績を除いた**、`date` 降順の先頭 3 件（現行は自分を含んでいた。D-1。D-012 で承認）。
  - 理由: 今見ているページへのカードはリンク先が同じページで、3 枠のうち 1 枠を無駄にする。最新の実績を開いたときに特に目立つ。
- 除いた結果が 3 件未満ならある分だけ表示する。
- **0 件（実績が全部で 1 件だけ）のとき**: `Latest` の見出しと `<ul>` を出さず、`View More` だけを出す（空のセクション見出しを出さない）。
  空のメッセージは出さない（現行の「お知らせはまだ登録されておりません。」は、自分を含めていたので実質出なかった）。
- カードは共通の `WorkCard`（`headingLevel` 3。`Latest` の `h2` の下）。
- `View More` の `href` は `routes.works()` = `/works/`（url-design の受け入れ条件どおり）。

### 前後の実績への導線（P1 に入れるか）
- **P1 には入れない（D-2。D-012）**。現行に無く、Latest 3 件と View More で回遊の導線は足りる。並び順（`date` 降順）が決まっているので、
  入れる場合も `getStaticPaths` で前後を props に渡すだけで足せる（将来拡張）。

### その他
- 下書きプレビュー（開発時、`work.isDraftPreview === true`）は、開発時だけ「DRAFT」を出してもよい（cms-integration で任意とされている。P1 では実装しなくてよい）。
- 旧 URL（`/{category}/{ID}`・`/?p={ID}`）からの 301 は url-design の `.htaccess` 生成で行う。本ページは関与しない。

## 受け入れ条件

前提: `CMS_SOURCE=fixture npm run build` の成果物と Vitest で判定する。期待値はフィクスチャを `loadContent()` に通した結果から作る
（HTML の検査方法は top-page X-1。フィクスチャは cms-integration の内容〈実績 8 件以上、本文に microCMS 画像と `"assets/` を含むもの〉を前提とする）。

### 純粋関数（Vitest）
- [ ] 5 件（`date` 降順）の配列に `selectLatestWorks(works, { excludeSlug: works[0].slug, limit: 3 })` → `works[1..3]`。
- [ ] `excludeSlug` が先頭以外（例 `works[2].slug`）のとき → `works[0], works[1], works[3]`。
- [ ] `excludeSlug` 省略 → 先頭 3 件。`excludeSlug` が配列に無い slug → 先頭 3 件。
- [ ] 全 2 件で自分を除く → 1 件。全 1 件で自分を除く → 空配列。
- [ ] 元の配列が変更されない（呼び出し前後で同じ内容・順序）。

### ページ生成（ビルド成果物）
- [ ] フィクスチャの全実績について `dist/works/{slug}/index.html` が存在し、それ以外の `dist/works/*/index.html` が無い（url-design と同じ判定）。
- [ ] 各ページの `<h1>` がちょうど 1 つで、テキストがその実績の `title`。
- [ ] 各ページのヘッダー画像の `src` が `cmsImageUrl(thumbnail, { width: 1600, format: 'webp' })` と一致し、`width`・`height` があり、`loading="lazy"` が無い。`alt` が `thumbnail.alt`（フィクスチャでは空）と一致する。
- [ ] 「カテゴリー：」とその実績のカテゴリ名が含まれる。カテゴリ名のリンクの `href` が `/works/?category={category.slug}`。
- [ ] 本文がエスケープされずに出力される: フィクスチャ本文に含まれるタグ（例 `<h2>`）が、`.p-work-detail__content__body` 相当の要素の中にタグとして存在し、`&lt;h2&gt;` が無い。
- [ ] 本文の `"assets/` は `"/assets/` に、本文の `<img>` には `loading="lazy"` が付いた状態で出力されている（cms-integration の変換結果がそのまま出ている）。
- [ ] `set:html` を使っているのが `src/components/works/WorkBody.astro` だけである（`src/` を grep）。

### Latest・View More（ビルド成果物）
- [ ] 各ページの Latest セクション（`aria-labelledby="work-latest-heading"`）の実績リンクが、`selectLatestWorks(全件, { excludeSlug: 自分, limit: 3 })` と同じ slug・同じ順で、`href` が `/works/{slug}/`。
- [ ] Latest に**自分自身へのリンクが無い**（全ページで確認）。
- [ ] Latest のカードの見出しは `<h3>`、`<img>` は `alt=""`。
- [ ] `View More` の `href` が `/works/`。
- [ ] （実績 1 件だけのフィクスチャを使ったビルド、またはコンポーネント単体の描画〈top-page X-2〉で）Latest の見出しと `<ul>` が無く、`View More` はある。

### 共通
- [ ] 各ページ内の `id` 属性の値に重複が無い。
- [ ] `npm run check`・`npm run lint`・`CMS_SOURCE=fixture npm run build` が通る。

## 将来拡張（任意）
- 前後の実績へのリンク（`getStaticPaths` で前後の `Work` を props に渡す）。
- 実績日（`work.date`）・担当範囲・使用技術・公開サイトへのリンクの表示（cms-integration の将来拡張のフィールドと連動）。
- 本文 HTML のビルド時サニタイズ（許可リスト）と、本文中の外部リンクへの `rel="noopener"` 付与（`body.ts`）。
- Latest を「同じカテゴリの実績」優先にする。
- 構造化データ（JSON-LD の `CreativeWork`）（P2「SEO / OGP」）。

## 未決事項

2026-10-27 にすべて推奨どおりで決定した（D-012）。

| ID | 内容 | 決定 |
|---|---|---|
| D-1 | Latest に表示中の実績自身を含めるか（現行は含めている。cms-integration で「Works 詳細仕様で決める」とされた点） | **決定（D-012）**: 除く。自分を除いた最新 3 件（`selectLatestWorks`） |
| D-2 | 前後の実績への導線を P1 に入れるか | **決定（D-012）**: 入れない（現行に無い。Latest と View More で足りる）。必要になれば将来拡張で追加 |
| D-3 | カテゴリ名を `/works/?category={slug}` へのリンクにするか（現行はテキストのみ） | **決定（D-012）**: リンクにする |
| D-4 | 本文 HTML のサニタイズ | **決定（D-012）**: P1 はしない（書き手は本人のみ・管理画面の出力を信頼）。microCMS アカウントの 2 段階認証を前提とし、P2 でビルド時の許可リスト方式のサニタイズを判断 |
| D-5 | ヘッダー画像の alt（cms-integration C-8 の「詳細画像の alt にタイトルを入れるか」） | **決定（D-012）**: タイトルは入れない。CMS の代替テキストがあれば使い、無ければ空（`<h1>` と重複させない）。cms-integration の C-8 も更新した |
| D-6 | 実績 1 件だけのときの Latest | **決定（D-012）**: 見出しごと出さず、View More だけ |
| D-7 | 実績日（`date`）を詳細に表示するか（現行は表示なし） | **決定（D-012）**: P1 は表示しない（現行どおり）。P2 のデザイン刷新で検討 |
| D-8 | ヘッダー画像の幅（`w=1600`） | **決定（D-012）**: P1 は `w=1600`。P2「パフォーマンス / a11y」で `srcset` と合わせて見直す |
