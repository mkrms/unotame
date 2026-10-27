# 機能外仕様: デザイン方針（design-policy）

> 状態: **骨子のみ**（方針は D-005 で確定。細部は P1 の移植時・P2 の刷新時に `designer` が具体化する）

## 基本方針
- 現行デザインを**踏襲して刷新**する。ブランドの一貫性（ロゴ・書体・トーン）は維持し、コードと細部を改善する。

## 対象ブラウザ
- Vite（Astro 7）の既定の対象（`baseline-widely-available`。Safari は 16.4 以降）に合わせる。
  メディアクエリの範囲記法（`width <= 768px` など）は変換せずに出力するため、iOS 16.3 以前の Safari には SP 用のスタイルが当たらない
  （2026-10-27 レビュー指摘 L-3。古い環境への対応が必要になったら、P2 で対象ブラウザの指定を見直す）。

## 引き継ぐ資産（移植元）
- ロゴ: `assets/img/logo-landscape-removebg.png` ほか `unotame-logo-*.png`
- 書体: Objective（Regular / Medium / Black, `assets/fonts/*.otf`）→ WOFF2 化を検討
- スタイル: `assets/css/style.scss`（Foundation / Layout / Object〈Component / Project〉）、`destyle.css`。新構成では Object に Utility を追加する
- 命名規約: FLOCSS（`l-` Layout / `c-` Component / `p-` Project / `u-` Utility / `is-` 状態）。Utility は現行の `.sp-none` / `.pc-none` などの置き場
- ページ構成: トップ（KV / Message / Works / About）、Works 一覧・詳細、Contact、フッターの大きな CONTACT 導線

## 改善候補（P2 で検討）
- ローダー演出の要否（表示速度とのトレードオフ）
- レスポンシブ・iOS 表示の再検証、タイポグラフィ・余白の整理
- ダークモード対応の要否、モーション（`prefers-reduced-motion` 尊重）
- 色・余白などのデザイントークン化（SCSS 変数 / CSS カスタムプロパティ）

## 未決事項
- 刷新の度合い（どこまで変えるか）の具体的な基準。
