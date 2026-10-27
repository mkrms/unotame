import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import globals from 'globals';

export default defineConfig([
  { ignores: ['dist/', '.astro/', 'node_modules/', 'legacy/', 'coverage/'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  astro.configs.recommended,
  { files: ['*.{js,mjs,ts}'], languageOptions: { globals: globals.node } }, // 設定ファイル用
]);
