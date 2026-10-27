# UNOTAME 開発ガイド（詳細）

ルート `CLAUDE.md` の詳細版。開発に必要な知見・ドキュメント所在・禁止事項をここに集約する。

---

## 1. プロジェクト概要

- **目的**: WordPress で構築した現行ポートフォリオサイトを、モダンで保守しやすい静的サイトへ作り替える。
  あわせて FTP 手動アップロードを廃止し、CI/CD で安全・再現可能に公開できる状態にする。
- **対象ユーザー / 最終ゴール**: 仕事を依頼する可能性のある企業・個人（クライアント）、および技術者コミュニティ。
  実績（Works）・人物像（About）・問い合わせ導線が速く・美しく届き、本人は CMS から実績を追加するだけで
  公開まで自動で完了する状態がゴール。
- **技術スタック**: Astro（TypeScript）/ SCSS（FLOCSS 構成を継続）/ ヘッドレス CMS（microCMS）/
  GitHub Actions / Xserver レンタルサーバー（静的ファイル配信）
- **公開・配布**: https://unotame.com/（Xserver）。`main` への push ＋ CMS 更新 Webhook を契機に
  GitHub Actions でビルド → SSH/rsync でデプロイ。

### 現行サイト（移行元）の構成メモ
- WordPress オリジナルテーマ（このリポジトリの現ルートにある `*.php` / `assets/`）。
- ページ: トップ（KV / Message / Works 最新6件 / About・SNSリンク）、`/works/`（実績一覧＋カテゴリ絞り込み）、
  実績詳細（投稿）、`/contact/`（本文はWP側。フォームプラグイン想定）。
- 実績は WP の「投稿」をポートフォリオとして使用（カテゴリあり・タグ非表示・アイキャッチ使用）。
- スタイル: `assets/css/style.scss`（Foundation / Layout / Object）、`destyle.css`。JS: jQuery 3.4.1 ＋ `script.js`
  （ローダー、カテゴリフィルタ）。

## 2. 開発方針（フェーズ）

| フェーズ | 目的 | 概要 |
|---|---|---|
| 1 | 現行サイトを Astro で再構築（ローカルで動く） | Astro 基盤、共通レイアウト、トップ / Works 一覧・詳細 / Contact、microCMS 連携、SCSS 移植（jQuery を使わない実装） |
| 2 | 刷新と品質向上 | デザインの細部刷新、SEO/OGP・パフォーマンス・a11y、WP からのコンテンツ移行、PR 時の CI チェック |
| 3 | 公開と CI/CD | GitHub Actions による Xserver 自動デプロイ、CMS Webhook 連携、本番切替（WP 撤去・URL 互換） |

詳細なスコープは `.claude/docs/unotame-inventory.md`（棚卸）を参照。

## 3. 技術スタックの決定事項

- **フレームワーク**: Astro（静的出力 `output: 'static'`）。TypeScript を使用。（D-003）
- **コンテンツ管理**: ヘッドレス CMS（microCMS で確定・D-010）。ビルド時に API から取得して静的生成する。
  API キーはリポジトリに含めず、ローカルは `.env`、CI は GitHub Secrets で渡す。（D-004）
- **デザイン/スタイル**: 現行デザインを踏襲して刷新。SCSS ＋ FLOCSS 構成を継続し、既存のフォント・ロゴ・
  画像資産を流用する。jQuery は廃止し、必要な挙動は素の TS / Astro で実装する。（D-005）
- **デプロイ**: GitHub Actions ＋ SSH/rsync で Xserver へ配信。FTP 手動アップロードは本番切替後に廃止。（D-006）
- **リポジトリ構成**: ルートを Astro プロジェクトとし、現行 WordPress テーマは `legacy/` へ退避する（配信しない）。（D-007）
- **事前確認**: ステージングは置かず、`npm run dev` と `npm run build && npm run preview` によるローカル確認で代替する。（D-008）
- 設計判断の経緯は `.claude/docs/decisions-log.md` に記録する。

## 4. ドキュメント構成（所在）

```
CLAUDE.md                      … プロジェクト概要のみ（このファイルへの誘導）
.claude/
├─ CLAUDE.md                  … 本ファイル（開発ガイド詳細）
├─ docs/                      … 設計ドキュメント・棚卸・意思決定ログ
├─ spec/
│  ├─ feature/               … 機能仕様
│  ├─ infra/                 … 機能外: 公開・通信・ビルド（Xserver / CI/CD / CMS 連携）
│  ├─ design/                … 機能外: デザイン方針
│  └─ quality/               … 機能外: テスト・レビュー方針
├─ agents/                    … エージェント定義（designer / implementer / code-reviewer / tester）
└─ skills/                    … プロジェクトローカルのスキル（update-docs / feature-spec など）
```

- **ドキュメント全般** → `.claude/docs/`
- **機能仕様** → `.claude/spec/feature/`
- **機能外仕様** → `.claude/spec/` 配下にディレクトリを分けて保存（infra / design / quality など）

## 5. エージェント構成

| 名前 | 役割 |
|---|---|
| `designer` | 仕様・設計の起こし（docs / spec の執筆、現行 WP テーマの調査） |
| `implementer` | 実装（Astro コンポーネント / ページ、microCMS 連携、SCSS、GitHub Actions ワークフロー） |
| `code-reviewer` | コードレビュー（既存の `/code-review` skill も活用） |
| `tester` | テスト（Vitest によるロジックのユニットテスト、`astro check` / ビルド検証、必要に応じ Playwright） |

## 6. 禁止事項・厳守事項

### ❌ 禁止
- **承認なしに次のステップへ進むこと。** 各エージェントの完了時・作業の区切りごとに、必ずユーザーへ
  「次へ進んでよいか」の承認を求める。
- **承認なしの `git commit` / `git push`。** ブランチ作成・差分提示・コミット文案の提示までは可。
  実際のコミット／プッシュはユーザーの承認後のみ。（`main` への push は本番デプロイの契機になるため特に厳守）
- プロジェクトの資産（ソース・データ・設定）への破壊的変更を、確認なしに行うこと。
- `git init`（リポジトリはユーザーが用意する。こちらから初期化しない）。
- **本番サーバー（Xserver）への直接操作**（SSH 接続・ファイル削除・rsync `--delete` の手動実行など）を承認なしに行うこと。
  現行 WordPress が稼働中であり、誤操作は即座にサイト停止につながるため。
- **秘密情報（microCMS API キー、SSH 秘密鍵、FTP/サーバー資格情報）をリポジトリ・ログ・ドキュメントに書くこと。**
  `.env` は `.gitignore` 対象、CI では GitHub Secrets を使う。
- 現行 WordPress テーマのファイル（退避後は `legacy/`）を、本番切替完了の合意前に削除すること。

### ✅ 厳守・推奨
- **不明点は、できるだけ一度にまとめて質問する。**（細切れに聞かない）
- 効率化のため、必要に応じて **git workflow / エージェントの並列起動**を活用してよい。
- 仕様にない追加・スコープ拡大を独断でしない（必要なら提案して承認を得る）。
- **既存 URL の互換性を意識する**（`/works/`・`/contact/`・実績詳細の現行パーマリンク `/{category}/{投稿ID}`）。変更する場合はリダイレクト方針を仕様に書く。
- 実装後は `npm run build` と `astro check` が通ることを確認してから次へ進む。

## 7. よく使うワークフロー

- **設計** → `designer` で docs / spec を起こす → 承認 → 実装へ。
- **実装** → `implementer` が実装 → `astro check`・lint・`npm run build`・dev server での表示確認 →
  `code-reviewer` → `tester` → 承認 → コミット文案提示 → 承認後コミット。
- **ドキュメント同期** → 区切りごとに `update-docs` スキルで docs / spec / decisions-log を最新化。
