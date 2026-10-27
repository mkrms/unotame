import { getViteConfig } from 'astro/config';
import { configDefaults } from 'vitest/config';

export default getViteConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // tests/dist/ はビルド済みの dist/ を検査するので npm test からは外し、npm run test:dist（vitest.dist.config.ts）で動かす
    exclude: [...configDefaults.exclude, 'tests/dist/**'],
    environment: 'node',
    // Vitest は既定で CSS 系のモジュールを空にする。ソースの静的検査（tests/styles/）で
    // SCSS・CSS を ?raw の文字列として読めるよう、?raw の読み込みだけは空にしない
    css: { include: [/\.s?css\?raw$/] },
  },
});
