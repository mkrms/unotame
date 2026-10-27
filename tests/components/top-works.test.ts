// TopWorks の単体描画（top-page X-2）。フィクスチャでは起きない 0 件の表示を、Astro のコンテナ API で確かめる。
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { parse } from 'node-html-parser';
import { beforeAll, describe, expect, it } from 'vitest';
import TopWorks from '../../src/components/top/TopWorks.astro';
import { EMPTY_WORKS_MESSAGE } from '../../src/data/site';
import { loadContent } from '../../src/lib/cms';
import type { CmsConfig } from '../../src/lib/cms/config';
import { createFixtureSource } from '../../src/lib/cms/fixture-source';
import type { Work } from '../../src/lib/domain/work';

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create();
});

async function render(works: Work[]) {
  return parse(await container.renderToString(TopWorks, { props: { works } }));
}

describe('TopWorks (container API)', () => {
  it('shows the empty message and View More without a list when there are no works', async () => {
    const root = await render([]);
    expect(root.querySelectorAll('ul')).toHaveLength(0);
    const paragraphs = root.querySelectorAll('p').map((p) => p.text.trim());
    expect(paragraphs).toContain(EMPTY_WORKS_MESSAGE);
    const viewMore = root.querySelectorAll('a').filter((a) => a.text.trim() === 'View More');
    expect(viewMore).toHaveLength(1);
    expect(viewMore[0].getAttribute('href')).toBe('/works/');
  });

  it('renders one WorkCard per work, without the empty message', async () => {
    const config: CmsConfig = { source: 'fixture', previewDrafts: [], isDev: false };
    const { works } = await loadContent(createFixtureSource(), config, { warn: () => {} });
    const root = await render(works.slice(0, 2));
    const cards = root.querySelectorAll('ul > li > a.c-work-card');
    expect(cards.map((a) => a.getAttribute('href'))).toEqual(
      works.slice(0, 2).map((work) => `/works/${work.slug}/`),
    );
    expect(root.text).not.toContain(EMPTY_WORKS_MESSAGE);
  });

  it('renders all cards when given 3 works', async () => {
    const config: CmsConfig = { source: 'fixture', previewDrafts: [], isDev: false };
    const { works } = await loadContent(createFixtureSource(), config, { warn: () => {} });
    expect(works.length).toBeGreaterThanOrEqual(3);
    const three = works.slice(0, 3);
    const root = await render(three);
    const cards = root.querySelectorAll('ul > li > a.c-work-card');
    expect(cards).toHaveLength(3);
    expect(cards.map((a) => a.getAttribute('href'))).toEqual(
      three.map((work) => `/works/${work.slug}/`),
    );
  });
});
