# 機能仕様: CMS 連携（cms-integration）

> 状態: **承認済み（2026-10-27。C-1 は入力制限なし、他は推奨どおり。decisions-log D-010）**。`url-design.md`（承認済み・D-009）のスキーマ案・ドメイン型・ルーティング関数を
> 引き継いで確定させる。url-design の内容は変更していない（変更が必要と思われる点は「未決事項」に挙げた）。
> **2026-10-27 変更（D-012）**: P1 のページ仕様の承認に合わせ、`Profile` 型（top-page T-6）、プロフィールの受け入れ条件（top-page T-7）、
> Latest の取得（works-detail D-1）、C-8（works-detail D-5）、C-16（works-list L-2）を更新した。
> **2026-10-27 変更（実装・レビューの反映）**: 実装時の判断とレビュー指摘に合わせ、取得の流れ（検証 → 変換の順）、description の自動生成、
> 本文の加工の範囲、`totalCount` の照合、環境変数を読む場所と開発時の判定方法、0 件の扱いを更新し、未決事項 C-17 を追加した。

## 目的
- Works（実績）とカテゴリを microCMS で管理し、**ビルド時に API から取得して静的生成**する仕組みを定める（D-004）。
- **データ取得（microCMS API）と表示（Astro コンポーネント）を分離**する。API のレスポンスは必ず「ドメイン型」へ変換してから
  ページへ渡し、CMS の差し替えや API 仕様の変更が `src/lib/cms/` の中だけで済むようにする。
- CMS の入力ミス（slug の規則違反・重複、カテゴリ参照切れなど）を**ビルドで検出して失敗させ**、壊れたサイトを公開しない。
- API キーなどの秘密情報を安全に扱い、ステージングが無い前提（D-008）でもローカルで下書きを確認できるようにする。

## スコープ（対象フェーズ）
- **P1（本書の主対象）**
  - microCMS の API 設計（`works`・`categories`）の確定。
  - データ取得層（`src/lib/cms/`）：クライアント、全件取得、レスポンス → ドメイン型の変換、ビルド時の検証。
  - `getStaticPaths` との連携方法、ページから使う公開関数。
  - 画像 URL の組み立て（microCMS 画像 API のパラメータ）と、本文 HTML の最小限の加工。
  - 環境変数・`.env.example`・GitHub Secrets との対応。
  - ローカル開発：下書きプレビュー（開発時のみ）と、API を呼ばないフィクスチャモード。
- **P2**: 本文画像・サムネイルの astro:assets 化の要否判断（「パフォーマンス / a11y」）、OGP での `description` 利用（「SEO / OGP」）、
  WP 投稿の移行作業（「コンテンツ移行」）、PR の CI でフィクスチャモードのビルドを回すこと（「CI」）。
- **P3**: microCMS Webhook → GitHub `repository_dispatch` による再ビルド（**詳細は `spec/infra/hosting-and-deploy.md` に任せる**）。
- **含まない**: トップの KV・Message・About・SNS リンクの CMS 化（本書ではリポジトリ内データで持つと決める。「将来拡張」参照）、
  お問い合わせ、ページネーション、全文検索、多言語。

## 現行（WordPress）の振る舞い
- 実績は WP の「投稿」（管理画面の表示名は「ポートフォリオ」。`functions.php` の `Change_menulabel`）。
- 使っている項目: **タイトル・本文・アイキャッチ・カテゴリ**。タグは管理画面から外している（`my_unregister_taxonomies`）。
- カテゴリは `get_the_category()` の **先頭 1 件だけ** を表示・絞り込みに使う（`front-page.php` / `archive.php` / `single.php`）。
  複数付いていても 2 件目以降は無視されている。
- 並び順はすべて WP_Query の既定（**投稿日の新しい順**）。件数はトップ 6 件、詳細の Latest 3 件、一覧は既定の件数
  （`posts_per_page` 未指定のため「表示設定」の値。全件ではない可能性あり）。
- 一覧のカテゴリボタンは `get_terms('category')`（既定で**名前順・投稿 0 件のカテゴリは非表示**）。
- 本文は `the_content` のフィルタ `replaceAssetsPath` で、`"assets/` を `"{テーマのディレクトリ}/assets/` に置き換えている。
  → 本文に `src="assets/img/xxx.png"` のようなテーマ同梱画像への相対参照がある（例: `assets/img/img-works-unotame.png`）。
- アイキャッチの `alt` は全箇所で空。Latest 3 件は表示中の実績自身も含む。
- 投稿が 0 件のときは「お知らせはまだ登録されておりません。」を表示する。
- トップの KV のスキル一覧・Message・About・SNS リンクは `front-page.php` に直書き（WP の管理画面では編集できない）。

## 設計判断（比較と推奨）

### 1. 本文の形式

| 案 | 長所 | 短所 |
|---|---|---|
| **A. リッチエディタ（推奨）** | 管理画面で見たまま編集できる。出力は HTML なので、WP の本文（HTML）をほぼそのまま移せる。現行の `p-work-detail__content__body` のスタイルを流用しやすい | 出力 HTML の構造を細かく制御できない。HTML をそのまま `set:html` で出す（書き手が本人のみなので許容） |
| B. Markdown（テキストエリア ＋ ビルド時に変換） | Git や他 CMS へ移しやすい。出力を制御しやすい | microCMS に Markdown 専用の入力欄は無く、プレビューも無い。移行時に HTML → Markdown 変換が要る。変換ライブラリが増える |
| C. 繰り返しフィールド（見出し・本文・画像などのカスタムフィールドを並べる） | ブロックごとに専用の見た目を作れる | 現行の本文を分解して移す手間が大きい。ポートフォリオの規模に対して過剰。表示側のコンポーネントも増える |

**推奨: A（リッチエディタ）**。移行コストが最小で、現行の見た目をそのまま再現できる。将来ブロック単位のレイアウトが必要になったら、
`body` を残したまま繰り返しフィールドを追加する形で拡張できる。

### 2. カテゴリの参照数

| 案 | 長所 | 短所 |
|---|---|---|
| **単数参照・必須（推奨）** | 現行（先頭 1 件だけ使う）と同じ。url-design のドメイン型 `category: Category` と一致。表示も絞り込みも単純 | 1 つの実績を複数カテゴリで絞り込めない |
| 複数参照 | 絞り込みの柔軟性が上がる | 「表示するカテゴリ」が曖昧になる。url-design の型と合わない。現行に無い振る舞い |

**推奨: 単数参照・必須**。複数カテゴリは「将来拡張」で扱う（ドメイン型を `categories: Category[]` に広げる変更になる）。

### 3. 並び順

| 案 | 長所 | 短所 |
|---|---|---|
| X. microCMS の `publishedAt`（公開日時）で新しい順 | フィールド追加不要 | 移行した実績は移行した日が公開日時になる。管理画面で公開日時を変更できるかは要確認（未決 C-3）。CMS 固有のメタ情報に依存する |
| **Y. 専用の日付フィールド `date`（必須）で新しい順（推奨）** | WP の投稿日をそのまま移せる。「実績の時期」として意味を持ち、CMS を替えても値が残る。表示にも使える | 新規作成時に入力が 1 つ増える（既定値は入力日にできないため手入力。要確認） |
| Z. 手動の並び順フィールド（`sortOrder` 数字） | 見せたい実績を上に出せる | 追加のたびに番号の振り直しが要る。件数が少ないうちは不要 |

**推奨: Y（`date` の降順。同じ日付なら `publishedAt` の降順、さらに同じなら `id` の昇順で決定的にする）**。
並べ替えは API の `orders` に頼らず、変換後に `src/lib/cms/` 内で行う（フィクスチャでも同じ順になり、テストしやすい）。
「おすすめを先頭に固定したい」要望が出たら、Z を任意フィールドとして足す（将来拡張）。

カテゴリの並び順は、microCMS の**管理画面での並び順**（`orders` 未指定時の API の既定順）をそのまま使う。管理画面でドラッグして並べ替えられる。
（現行は名前順。並べ替え機能が無料プランで使えるかは要確認 → 使えなければ名前順にフォールバックする。未決 C-4）

### 4. サムネイル（アイキャッチ）と OGP 用の項目
- `thumbnail`（画像・必須）: 現行のアイキャッチ。一覧・トップ・Latest・詳細ヘッダーで使う。OGP 画像にも流用する（P2）。
- `description`（テキストエリア・任意、最大 120 文字）: 一覧には出さず、`<meta name="description">` と OGP の説明に使う（P2）。
  未入力の場合は、本文 HTML からタグを除いた先頭 100 文字程度を使う（変換層で `description` を必ず埋める）。
  本文が画像だけなどでテキストが空になる場合は `title` を使う（2026-10-27 変更。レビュー指摘）。
- OGP 専用画像のフィールドは**作らない**（サムネイルで足りる。必要になったら任意フィールドで追加）。
- 画像の `alt`: 現行は空。microCMS の画像フィールドに代替テキストが付けられるかは要確認（未決 C-8）。P1 ではドメイン型に `alt` を持たせ、
  値が無ければ空文字にする（カード内ではタイトルが隣にあるため、装飾画像として空でも可）。

### 5. トップの KV・Message・About・SNS リンクの持ち方

| 案 | 長所 | 短所 |
|---|---|---|
| **R. リポジトリ内のデータファイル（`src/data/profile.ts`）（推奨）** | 更新頻度が低く、現行も直書き。型で守れる。SNS アイコンはローカル画像（`assets/img/`）を使うので一緒に管理しやすい。API 数を消費しない。P1 を最小にできる | 更新にコミットとデプロイが必要（本人が開発者なので問題は小さい） |
| S. microCMS のオブジェクト形式 API（例 `profile`）で管理 | 管理画面から文言を変えられる | 無料プランの API 数（5 個）を 1 つ使う。改行・強調などの書式の扱いを決める必要がある。アイコン画像の持ち方が複雑になる |

**推奨: R**。データファイルの型（案）は「データ構造案」に示す。CMS へ移す場合も、`getProfile()` の中身を差し替えるだけで済むよう、
ページはデータファイルを直接 import せず `src/lib/profile.ts` の関数経由で読む。

### 6. データ取得の方法

#### 6-1. `microcms-js-sdk` か fetch 直呼びか

| 案 | 長所 | 短所 |
|---|---|---|
| **SDK `microcms-js-sdk`（推奨）** | 公式。全件取得の `getAllContents`（内部でページング）、`draftKey` などのクエリの型、レスポンスの基本型（`MicroCMSListContent` など）がある | 依存が 1 つ増える。SDK の更新に追従が要る |
| fetch 直呼び | 依存ゼロ。挙動がすべて手元のコードで見える | ページング・クエリ組み立て・エラー処理を自前で書く。型も自前 |

**推奨: SDK**。ただし SDK を import するのは `src/lib/cms/microcms-source.ts` の 1 ファイルだけにし、ほかの層は自前の
`CmsSource` インターフェースだけを見る。これでフィクスチャ版との差し替え・テスト・将来の fetch 化が局所化される。

#### 6-2. Astro の Content Layer（content collections の loader）か、素の関数か

| 案 | 長所 | 短所 |
|---|---|---|
| L. Content Layer（`src/content.config.ts` で `defineCollection({ loader, schema })`） | Astro 標準。zod のスキーマ検証、`getCollection` / `getEntry`、`reference()`。開発サーバーでデータがキャッシュされる | 「slug の重複」「カテゴリ参照切れ」のような**コレクションをまたぐ検証**を書く場所が不自然。zod スキーマとドメイン型の二重定義になりがち。開発時のキャッシュで CMS の更新がすぐ反映されないことがある。loader のテストに Astro の実行環境が要り、Vitest で単体テストしにくい |
| **F. 素の関数（`src/lib/cms/index.ts` の `getAllWorks()` など）（推奨）** | 取得 → 変換 → 検証 → 並べ替えがすべて普通の TS 関数で、Vitest でフィクスチャを入れて丸ごとテストできる。ドメイン型が唯一の型。CMS を替えても関数の中身だけ替えればよい | 1 回のビルドで何度も API を呼ばないよう、自前でメモ化（Promise をモジュール内に保持）する必要がある |

**推奨: F（素の関数）**。件数が数十件規模で、Content Layer のキャッシュや増分更新の利点が小さい一方、検証とテストのしやすさを重視する。
将来件数が増えてビルドが遅くなったら、同じ `CmsSource` を使う loader を作って L へ移行できる（ページ側は公開関数の形を保つ）。

### 7. 画像

| 案 | 長所 | 短所 |
|---|---|---|
| **I. microCMS の画像 API（imgix のパラメータを URL に付ける）（推奨・P1）** | ビルドが軽い（画像をダウンロードしない）。`w` / `h` / `fit` / `fm=webp` / `q` などで縮小・形式変換できる。`srcset` も URL を変えるだけで作れる | 画像の配信が microCMS 側になり、転送量が無料プランの上限（20GB/月）に数えられるかは要確認（未決 C-6）。`auto=format` は使えない（公式ドキュメント記載）。SVG は変換できない |
| J. ビルド時に取り込み astro:assets で最適化（`<Image>` にリモート URL を渡す、`image.domains` に `images.microcms-assets.io` を許可） | 画像も Xserver から配信され、外部への依存と microCMS の転送量が減る。width/height 付きの `<img>` を自動で出せる | ビルド時間が画像の数に比例して伸びる（CI でキャッシュが無いと毎回ダウンロード）。本文（リッチエディタの HTML）中の画像には使えない（HTML を解析して置き換える処理が別途必要） |

**推奨: P1 は I**。サムネイルは `src/lib/cms/image.ts` の `cmsImageUrl(image, { width, format })` で URL を組み立てる。
P2「パフォーマンス / a11y」でサムネイルを J に切り替えるか判断する。ドメイン型 `ImageAsset`（URL・幅・高さ・alt）はどちらでも同じなので、
切り替えは表示側のコンポーネント 1 つ（例 `c-work-thumb`）と `image.ts` に閉じる。

本文中の画像:
- 本文のすべての `<img>` に、変換層で `loading="lazy"` と `decoding="async"` を付ける（既に付いていれば触らない）。
  （2026-10-27 変更。旧: microCMS にアップロードした画像だけ。受け入れ条件の書き方に合わせた。属性値に `>` を含む `<img>` でも壊れないよう、引用符を考慮して検出する）URL へのリサイズのパラメータ付与は P2 で判断する。
- 現行の `"assets/` で始まるテーマ同梱画像への相対参照は、**移行時に microCMS のメディアへアップロードし直して URL を置き換える**のを推奨する
  （本文の参照先を CMS の中で完結させる）。安全策として、変換層は `src`・`href`・`srcset`・`poster` の属性値の `"assets/` を `"/assets/` に置き換え
  （2026-10-27 変更: 本文中のコードの文字列には当てない）、さらに**ビルドで警告**を出す
  （どのコンテンツに残っているかを表示）。新サイトで `/assets/` に何を置くかは未決 C-7。

## データ構造案

### microCMS スキーマ（確定案）

#### `works`（リスト形式、エンドポイント `works`）

| フィールド ID | 表示名 | 種類 | 必須 | 制約・設定 | 用途 |
|---|---|---|---|---|---|
| `title` | タイトル | テキストフィールド | ○ | — | 一覧・詳細の見出し、`<title>` |
| `slug` | スラッグ | テキストフィールド | ○ | 重複を許可しない（正規表現・文字数の入力制限は付けない。命名規則はビルド時の検証で守る。C-1 / D-010） | 詳細 URL `/works/{slug}/` |
| `category` | カテゴリ | コンテンツ参照（`categories`）・**単数** | ○ | — | 表示・絞り込み |
| `thumbnail` | サムネイル | 画像 | ○ | — | カード・詳細ヘッダー・OGP 画像 |
| `body` | 本文 | リッチエディタ（**`richEditorV2`**） | ○ | 書式はすべて有効（2026-10-27 作成時。移行時に必要なものへ絞れる） | 詳細本文 |
| `date` | 実績日 | 日時 | ○ | 日付のみ指定（時刻は使わない） | 並び順。WP の投稿日を移す |
| `description` | 説明 | テキストエリア | — | 最大 120 文字 | meta description / OGP（P2）。空なら本文から自動生成 |
| `legacyWpId` | 旧 WP 投稿 ID | 数字 | — | 重複不可は CMS で設定できない想定 → ビルドで検証 | 旧 URL リダイレクト生成（url-design） |

- ID・`createdAt`・`updatedAt`・`publishedAt`・`revisedAt` は microCMS が自動で付ける。URL には使わない。
- フィールドの表示順は上の順（よく使うものを上）。管理画面の「API プレビュー」機能の設定は未決 C-2（下書きプレビューの方式次第）。

#### `categories`（リスト形式、エンドポイント `categories`）

| フィールド ID | 表示名 | 種類 | 必須 | 制約・設定 | 用途 |
|---|---|---|---|---|---|
| `name` | 名前 | テキストフィールド | ○ | — | 表示名 |
| `slug` | スラッグ | テキストフィールド | ○ | 重複を許可しない（入力制限は付けない。形式 `^[a-z0-9]+(?:-[a-z0-9]+)*$`・1〜40 文字はビルド時に検証。C-1 / D-010） | `?category=` の値。WP のスラッグを引き継ぐ（D-009） |
| `legacyWpSlugs` | 旧 WP スラッグ | テキストフィールド | — | カンマ区切り | WP 時代とスラッグが違う場合のみ（D-009 で原則不要） |

- API 数は 2 個を使う（無料プランの上限 5 個のうち残り 3 個）。

### 生のレスポンス型（`src/lib/cms/raw-types.ts`。SDK の型を使って定義）

```ts
import type { MicroCMSImage, MicroCMSListContent } from 'microcms-js-sdk';

export type RawCategory = MicroCMSListContent & {
  name: string;
  slug: string;
  legacyWpSlugs?: string;          // "old-a,old-b"
};

export type RawWork = MicroCMSListContent & {
  title: string;
  slug: string;
  category: RawCategory | null;    // depth=1 で展開。参照先が非公開・削除なら null / 欠落の可能性 → 検証で落とす
  thumbnail?: MicroCMSImage;       // 必須だが API 上は欠落に備えて optional で受ける
  body: string;                    // リッチエディタの HTML
  date: string;                    // ISO 8601（UTC）
  description?: string;
  legacyWpId?: number;
};
```

※ 必須フィールドでも、型は「欠ける可能性がある」として受け、変換・検証で必須を保証する（CMS 側の設定変更に耐える）。

### ドメイン型（`src/lib/domain/`。表示側はこれだけを見る。url-design の案を拡張）

```ts
export type ImageAsset = {
  url: string;        // 加工前の元 URL（パラメータは image.ts で付ける）
  width: number;
  height: number;
  alt: string;        // 無ければ ''
};

export type Category = {
  id: string;
  slug: string;              // 検証済み
  name: string;
  legacyWpSlugs: string[];   // url-design と同じ。空配列可
};

export type Work = {
  id: string;                // CMS のコンテンツ ID（内部用。URL に使わない）
  slug: string;              // 検証済み
  legacyWpId?: number;
  title: string;
  category: Category;
  thumbnail: ImageAsset;
  bodyHtml: string;          // 変換層で加工済み（assets パス・img 属性）
  description: string;       // 入力値 or 本文からの自動生成（必ず埋まる）
  date: string;              // 'YYYY-MM-DD'（JST）
  updatedAt: string;         // ISO 8601。sitemap の lastmod 用（P2）
  isDraftPreview: boolean;   // 開発時の下書きプレビューで差し込まれたものだけ true
};
```

### プロフィール（リポジトリ内データ。`src/data/profile.ts`）

```ts
// 2026-10-27 変更（D-012）: top-page.md の案に合わせた（icon を ImageMetadata に、SocialLink.id と about.photo を追加）
import type { ImageMetadata } from 'astro';

export type SocialLink = {
  id: 'x' | 'zenn' | 'qiita' | 'note' | 'github';               // 並び・テスト用の識別子
  label: string;                                                  // サービス名（リンクのアクセシブルネーム）
  url: string;                                                    // https の絶対 URL
  icon: ImageMetadata;                                            // src/assets/images/sns/ の画像を import した値
};
export type Profile = {
  kv: { name: string; role: string; skills: string[] };         // 'Niiyama Keisuke' / 'full-stack web engineer' / 9 項目
  message: { heading: string; lines: string[]; signature: string };
  about: { nameJa: string; nameEn: string; bio: string[]; photo: { src: ImageMetadata; alt: string } };
  socials: SocialLink[];                                          // X / Zenn / Qiita / note / GitHub
};
```
各フィールドの意味・初期値は `top-page.md` を正とする。内容は `front-page.php` から移す（Message の誤記の修正と About の経歴文の差し替えは top-page T-1・T-2）。`src/lib/profile.ts` の `getProfile(): Profile` 経由で読む。

### ディレクトリ構成（`src/lib/`。url-design の `routes.ts` / `slug.ts` / `redirects.ts` と同居）

```
src/lib/
├─ domain/
│  ├─ work.ts            … Work / Category / ImageAsset 型
│  └─ profile.ts         … Profile 型（src/data/profile.ts が使う）
├─ cms/
│  ├─ index.ts           … ページから使う公開関数（下記）。メモ化と、環境変数・開発時の判定の読み取りもここ
│  ├─ config.ts          … env オブジェクトを CmsConfig にする純粋関数 resolveCmsConfig(env, { isDev })（自分では環境変数を読まない）
│  ├─ source.ts          … CmsSource インターフェース
│  ├─ microcms-source.ts … SDK を使う実装（SDK を import するのはここだけ）
│  ├─ fixture-source.ts  … フィクスチャ JSON を返す実装
│  ├─ raw-types.ts       … 生のレスポンス型
│  ├─ transform.ts       … RawWork / RawCategory → ドメイン型（純粋関数）
│  ├─ body.ts            … 本文 HTML の加工・description の自動生成（純粋関数）
│  ├─ validate.ts        … ビルド時の検証（生データに対して行う。slug.ts を使う。違反をまとめて CmsValidationError で投げる）
│  └─ image.ts           … cmsImageUrl()
├─ profile.ts            … getProfile()
├─ routes.ts             … （url-design）
├─ slug.ts               … （url-design）SLUG_PATTERN / RESERVED_SLUGS / assertValidWorkSlugs
└─ redirects.ts          … （url-design）buildRedirectRules
fixtures/microcms/
├─ works.json            … 生のレスポンス形式（{ contents, totalCount, offset, limit }）
└─ categories.json
```

### インターフェースと公開関数（案）

```ts
// source.ts
export interface CmsSource {
  listWorks(): Promise<RawWork[]>;            // 公開中の全件（ページング済み）
  listCategories(): Promise<RawCategory[]>;   // 公開中の全件（管理画面の並び順）
  getDraftWork(contentId: string, draftKey: string): Promise<RawWork>; // 開発時の下書きプレビュー用
}

// index.ts（ページ・コンポーネントはここだけを import する）
export function getAllWorks(): Promise<Work[]>;                 // 検証済み・date 降順
export function getLatestWorks(limit: number): Promise<Work[]>;  // トップ 6（詳細の Latest は selectLatestWorks を使う。2026-10-27 変更、D-012）
export function getWorkBySlug(slug: string): Promise<Work | undefined>;
export function getAllCategories(): Promise<Category[]>;        // 管理画面の並び順
export function getCategoriesInUse(): Promise<Category[]>;      // 実績が 1 件以上あるもの（現行の hide_empty 相当）

// テスト用: ソースを差し替えて同じ処理を通す
export function loadContent(source: CmsSource, config: CmsConfig): Promise<{ works: Work[]; categories: Category[] }>;
```

## 振る舞い

### 取得の流れ（1 回のビルドにつき API 呼び出しは原則 2 回）
1. `resolveCmsConfig()` が環境変数から取得元（`microcms` / `fixture`）と下書きプレビュー設定を決める（後述）。
2. `loadContent()` が `CmsSource.listCategories()` と `listWorks()` を並行に呼ぶ。
   - `listWorks` は SDK の `getAllContents({ endpoint: 'works', queries: { depth: 1 } })` を使う（内部で `limit=100` 単位にページング）。
     自前で書く場合も `offset` を 100 ずつ進め、`offset >= totalCount` で止める。取得件数が `totalCount` と一致しない場合はエラー。
     （2026-10-27: SDK の `getAllContents` は件数を照合しないため、microCMS 版では照合しない。フィクスチャ版は `totalCount` と件数を照合する）
   - `richEditorFormat: 'html'` を明示し、SDK の `retry: true` で一時的なエラーを再試行する。
   - API の `limit` 上限は 100、レスポンスが約 5MB を超えるとエラーになる（公式ドキュメント）。本文が大きくなったら 1 回の件数を下げる。
3. 開発時で下書きプレビューが指定されていれば、`getDraftWork(id, draftKey)` で取って一覧に差し込む（同じ ID があれば置き換える）。
4. `validate.ts` で**生データを**検証（下記）。違反があれば**全部まとめて** `CmsValidationError` を投げる → ビルド失敗。
   （2026-10-27 変更。旧: 変換 → 検証。参照切れや必須項目の欠けがあると変換できないため、検証を先にした）
5. `transform.ts` で生データ → ドメイン型。`body.ts` で本文を加工し、`description` を埋める。`date` は JST の `YYYY-MM-DD` にする。
6. `date` 降順（→ `publishedAt` 降順 → `id` 昇順）に並べる。
7. 結果を Promise としてモジュール内に保持し、同じビルド中の 2 回目以降はそれを返す（メモ化）。開発サーバーでは毎リクエスト取り直す
   （CMS の更新をすぐ見られるように。開発時の API 呼び出し回数が気になれば未決 C-10）。

### `getStaticPaths` との連携
```ts
// src/pages/works/[slug].astro
import { getAllWorks } from '../../lib/cms';
export async function getStaticPaths() {
  const works = await getAllWorks();
  return works.map((work) => ({ params: { slug: work.slug }, props: { work } }));
}
```
- ページは `props` の `Work` をそのまま表示する。Latest 3 件は**表示中の実績を除いた**最新 3 件（2026-10-27 変更、D-012。works-detail D-1）。
  `getStaticPaths` で取得済みの全件から表示側の純粋関数 `selectLatestWorks()` で選び、props で渡す（具体的なコードは `works-detail.md` を正とする。`getLatestWorks()` 自体は変えない）。
- トップは `getLatestWorks(6)`、一覧は `getAllWorks()` と `getCategoriesInUse()`。
- 実績 0 件の表示（「お知らせはまだ登録されておりません。」相当）はページ側の仕様。ただし本番ビルドでは 0 件をエラーにする（下記）。

### ビルド時の検証（違反はすべてビルド失敗。メッセージにコンテンツ ID と slug を含める）
| 対象 | 検証内容 |
|---|---|
| works.slug | 必須・パターン・3〜60 文字・予約語・重複（url-design の `assertValidWorkSlugs` を使う） |
| works.legacyWpId | 正の整数・重複なし |
| works.category | 参照が存在する（`null` / 欠落 / 取得したカテゴリ一覧に ID が無い → 参照切れ） |
| works の必須項目 | `title`（空白のみ不可）・`thumbnail`（URL・幅・高さあり）・`body`（空でない）・`date`（日付として解釈できる） |
| categories.slug | 必須・パターン（`^[a-z0-9]+(?:-[a-z0-9]+)*$`）・重複なし |
| categories.legacyWpSlugs | 各要素が同じパターン・ほかのカテゴリの `slug` / `legacyWpSlugs` と重複しない |
| 件数 | **本番ビルド（`astro build`）で works が 0 件ならエラー**。API の不調などで空のサイトを rsync `--delete` で公開してしまう事故を防ぐ。開発時は警告のみ。取得元（microcms / fixture）は問わない |
| 旧 ID 件数 | url-design の「生成リダイレクト件数が期待件数を下回ったら失敗」と同じ仕組み（実装は redirects 側） |

警告（ビルドは続行）: 本文に `"assets/` が残っている、`description` が 120 文字を超えている（CMS の制限漏れ）。

### API エラー時
- ネットワークエラー・401/403（キー誤り・権限不足）・404（エンドポイント名誤り）・5xx・429 は、**古いデータで続行せずビルドを失敗させる**。
- 一時的な 5xx / 429 は SDK のリトライ設定（使える場合）で数回再試行してから失敗とする。
- エラーメッセージに API キーを含めない（リクエストヘッダーやクエリをそのまま出力しない）。

### 環境変数と秘密情報

| 変数 | 必須 | 用途 | ローカル | CI（GitHub） |
|---|---|---|---|---|
| `MICROCMS_SERVICE_DOMAIN` | microcms モードで必須 | サービス ID（`xxx.microcms.io` の `xxx`） | `.env` | Secrets `MICROCMS_SERVICE_DOMAIN`（infra 仕様どおり） |
| `MICROCMS_API_KEY` | microcms モードで必須 | **読み取り専用キー（GET 権限のみ）** | `.env` | Secrets `MICROCMS_API_KEY` |
| `CMS_SOURCE` | 任意（既定 `microcms`） | `microcms` / `fixture` | `.env` で切替 | PR の CI では `fixture` 可。**デプロイ用ワークフローでは設定しない**（P3） |
| `MICROCMS_PREVIEW_DRAFTS` | 任意・開発時のみ | 下書きプレビュー（後述） | `.env` | **設定しない** |

- `.env.example`（コミットする。値は空）:
  ```dotenv
  # microCMS（API キーは GET 権限のみの読み取り専用キーを使う。値はコミットしない）
  MICROCMS_SERVICE_DOMAIN=
  MICROCMS_API_KEY=
  # データの取得元: microcms（既定）| fixture（API を呼ばずに fixtures/microcms/*.json を使う）
  CMS_SOURCE=
  # 開発時のみ: 下書きプレビュー。"コンテンツID:draftKey" をカンマ区切り。astro build で設定されているとビルド失敗
  MICROCMS_PREVIEW_DRAFTS=
  ```
- `.env` は `.gitignore` に入れる（現状の `.gitignore` には無いので「プロジェクト基盤」で追加）。
- API キーの権限: 既定権限は **GET のみ**。POST / PUT / PATCH / DELETE と「下書きの全取得」は付けない。
  無料プランは API キーが 1 個のため、ローカルと CI で同じキーを使うことになる。だからこそ書き込み・下書き全取得の権限は付けない。
- 環境変数はクライアント側に出さない（`PUBLIC_` を付けない）。読むのは `index.ts` だけ（2026-10-27 変更。旧: `config.ts`）。`config.ts` は
  `resolveCmsConfig(env, { isDev })` という純粋関数にし、Vitest から任意の env を渡してテストできるようにする。
- `isDev` は `import.meta.env.DEV` を**使わない**（2026-10-27 変更。レビュー指摘）。`NODE_ENV=development` や `--devOutput` 付きの
  `astro build` でも DEV が true になり、下書きと 0 件の 2 つのガードが外れるため。代わりに、Astro インテグレーションが
  `astro:config:setup` の `command === 'dev'` を見てビルド時定数を注入し、それを使う（`astro build` では必ず false）。
  実装は `src/integrations/dev-server-flag.ts` が `import.meta.env.UNOTAME_IS_DEV_SERVER` を注入し、`index.ts` の `isDevServer()` が
  厳密に `true` のときだけ開発時とみなす（注入されていない場合も本番扱いにして、ガードを外さない）。

### ローカル開発

#### 下書きのプレビュー（ステージング無しの代替。D-008）

| 案 | 長所 | 短所 |
|---|---|---|
| P. `MICROCMS_INCLUDE_DRAFTS=true` で下書きを全件取得 | 下書きをまとめて確認できる | API キーに「下書きの全取得」権限が要る。**無料プランはキーが 1 個なので、CI・本番ビルドで使うキーにも下書き取得権限が付く** → 下書きが公開される事故の防止をコードのガードだけに頼ることになる。公開中かつ下書き中のコンテンツは全件取得でも公開版しか返らない（公式ドキュメント） |
| **Q. `MICROCMS_PREVIEW_DRAFTS="id:draftKey,..."` で指定した下書きだけ取得（推奨）** | draftKey は 1 件の下書き取得の正規の方法で、キーは GET のみのまま。確認したいコンテンツだけを明示的に差し込むので事故が起きにくい。公開中かつ下書き中のコンテンツの「下書き版」も見られる | 確認のたびに管理画面から ID と draftKey を写す手間がある |

**推奨: Q**。ガード（受け入れ条件で確認する）:
- `MICROCMS_PREVIEW_DRAFTS` が設定された状態で `isDev === false`（`astro build` / `astro preview` 用のビルド）なら、**取得を始める前にエラーで止める**
  （黙って無視しない。本番ビルドに下書きが混ざる経路を作らない）。
- `CMS_SOURCE=fixture` との併用はエラー。
- 同じ ID を重ねて指定した場合（`w1:k1,w1:k2`）はエラーにせず、後に書いたほうが優先される（2026-10-27。テストで固定）。
- 差し込んだ実績は `isDraftPreview: true`。表示側は開発時だけ「DRAFT」表示を出してよい（任意）。
- 下書きの確認手順: `.env` に設定 → `npm run dev` → `/works/{slug}/` を開く。公開前の最終確認は設定を外して `npm run build && npm run preview`。
- draftKey は秘密情報に準じて扱う（コミットしない。`.env` にのみ書く）。

#### フィクスチャモード（`CMS_SOURCE=fixture`）
- **用意する（推奨）**。用途: Vitest、オフラインでの開発、Secrets を使えない状況での CI ビルド（P2）、microCMS の準備前に P1 の画面を作ること。
- `fixtures/microcms/works.json`・`categories.json` は**生のレスポンス形式**で置き、`fixture-source.ts` は読み込んで返すだけにする
  （変換・検証は microcms と同じ経路を通る）。
- 内容: カテゴリ 3 件以上（うち 1 件は実績 0 件）、実績 8 件以上（トップ 6 件・Latest 3 件・絞り込みを確認できる数）、
  `legacyWpId` あり / なしの両方、`description` あり / なし、本文に `"assets/` と microCMS 画像を含むもの。画像 URL はダミー
  （`https://images.microcms-assets.io/assets/dummy/...`。fixture モードでは画像が表示されなくてよい。ローカル画像に差し替えるかは未決 C-9）。
- 異常系のフィクスチャ（slug 重複・参照切れなど）は `tests/fixtures/` に別に置き、ビルド用のフィクスチャは常に検証を通る状態に保つ。

### 再ビルドの契機（概要のみ）
- 想定の流れ: microCMS の Webhook（公開・更新・公開終了・削除）→ GitHub の `repository_dispatch`（例 `event_type: microcms-update`）
  → GitHub Actions でビルド → rsync で Xserver へ。予約公開も公開時の Webhook で再ビルドされる想定。
- トークン（Fine-grained PAT）の管理、Webhook の設定、ワークフローの詳細は **P3 として `spec/infra/hosting-and-deploy.md` で定める**。
  本書の範囲では「ビルドは毎回 CMS から全件を取り直す（差分ビルドしない）」ことだけを前提とする。

### microCMS 無料プラン（Hobby）の制約
確認日: **2026-10-27**。出典: [料金プラン](https://microcms.io/pricing)、[APIキー（英語版）](https://document.microcms.io/en/content-api/x-microcms-api-key)、
[コンテンツ一覧取得（英語版）](https://document.microcms.io/en/content-api/get-list-contents)、[画像 API（英語版）](https://document.microcms.io/en/image-api/introduction)。

| 項目 | Hobby の値 | 本プロジェクトへの影響 |
|---|---|---|
| 料金 | 0 円/月 | — |
| API 数 | 5 個 | `works`・`categories` で 2 個。プロフィールを CMS 化しても足りる |
| コンテンツ数 | 10,000 件 | 十分 |
| データ転送量 | 20GB/月（超えると API 停止） | ビルド時の JSON 取得は小さい。**画像 API 経由の画像配信が数えられるかは要確認**（C-6）。数えられるなら astro:assets 化（案 J）の理由になる |
| メディアのストレージ | 無制限 | — |
| 1 メディアのサイズ上限 | 40MB | — |
| メンバー数 | 3 人 | — |
| API キー数 | 1 個 | ローカル・CI で共用 → GET のみの権限にする（上記） |
| API リクエスト数 | 無制限 | — |
| CSV インポート | 1,000 件 | 移行で使える可能性（P2） |
| CSV エクスポート / 過去バージョン復元 / 権限管理 / IP 制限 / 複数環境 / カスタムステータス | 利用不可 | バックアップは別手段（例: ビルド時の取得結果の保存）を P2 で検討 |
| 一覧取得の `limit` | 最大 100（既定 10） | 全件取得はページング必須 |
| レスポンスサイズ | 約 5MB を超えるとエラー | 本文が大きい場合は 1 回の件数を下げる |
| 参照の展開 `depth` | 0〜3（既定 1） | `category` は既定のまま展開される |
| 画像 API | imgix の Rendering API。`auto=format` は不可。SVG は不可 | `fm=webp` を明示する |
| Webhook | **要確認**（料金ページに記載なし） | P3 の前提。使えなければ手動の `workflow_dispatch` で代替 |
| 下書きの API プレビュー機能 | **要確認** | 推奨案 Q は draftKey のみで成立する |
| 管理画面での並べ替え | **要確認** | カテゴリの並び順（C-4） |
| 商用利用 | **要確認**（料金ページに記載なし） | 個人のポートフォリオ（仕事の受注目的）の扱い |

## 受け入れ条件

フィクスチャと Vitest で判定する（API は呼ばない）。`fixtures/` はビルド用、`tests/fixtures/` は異常系。

### 変換（transform / body）
- [ ] 正常な `RawWork` を変換すると、`Work` の全フィールドが埋まり、`category` が `Category` 型（`legacyWpSlugs` は配列）になる。
- [ ] `legacyWpSlugs: "old-a, old-b"` → `['old-a', 'old-b']`（前後の空白を除く）、未入力 → `[]`。
- [ ] `legacyWpId` 未入力 → `Work.legacyWpId` は `undefined`。
- [ ] `date: "2023-03-31T15:00:00.000Z"` → `'2023-04-01'`（JST）。
- [ ] `description` 未入力のとき、本文からタグを除いた先頭 100 文字程度（空白を詰め、100 文字を超えて切り詰めたときだけ末尾に `…`）になる。入力ありならその値。
      本文のテキストが空なら `title` になる。
- [ ] 本文の `src="assets/img/a.png"` が `src="/assets/img/a.png"` に置き換わり、警告が 1 件出る（コンテンツ ID を含む）。属性値でない `"assets/`（コードの文字列など）は置き換えない。
- [ ] 本文の `<img>` に `loading="lazy"`・`decoding="async"` が付く。既に `loading` 属性がある場合は変えない。`alt` に `>` を含む `<img>` も壊れない。
- [ ] 範囲外の数値文字参照（例 `&#99999999;`）があっても例外にならず、そのまま残る。
- [ ] `thumbnail` の alt が無い場合 `alt === ''`。

### 並び順・公開関数
- [ ] `getAllWorks()` が `date` 降順、同日なら `publishedAt` 降順、さらに同じなら `id` 昇順で返す（同点のフィクスチャで確認）。
- [ ] `getLatestWorks(6)` が先頭 6 件、件数が 6 未満なら全件を返す。
- [ ] `getWorkBySlug('存在するslug')` が該当 `Work`、存在しない slug で `undefined`。
- [ ] `getAllCategories()` がレスポンスの順序を保つ。`getCategoriesInUse()` は実績 0 件のカテゴリを含まない。
- [ ] 同じビルド中に公開関数を複数回呼んでも、`CmsSource.listWorks` / `listCategories` はそれぞれ 1 回しか呼ばれない（モックの呼び出し回数で確認）。

### 全件取得
- [ ] 250 件を返すモック（100 件ずつ）で `listWorks` が 3 回のページ取得をして 250 件を返す（自前ページングの場合。SDK の場合は `getAllContents` に `endpoint: 'works'`・`depth: 1` を渡していることを確認）。
- [ ] 取得件数が `totalCount` と一致しないとエラーになる（自前ページングの場合とフィクスチャ版）。

### 検証
- [ ] slug 規則違反・slug 重複・`legacyWpId` 重複・カテゴリ参照切れ（`null`／一覧に無い ID）・必須項目欠落（title / thumbnail / body / date）・
      カテゴリ slug 重複・`legacyWpSlugs` の重複のそれぞれで `CmsValidationError` が投げられ、メッセージに該当のコンテンツ ID と slug が含まれる。
- [ ] 違反が複数あるとき、**最初の 1 件で止まらず全件**がメッセージに含まれる。
- [ ] works 0 件のとき、`isDev: false` ではエラー、`isDev: true` では警告のみで空配列を返す。
- [ ] `NODE_ENV=development` を付けた `astro build` でも `isDev` は false になる（下書きと 0 件のガードが働く）。
- [ ] `CMS_SOURCE=microcms` で異常系のデータを返すソースを使った `npm run build` 相当（`loadContent`）が失敗する。ビルド用フィクスチャ（`fixtures/microcms/`）は検証を通る。

### 設定・秘密情報
- [ ] `resolveCmsConfig({}, { isDev: false })`（microcms モードで domain / key なし）がエラーになり、メッセージに不足している**変数名**が含まれ、値は含まれない。
- [ ] `CMS_SOURCE=fixture` では domain / key が無くてもエラーにならない。`CMS_SOURCE=foo` はエラー。
- [ ] `MICROCMS_PREVIEW_DRAFTS` が設定され `isDev: false` のときエラーになる（取得処理が呼ばれる前に）。
- [ ] `MICROCMS_PREVIEW_DRAFTS="a1:k1,b2:k2"` が `[{ id: 'a1', draftKey: 'k1' }, { id: 'b2', draftKey: 'k2' }]` に解釈され、形式不正（`a1` のみ等）はエラー。
- [ ] 下書きプレビュー時、同じ ID の公開版は下書き版に置き換わり、新規の下書きは追加され、どちらも `isDraftPreview: true` になる。
- [ ] `CMS_SOURCE=fixture` と `MICROCMS_PREVIEW_DRAFTS` の併用でエラー。
- [ ] API エラー（モックで 401 / 500 を投げる）時、`loadContent` が失敗し、エラーメッセージ・ログに API キーの値が含まれない。
      キーの値を含むエラーを投げる偽の SDK クライアントで、`microcms-source.ts` を通した取得の流れでも伏せられることを確かめる。
- [ ] リポジトリに `.env.example` があり上記 4 変数が値なしで並ぶ。`.env` が `.gitignore` に含まれる。`src/` 内で `microcms-js-sdk` を import しているのは `microcms-source.ts` だけ（grep で確認）。

### 画像
- [ ] `cmsImageUrl(img, { width: 600, format: 'webp' })` が元 URL に `w=600&fm=webp` を付けた URL を返す。元 URL に既にクエリがあれば `&` でつなぐ。
- [ ] SVG（URL の拡張子が `.svg`）にはパラメータを付けない。

### ビルド（フィクスチャモード）
- [ ] `CMS_SOURCE=fixture npm run build` が成功し、フィクスチャの全 works について `dist/works/{slug}/index.html` が生成される（url-design の受け入れ条件と同じ判定）。
- [ ] プロフィール（KV のスキル 9 項目・Message・About・SNS 5 件）が `src/data/profile.ts` から出力され、`dist/index.html` に `src/data/profile.ts` の文言が含まれる。（2026-10-27 変更、D-012。旧:「現行と同じ文言」。Message の誤記修正〈top-page T-2〉と経歴文の差し替え〈T-1〉で現行の文言と一致しなくなるため）

## 将来拡張（任意）
- プロフィール（KV・Message・About・SNS）を microCMS のオブジェクト形式 API へ移す（`getProfile()` の中身の差し替えのみ）。
- 複数カテゴリ（`categories` 複数参照）。ドメイン型を `categories: Category[]` ＋ 表示用の `primaryCategory` に広げる。
- 手動の並び順（`sortOrder`）や「おすすめ固定」フラグ。
- 実績に外部リンク（公開サイト URL）、担当範囲、使用技術などの構造化フィールドを追加する。
- 本文画像を astro:assets で取り込む（HTML を解析して置き換える）。
- 件数が増えた場合の Content Layer loader 化（同じ `CmsSource` を使う）。
- 開発時の下書きプレビュー用ページ（`/preview/?id=&draftKey=`。静的出力では動かないため、開発サーバー限定の仕組みが必要）。
- CMS データのバックアップ（ビルド時に取得 JSON を Actions の成果物として保存するなど）。

## 未決事項

| ID | 内容 | 推奨・決め方 |
|---|---|---|
| C-1 | **url-design のスキーマ案に関わる点**: works.slug の正規表現 `^(?=.*[a-z])...` の**先読み `(?=` が microCMS の正規表現の入力制限で使えるか**未確認 | **決定（D-010）**: microCMS 側に正規表現・文字数の入力制限は付けない（必須・重複不可のみ）。命名規則（url-design の SLUG_PATTERN・長さ・予約語）はビルド時の検証だけで守る |
| C-2 | 下書きプレビューの方式 | **決定（D-010）**: 推奨 Q（`MICROCMS_PREVIEW_DRAFTS` で ID と draftKey を指定。キーは GET のみ） |
| C-3 | 並び順の基準 | **決定（D-010）**: 専用の `date` フィールドを作る |
| C-4 | カテゴリの並び順 | 推奨: 管理画面の並び順。無料プランで並べ替えができなければ名前順（現行どおり） |
| C-5 | 本文の形式 | 推奨: リッチエディタ |
| C-6 | 画像の配信方式 | 推奨: P1 は microCMS 画像 API。画像 API の転送量が無料枠 20GB/月に数えられるかを確認し、P2 で astro:assets 化を判断 |
| C-7 | 本文中の `"assets/` 参照（例 `assets/img/img-works-unotame.png`）の扱い | 推奨: 移行時に microCMS メディアへ上げ直して URL を置換。新サイトの `public/assets/` にテーマ画像を置き続けるか（置換の受け皿を残すか）を「コンテンツ移行」「プロジェクト基盤」で決める |
| C-8 | 画像フィールドで代替テキストを入力できるか | 入力できるかは要確認。できなければ alt は空（現行どおり）。**詳細画像の alt（2026-10-27 決定、D-012。works-detail D-5）**: タイトルは入れない。代替テキストがあれば使い、無ければ空。カードの画像は常に空（top-page） |
| C-9 | フィクスチャの画像をダミー URL にするか、ローカル画像にするか | 推奨: P1 はダミー URL（オフラインでは表示されない）。画面を詰める段階で困ればローカル画像へのマッピングを追加 |
| C-10 | 開発サーバーでのメモ化 | 推奨: 開発時は毎回取り直す。API 呼び出し回数が問題になれば短時間（例 30 秒）のキャッシュを足す |
| C-11 | トップのプロフィール類の持ち方 | **決定（D-010）**: リポジトリ内データ（`src/data/profile.ts`） |
| C-12 | 本番ビルドで works 0 件をエラーにすること | **決定（D-010）**: エラーにする（空サイトの公開防止） |
| C-13 | `description` の上限（120 文字）と自動生成の長さ（100 文字程度） | SEO / OGP 仕様（P2）で調整してよい |
| C-14 | microCMS の最終確定（D-004 は「P1 冒頭で確定」） | **決定（D-010）**: microCMS で確定 |
| C-15 | 料金ページに無い項目（Webhook・API プレビュー・管理画面の並べ替え・商用利用）の確認 | 管理画面またはヘルプで確認する（本書では要確認のまま） |
| C-17 | richEditorV2 が実際に出す HTML（画像を `<figure>` で包むか、`width` / `height` を付けるか、コードブロックの形など） | コンテンツが 0 件のため未確認（2026-10-27）。最初の実績を入れたら確かめ、本文の加工（`<img>` の検出・`"assets/` の置換）と詳細ページのスタイルを合わせる。あわせて、`"assets/` の置換が対象外にしている形（`srcset` の 2 つ目以降の候補、単一引用符、`=` の前後の空白）を直すかを判断する（2026-10-27 検証時の指摘） |
| C-16 | 現行一覧の表示件数（`posts_per_page` 未指定 = 「表示設定」の値）。新サイトは全件表示にする想定 | **決定（2026-10-27、D-012。works-list L-2）**: 新サイトの一覧は全件表示（ページ分割なし）。本番 WP の「表示設定」の確認は不要 |
