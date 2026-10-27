# 機能外仕様: ホスティングと CI/CD（hosting-and-deploy）

> 状態: **骨子のみ**（方針は D-004 / D-006 で確定。詳細は P2〜P3 で `designer` が具体化する）

## 前提
- 公開先: Xserver レンタルサーバー（https://unotame.com/）。静的ファイル（Astro の `dist/`）を配置する。
- 現在は WordPress が同ドメインで稼働中。本番切替まで既存環境を壊さない。

## 構成（予定）

```
[GitHub: main へ push] ─┐
                         ├─> GitHub Actions: install → lint/check/test → build → rsync(SSH) → Xserver
[microCMS 更新 Webhook] ─┘        (repository_dispatch)
```

- **CI（P2）**: PR で lint / `astro check` / `npm test` / `npm run build`。
- **CD（P3）**: `main` push と `repository_dispatch` で build → `rsync -avz --delete` で公開ディレクトリへ同期。
- **Secrets（GitHub）**: `MICROCMS_SERVICE_DOMAIN`、`MICROCMS_API_KEY`、`SSH_PRIVATE_KEY`、`SSH_HOST`、`SSH_PORT`（Xserver は 10022）、
  `SSH_USER`、`DEPLOY_PATH`、`SSH_KNOWN_HOSTS`。

## 未決事項
- Xserver 側の準備: SSH 有効化、デプロイ専用鍵の登録、公開ディレクトリのパス（`~/unotame.com/public_html/` 想定）。
- `--delete` の安全策（除外対象: `.well-known/`、サーバー側にだけ置く設定ファイルやログなど）。
  `.htaccess` はリポジトリで管理してビルド時に生成し、デプロイ対象に含める（D-009）。除外はしない。
  - **本番切替の前**: 現行の本番 `.htaccess` をバックアップし、`src/htaccess/htaccess.template` との差分を確かめる。Xserver のサーバーパネルで
    `.htaccess` に書き込む機能（ブラウザキャッシュ・アクセス制限・国外 IP アクセス制限など）は使わない。使う設定はテンプレートへ取り込む
    （パネルでの変更は次のデプロイで上書きされて消える）。（2026-10-27 追加。リダイレクト実装のレビュー指摘）
  - **デプロイ直前のガード（P3 のワークフロー）**: rsync の前に `test -s dist/.htaccess` と `grep -q '^ErrorDocument 404 ' dist/.htaccess` を実行し、
    失敗したらデプロイしない（`--delete` で本番の `.htaccess` ごと消え、https への寄せとリダイレクトと 404 が失われるのを防ぐ）。
    ビルドとデプロイを別ジョブに分けて `actions/upload-artifact`（v4.4 以降は既定で隠しファイルを除外）を使う場合は、`include-hidden-files: true` を指定する。
  - `wp-content/` など WP の残りは、本番切替時に `--delete` で消える（url-design U-11 と同じ論点。切替のチェックリストで扱う）。
- 本番切替手順: WP のバックアップ → 撤去範囲 → 初回デプロイ → 確認 → ロールバック手順。
  ステージングは置かない（D-008）ため、`.htaccess` のリダイレクトなど本番でしか確かめられない項目は確認リストにして切替時に検証する。
- URL 互換: 現行パーマリンク `/{category}/{投稿ID}` から新 URL への 301 リダイレクト（`.htaccess`）。新 URL 体系は `spec/feature` の URL 設計で決める。
- microCMS Webhook → GitHub `repository_dispatch` のトークン管理（Fine-grained PAT）。
