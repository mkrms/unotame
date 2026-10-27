import { describe, expect, it } from 'vitest';

// getViteConfig 経由で astro.config.mjs が Vitest に読み込まれていることを確かめる。
describe('test setup', () => {
  it('loads the Astro config (site)', () => {
    expect(import.meta.env.SITE).toBe('https://unotame.com');
  });
});
