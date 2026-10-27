# 機能仕様: 404 ページ（not-found）

> 状態: **承認済み（2026-10-27、推奨どおり。decisions-log D-012）**。`url-design.md`（D-009：404 は `src/pages/404.astro` → `dist/404.html`、`.htaccess` の生成と
> `ErrorDocument 404 /404.html`、404 は canonical なし・noindex）を前提とする。共通部分は `layout.md`（承認済み・D-012）に従う。

## 目的
- 存在しない URL にアクセスした人に、**404 ステータスのまま**「ページが無いこと」と「次に行ける場所（トップ・実績一覧）」を示す。
- 旧 WordPress の URL のうちリダイレクト対象外のもの（url-design の対応表で「404」としたもの）や、存在しない `/works/{slug}/` の受け皿にする。
- 検索エンジンに 404 ページ自体を登録させない（noindex）。

## スコープ（対象フェーズ）
- **P1（本書の対象）**
  - `src/pages/404.astro`（→ `dist/404.html`）の中身と `<head>`（title・noindex）。
  - url-design で決めた `.htaccess` の生成物に `ErrorDocument 404 /404.html` が含まれることの確認（生成の仕組みそのものは url-design の実装）。
  - ローカル（`npm run dev`・`npm run preview`）での確かめ方。
- **P3「本番切替」に引き継ぐもの**: 本番の Apache で 404 ステータスと中身が返ることの `curl` 確認（url-design の「本番確認」の項目）。
- **含まない**: 403・500 などほかのエラーページ（将来拡張）。存在しない URL に「近いページ」を推測して案内する機能。404 のアクセス集計。

## 現行（WordPress）の振る舞い
- `legacy/404.php` は **0 バイトの空ファイル**。WordPress は存在しない URL で 404 ステータスを返し、このテンプレートを使うが、
  中身が空なので **`get_header()`・`get_footer()` も呼ばれず、真っ白なページ**になっていると考えられる（ヘッダー・フッターも出ない）。
  - 補足: url-design の「現行の振る舞い」表の記述（「中身は空。ヘッダー/フッターのみ」）は誤りだったため、2026-10-27 に url-design 側を訂正した（N-4、D-012）。
- 現行サイトにはトップや一覧への導線が無く、迷った人がそのまま離脱する状態。

## データ構造案
本機能は CMS のデータを使わない（N-1）。ページの props も無い。使うのは次の既存の部品だけ。

```ts
// src/pages/404.astro が使うもの
import BaseLayout from '../layouts/BaseLayout.astro';  // layout.md: { title, description, noindex, loader }
import { routes } from '../lib/routes';                 // url-design: home() / works()
import ViewMoreLink from '../components/common/ViewMoreLink.astro'; // top-page.md（承認済み・D-012）。「実績一覧へ」のボタン（.c-btn-view-more）
```

文言（N-2。D-012 で決定）:

| 要素 | 文言 |
|---|---|
| `<title>`（`title` props） | `ページが見つかりません` → `ページが見つかりません \| UNOTAME` |
| `<meta name="description">`（`description` props） | `お探しのページは見つかりませんでした。` |
| 見出し（h1） | `404 Not Found` |
| 本文 | `お探しのページは見つかりませんでした。URL が変わったか、ページが削除された可能性があります。` |
| 導線 1 | `実績一覧へ`（→ `routes.works()` = `/works/`） |
| 導線 2 | `トップページへ`（→ `routes.home()` = `/`） |

## 振る舞い

### ページ（`src/pages/404.astro`）
- `BaseLayout` を `title="ページが見つかりません"`・`noindex`（true）・`loader` なし（false）で使う。ヘッダー・フッター（大きな CONTACT 導線）は他のページと同じに出る。
- 本文のマークアップ（案。クラスは既存の FLOCSS を流用し、新しいスタイルは足さない）:

```html
<div class="l-page__wrapper l-container">
  <h1 class="l-page-title">404 Not Found</h1>
  <p>お探しのページは見つかりませんでした。URL が変わったか、ページが削除された可能性があります。</p>
  <a class="c-btn-view-more" href="/works/">実績一覧へ</a>
  <p><a href="/">トップページへ</a></p>
</div>
```

- リンクの `href` は `routes.*` で作る（直書きしない）。
- 段落・リンクの余白などで見た目が崩れる場合に限り、`object/project/_not-found.scss`（`p-not-found`）を足してよい（`style-migration.md` の書き方に従う）。
- **ページ内のアセット・リンクはすべてルート相対（`/` 始まり）**にする（url-design）。Apache は `/works/foo/bar/` のような深い URL でも
  URL を変えずに `404.html` の中身を返すため、相対パスだと CSS・画像・リンクが壊れる。Astro の既定（`base` 未設定）では
  `/_astro/…` の絶対パスで出力されるので、相対パスを自分で書かないことだけを守る。

### `<head>`
- `<title>ページが見つかりません | UNOTAME</title>`（`layout.md` の `buildPageTitle`）。
- `<meta name="robots" content="noindex">` を出す。`<link rel="canonical">` は出さない（url-design）。`og:url` も出さない（`layout.md`）。
- sitemap に含めない（P2。url-design の規則どおり）。

### ビルド成果物
- Astro は `404.astro` を `build.format: 'directory'` でも特別に **`dist/404.html`** として出力する（`dist/404/index.html` にはならない）。
- `dist/404.html` を直接開いた場合（`https://unotame.com/404.html`）は 200 で表示されるが、noindex なので問題にしない。

### `.htaccess`（url-design の生成物との関係）
- url-design の決定どおり、`src/htaccess/htaccess.template` から生成する `dist/.htaccess` の**末尾**（① 正規化 → ② 生成ルール → ③ 固定ルール → ④）に
  次の 1 行が入る:

```apache
ErrorDocument 404 /404.html
```

- **パスはルート相対で書く**（`https://unotame.com/404.html` のような完全な URL にすると、Apache は 404 ではなく 302 リダイレクトを返してしまう）。
- これにより、存在しない `/works/{任意}/`、対応表に無い旧 ID（例 `/web/999999/`）、`/feed/` などが **404 ステータス**で `404.html` の中身を返す。
- `.htaccess` 生成の実装（`redirects.ts`・テンプレート・`astro:build:done` などでの書き出し）は url-design の実装範囲。404 ページの実装を先に行う場合、
  `.htaccess` に関する受け入れ条件はその実装の完了時に確認する。
- Xserver のサーバーパネルにもエラーページの設定があるが、`.htaccess` で管理するので使わない（リポジトリの外に設定を持たない。D-009 の方針）。

### ローカルでの確かめ方
- `npm run dev`: 存在しない URL（例 `http://localhost:4321/does-not-exist/`）で 404 ページが表示される。`trailingSlash: 'always'` のため
  `/works`（スラッシュなし）も 404 ステータスになる（url-design の受け入れ条件と同じ）。
  - **2026-10-27 変更（実装時の確認）**: スラッシュなしの URL（`/works`・`/works/{slug}`・`/does-not-exist`）は、dev・preview とも
    自前の 404 ページではなく Astro 既定のページ（「trailingSlash is set to "always"」の案内）が 404 ステータスで出る。Astro の挙動なので受け入れる。
    本番（Apache）では mod_dir が `/works` を `/works/` へ 301 で転送するため、影響はローカルだけ。自前の 404 ページはスラッシュ付きの URL で確かめる。
- `npm run build && npm run preview`: 同じ URL を開き、`curl -i http://localhost:4321/does-not-exist/` で **ステータスが 404**、本文に `404 Not Found` が含まれることを確かめる。
  - Astro の preview サーバーは `dist/404.html` を 404 ステータスで返す想定。Astro 7 で挙動が違った場合は、`dist/404.html` の存在と中身の検査で代える（N-3）。
- `.htaccess` の `ErrorDocument` はローカルの preview では効かない（Apache ではないため）。ローカルでは `dist/.htaccess` の中身を検査し、
  実際の動作は P3「本番切替」の `curl -I` で確認する（D-008）。

## 受け入れ条件

### ビルド成果物（`CMS_SOURCE=fixture npm run build` の `dist/` を検査）
- [ ] `dist/404.html` が存在し、`dist/404/index.html` は存在しない。
- [ ] `dist/404.html` の `<title>` が `ページが見つかりません | UNOTAME`。
- [ ] `dist/404.html` に `<meta name="robots" content="noindex">` があり、`<link rel="canonical">` と `og:url` が無い。
- [ ] `dist/404.html` に `<h1>` がちょうど 1 つあり、`/works/` と `/` へのリンクがある。ヘッダー（ナビ 3 項目）とフッター（CONTACT → `/contact/`）がある。
- [ ] `dist/404.html` のすべての `href`・`src`（`<link>`・`<script>`・`<img>`・`<a>`）が `/`・`#`・`https://` のいずれかで始まる（相対パスが無い）。
- [ ] `dist/404.html` にローダー（`.c-loader`）が無く、ナビに `aria-current` が無い。
- [ ] `dist/404.html` の出力が CMS のデータに依存しない。（2026-10-27 変更。旧: フィクスチャの works を 0 件・別の内容にしても `dist/404.html` が同一）
      `src/pages/404.astro` から import をたどって（動的 import を含む）`src/lib/cms/` に届かないことを、ソースの検査で確かめる。
      パスの別名（alias）を導入した場合は、この検査も別名をたどるよう直す。
- [ ] `dist/.htaccess` の最後の有効な行（コメント・空行を除く）が `ErrorDocument 404 /404.html` で、`ErrorDocument` の指定先が `http` で始まっていない。※ url-design の `.htaccess` 生成の実装後に確認。

### ローカル確認
- [ ] `npm run dev` で `/does-not-exist/` が 404 ページを表示し、`/works`（スラッシュなし）が 404 ステータスになる（中身は Astro 既定のページでよい。2026-10-27 変更）。
- [ ] `npm run preview` で `curl -i http://localhost:4321/does-not-exist/` のステータスが `404` で、本文に `404 Not Found` が含まれる（N-3 で preview の挙動が違うと分かった場合は、この項目を外す）。
- [ ] `/works/aaa/bbb/` のような深い URL で 404 ページを開いても、CSS・フォント・ロゴが読み込まれ、見た目が崩れない。

### 本番（P3「本番切替」のチェックリストに引き継ぐ。url-design の「本番確認」と同じ）
- [ ] `curl -I https://unotame.com/works/does-not-exist/` と `curl -I https://unotame.com/web/999999/` が `404` を返し、`curl https://unotame.com/works/does-not-exist/` の本文が `dist/404.html` と同じ。

### 品質
- [ ] `npm run lint`・`npm run check`・`npm run build` が通る。

## 将来拡張（任意）
- 最新の実績を数件並べる（N-1 の案 B。P1 では採らなかった）。404 から実績へ回遊してもらう効果がある。
- 403（ディレクトリ一覧の禁止など）・500 のエラーページと `ErrorDocument`。
- 404 の発生状況の把握（アクセス解析の導入時に、404 ページのイベントを送る）。

## 未決事項

| ID | 内容 | 決定・決め方 |
|---|---|---|
| N-1 | 404 ページに最新の実績を並べるか | **決定（D-012）**: 並べない（案 A：静的な文言と導線だけ）。CMS が取れないときでも必ず同じ 404 が出て、ビルドの依存が増えない |
| N-2 | 文言（見出しを `404 Not Found` にするか日本語にするか、本文、ボタンの文言） | **決定（D-012）**: 「データ構造案」の表のとおり（見出しは英字、説明は日本語） |
| N-3 | Astro 7 の `astro preview` が、存在しない URL に `dist/404.html` を **404 ステータスで**返すか | 実装時に `curl -i` で確認する。違った場合は受け入れ条件のその項目を外し、`dist/` の検査と P3 の本番確認で代える |
| N-4 | url-design の「現行の振る舞い」表の 404 の記述（「ヘッダー/フッターのみ」）が、空の `404.php` の実際の挙動（真っ白なページ）と合っていない | **対応済み（2026-10-27、D-012）**: url-design の記述を「`legacy/404.php` は 0 バイトで、現行の 404 は空白のページ」に訂正した |
