# 機能仕様: 実績一覧（works-list）

> 状態: **承認済み（2026-10-27、推奨どおり。decisions-log D-012）**。`url-design.md`（D-009。`/works/`・`?category=`・canonical・U-9）、`cms-integration.md`（D-010。
> `getAllWorks()`・`getCategoriesInUse()`・並び順・C-16）、`top-page.md`（共通カード `WorkCard`）を前提とする。
> U-9（replaceState）と C-16（全件表示）は本書の承認で決まり、url-design・cms-integration 側も更新した。
> 共通レイアウトは `layout.md`、スタイルの移植は `style-migration.md` に従う（どちらも承認済み・D-012）。

## 目的
- `/works/` で**全実績**を一覧でき、カテゴリで絞り込めるようにする。
- 現行の jQuery 時代の実装（`id` の重複、`<ul>` 直下の `<span>`、クリックできるだけの `<li>`）を、**正しいマークアップのボタンと素の TS**に置き換える。
- 絞り込み状態を URL（`?category=`）に持たせ、共有・再読み込み・詳細ページからの「戻る」で状態が保たれるようにする（url-design 案 B）。
- 絞り込みの判定を**純粋関数**に切り出し、Vitest で確かめられるようにする。

## スコープ（対象フェーズ）
- **P1（本書の主対象）**
  - `src/pages/works/index.astro`（URL `/works/`）。全件をビルド時に HTML へ出力する。
  - カテゴリの絞り込み UI（ボタン）と、クライアント側の素の TS による絞り込み・`?category=` の読み書き・履歴の扱い（U-9）。
  - JS 無効時の表示、a11y（`aria-pressed`・結果件数の読み上げ・DOM の順序）、`prefers-reduced-motion`。
  - 絞り込みロジックの純粋関数と、そのテスト。
- **P2**: canonical（`/works/?category=x` → `/works/`）の出力（「SEO / OGP」。URL の規則は url-design で確定済み）、デザイン刷新、Playwright によるブラウザでの確認。
- **含まない**: ページネーション、カテゴリ別の静的ページ（url-design の将来拡張）、複数カテゴリでの絞り込み、検索、並び替え UI。

## 現行（WordPress）の振る舞い
`legacy/archive.php`・`legacy/assets/js/script.js`・`legacy/assets/css/Object/Project/_works.scss` より。

- 見出し `<h1 class="l-page-title">記事・実績一覧</h1>`。
- 一覧 `ul.p-works__body`: `WP_Query`（`posts_per_page` 未指定 → WP の「表示設定」の件数。全件とは限らない。cms-integration C-16）。
  各 `<li data-category="{先頭カテゴリのslug}" class="is-show">` の中にカード（トップと同じ構造。`<h3>`）。0 件なら「お知らせはまだ登録されておりません。」。
- 絞り込み `ul.p-works__sidebar`（**DOM 上は一覧の後ろ**。スマホは `column-reverse` で上に見せている）:
  - **`<ul>` の直下に `<span>Category</span>`**（`<ul>` の子は `<li>` だけが正しい）。
  - ボタン役の `<li>` が**すべて `id="categoryButton"`**（id の重複）。`data-filter="all"` が「全て」、以降 `get_terms('category')`（名前順・0 件のカテゴリは除外）。
  - `<li>` なので**キーボードで操作できない**、選択状態は `is-active` クラスだけで支援技術に伝わらない。`::after { content: "→" }` が読み上げられうる。
- `script.js`: `[data-filter]` のクリックで `is-active` を付け替え、`[data-category]` の `is-show` を付け外す。CSS は `li { display: none }` ＋ `.is-show { display: block }`
  なので、**JS が動かないと（または `is-show` が付かないと）実績が見えない**作り。切り替えのたびに全カードへ `opacity 0 → 1`（600ms）のアニメーション（減らす設定の考慮なし）。
- 絞り込み状態は URL に出ない（共有・戻るで失われる）。

## データ構造案

### ページが使うデータ
```ts
// src/pages/works/index.astro（frontmatter）
const works = await getAllWorks();             // 検証済み・date 降順（cms-integration）
const categories = await getCategoriesInUse(); // 実績 1 件以上のカテゴリ・管理画面の並び順（cms-integration C-4）
```
- **全件表示**（ページ分割しない）。cms-integration C-16 は本書で「全件」と決めた（L-2。D-012）。
- 一覧のカード順は `getAllWorks()` の順（`date` 降順）をそのまま使う。絞り込みは表示/非表示だけで、並べ替えない。

### 純粋関数（`src/lib/works-filter.ts`。DOM・`window` に触れない）
```ts
/** null = 「全て」。それ以外はカテゴリの slug */
export type WorksFilter = string | null;

export const CATEGORY_QUERY_KEY = 'category';

/** URL の検索文字列から初期の絞り込みを決める。知らない slug・空・未指定は null（全て） */
export function resolveFilterFromSearch(search: string, knownSlugs: readonly string[]): WorksFilter;

/** その実績を表示するか */
export function isWorkVisible(workCategorySlug: string, filter: WorksFilter): boolean;

/** 現在の URL（path + search + hash）から、絞り込みを反映した URL を作る。
 *  filter が null なら category を取り除き、ほかのクエリと hash は保つ。結果は '/works/' や '/works/?category=web' の形 */
export function buildFilterUrl(currentUrl: string, filter: WorksFilter): string;

/** 結果件数の読み上げ文（例 'Web の実績 3 件を表示しています' / 'すべての実績 12 件を表示しています'） */
export function describeFilterResult(filter: WorksFilter, categoryName: string | undefined, visibleCount: number): string;
```
- 「全て」を `'all'` という文字列で表さない（カテゴリ slug の規則上 `all` というカテゴリも作れるため。`null` と、DOM では `data-filter=""` で表す）。
- slug の比較は**完全一致**（大文字小文字を変換しない。slug は検証済みで小文字のみ）。`?category=a&category=b` は最初の値（`URLSearchParams.get`）を使う。
- `buildFilterUrl` は `routes.works()` と同じ形（`/works/?category=…`）を返す。値は `encodeURIComponent` 相当でエンコードされる（`URLSearchParams` を使う）。

### DOM を扱う部分（`src/components/works/works-filter-controller.ts`）
```ts
export type FilterControllerDeps = {
  location: Pick<Location, 'pathname' | 'search' | 'hash'>;
  history: Pick<History, 'replaceState' | 'state'>;
  prefersReducedMotion: () => boolean;     // matchMedia('(prefers-reduced-motion: reduce)').matches
};
/** root（絞り込み UI と一覧を含む要素）に挙動を付ける。テストでは deps を差し替える */
export function initWorksFilter(root: HTMLElement, deps: FilterControllerDeps): void;
```
- `WorksFilter.astro`（または `works/index.astro`）の `<script>` で `import { initWorksFilter } …` して呼ぶ（Astro が bundle する。jQuery なし）。
- ロジックの判断（表示するか・URL・読み上げ文）はすべて `works-filter.ts` の純粋関数に任せ、controller は DOM への反映だけを行う。

### コンポーネント構成（案）
```
src/pages/works/index.astro              … getAllWorks / getCategoriesInUse を呼び、下へ渡す
src/components/works/WorksFilter.astro   … props: { categories: Category[] }。ボタン群（＋ <script> で controller を起動）
src/components/works/WorkCard.astro      … top-page.md で定義した共通カード（headingLevel 2 で使う）
src/components/works/works-filter-controller.ts … 上記
src/lib/works-filter.ts                  … 純粋関数
```

## 振る舞い

### ビルド時に出す HTML（JS が無くても成立する形）
```html
<div class="l-page__wrapper l-container">
  <h1 class="l-page-title">記事・実績一覧</h1>
  <div class="p-works" data-works-filter-root>
    <!-- 絞り込み（DOM では一覧より前。PC で右側に置くのは CSS の order 等で行う） -->
    <div class="p-works__filter" role="group" aria-labelledby="works-filter-heading">
      <h2 id="works-filter-heading" class="p-works__filter-title">Category</h2>
      <ul class="p-works__filter-list">
        <li><button type="button" class="p-works__filter-button" data-filter="" aria-pressed="true">全て</button></li>
        <li><button type="button" class="p-works__filter-button" data-filter="web" aria-pressed="false">Web</button></li>
        …（getCategoriesInUse の順）
      </ul>
    </div>
    <p class="u-visually-hidden" role="status" data-works-filter-status></p>
    <ul class="p-works__list">
      <li class="p-works__item" data-category="web"><!-- WorkCard（headingLevel 2） --></li>
      …（getAllWorks の全件。hidden は付けない）
    </ul>
  </div>
</div>
```
- **静的 HTML では全カードが表示状態**（`hidden` を付けない）。現行の「既定は `display: none`、`is-show` で表示」は移植しない
  （`style-migration.md` への要件: `p-works` の `li { display: none }`・`.is-show` を持ち込まないこと）。
- **id の重複を無くす**: ボタンに id を付けない（`data-filter` で識別する）。ページ内の id は `works-filter-heading` だけ。
- 「Category」は `<ul>` の外の見出し（`h2`）にする。ボタン群は `role="group"` で見出しを名前にする。
- 実績カードの見出しは `h2`（ページの `h1` 直下に並ぶため。現行は `h3` で階層が飛んでいた）。`Category` も `h2` で同じ階層。
- 「→」の矢印は飾り。CSS の `content` で出すなら代替テキストを空にする（`content: "→" / ""`）か、`<span aria-hidden="true">` にする（`style-migration.md` で選ぶ）。
- 選択中の見た目は `aria-pressed="true"` を CSS のセレクタに使う（状態を `is-active` クラスと二重に持たない。`style-migration.md` への要件）。
- 0 件のとき（開発時のみ。本番ビルドはエラー）: 絞り込み UI と `<ul>` を出さず、空のメッセージの `<p>`（文言は top-page T-4 と共通）。
- `BaseLayout`（`layout.md`）に `title="記事・実績一覧"` を渡す（`<title>` は `記事・実績一覧 | UNOTAME`）。canonical は P2 で `/works/`（クエリなし）。

### JS が有効なとき（`initWorksFilter`）
1. **初期化**: `resolveFilterFromSearch(location.search, ボタンの data-filter 一覧)` で初期の絞り込みを決める。
   - 該当カテゴリがあれば、そのボタンを `aria-pressed="true"`（ほかは `false`）にし、該当しない `<li>` に `hidden` を付ける。**初期化ではアニメーションしない**。
   - `?category=` が**知らない slug・空**だった場合は「全て」を表示し、`history.replaceState` で URL から `category` を取り除く（URL と表示を一致させる。エラーにしない。url-design）。
     実績 0 件のカテゴリの slug（`getCategoriesInUse` に無い）も「知らない slug」と同じ扱い。
   - 初期化時はステータス（`role="status"`）を書き換えない（ページを開いた直後に読み上げさせない）。
2. **ボタン操作**（クリック。`<button>` なので Enter / Space でも同じ）:
   - 押したボタンだけ `aria-pressed="true"`、ほかは `false`。既に選択中のボタンを押しても何も変えない（URL も更新しない）。
   - 各 `<li>` の `hidden` を `isWorkVisible(li.dataset.category, filter)` に合わせて付け外す。
   - **`history.replaceState(history.state, '', buildFilterUrl(現在の URL, filter))`** で URL を更新する（「全て」は `category` を取り除く）。**pushState は使わない**（U-9。理由は下）。
   - ステータスに `describeFilterResult(...)` を入れて読み上げさせる。
   - フォーカスはボタンに留める（スクロール位置も動かさない）。
   - 表示されたカードを `opacity: 0 → 1` でフェードイン（現行 600ms → 300ms。L-9。`style-migration.md` で調整可）。
     **`prefersReducedMotion()` が true ならアニメーションしない**。現行のように非表示のカードまでアニメーションさせない。
3. **戻る・進む・再読み込み**: URL に `?category=` が残っているので、再読み込みや「詳細 → ブラウザの戻る」（bfcache が効かない場合も）で 1. の初期化によって同じ状態に戻る。
   bfcache で戻った場合は DOM の状態がそのまま残る。`popstate` の処理は不要（replaceState だけなので履歴の項目が増えない）。

### 履歴の扱い（U-9）: `replaceState`（決定。L-1、D-012）

| 案 | 長所 | 短所 |
|---|---|---|
| **replaceState（採用）** | ボタンを何度押しても履歴が増えず、「戻る」1 回で前のページ（トップなど）へ戻れる。詳細ページへ移って戻ったときは URL の `?category=` から状態を復元できる。`popstate` の処理が要らず実装・テストが単純 | ブラウザの「戻る」で 1 つ前の絞り込みには戻れない |
| pushState | 「戻る」で絞り込みを 1 段ずつ戻せる | カテゴリを切り替えるたびに履歴が積まれ、ページから出るのに何度も「戻る」が要る（絞り込みはページ遷移ではなく表示の切り替えなので、利用者の想定と合いにくい）。`popstate` で状態を復元する処理とテストが増える |

絞り込みはページ内の表示状態であり、利用者が守りたいのは「詳細を見て戻ったとき、絞り込みが残っていること」なので、replaceState で足りる。

### JS が無効なとき・JS の読み込みに失敗したとき
- 全実績が表示される（静的 HTML のまま）。`?category=` は無視される（url-design で許容済みの劣化）。
- 絞り込みボタンは表示されたまま（押しても変化しない）。消すと JS 有効時にレイアウトがずれる（CLS）ため、P1 は表示したままにする（L-4。D-012）。

### 既知の制約
- `?category=` 付きで直接開いた場合、JS の実行までの一瞬、全件が見えてから絞り込まれる可能性がある（module スクリプトは HTML の解析後に動くため）。
  件数が数十件の規模では許容し、気になれば P2 で対策（一覧の直後に小さなインラインスクリプトを置く等）を検討する（L-5。D-012）。

## 受け入れ条件

前提: 純粋関数は Vitest（node 環境）。DOM の挙動は DOM 環境のテスト（L-6。happy-dom。D-012）で `initWorksFilter` に偽の `location` / `history` /
`prefersReducedMotion` を渡して判定する。ビルド成果物は `CMS_SOURCE=fixture npm run build` の `dist/works/index.html` を検査し、
期待値はフィクスチャを `loadContent()` に通した結果から作る（HTML の検査方法は top-page X-1：`node-html-parser` と `test:dist`）。

### 純粋関数（Vitest）
- [ ] `resolveFilterFromSearch('?category=web', ['web','design'])` → `'web'`。
- [ ] `resolveFilterFromSearch` が `''`・`'?category='`・`'?category=unknown'`・`'?category=WEB'`・`'?foo=bar'` で `null`。
- [ ] `resolveFilterFromSearch('?category=design&category=web', ['web','design'])` → `'design'`（最初の値）。
- [ ] `isWorkVisible('web', null)` と `isWorkVisible('web', 'web')` が `true`、`isWorkVisible('web', 'design')` が `false`。
- [ ] `buildFilterUrl('/works/', 'web')` → `'/works/?category=web'`、`buildFilterUrl('/works/?category=web', null)` → `'/works/'`。
- [ ] `buildFilterUrl('/works/?utm_source=x&category=web#top', 'design')` → `utm_source=x` と `#top` を保ち、`category=design` になる。
- [ ] `buildFilterUrl('/works/', 'web')` の結果が `routes.works({ category: 'web' })` と一致する。
- [ ] `describeFilterResult` が「全て」とカテゴリ指定のそれぞれで、カテゴリ名と件数を含む文を返す。

### ビルド成果物（`dist/works/index.html`）
- [ ] `<h1>` がちょうど 1 つで「記事・実績一覧」。
- [ ] 実績のリンク（`/works/{slug}/`）が、フィクスチャの**全件**について `date` 降順で並ぶ（件数がフィクスチャの works 件数と一致する）。
- [ ] 各実績の `<li>` に `data-category` があり、値がその実績のカテゴリ slug と一致する。どの `<li>` にも `hidden` 属性・`is-show` クラスが無い。
- [ ] 各カードの見出しが `<h2>`。カード内の `<img>` は `alt=""`・`width`・`height` を持つ。
- [ ] 絞り込みのボタンが `<button type="button">` で、先頭が「全て」（`data-filter=""`・`aria-pressed="true"`）、続いて `getCategoriesInUse()` の順に各カテゴリ（`data-filter="{slug}"`・`aria-pressed="false"`・テキストはカテゴリ名）。
- [ ] フィクスチャの「実績 0 件のカテゴリ」のボタンが無い。
- [ ] ボタン群が `role="group"` で、`aria-labelledby` の参照先が存在する見出し（「Category」）。
- [ ] ページ内の `id` 属性の値に重複が無い。`<ul>`・`<ol>` の直下の子要素がすべて `<li>`。
- [ ] DOM の順序で、絞り込みボタン群が実績一覧より前にある。
- [ ] `role="status"` の要素が 1 つある（初期状態では空）。

### DOM の挙動（DOM 環境のテスト。`initWorksFilter`）
- [ ] `location.search = '?category=web'` で初期化すると、`data-category="web"` 以外の `<li>` に `hidden` が付き、Web のボタンだけ `aria-pressed="true"`。`replaceState` は呼ばれない。アニメーションは呼ばれない。
- [ ] `location.search = '?category=unknown'`（および `'?category='`）で初期化すると、全件表示・「全て」が `aria-pressed="true"` で、`replaceState` が `category` を除いた URL（`/works/`）で 1 回呼ばれる。
- [ ] 「Design」ボタンをクリックすると、Design 以外が `hidden`、`replaceState` が `'/works/?category=design'` で呼ばれ、`pushState` は呼ばれない（偽の `history` に `pushState` を置いて呼び出し回数 0 を確認）。
- [ ] 続けて「全て」をクリックすると全件の `hidden` が外れ、`replaceState` が `'/works/'` で呼ばれる。
- [ ] 選択中のボタンをもう一度クリックしても `replaceState` が呼ばれない。
- [ ] クリック後、`role="status"` の文が `describeFilterResult` の結果になる。初期化直後は空のまま。
- [ ] `prefersReducedMotion` が `true` のとき、クリックしてもカードの `animate`（またはアニメーション用のクラス付与）が行われない。`false` のときは表示されたカードにだけ行われる。
- [ ] JS を初期化しない状態（静的 HTML のまま）では全カードが表示状態（`hidden` が無い）。

### ブラウザでの確認（url-design の「一覧のカテゴリクエリ」の受け入れ条件。P1 は `npm run build && npm run preview` での手動確認、P2 で Playwright 化）
- [ ] `/works/?category={存在するslug}` でそのカテゴリだけが表示され、ボタンが選択状態。
- [ ] `/works/?category=unknown`・`/works/?category=` で全件表示、エラーなし。
- [ ] ボタンで URL の `category` が更新され、「全て」でクエリが消える。詳細へ移ってブラウザで戻ると絞り込みが残っている。
- [ ] Tab キーでボタンに移動でき、Enter / Space で絞り込める。フォーカスが見える。
- [ ] OS の「視差効果を減らす（動きを減らす）」設定でフェードが出ない。

## 将来拡張（任意）
- Playwright によるブラウザテスト（P2「CI」）。
- 件数が増えた場合のページネーション、またはカテゴリ別の静的ページ（url-design の案 C）。
- 複数カテゴリでの絞り込み（cms-integration の将来拡張と連動）。
- `?category=` 直アクセス時のちらつき対策（L-5）。

## 未決事項

2026-10-27 にすべて推奨どおりで決定した（D-012）。

| ID | 内容 | 決定 |
|---|---|---|
| L-1 | U-9: 絞り込みの履歴を `replaceState` にするか `pushState` にするか | **決定（D-012）**: replaceState（上の比較）。url-design の U-9 も「決定」に更新した |
| L-2 | cms-integration C-16: 一覧の表示件数 | **決定（D-012）**: 全件表示（ページ分割なし）。本番 WP の「表示設定」の件数の確認は不要（新サイトの挙動に影響しない）。cms-integration の C-16 も更新した |
| L-3 | 知らない `?category=` のとき、`replaceState` で URL からクエリを消すか | **決定（D-012）**: 消す（URL と表示を一致させる）。url-design の「無視して全て」に追加する振る舞いで、矛盾しない |
| L-4 | JS が無効なときの絞り込みボタン | **決定（D-012）**: 表示したまま（押しても変化しない） |
| L-5 | `?category=` 直アクセス時のちらつき | **決定（D-012）**: P1 は許容 |
| L-6 | DOM 挙動のテスト環境 | **決定（D-012）**: 開発依存に `happy-dom` を追加し、該当テストのファイル先頭で `// @vitest-environment happy-dom` を指定する（全体の `environment: 'node'` は変えない）。パッケージ追加は承認済み（インストールは実装時） |
| L-7 | 結果件数の読み上げ（`role="status"`）と `u-visually-hidden` | **決定（D-012）**: 入れる。`u-visually-hidden` は `style-migration.md` の Utility 層に追加した |
| L-8 | `style-migration.md` への要件（`li { display: none }`・`.is-show` を移植しない、選択状態を `[aria-pressed="true"]` で装飾、foundation に `[hidden] { display: none !important; }`、PC で絞り込みを右に置くのは CSS） | **決定（D-012）**: `style-migration.md` の「ほかの P1 仕様からの要件」に反映した |
| L-9 | フェードの長さ（現行 600ms → 300ms） | **決定（D-012）**: P1 は 300ms。P2 刷新で見直し |
