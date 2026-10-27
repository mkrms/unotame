// 開発サーバー（astro dev）で動いているかどうかを、ビルド時定数として注入するインテグレーション（cms-integration「下書きのプレビュー」）。
// import.meta.env.DEV は NODE_ENV=development や --devOutput 付きの astro build でも true になるため、
// 「本番ビルドでは下書き・works 0 件を止める」ガードの判定には使わない。
// Astro のコマンド（dev / build / preview / sync）を直接見て、dev のときだけ true にする。
import type { AstroIntegration } from 'astro';

/** 注入する定数の名前（src/env.d.ts で型を宣言している） */
export const DEV_SERVER_FLAG = 'import.meta.env.UNOTAME_IS_DEV_SERVER';

/** Astro のコマンドから、注入する Vite の define を作る */
export function devServerFlagDefine(command: string): Record<string, string> {
  return { [DEV_SERVER_FLAG]: JSON.stringify(command === 'dev') };
}

export default function devServerFlag(): AstroIntegration {
  return {
    name: 'unotame:dev-server-flag',
    hooks: {
      'astro:config:setup': ({ command, updateConfig }) => {
        updateConfig({ vite: { define: devServerFlagDefine(command) } });
      },
    },
  };
}
