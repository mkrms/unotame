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
- `--delete` の安全策（除外対象: `.htaccess`、`.well-known/`、お問い合わせ用 PHP 等）。
- 本番切替手順: WP のバックアップ → 撤去範囲 → 初回デプロイ → 確認 → ロールバック手順。
  ステージングは置かない（D-008）ため、`.htaccess` のリダイレクトなど本番でしか確かめられない項目は確認リストにして切替時に検証する。
- URL 互換: 現行パーマリンク `/{category}/{投稿ID}` から新 URL への 301 リダイレクト（`.htaccess`）。新 URL 体系は `spec/feature` の URL 設計で決める。
- microCMS Webhook → GitHub `repository_dispatch` のトークン管理（Fine-grained PAT）。
