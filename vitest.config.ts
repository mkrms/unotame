/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Vitest は既定で CSS 系のモジュールを空にする。ソースの静的検査（tests/styles/）で
    // SCSS・CSS を ?raw の文字列として読めるよう、?raw の読み込みだけは空にしない
    css: { include: [/\.s?css\?raw$/] },
  },
});
