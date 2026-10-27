// トップページの受け入れ条件（top-page「受け入れ条件」）を dist/index.html で検査する。
// 期待値はフィクスチャを loadContent に通した結果と getProfile() から作る（ハードコードしない）。
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import type { HTMLElement } from 'node-html-parser';
import { cmsImageUrl } from '../../src/lib/cms/image';
import type { Work } from '../../src/lib/domain/work';
import { getProfile } from '../../src/lib/profile';
import { routes } from '../../src/lib/routes';
import { distPath, linesOf, loadDistHtml, loadFixtureContent, textOf } from './helpers';

const profile = getProfile();
const TOP_WORKS_LIMIT = 6;

let root: HTMLElement;
let expectedWorks: Work[];

/** aria-labelledby で特定したセクション（ちょうど 1 つあること） */
function section(headingId: string): HTMLElement {
  const found = root.querySelectorAll(`section[aria-labelledby="${headingId}"]`);
  expect(found).toHaveLength(1);
  return found[0];
}

beforeAll(async () => {
  root = loadDistHtml('index.html');
  const { works } = await loadFixtureContent();
  expectedWorks = works.slice(0, TOP_WORKS_LIMIT);
});

describe('top page: KV / Message', () => {
  it('has exactly one h1 with kv.name', () => {
    const h1s = root.querySelectorAll('h1');
    expect(h1s).toHaveLength(1);
    expect(textOf(h1s[0])).toBe(profile.kv.name);
    expect(h1s[0].id).toBe('top-kv-heading');
  });

  it('has the role and the skills in order in the KV section', () => {
    const kv = section('top-kv-heading');
    expect(textOf(kv)).toContain(profile.kv.role);
    expect(kv.querySelectorAll('li').map(textOf)).toEqual(profile.kv.skills);
  });

  it('has the heading, the lines (a blank line as two <br>) and the signature', () => {
    const message = section('top-message-heading');
    const h3s = message.querySelectorAll('h3');
    expect(h3s).toHaveLength(1);
    expect(textOf(h3s[0])).toBe(profile.message.heading);

    const paragraphs = message.querySelectorAll('p');
    const body = paragraphs.find((p) => p.querySelector('br') !== null);
    expect(body).toBeDefined();
    // <br> で区切った結果が lines と一致する＝'' の行の位置で <br> が 2 つ続く
    expect(linesOf(body!)).toEqual(profile.message.lines);
    if (profile.message.lines.includes('')) {
      expect(body!.innerHTML).toMatch(/<br\s*\/?>\s*<br\s*\/?>/);
    }
    expect(paragraphs.map(textOf)).toContain(profile.message.signature);
  });

  it('has only one <main> and no <aside> in the message section', () => {
    expect(root.querySelectorAll('main')).toHaveLength(1);
    expect(section('top-message-heading').querySelectorAll('aside')).toHaveLength(0);
  });
});

describe('top page: Works', () => {
  it('lists the latest 6 works (date desc) with /works/{slug}/ links', () => {
    expect(expectedWorks.length).toBeGreaterThan(0);
    // 期待値自体が日付の新しい順（非増加）になっていること
    expectedWorks.slice(1).forEach((work, index) => {
      expect(work.date <= expectedWorks[index].date).toBe(true);
    });
    const hrefs = section('top-works-heading')
      .querySelectorAll('ul a')
      .map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(expectedWorks.map((work) => `/works/${work.slug}/`));
  });

  it('renders the title (h3), the category and the image of each card', () => {
    const links = section('top-works-heading').querySelectorAll('ul a');
    expect(links).toHaveLength(expectedWorks.length);
    links.forEach((link, index) => {
      const work = expectedWorks[index];
      const h3 = link.querySelector('h3');
      expect(h3 && textOf(h3)).toBe(work.title);
      expect(textOf(link)).toContain(work.category.name);

      const imgs = link.querySelectorAll('img');
      expect(imgs).toHaveLength(1);
      const img = imgs[0];
      expect(img.getAttribute('alt')).toBe('');
      expect(img.getAttribute('width')).toBe(String(work.thumbnail.width));
      expect(img.getAttribute('height')).toBe(String(work.thumbnail.height));
      expect(img.getAttribute('loading')).toBe('lazy');
      expect(img.getAttribute('src')).toBe(
        cmsImageUrl(work.thumbnail, { width: 800, format: 'webp' }),
      );
    });
  });

  it('has View More to /works/', () => {
    const viewMore = section('top-works-heading')
      .querySelectorAll('a')
      .filter((a) => textOf(a) === 'View More');
    expect(viewMore).toHaveLength(1);
    expect(viewMore[0].getAttribute('href')).toBe('/works/');
  });
});

describe('top page: About', () => {
  it('has exactly one id="about" on the ABOUT section, and the header links to /#about', () => {
    const about = root.querySelectorAll('[id="about"]');
    expect(about).toHaveLength(1);
    expect(about[0].tagName).toBe('SECTION');
    expect(about[0].getAttribute('aria-labelledby')).toBe('top-about-heading');
    const headerLinks = root.querySelectorAll('header a').map((a) => a.getAttribute('href'));
    expect(headerLinks).toContain('/#about');
    expect(routes.about()).toBe('/#about');
  });

  it('renders the profile photo through astro:assets, smaller than the original', () => {
    const photos = section('top-about-heading')
      .querySelectorAll('img')
      .filter((img) => img.getAttribute('alt') === profile.about.photo.alt);
    expect(photos).toHaveLength(1);
    const src = photos[0].getAttribute('src') ?? '';
    expect(src).toMatch(/^\/_astro\//);
    expect(photos[0].getAttribute('width')).toBe('300');
    expect(photos[0].getAttribute('height')).toBe('300');

    const original = fileURLToPath(new URL('../../src/assets/images/profile.png', import.meta.url));
    expect(statSync(distPath(src)).size).toBeLessThan(statSync(original).size);
  });

  it('has each bio line', () => {
    const text = textOf(section('top-about-heading'));
    for (const line of profile.about.bio) expect(text).toContain(line);
  });

  it('has 5 social links in order, opening in a new tab with noopener and a name', () => {
    const links = section('top-about-heading').querySelectorAll('a');
    expect(links).toHaveLength(profile.socials.length);
    links.forEach((link, index) => {
      const social = profile.socials[index];
      expect(link.getAttribute('href')).toBe(social.url);
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')?.split(/\s+/)).toContain('noopener');
      expect(link.getAttribute('aria-label')).toContain(social.label);
      const imgs = link.querySelectorAll('img');
      expect(imgs).toHaveLength(1);
      expect(imgs[0].getAttribute('alt')).toBe('');
      expect(imgs[0].getAttribute('width')).toBe('60');
      expect(imgs[0].getAttribute('height')).toBe('60');
    });
  });
});

describe('top page: common', () => {
  it('has no duplicated id values', () => {
    const ids = root.querySelectorAll('[id]').map((element) => element.id);
    const duplicated = ids.filter((id, index) => ids.indexOf(id) !== index);
    expect(duplicated).toEqual([]);
  });
});
