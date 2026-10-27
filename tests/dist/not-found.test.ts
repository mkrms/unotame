// 404 ページの受け入れ条件（not-found「受け入れ条件 / ビルド成果物」）を dist/404.html で検査する。
// .htaccess（ErrorDocument）の項目は url-design の .htaccess 生成の実装後に確認する（今回は対象外）。
// 「CMS のデータに依存しない」は tests/source/components.test.ts で、404.astro の import をたどって src/lib/cms に届かないことを確かめる。
import { existsSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { HTMLElement } from 'node-html-parser';
import { globalNav } from '../../src/data/navigation';
import { routes } from '../../src/lib/routes';
import { distPath, loadDistHtml, textOf } from './helpers';

let root: HTMLElement;

beforeAll(() => {
  root = loadDistHtml('404.html');
});

describe('404 page: output', () => {
  it('is output as dist/404.html, not dist/404/index.html', () => {
    expect(existsSync(distPath('404.html'))).toBe(true);
    expect(existsSync(distPath('404/index.html'))).toBe(false);
  });

  it('has the title', () => {
    const titles = root.querySelectorAll('title');
    expect(titles).toHaveLength(1);
    expect(textOf(titles[0])).toBe('ページが見つかりません | UNOTAME');
  });

  it('is noindex without canonical and og:url', () => {
    const robots = root.querySelectorAll('meta[name="robots"]');
    expect(robots).toHaveLength(1);
    expect(robots[0].getAttribute('content')).toBe('noindex');
    expect(root.querySelectorAll('link[rel="canonical"]')).toHaveLength(0);
    expect(root.querySelectorAll('meta[property="og:url"]')).toHaveLength(0);
  });
});

describe('404 page: content', () => {
  it('has exactly one h1 and links to /works/ and /', () => {
    const h1s = root.querySelectorAll('h1');
    expect(h1s).toHaveLength(1);
    expect(textOf(h1s[0])).toBe('404 Not Found');
    const mainLinks = root.querySelectorAll('main a').map((a) => a.getAttribute('href'));
    expect(mainLinks).toContain(routes.works());
    expect(mainLinks).toContain(routes.home());
  });

  it('has the header navigation and the footer CONTACT', () => {
    const navLinks = root.querySelectorAll('header nav a');
    expect(navLinks.map((a) => [textOf(a), a.getAttribute('href')])).toEqual(
      globalNav.map((item) => [item.label, item.href]),
    );
    const footerLinks = root.querySelectorAll('footer a');
    expect(
      footerLinks.some((a) => textOf(a) === 'CONTACT' && a.getAttribute('href') === '/contact/'),
    ).toBe(true);
  });

  it('uses only root-relative, fragment or https URLs', () => {
    const urls = root
      .querySelectorAll('link[href], script[src], img[src], a[href]')
      .map((element) => element.getAttribute('href') ?? element.getAttribute('src') ?? '');
    expect(urls.length).toBeGreaterThan(0);
    const offenders = urls.filter((url) => !/^(\/(?!\/)|#|https:\/\/)/.test(url));
    expect(offenders).toEqual([]);
  });

  it('has no loader and no aria-current', () => {
    expect(root.querySelectorAll('.c-loader')).toHaveLength(0);
    expect(root.querySelectorAll('[aria-current]')).toHaveLength(0);
  });
});
