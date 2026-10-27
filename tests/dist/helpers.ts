// dist/ 検査（npm run test:dist）の共通ヘルパー。先にフィクスチャでビルドしておくこと。
//   Git Bash:   CMS_SOURCE=fixture npm run build
//   PowerShell: $env:CMS_SOURCE='fixture'; npm run build
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, type HTMLElement } from 'node-html-parser';
import { loadContent } from '../../src/lib/cms';
import type { CmsConfig } from '../../src/lib/cms/config';
import { createFixtureSource } from '../../src/lib/cms/fixture-source';

/** 前提を満たさないときのメッセージ（ビルドし直す手順） */
export const FIXTURE_BUILD_HINT =
  "CMS_SOURCE=fixture でビルドし直してください（Git Bash: CMS_SOURCE=fixture npm run build / PowerShell: $env:CMS_SOURCE='fixture'; npm run build）";

export const distDir = fileURLToPath(new URL('../../dist/', import.meta.url));

/** dist/ からの相対パス（例 'index.html'・'/_astro/x.webp'）を絶対パスにする */
export function distPath(relativePath: string): string {
  return join(distDir, relativePath.replace(/^\//, '').split(/[?#]/)[0]);
}

/** dist/ の HTML を読んでパースする */
export function loadDistHtml(relativePath: string): HTMLElement {
  const path = distPath(relativePath);
  if (!existsSync(path)) {
    throw new Error(`${path} がありません。${FIXTURE_BUILD_HINT}`);
  }
  return parse(readFileSync(path, 'utf8'));
}

/** ビルドと同じ経路（loadContent）でフィクスチャを読み、期待値の元にする */
export function loadFixtureContent() {
  const config: CmsConfig = { source: 'fixture', previewDrafts: [], isDev: false };
  return loadContent(createFixtureSource(), config, { warn: () => {} });
}

/** 要素の中のテキスト（エンティティを戻し、空白を詰めたもの） */
export function textOf(element: HTMLElement): string {
  return element.text.replace(/\s+/g, ' ').trim();
}

/** <br> で区切られた行を、エンティティを戻したテキストの配列にする */
export function linesOf(element: HTMLElement): string[] {
  return element.innerHTML.split(/<br\s*\/?>/i).map((segment) => textOf(parse(segment)));
}
