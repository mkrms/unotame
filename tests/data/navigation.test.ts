import { describe, expect, it } from 'vitest';
import { globalNav } from '../../src/data/navigation';
// Vite の ?raw でソースを文字列として読む（@types/node を足さずに済ませる）
import navigationSource from '../../src/data/navigation.ts?raw';

describe('globalNav', () => {
  it('lists ABOUT, WORKS and CONTACT in order', () => {
    expect(globalNav.map((item) => [item.label, item.href])).toEqual([
      ['ABOUT', '/#about'],
      ['WORKS', '/works/'],
      ['CONTACT', '/contact/'],
    ]);
  });

  it('builds hrefs with routes.* instead of hard-coded paths', () => {
    expect(navigationSource).not.toMatch(/['"`]\/(#about|works\/|contact\/)/);
  });
});
