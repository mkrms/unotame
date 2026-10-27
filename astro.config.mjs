import { defineConfig } from 'astro/config';
import devServerFlag from './src/integrations/dev-server-flag.ts';
import htaccess from './src/integrations/htaccess.ts';

export default defineConfig({
  site: 'https://unotame.com',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' }, // 既定値だが明示する（url-design）
  // dev-server-flag … astro dev のときだけ import.meta.env.UNOTAME_IS_DEV_SERVER を true にする（cms の dev 判定）
  // htaccess … dist/htaccess.txt（src/pages/htaccess.txt.ts の出力）を dist/.htaccess に改名する（url-design）
  // sitemap は P2「SEO / OGP」で追加
  integrations: [devServerFlag(), htaccess()],
});
