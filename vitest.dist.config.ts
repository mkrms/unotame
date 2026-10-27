// npm run test:dist 用（top-page X-1）。ビルド済みの dist/ の HTML を tests/dist/ で検査する。
// ビルドは含めない。先にフィクスチャでビルドしておく（CI の順序: lint → check → test → build → test:dist）。
//   Git Bash:   CMS_SOURCE=fixture npm run build && npm run test:dist
//   PowerShell: $env:CMS_SOURCE='fixture'; npm run build; npm run test:dist
// tests/dist/setup.ts が、dist/ が無い・フィクスチャのビルドでないときに手順を示して止める。
// 期待値を getProfile() などから作るため、npm test と同じく Astro の Vite 設定（画像の import など）を使う。
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    include: ['tests/dist/**/*.test.ts'],
    setupFiles: ['tests/dist/setup.ts'],
    environment: 'node',
  },
});
