// サーバー側（ビルド時）だけで読む環境変数の型（cms-integration「環境変数と秘密情報」）。
// PUBLIC_ を付けないのでクライアントのコードには出ない。読むのは src/lib/cms/index.ts だけ。
interface ImportMetaEnv {
  readonly MICROCMS_SERVICE_DOMAIN?: string;
  readonly MICROCMS_API_KEY?: string;
  readonly CMS_SOURCE?: string;
  readonly MICROCMS_PREVIEW_DRAFTS?: string;
  /**
   * astro dev のときだけ true（src/integrations/dev-server-flag.ts がビルド時定数として注入する）。
   * astro build / preview 用のビルドでは false。注入されていない環境（Vitest など）では undefined。
   */
  readonly UNOTAME_IS_DEV_SERVER?: boolean;
}
