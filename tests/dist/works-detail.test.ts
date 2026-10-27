// 実績詳細の受け入れ条件（works-detail「受け入れ条件 / ページ生成・Latest・View More」）を dist/works/{slug}/index.html で検査する。
// 期待値はフィクスチャを loadContent に通した結果と selectLatestWorks から作る（ハードコードしない）。
import { existsSync, readdirSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { parse, type HTMLElement } from 'node-html-parser';
import { cmsImageUrl } from '../../src/lib/cms/image';
import type { Work } from '../../src/lib/domain/work';
import { selectLatestWorks } from '../../src/lib/related-works';
import { distPath, loadDistHtml, loadFixtureContent, textOf } from './helpers';

let works: Work[];
const pages = new Map<string, HTMLElement>();

beforeAll(async () => {
  ({ works } = await loadFixtureContent());
  for (const work of works) pages.set(work.slug, loadDistHtml(`works/${work.slug}/index.html`));
});

/** 各実績について、そのページの検査を行う */
function eachPage(check: (root: HTMLElement, work: Work) => void) {
  expect(works.length).toBeGreaterThan(0);
  for (const work of works) check(pages.get(work.slug)!, work);
}

const bodyOf = (root: HTMLElement) => {
  const bodies = root.querySelectorAll('.p-work-detail__content__body');
  expect(bodies).toHaveLength(1);
  return bodies[0];
};

const latestOf = (root: HTMLElement) => {
  const sections = root.querySelectorAll('section[aria-labelledby="work-latest-heading"]');
  expect(sections).toHaveLength(1);
  return sections[0];
};

describe('works detail: pages', () => {
  it('generates dist/works/{slug}/index.html for every work and nothing else', () => {
    const generated = readdirSync(distPath('works'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => existsSync(distPath(`works/${name}/index.html`)))
      .sort();
    expect(generated).toEqual(works.map((work) => work.slug).sort());
  });

  it('has exactly one h1 with the title', () => {
    eachPage((root, work) => {
      const h1s = root.querySelectorAll('h1');
      expect(h1s).toHaveLength(1);
      expect(textOf(h1s[0])).toBe(work.title);
    });
  });

  it('renders the header image (w=1600, webp) eagerly with the CMS alt', () => {
    eachPage((root, work) => {
      const imgs = root.querySelectorAll('.p-work-detail__content__header img');
      expect(imgs).toHaveLength(1);
      const img = imgs[0];
      expect(img.getAttribute('src')).toBe(
        cmsImageUrl(work.thumbnail, { width: 1600, format: 'webp' }),
      );
      expect(img.getAttribute('width')).toBe(String(work.thumbnail.width));
      expect(img.getAttribute('height')).toBe(String(work.thumbnail.height));
      expect(img.hasAttribute('loading')).toBe(false);
      expect(img.getAttribute('fetchpriority')).toBe('high');
      expect(img.getAttribute('alt')).toBe(work.thumbnail.alt);
    });
  });

  it('shows the category linking to the filtered list', () => {
    eachPage((root, work) => {
      const header = root.querySelector('.p-work-detail__content__header')!;
      expect(textOf(header)).toContain(`カテゴリー：${work.category.name}`);
      const links = header.querySelectorAll('a');
      expect(links).toHaveLength(1);
      expect(textOf(links[0])).toBe(work.category.name);
      expect(links[0].getAttribute('href')).toBe(`/works/?category=${work.category.slug}`);
    });
  });

  it('outputs the body HTML unescaped, as transformed by the CMS layer', () => {
    eachPage((root, work) => {
      const body = bodyOf(root);
      expect(body.innerHTML).toBe(work.bodyHtml);
    });
    // フィクスチャに <h2> を含む本文があり、タグとして出ている
    const withH2 = works.filter((work) => work.bodyHtml.includes('<h2'));
    expect(withH2.length).toBeGreaterThan(0);
    for (const work of withH2) {
      expect(bodyOf(pages.get(work.slug)!).querySelectorAll('h2').length).toBeGreaterThan(0);
    }
  });

  it('has "/assets/ and loading on body images (the CMS transformation is kept)', () => {
    const withAssets = works.filter((work) => work.bodyHtml.includes('"/assets/'));
    expect(withAssets.length).toBeGreaterThan(0);
    for (const work of withAssets) {
      const html = bodyOf(pages.get(work.slug)!).innerHTML;
      expect(html).toContain('"/assets/');
      expect(html).not.toContain('"assets/');
    }
    // 変換層は loading の無い <img> に loading="lazy" を足す（CMS で指定済みの値は変えない）
    const withImages = works.filter((work) => work.bodyHtml.includes('<img'));
    expect(withImages.length).toBeGreaterThan(0);
    let lazyCount = 0;
    for (const work of withImages) {
      const imgs = bodyOf(pages.get(work.slug)!).querySelectorAll('img');
      const expected = parse(work.bodyHtml).querySelectorAll('img');
      expect(imgs.map((img) => img.getAttribute('loading'))).toEqual(
        expected.map((img) => img.getAttribute('loading')),
      );
      for (const img of imgs) expect(img.hasAttribute('loading')).toBe(true);
      lazyCount += imgs.filter((img) => img.getAttribute('loading') === 'lazy').length;
    }
    expect(lazyCount).toBeGreaterThan(0);
  });
});

describe('works detail: Latest and View More', () => {
  it('lists the latest works excluding itself, in order', () => {
    eachPage((root, work) => {
      const expected = selectLatestWorks(works, { excludeSlug: work.slug, limit: 3 });
      expect(expected.length).toBeGreaterThan(0);
      const hrefs = latestOf(root)
        .querySelectorAll('ul a')
        .map((a) => a.getAttribute('href'));
      expect(hrefs).toEqual(expected.map((latest) => `/works/${latest.slug}/`));
      expect(hrefs).not.toContain(`/works/${work.slug}/`);
    });
  });

  it('shows min(3, all works - 1) cards in Latest', () => {
    const expectedCount = Math.min(3, works.length - 1);
    expect(expectedCount).toBeGreaterThan(0);
    eachPage((root) => {
      expect(latestOf(root).querySelectorAll('ul > li')).toHaveLength(expectedCount);
    });
  });

  it('uses h3 for card titles and decorative images', () => {
    eachPage((root) => {
      const cards = latestOf(root).querySelectorAll('ul > li');
      for (const card of cards) {
        expect(card.querySelectorAll('h3')).toHaveLength(1);
        const imgs = card.querySelectorAll('img');
        expect(imgs).toHaveLength(1);
        expect(imgs[0].getAttribute('alt')).toBe('');
      }
    });
  });

  it('has View More to /works/', () => {
    eachPage((root) => {
      const viewMore = latestOf(root)
        .querySelectorAll('a')
        .filter((a) => textOf(a) === 'View More');
      expect(viewMore).toHaveLength(1);
      expect(viewMore[0].getAttribute('href')).toBe('/works/');
    });
  });
});

describe('works detail: common', () => {
  it('has no duplicated id values', () => {
    eachPage((root) => {
      const ids = root.querySelectorAll('[id]').map((element) => element.id);
      const duplicated = ids.filter((id, index) => ids.indexOf(id) !== index);
      expect(duplicated).toEqual([]);
    });
  });
});
