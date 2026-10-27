import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://unotame.com',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' }, // 既定値だが明示する（url-design）
  // integrations: [] … sitemap は P2「SEO / OGP」で追加
});
