// LatestWorks の単体描画（works-detail「Latest・View More」、top-page X-2 の方式）。
// フィクスチャのビルドでは起きない「実績が全部で 1 件だけ（Latest 0 件）」の表示を、Astro のコンテナ API で確かめる。
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { parse } from 'node-html-parser';
import { beforeAll, describe, expect, it } from 'vitest';
import LatestWorks from '../../src/components/works/LatestWorks.astro';
import { loadContent } from '../../src/lib/cms';
import type { CmsConfig } from '../../src/lib/cms/config';
import { createFixtureSource } from '../../src/lib/cms/fixture-source';
import type { Work } from '../../src/lib/domain/work';
import { selectLatestWorks } from '../../src/lib/related-works';

let container: AstroContainer;
let works: Work[];

beforeAll(async () => {
  container = await AstroContainer.create();
  const config: CmsConfig = { source: 'fixture', previewDrafts: [], isDev: false };
  ({ works } = await loadContent(createFixtureSource(), config, { warn: () => {} }));
});

async function render(latest: Work[]) {
  return parse(await container.renderToString(LatestWorks, { props: { works: latest } }));
}

const viewMoreLinks = (root: ReturnType<typeof parse>) =>
  root.querySelectorAll('a').filter((a) => a.text.trim() === 'View More');

describe('LatestWorks (container API)', () => {
  it('shows only View More without the heading and the list when there is no other work', async () => {
    const only = works.slice(0, 1);
    const latest = selectLatestWorks(only, { excludeSlug: only[0].slug, limit: 3 });
    expect(latest).toEqual([]);
    const root = await render(latest);
    expect(root.querySelectorAll('h2')).toHaveLength(0);
    expect(root.querySelectorAll('ul')).toHaveLength(0);
    expect(root.querySelectorAll('[aria-labelledby]')).toHaveLength(0);
    expect(root.text).not.toContain('Latest');
    const viewMore = viewMoreLinks(root);
    expect(viewMore).toHaveLength(1);
    expect(viewMore[0].getAttribute('href')).toBe('/works/');
  });

  it('renders the heading, one card (h3) per work and View More', async () => {
    const latest = works.slice(0, 3);
    const root = await render(latest);
    const heading = root.querySelector('#work-latest-heading');
    expect(heading?.tagName).toBe('H2');
    expect(heading?.text.trim()).toBe('Latest');
    const cards = root.querySelectorAll('ul > li > a.c-work-card');
    expect(cards.map((a) => a.getAttribute('href'))).toEqual(
      latest.map((work) => `/works/${work.slug}/`),
    );
    expect(root.querySelectorAll('ul h3')).toHaveLength(latest.length);
    expect(viewMoreLinks(root)).toHaveLength(1);
  });
});
