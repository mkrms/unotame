// npm run test:dist の前提チェック（vitest.dist.config.ts の setupFiles）。各テストファイルの検査の前に動く。
// dist/ が「フィクスチャ（CMS_SOURCE=fixture）でビルドされたもの」でなければ、分かるメッセージで止める。
// 期待値はフィクスチャから作るので、microCMS の実データでビルドした dist/ を検査しても意味がないため。
import { existsSync, readFileSync } from 'node:fs';
import { distPath, FIXTURE_BUILD_HINT, loadFixtureContent } from './helpers';

const indexPath = distPath('index.html');
if (!existsSync(indexPath)) {
  throw new Error(`${indexPath} がありません。${FIXTURE_BUILD_HINT}`);
}

const { works } = await loadFixtureContent();
const first = works[0];
if (!first) {
  throw new Error('フィクスチャに実績がありません（fixtures/microcms/works.json）');
}
const marker = `href="/works/${first.slug}/"`;
if (!readFileSync(indexPath, 'utf8').includes(marker)) {
  throw new Error(
    `dist/index.html がフィクスチャでビルドされたものではないようです（フィクスチャの先頭の実績の ${marker} がありません）。${FIXTURE_BUILD_HINT}`,
  );
}
