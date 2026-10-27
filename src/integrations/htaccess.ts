// ビルドの最後に dist/htaccess.txt（src/pages/htaccess.txt.ts の出力）を dist/.htaccess に改名するインテグレーション
// （url-design「対応表の持ち方」。Astro は "." で始まるファイルをルートにしないので、名前を変えて出力してから改名する）。
// 中身はエンドポイントが作る。ここはファイル名の付け替えと、出力の取り違えを止めることだけを担う。
import { existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

/** src/pages/htaccess.txt.ts の出力ファイル名（dist/ からの相対） */
export const HTACCESS_BUILD_OUTPUT = 'htaccess.txt';
export const HTACCESS_FILE = '.htaccess';

/** dist/ の中で htaccess.txt を .htaccess に改名する。前提が崩れていたら例外でビルドを止める */
export function finalizeHtaccess(distDir: string): void {
  const from = join(distDir, HTACCESS_BUILD_OUTPUT);
  const to = join(distDir, HTACCESS_FILE);
  if (existsSync(to)) {
    // public/.htaccess を置くと生成物と二重になる（project-foundation のルール）
    throw new Error(
      `${HTACCESS_FILE} がすでに出力されています。public/.htaccess は置かず、src/htaccess/htaccess.template を編集してください`,
    );
  }
  if (!existsSync(from)) {
    throw new Error(`${HTACCESS_BUILD_OUTPUT} が出力されていません（src/pages/htaccess.txt.ts）`);
  }
  renameSync(from, to);
}

export default function htaccess(): AstroIntegration {
  return {
    name: 'unotame:htaccess',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        finalizeHtaccess(fileURLToPath(dir));
        logger.info(`${HTACCESS_BUILD_OUTPUT} → ${HTACCESS_FILE}`);
      },
    },
  };
}
