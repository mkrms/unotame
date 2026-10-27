# 機能仕様: URL 設計（url-design）

> 状態: **承認済み（2026-10-27、推奨案どおり）**。decisions-log D-009 に記録。
> **2026-10-27 変更（D-012）**: U-9 を「replaceState」で決定（works-list L-1）。現行の 404 の記述を訂正（not-found N-4）。

## 目的
- 新サイト（Astro 静的出力 + microCMS、Xserver/Apache 配信）の **URL 体系を一本化**し、ページ・リンク生成・
  canonical・sitemap・リダイレクトがすべて同じ規則に従う状態にする。
- 実績詳細の URL を、意味を持たない数値 ID とカテゴリ依存の `/{category}/{投稿ID}` から、
  **カテゴリ変更の影響を受けない読める URL** `/works/{slug}/` に改める。
- 旧 URL（WordPress）への被リンク・検索エンジンの評価を失わないよう、**旧 → 新の 301 リダイレクト方式**を定める。

## スコープ（対象フェーズ）
- **P1（本書の主対象）**
  - URL 体系（トップ / works 一覧 / works 詳細 / カテゴリ絞り込み / contact / 404）と末尾スラッシュ方針。
  - Astro 側の設定（`site` / `trailingSlash` / `build.format`）とルーティング（`src/pages/` の配置）。
  - URL を生成する関数の一元化（ページ・コンポーネントはパスを文字列で直書きしない）。
  - slug の命名規則と、microCMS での slug の持ち方（スキーマ案は「CMS 連携」仕様と整合させる）。
  - 旧 URL → 新 URL のリダイレクト規則の**生成ロジック**（`.htaccess` の中身をビルドで出力し、ローカルで内容を検証できるところまで）。
- **P2**: canonical / sitemap の実装（「SEO / OGP」仕様で実装。本書では URL 上の規則のみ定める）。旧投稿 ID と slug の対応付け（「コンテンツ移行」で実施）。
- **P3**: 本番での `.htaccess` 適用と、`curl` による実地確認（「本番切替」で実施）。
- **含まない**: ページネーション（`/works/page/2/` 等）、カテゴリ別の静的ページ（「将来拡張」参照）、多言語 URL。

## 現行（WordPress）の振る舞い

| ページ | 現行 URL | 実体 |
|---|---|---|
| トップ | `/` | `front-page.php`（Works 最新 6 件、About、SNS リンク） |
| 実績一覧 | `/works/` | 投稿アーカイブ。`functions.php` で `post` に `has_archive = 'works'` を付与 → `archive.php` |
| 実績詳細 | `/{category}/{投稿ID}`（例 `/web/123`）※ | 投稿（`single.php`）。パーマリンク構造は `/%category%/%post_id%` 系 |
| お問い合わせ | `/contact/` | 固定ページ（`page-contact.php`、本文は WP 側でフォームプラグイン想定） |
| 404 | 任意の未定義 URL | `404.php`。`legacy/404.php` は 0 バイトで、現行の 404 は空白のページ（ヘッダー・フッターも出ない）。2026-10-27 訂正（D-012。旧記述「ヘッダー/フッターのみ」は誤り） |

※ 末尾スラッシュの有無は未確認（未決事項 U-1）。

補足（移行元コードから読み取れること・WP が暗黙に持っている URL）:
- ナビ・「View More」は `home_url('works')` / `home_url('contact')` で、**末尾スラッシュなし**のリンク（`/works`）を出力している。
  WP の canonical リダイレクトで `/works/` に寄せられている可能性が高い。
- カテゴリ絞り込みは `/works/` 上の JS（`assets/js/script.js`）で行い、**URL には反映されない**（状態を共有できない）。
- `%category%` はカテゴリスラッグで、複数カテゴリの投稿は 1 つ目（ID が最小）のカテゴリ、子カテゴリの場合は
  `/{親}/{子}/{ID}` になる。
- WP 標準で以下の URL も到達可能だった（被リンク・インデックスが残っている可能性あり）:
  `/?p={ID}`、カテゴリアーカイブ `/category/{slug}/`、`/works/page/{n}/`、`/feed/`、
  `/wp-content/uploads/...`（本文画像）、`/wp-content/themes/unotame/assets/img/unotame-logo-square.png`（現行 OGP 画像）。

## 新しい URL 体系

| ページ | 新 URL | Astro のソース（案） | 出力ファイル |
|---|---|---|---|
| トップ | `/` | `src/pages/index.astro` | `dist/index.html` |
| About | `/#about`（トップ内アンカー。独立ページは作らない） | 同上 | — |
| 実績一覧 | `/works/` | `src/pages/works/index.astro` | `dist/works/index.html` |
| 実績一覧（カテゴリ絞り込み） | `/works/?category={categorySlug}` | 同上（クライアント側で絞り込み） | — |
| 実績詳細 | `/works/{slug}/` | `src/pages/works/[slug].astro`（`getStaticPaths`） | `dist/works/{slug}/index.html` |
| お問い合わせ | `/contact/` | `src/pages/contact.astro` | `dist/contact/index.html` |
| 404 | （該当なしのすべて） | `src/pages/404.astro` | `dist/404.html` |

- すべてのページ URL は **小文字・ASCII・末尾スラッシュあり** で統一する（ファイル `.html` を URL に出さない）。
- 正規ホストは `https://unotame.com`（非 www、https）。http / www からの正規化は `.htaccess` で 301（www 運用の有無は U-6）。
- お問い合わせの送信先（PHP や SaaS のエンドポイント、送信完了ページ `/contact/thanks/` の要否）は「お問い合わせ」仕様で決める。
  本書では `/contact/` を維持することだけを定める。

### カテゴリ絞り込みを URL に持たせるか（比較）

| 案 | 例 | 長所 | 短所 |
|---|---|---|---|
| A. 持たせない（現行どおり） | `/works/` のみ | 実装が最小。ページ数が増えない | 絞り込み状態を共有・ブックマークできない。旧 `/category/{slug}/` の受け皿がない |
| **B. クエリ（推奨）** | `/works/?category=web` | 静的 1 ページのまま実現（JS が `URLSearchParams` を読む）。共有・戻る操作に対応できる。旧カテゴリアーカイブを 301 で受けられる。canonical を `/works/` に集約でき重複コンテンツにならない | JS 無効時は全件表示になる（劣化は許容範囲）。カテゴリ別ページとしては検索に載らない |
| C. パス | `/works/category/web/` | JS なしで成立。カテゴリ別ページとして検索に載せられる | カテゴリ数だけ静的ページが増え、一覧とほぼ同じ内容の重複ページになる。カテゴリスラッグ変更時に新たなリダイレクトが要る。ポートフォリオの規模（数十件）に対して過剰 |

**推奨: B（クエリ `?category=`）**。理由: 静的ホスティングのまま最小コストで共有可能な状態を持てる。
カテゴリは「絞り込みの状態」であってページではないため canonical は `/works/` に寄せる。
将来カテゴリ別ページを検索に載せたくなった場合は C へ拡張できる（そのときは B → C を 301）。

- 振る舞い:
  - `/works/` 表示時に `category` クエリを読み、存在するカテゴリスラッグなら該当カテゴリで絞り込んだ状態で表示する。
  - 未知の値・空値は無視して「全て」を表示する（エラーにしない）。
  - 絞り込みボタン操作時は `history.replaceState` で `?category=` を更新し、「全て」選択時はクエリを取り除く。
    （`pushState` は使わない。2026-10-27 決定、D-012。U-9・works-list L-1）
  - 絞り込み UI 自体の仕様は「Works 一覧」仕様に委ねる。本書はクエリ名とスラッグの規則のみを定める。

### 末尾スラッシュの方針

**方針: 末尾スラッシュ「あり」に統一。** Astro 設定（案）:

```ts
// astro.config.mjs（案）
export default defineConfig({
  site: 'https://unotame.com',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' }, // 既定値だが明示する
});
```

- `build.format: 'directory'` で `works/index.html` 形式に出力され、Apache 上で `/works/` がそのまま配信される。
- Apache（Xserver）の `mod_dir`（`DirectorySlash On` が既定）により、`/works` のようにスラッシュなしで来た場合は
  実ディレクトリ `works/` が存在するので `/works/` へ **301** される。サーバー側でスラッシュを付ける追加設定は原則不要。
  - ただし `mod_dir` のリダイレクト先は `Host` ヘッダ由来のため、https/ホスト正規化ルールを `.htaccess` の先頭に置き、
    多段リダイレクト（http → https → スラッシュ付与）を極力 1〜2 段に抑える。
- `trailingSlash: 'always'` は **開発サーバーでのみ** スラッシュなし URL を 404 にする（本番の挙動は Apache が決める）。
  リンクの書き忘れを開発中に検出する目的で採用する。
- `/works/index.html` のような `.html` 直アクセスも配信されてしまうため、canonical で `/works/` を明示する（リダイレクトまではしない）。
- 末尾スラッシュ「なし」案（`build.format: 'file'` + `works.html`）は、Apache で拡張子なし配信の書き換えルールが必要になり、
  現行（`/works/`・`/contact/`）とも合わないため採らない。

## slug の命名規則

- 使用文字: 英小文字 `a-z`・数字 `0-9`・ハイフン `-` のみ（日本語・大文字・アンダースコア・スペース不可）。
- 形式（正規表現案）: `^(?=.*[a-z])[a-z0-9]+(?:-[a-z0-9]+)*$`
  - 先頭・末尾のハイフン、連続ハイフンは不可。
  - **英字を最低 1 文字含む（数字のみ不可）**。旧 URL の数値 ID と見分けられ、リダイレクト規則と衝突しないようにするため。
- 長さ: 3〜60 文字（案）。
- 予約語（使用不可）: `page`、`category`、`feed`、`index`、`404`。
- 付け方の目安: 「案件や制作物を表す英語の kebab-case」。例 `unotame-portfolio`、`xxx-corporate-site`、`yyy-lp-redesign`。
  年やカテゴリ名は原則入れない（カテゴリを URL から外した意味がなくなるため）。
- **公開後は変更しない**のが原則。変更が必要な場合のリダイレクトは「将来拡張」で扱う（P1 では手書きの追記で対応可能）。
- カテゴリのスラッグ（`?category=` の値）も同じ文字種規則に従う（数字のみ可否は問わない）。

### microCMS で slug を何で持つか（比較）

| 案 | 長所 | 短所 |
|---|---|---|
| X. コンテンツ ID を slug として使う | フィールド追加不要。一意性を microCMS が保証。詳細取得が ID 直指定で済む | 入力し忘れると自動採番のランダム ID（例 `a1b2c3d4e5`）が URL になる。正規表現などの入力制約をかけられない。ID の後変更の可否・手順が運用上わかりにくい（要確認 U-7） |
| **Y. 専用の `slug` フィールド（推奨）** | テキストフィールドの「必須」「重複を許可しない」で一意性を CMS 入力時点で守れる（命名規則はビルド時に検証。D-010）。コンテンツ ID と URL を切り離せる（CMS 差し替え時も URL を維持しやすい） | フィールドが 1 つ増える。単体取得はフィルタ（`slug[equals]...`）になる（ただし SSG ではビルド時に全件取得するため実質影響なし） |

**推奨: Y（専用 `slug` フィールド）**。slug を人が決められることと、URL を CMS 内部 ID から独立させる（D-004 の「CMS 差し替えの影響を局所化」と整合）ことを優先する。
加えて、ビルド時にも検証する（CMS の設定漏れ・別 CMS への移行に備えた二重チェック）。

## データ構造案

### microCMS スキーマ（案。最終形は「CMS 連携」仕様で確定）

`works`（リスト形式）に URL 関連として以下を持たせる:

| フィールド ID | 種類 | 必須 | 設定 | 用途 |
|---|---|---|---|---|
| `slug` | テキストフィールド | ○ | 重複を許可しない（正規表現の入力制限は付けない。命名規則はビルド時に検証・D-010） | 詳細 URL `/works/{slug}/` |
| `legacyWpId` | 数字 | — | （重複不可は CMS では設定できない想定 → ビルド時に検証） | 旧 WP 投稿 ID。旧 URL リダイレクト生成に使う。新規作成の実績では空 |

`categories`（リスト形式）:

| フィールド ID | 種類 | 必須 | 設定 | 用途 |
|---|---|---|---|---|
| `name` | テキストフィールド | ○ | — | 表示名 |
| `slug` | テキストフィールド | ○ | 重複を許可しない（正規表現の入力制限は付けない。形式 `^[a-z0-9]+(?:-[a-z0-9]+)*$` はビルド時に検証・D-010） | `?category=` の値。WP のカテゴリスラッグを引き継ぐ |
| `legacyWpSlugs` | テキストフィールド（任意、カンマ区切り） | — | — | WP 時代のカテゴリスラッグがいまと異なる場合のみ。旧 `/category/{slug}/` のリダイレクト生成に使う |

※ `legacyWpSlugs` は旧カテゴリスラッグを変える場合だけ必要。変えないなら不要（U-5）。

### ドメイン型・ルーティング関数（案）

```ts
// src/lib/domain/work.ts（案）— CMS レスポンスから変換済みの型。表示側はこれだけを見る
export type Work = {
  slug: string;            // 検証済み
  legacyWpId?: number;
  title: string;
  category: Category;
  // ...（本文・アイキャッチ等は CMS 連携 / Works 詳細仕様）
};
export type Category = { slug: string; name: string; legacyWpSlugs: string[] };

// src/lib/routes.ts（案）— URL はここでのみ組み立てる
export const routes = {
  home: () => '/',
  about: () => '/#about',
  works: (opts?: { category?: string }) =>
    opts?.category ? `/works/?category=${encodeURIComponent(opts.category)}` : '/works/',
  work: (slug: string) => `/works/${slug}/`,
  contact: () => '/contact/',
};
export const absoluteUrl = (path: string) => new URL(path, 'https://unotame.com').href; // site 設定から取る
```

```ts
// src/lib/slug.ts（案）— 検証（CMS → ドメイン変換の中で呼ぶ。違反はビルド失敗）
export const SLUG_PATTERN = /^(?=.*[a-z])[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const RESERVED_SLUGS = ['page', 'category', 'feed', 'index', '404'];
export function assertValidWorkSlugs(works: { slug: string; legacyWpId?: number }[]): void;
// - パターン違反・長さ違反・予約語・slug 重複・legacyWpId 重複 → 該当 slug を列挙して throw
```

```ts
// src/lib/redirects.ts（案）— 純粋関数。.htaccess 断片を文字列で返す（テスト容易）
export type LegacyWorkRedirect = { legacyWpId: number; slug: string };
export type LegacyCategoryRedirect = { fromSlug: string; toSlug: string };
export function buildRedirectRules(input: {
  works: LegacyWorkRedirect[];
  categories: LegacyCategoryRedirect[];
}): string;
```

## 振る舞い

### ページとリンク
- `getStaticPaths` は microCMS の全 works を取得（100 件超に備えて全件取得）し、`slug` ごとに `/works/{slug}/` を生成する。
- トップの Works 最新 6 件・一覧・詳細の Latest・ナビ・フッター・「View More」のリンクはすべて `routes.*` で生成する。
  - ヘッダーの「ABOUT」は `/#about`（トップの About セクションに `id="about"` を付ける。現行はトップへのリンクのみ）。U-10。
- 下書き・非公開の works はページを生成しない（取得条件は CMS 連携仕様）。
- slug 検証に失敗した場合は **ビルドを失敗させ**、どのコンテンツが違反かをメッセージに出す。

### 404
- `src/pages/404.astro` → `dist/404.html`。`.htaccess` に `ErrorDocument 404 /404.html` を置く。
- 404 ページ内のアセット・リンクはすべてルート相対（`/` 始まり）にする（深い階層で 404 になっても崩れないように）。
- 存在しない `/works/{任意}/` は Apache が 404 ステータスで `404.html` を返す。
- 404 ページ自体の内容は「404 ページ」仕様に委ねる。

### 旧 URL → 新 URL のリダイレクト（301）

対応表:

| 旧 URL（パターン） | 新 URL | 方式 |
|---|---|---|
| `/{category…}/{ID}` と `/{category…}/{ID}/`（カテゴリ部分は 1 階層以上・任意の値。先頭が 4 桁の年のもの・ID の直前が `page` のものは除く） | `/works/{slug}/` | ID ごとの個別ルール（生成） |
| `/?p={ID}` | `/works/{slug}/` | ID ごとの個別ルール（生成。クエリは破棄） |
| `/category/{wpCatSlug}/`（`/category/{親}/{子}/`、`/category/{slug}/page/{n}/` を含む） | `/works/?category={新カテゴリslug}` | 汎用ルール（同名なら 1 本）＋ 変更分のみ個別ルール |
| `/works/page/{n}/` | `/works/` | 汎用ルール |
| `/works`・`/contact`（スラッシュなし） | `/works/`・`/contact/` | Apache `mod_dir` に任せる |
| `/feed/` ほか WP 固有（`/wp-admin/`、`/wp-login.php`、`/author/…`、日付アーカイブ、`/category/{slug}/feed/`・`/category/{slug}/feed/atom/` などのフィード） | — | リダイレクトしない（404。`/feed/` は U-8。`feed` がカテゴリとして拾われないよう、汎用カテゴリルールで除外する） |
| 上記に該当しない旧 ID（対応表にない ID） | — | 404（`/works/` への一括転送はしない＝ソフト 404 を避ける） |

**カテゴリ名（スラッグ）が変わった場合の扱い**: 詳細ページのルールは **ID だけで照合し、カテゴリ部分は任意の値を許容**する。
したがって、WP 時代にカテゴリを変更していた・複数カテゴリ・子カテゴリだった場合でも、ID が一致すれば正しく転送される。
新サイトではカテゴリが URL に含まれないため、今後カテゴリを変更・改名しても詳細 URL は変わらず、リダイレクトの追加も不要。
カテゴリアーカイブ（`/category/{slug}/`）だけは旧スラッグに依存するため、改名したカテゴリは `legacyWpSlugs` から個別ルールを生成する。

**`.htaccess` の生成ルール（案）**（2026-10-27 変更。実装時のレビューで、旧詳細ルールが `/works/page/2/` や日付アーカイブ `/2020/12/` を、
カテゴリの汎用ルールがカテゴリのページ送り・フィードを誤って転送することが分かったため、パターン・順序・転送先を改めた）:

```apache
RewriteEngine On

# --- ③ 固定: ページネーション（生成ルールより前） ---
RewriteRule ^works/page/[0-9]+/?$ https://unotame.com/works/ [R=301,L]

# --- ② 生成: 旧 WP 実績詳細（legacyWpId → slug） ---
# /{category…}/123 または /{category…}/123/（先頭が 4 桁の年、ID の直前が page のものは除く）
RewriteRule ^(?![0-9]{4}/|wp-)(?:[^/]+/)*(?!page/)[^/]+/123/?$ https://unotame.com/works/unotame-portfolio/ [R=301,L]
# /?p=123
RewriteCond %{QUERY_STRING} (?:^|&)p=123(?:&|$)
RewriteRule ^$ https://unotame.com/works/unotame-portfolio/? [R=301,L]

# --- ② 生成: カテゴリ（変更があったものだけ） ---
RewriteRule ^category/(?:[^/]+/)*old-web(?:/page/[0-9]+)?/?$ https://unotame.com/works/?category=web [R=301,L]
# --- ③ 固定: カテゴリ（同名の残り。最短一致で末尾の要素を取り、ページ送りも受ける。feed・feed/atom などのフィードは対象外で 404） ---
# 先読みは category/ の直後でパス全体に掛ける（途中に置くと最短一致が feed/ を越えて atom をカテゴリとして拾うため）
RewriteRule ^category/(?!(?:[^/]+/)*feed(?:/[^/]+)?/?$)(?:[^/]+/)*?([a-z0-9-]+)(?:/page/[0-9]+)?/?$ https://unotame.com/works/?category=$1 [R=301,L]

# --- ① https / ホスト正規化（旧 URL のルールより後ろ。省略） ---
# --- ④ ErrorDocument 404 /404.html ---
```

- 個別ルールは、新 URL `/works/{slug}/` と衝突しない（slug は英字必須のため数値だけのパス要素にならない）。
  先頭が 4 桁の年（日付アーカイブ）・先頭が `wp-`（`wp-json`・`wp-content` など）・ID の直前が `page`（ページ送り）の URL は否定先読みで除外する。
  フィード（末尾が `feed` または `feed/atom`・`feed/rss2` など）は、汎用カテゴリルールの否定先読みで対象外にし、404 にする（除外専用のルールは置かない）。WP の分割ページ（`/{cat}/{ID}/2/`）は扱わない（U-1 の確認後に判断）。
- 置換先の末尾 `?` は元クエリを破棄する指定。旧詳細のパスルールは元のクエリを残す（`/web/123/?utm=x` → `/works/foo/?utm=x`。害はない）。
- 転送先は `https://unotame.com/...` の完全な URL で書く（2026-10-27 変更。旧: ルート相対）。http の旧 URL も 1 回の 301 で最終 URL に届く。
  `ErrorDocument` だけはルート相対（完全な URL にすると 404 ではなく 302 になるため）。
- `.htaccess` 内の順序は「③ ページ送り → ② 生成ルール → ③ カテゴリ汎用 → ① https/ホスト正規化 → ④ ErrorDocument」とする。
  （2026-10-27 変更。① を先頭に置くと、http・www の旧 URL はまず https への寄せが当たって 2 回の 301 になることを Apache で確認したため。
  旧 URL のルールは完全な URL へ飛ぶので当たれば 1 回で届き、当たらないリクエストは最後の ① で正規化される）

**対応表の持ち方（比較）**:

| 案 | 長所 | 短所 |
|---|---|---|
| P. `.htaccess` を手書き（`public/.htaccess`） | 仕組みが最小。ビルドに依存しない | 対応表と CMS の slug が二重管理になる。slug の付け替えや移行時の転記ミスに気づけない |
| Q. リポジトリ内の設定ファイル（例 `src/data/legacy-works.json`）から生成 | CMS に依存せずレビュー可能（差分が PR に出る）。旧 ID は増えないので固定データと相性がよい | slug を CMS で変えたときに設定ファイルの追従が必要（二重管理は残る） |
| **R. CMS の `legacyWpId` から生成（推奨）** | 対応の「正」が実績データ自身にあり、slug を変えても次のビルドで自動追従。コンテンツ移行（P2）時に 1 件ずつ入力でき、手書き表が不要 | ビルドが CMS に依存（どのみちページ生成で依存済み）。編集者が誤って値を消すとリダイレクトが消える → ビルド時の件数チェックで検知 |

**推奨: R**（CMS の `legacyWpId` を正とし、ビルドで `.htaccess` を生成）。
- 実装案: `public/` には置かず、テンプレート（例 `src/htaccess/htaccess.template`。正規化ルール・固定ルール・ErrorDocument を含む）に
  `buildRedirectRules()` の出力を差し込み、`dist/.htaccess` に書き出す（Astro インテグレーションの `astro:build:done` か、`build` 後のスクリプト）。
- 安全策: 期待する旧 ID 件数（`EXPECTED_LEGACY_COUNT` などの定数、またはスナップショットテスト）を持ち、生成ルール数が減ったらビルドを失敗させる。
  **実装（2026-10-27）**: 定数は `src/data/redirects.ts` の `EXPECTED_LEGACY_WORK_REDIRECTS`。旧 ID はコンテンツ移行（P2・U-2）で入れるため、
  当面は 0（保護が効かない）。移行後に移行件数へ上げる。実際の件数が定数より多いときはビルドで「定数を上げる」よう警告する。
  P3 の本番切替のチェックリストに「`EXPECTED_LEGACY_WORK_REDIRECTS` が移行件数と等しい（0 でない）」を入れる。
- 書き出し（実装）: Astro は `.` で始まるページを出力しないため、`src/pages/htaccess.txt.ts` で出力し、`src/integrations/htaccess.ts` が
  `astro:build:done` で `dist/htaccess.txt` を `dist/.htaccess` に改名する（`public/.htaccess` があればビルドを失敗させる）。
  P2 で sitemap を入れるときは、`htaccess.txt` が sitemap に含まれないことを確かめる。
- `.htaccess` は**デプロイ対象に含める**前提（`hosting-and-deploy.md` の「`--delete` で `.htaccess` を除外」案と調整が必要。U-4）。
  Xserver 側で自動追記される設定（SSL 化など）がある場合は、テンプレートへ取り込んでリポジトリ管理する。

### SEO 観点（URL に関わる規則のみ。実装は「SEO / OGP」仕様・P2）
- **canonical**: 全ページに `<link rel="canonical">` を絶対 URL で出す。値は `absoluteUrl(routes.*)`（https・非 www・末尾スラッシュあり）。
  - `/works/?category=xxx` の canonical は `/works/`（クエリなし）。
  - `404.html` には canonical を出さず `noindex` とする。
- **sitemap**: `@astrojs/sitemap` 等で生成し、含めるのは `/`・`/works/`・`/works/{slug}/` 全件・`/contact/`。
  404・クエリ付き URL・リダイレクト元は含めない。URL は canonical と完全一致させる（末尾スラッシュ含む）。
- **301 を使う**（302 は使わない）。旧詳細 URL は 1 回のリダイレクトで最終 URL に到達させる（チェーンを作らない）。
- 本番切替後、Google Search Console で新 sitemap を送信し、旧 URL のクロール状況を確認する（本番切替の手順に含める）。

## 受け入れ条件

### ビルド・ルーティング（P1。`npm run build` とユニットテストで判定）
- [ ] `astro.config` に `site: 'https://unotame.com'`、`trailingSlash: 'always'`、`build.format: 'directory'` が設定されている。
- [ ] ビルド後、`dist/index.html`、`dist/works/index.html`、`dist/contact/index.html`、`dist/404.html` が存在する。
- [ ] CMS 上の公開 works すべてについて `dist/works/{slug}/index.html` が存在し、それ以外の `dist/works/*/` は存在しない。
- [ ] `dist/` 配下の HTML に含まれる内部リンク（`href` が `/` 始まり）はすべて `/` で終わるか `/#`・`/?` を含む形式で、`.html` で終わるものがない。
- [ ] ヘッダーの WORKS / CONTACT、トップの「View More」、詳細の「View More」の `href` がそれぞれ `/works/`・`/contact/`・`/works/` である。
- [ ] トップ・一覧・詳細 Latest の各実績リンクの `href` が `/works/{slug}/` 形式である。
- [ ] `routes.work('abc-def')` が `/works/abc-def/`、`routes.works({ category: 'web' })` が `/works/?category=web`、`routes.works()` が `/works/` を返す（ユニットテスト）。
- [ ] `npm run dev` で `/works`（スラッシュなし）にアクセスすると 404 になり、`/works/` は 200 になる。

### slug 検証（ユニットテスト）
- [ ] `unotame-portfolio`、`site2024`、`abc` など規則に合う slug は通る。`ABC`、`abc_def`、`-abc`、`abc-`、`a--b`、`123`、`ポートフォリオ`、`page`、61 文字以上、2 文字以下は拒否される。
- [ ] slug が重複する入力、`legacyWpId` が重複する入力で `assertValidWorkSlugs` が例外を投げ、メッセージに該当 slug / ID が含まれる。
- [ ] CMS データに規則違反の slug が含まれる場合、`npm run build` が非 0 で終了する。

### リダイレクト生成（ユニットテスト・ビルド成果物の検査）
- [ ] `buildRedirectRules` に `{ legacyWpId: 123, slug: 'foo' }` を与えると、`^(?:[^/]+/)+123/?$` → `/works/foo/` の `R=301` ルールと、`p=123` クエリ用ルールが出力される。
- [ ] `legacyWpId` を持たない works からはルールが生成されない。
- [ ] 生成ルールのパターンを JS の正規表現として評価したとき、`web/123`、`web/123/`、`design/sub/123/` に一致し、`web/1234`、`web/12`、`works/foo/` に一致しない（テストで Apache の正規表現と同等の範囲を確認）。
- [ ] ID=2・12 のルールがあっても、`works/page/2/`・`page/2/`・`2020/12/` は実績へ転送されず、`works/page/2/` の行き先は `/works/`。`category/web/page/2/` は `?category=web`、`category/web/feed/` は転送されない。（2026-10-27 追加）
- [ ] `legacyWpSlugs: ['old-web']`、`slug: 'web'` のカテゴリから `^category/(?:[^/]+/)*old-web/?$` → `/works/?category=web` が生成され、汎用カテゴリルールより前に出力される。
- [ ] `dist/.htaccess` が存在し、③ ページ送り → ② 生成ルール → ③ カテゴリ汎用 → ① 正規化 → ④ `ErrorDocument 404 /404.html` の順で並んでいる。（2026-10-27 変更）
- [ ] 生成された詳細リダイレクトの件数が期待件数（旧 ID 件数）を下回るとビルドが失敗する。

### 一覧のカテゴリクエリ（P1。ブラウザテスト。詳細は Works 一覧仕様）
- [ ] `/works/?category={存在するslug}` を開くと、そのカテゴリの実績だけが表示され、該当ボタンが選択状態になる。
- [ ] `/works/?category=unknown` と `/works/?category=` は全件表示になり、エラーにならない。
- [ ] 絞り込みボタンを押すと URL の `category` クエリが更新され、「全て」でクエリが消える。

### 本番確認（P3「本番切替」のチェックリストに引き継ぐ。`curl -I` で判定）
- [ ] 対応表の全旧 URL（スラッシュあり・なし両方）が 1 回の `301` で `https://unotame.com/works/{slug}/` に到達する。
- [ ] `/?p={ID}` が `301` で同じ新 URL に到達し、`?p=` が残らない。
- [ ] `/works` → `301` → `/works/`（200）、`/contact` → `301` → `/contact/`（200）。
- [ ] `http://unotame.com/works/`（および www を運用しない場合は `https://www.unotame.com/works/`）が 1 回の `301` で `https://unotame.com/works/` になる。
- [ ] `/works/does-not-exist/` と `/web/999999/`（対応表にない ID）が `404` ステータスで 404 ページの内容を返す。
- [ ] `/category/{旧slug}/` が `301` で `/works/?category={新slug}` に到達する。
- [ ] `http://unotame.com/{category}/{ID}/` も 1 回の `301` で `https://unotame.com/works/{slug}/` に到達する（Xserver で `%{HTTPS}` が正しく判定されることの確認を兼ねる）。
- [ ] `EXPECTED_LEGACY_WORK_REDIRECTS` が移行件数と等しい（0 でない）。

## 将来拡張（任意）
- slug 変更時の自動リダイレクト: works に `previousSlugs`（繰り返し or カンマ区切り）を持たせ、`/works/{旧slug}/` → `/works/{新slug}/` を同じ生成器で出す。
- カテゴリ別ページ（案 C: `/works/category/{slug}/`）が必要になった場合の追加と、`?category=` からの 301。
- ページネーション（`/works/page/{n}/`）。実績が増えて一覧が重くなった場合に検討。
- ローカルでの `.htaccess` 実地検証（Docker の `httpd` に `dist/` をマウントして `curl` テストを流す）。D-008 で本番以外の確認環境は置かない方針のため、必要性が出たら提案する。

## 未決事項

| ID | 内容 | 決め方・必要な作業 |
|---|---|---|
| U-1 | 現行パーマリンクの**正確な形**（末尾スラッシュの有無、カテゴリ部分にカテゴリベースが付くか、子カテゴリの有無） | 本番 WP の「設定 > パーマリンク」を確認。※生成ルールはスラッシュ有無の両方を受けるため、どちらでも動作はする |
| U-2 | **旧投稿 ID ⇔ 新 slug の対応表**の作成 | 本番 WP から全公開投稿の「ID・タイトル・カテゴリスラッグ・パーマリンク」を書き出し（WP 管理画面のエクスポート、または WP-CLI `wp post list --fields=ID,post_title,post_name --post_status=publish`）、slug を決めて microCMS の `slug`・`legacyWpId` に入力する。コンテンツ移行（P2）と同時に行う |
| U-3 | slug を専用フィールドで持つ（推奨 Y）か、コンテンツ ID を使うか | **決定（D-009）**: 専用フィールド（案 Y）。「CMS 連携」仕様のスキーマに反映する |
| U-4 | `.htaccess` を**デプロイ対象に含めて**リポジトリ管理する（推奨）か、サーバー手置きにするか | **決定（D-009）**: リポジトリで管理しデプロイ対象に含める。現行サーバーの `.htaccess` のバックアップ・確認は本番切替前に行う |
| U-5 | WP のカテゴリスラッグを新サイトでも**そのまま使うか**（変えるなら `legacyWpSlugs` が必要） | **決定（D-009）**: 現行スラッグを引き継ぐ（`legacyWpSlugs` は原則不要）。現行カテゴリ一覧の確認はコンテンツ移行時に行う |
| U-6 | 正規ホスト（`unotame.com` か `www.unotame.com` か）と、現在の http→https 強制の有無 | **決定（D-009）**: 正規ホストは `unotame.com`（www なし）。現在の http→https 強制の有無は本番切替前に確認 |
| U-7 | microCMS のコンテンツ ID の後変更の可否・文字数制約（案 X を選ぶ場合のみ重要） | **不要**: 案 Y（専用フィールド）を採用したため |
| U-8 | `/feed/` の扱い（404 のままか、`/` へ 301 か、RSS を新設するか） | 購読者の有無で判断。P1 は 404 を想定 |
| U-9 | カテゴリ切替時の履歴の扱い（`replaceState` か `pushState` か） | **決定：replaceState（D-012）**。2026-10-27、works-list L-1 で決定。履歴を増やさず、詳細から戻ったときは URL の `?category=` から状態を復元する |
| U-10 | ヘッダー「ABOUT」を `/#about` にする（現行はトップへのリンクのみ） | **決定（D-009）**: `/#about` にする |
| U-11 | 本文画像 `/wp-content/uploads/...` と現行 OGP 画像 URL（`/wp-content/themes/unotame/...`）を本番切替後も残すか | 画像は microCMS へ移行する前提だが、外部からの直リンク・SNS の OGP キャッシュが切れる。残す場合は rsync 除外、残さない場合は 404（または新画像へ 301）。コンテンツ移行・本番切替で決める |
| U-12 | slug の長さ上限（案 60 文字）・予約語の過不足 | **決定（D-009）**: 推奨どおり（3〜60 文字、予約語 `page` / `category` / `feed` / `index` / `404`） |
