// 実績一覧の受け入れ条件（works-list「受け入れ条件 / ビルド成果物」）を dist/works/index.html で検査する。
// 期待値はフィクスチャを loadContent に通した結果（と、同じ経路の getCategoriesInUse）から作る（ハードコードしない）。
import { existsSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { HTMLElement } from 'node-html-parser';
import { createCmsStore } from '../../src/lib/cms';
import type { CmsConfig } from '../../src/lib/cms/config';
import { createFixtureSource } from '../../src/lib/cms/fixture-source';
import type { Category, Work } from '../../src/lib/domain/work';
import { WORKS_FILTER_ROOT_ATTR } from '../../src/lib/works-filter';
import { distPath, FIXTURE_BUILD_HINT, loadDistHtml, loadFixtureContent, textOf } from './helpers';

let root: HTMLElement;
let works: Work[];
let allCategories: Category[];
let categoriesInUse: Category[];

beforeAll(async () => {
  root = loadDistHtml('works/index.html');
  const content = await loadFixtureContent();
  works = content.works;
  allCategories = content.categories;
  const config: CmsConfig = { source: 'fixture', previewDrafts: [], isDev: false };
  const store = createCmsStore({
    getConfig: () => config,
    createSource: () => createFixtureSource(),
    warn: () => {},
  });
  categoriesInUse = await store.getCategoriesInUse();
});

const listItems = () => root.querySelectorAll('ul.p-works__list > li');
const filterButtons = () => root.querySelectorAll('button[data-filter]');

describe('works list: heading and cards', () => {
  it('has exactly one h1 with the page title', () => {
    const h1s = root.querySelectorAll('h1');
    expect(h1s).toHaveLength(1);
    expect(textOf(h1s[0])).toBe('記事・実績一覧');
  });

  it('lists all works (date desc) with /works/{slug}/ links', () => {
    expect(works.length).toBeGreaterThan(0);
    works.slice(1).forEach((work, index) => {
      expect(work.date <= works[index].date).toBe(true);
    });
    const hrefs = listItems().map((li) => li.querySelector('a')?.getAttribute('href'));
    expect(hrefs).toEqual(works.map((work) => `/works/${work.slug}/`));
  });

  it('puts data-category on each item without hidden / is-show', () => {
    const items = listItems();
    expect(items).toHaveLength(works.length);
    items.forEach((li, index) => {
      expect(li.getAttribute('data-category')).toBe(works[index].category.slug);
      expect(li.hasAttribute('hidden')).toBe(false);
      expect(li.classList.contains('is-show')).toBe(false);
    });
    expect(root.querySelectorAll('.is-show')).toHaveLength(0);
  });

  it('uses h2 for card titles and decorative images with width / height', () => {
    listItems().forEach((li, index) => {
      const h2 = li.querySelector('h2');
      expect(h2 && textOf(h2)).toBe(works[index].title);
      expect(li.querySelectorAll('h3')).toHaveLength(0);
      const imgs = li.querySelectorAll('img');
      expect(imgs).toHaveLength(1);
      expect(imgs[0].getAttribute('alt')).toBe('');
      expect(imgs[0].getAttribute('width')).toBe(String(works[index].thumbnail.width));
      expect(imgs[0].getAttribute('height')).toBe(String(works[index].thumbnail.height));
    });
  });
});

describe('works list: filter', () => {
  it('has "全て" first, then the categories in use in order', () => {
    const buttons = filterButtons();
    expect(buttons).toHaveLength(categoriesInUse.length + 1);
    buttons.forEach((button) => {
      expect(button.tagName).toBe('BUTTON');
      expect(button.getAttribute('type')).toBe('button');
    });
    const [all, ...rest] = buttons;
    expect(all.getAttribute('data-filter')).toBe('');
    expect(all.getAttribute('aria-pressed')).toBe('true');
    expect(textOf(all)).toBe('全て');
    expect(
      rest.map((button) => [
        button.getAttribute('data-filter'),
        button.getAttribute('aria-pressed'),
        textOf(button),
      ]),
    ).toEqual(categoriesInUse.map((category) => [category.slug, 'false', category.name]));
  });

  it('has no button for a category without works', () => {
    const unused = allCategories.filter(
      (category) => !works.some((work) => work.category.id === category.id),
    );
    // フィクスチャに「実績 0 件のカテゴリ」があること（無ければこの検査は意味を持たない）
    expect(unused.length).toBeGreaterThan(0);
    const filters = filterButtons().map((button) => button.getAttribute('data-filter'));
    for (const category of unused) expect(filters).not.toContain(category.slug);
  });

  it('groups the buttons with role="group" named by the "Category" heading', () => {
    const groups = root.querySelectorAll('[role="group"]');
    expect(groups).toHaveLength(1);
    const labelledBy = groups[0].getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    const heading = root.querySelector(`[id="${labelledBy}"]`);
    expect(heading).not.toBeNull();
    expect(heading!.tagName).toMatch(/^H[1-6]$/);
    expect(textOf(heading!)).toBe('Category');
    expect(groups[0].querySelectorAll('button[data-filter]')).toHaveLength(filterButtons().length);
  });

  it('places the filter before the list in DOM order', () => {
    const html = root.toString();
    const filterIndex = html.indexOf('role="group"');
    const listIndex = html.indexOf('class="p-works__list"');
    expect(filterIndex).toBeGreaterThan(-1);
    expect(listIndex).toBeGreaterThan(filterIndex);
  });

  it('has one empty role="status" element', () => {
    const statuses = root.querySelectorAll('[role="status"]');
    expect(statuses).toHaveLength(1);
    expect(textOf(statuses[0])).toBe('');
  });
});

describe('works list: filter script binding', () => {
  /** type="module" のスクリプトの中身（src があれば dist/ のファイル、無ければインライン） */
  const moduleScriptSources = () =>
    root.querySelectorAll('script[type="module"]').map((script) => {
      const src = script.getAttribute('src');
      if (!src) return script.innerHTML;
      const path = distPath(src);
      if (!existsSync(path)) throw new Error(`${path} がありません。${FIXTURE_BUILD_HINT}`);
      return readFileSync(path, 'utf8');
    });

  it('loads a module script that looks up the filter root attribute', () => {
    const sources = moduleScriptSources();
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.some((source) => source.includes(WORKS_FILTER_ROOT_ATTR))).toBe(true);
  });

  it('puts the filter root attribute on one element that contains the filter and the list', () => {
    const roots = root.querySelectorAll(`[${WORKS_FILTER_ROOT_ATTR}]`);
    expect(roots).toHaveLength(1);
    expect(roots[0].querySelectorAll('button[data-filter]')).toHaveLength(filterButtons().length);
    expect(roots[0].querySelectorAll('ul.p-works__list > li')).toHaveLength(works.length);
    expect(roots[0].querySelectorAll('[data-works-filter-status]')).toHaveLength(1);
  });
});

describe('works list: markup', () => {
  it('has no duplicated id values', () => {
    const ids = root.querySelectorAll('[id]').map((element) => element.id);
    const duplicated = ids.filter((id, index) => ids.indexOf(id) !== index);
    expect(duplicated).toEqual([]);
  });

  it('has only <li> as direct children of <ul> / <ol>', () => {
    const offenders = root
      .querySelectorAll('ul, ol')
      .flatMap((list) => list.children.filter((child) => child.tagName !== 'LI'))
      .map((child) => child.tagName);
    expect(offenders).toEqual([]);
  });
});
