// dist/.htaccess の中身を作るエンドポイント（url-design「旧 URL → 新 URL のリダイレクト（301）」）。
// ページと同じ CMS の取得結果（メモ化済み）から作るため、ページ生成と同じ経路で出力する。
// ビルドでは dist/htaccess.txt に出力され、src/integrations/htaccess.ts が astro:build:done で dist/.htaccess に改名する
// （Astro は "." で始まるファイルをルートにしないため）。期待件数を下回るなどのエラーはビルドの失敗になる。
import type { APIRoute } from 'astro';
import template from '../htaccess/htaccess.template?raw';
import { EXPECTED_LEGACY_WORK_REDIRECTS } from '../data/redirects';
import { getAllCategories, getAllWorks } from '../lib/cms';
import { buildHtaccess } from '../lib/redirects';

export const GET: APIRoute = async () => {
  const [works, categories] = await Promise.all([getAllWorks(), getAllCategories()]);
  const body = buildHtaccess({
    template,
    works,
    categories,
    expectedLegacyWorkCount: EXPECTED_LEGACY_WORK_REDIRECTS,
  });
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
