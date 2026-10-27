// WorkCard の単体描画（top-page「共通コンポーネント WorkCard」）。見出しレベルの切り替えをコンテナ API で確かめる。
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { parse } from 'node-html-parser';
import { beforeAll, describe, expect, it } from 'vitest';
import WorkCard from '../../src/components/works/WorkCard.astro';
import { loadContent } from '../../src/lib/cms';
import type { CmsConfig } from '../../src/lib/cms/config';
import { createFixtureSource } from '../../src/lib/cms/fixture-source';
import type { Work } from '../../src/lib/domain/work';

let container: AstroContainer;
let work: Work;

beforeAll(async () => {
  container = await AstroContainer.create();
  const config: CmsConfig = { source: 'fixture', previewDrafts: [], isDev: false };
  const { works } = await loadContent(createFixtureSource(), config, { warn: () => {} });
  work = works[0];
});

async function render(props: { work: Work; headingLevel?: 2 | 3 }) {
  return parse(await container.renderToString(WorkCard, { props }));
}

describe('WorkCard (container API)', () => {
  it('uses h3 for the title by default', async () => {
    const root = await render({ work });
    expect(root.querySelectorAll('h2')).toHaveLength(0);
    const h3s = root.querySelectorAll('h3');
    expect(h3s).toHaveLength(1);
    expect(h3s[0].text.trim()).toBe(work.title);
  });

  it('uses h2 for the title with headingLevel={2}', async () => {
    const root = await render({ work, headingLevel: 2 });
    expect(root.querySelectorAll('h3')).toHaveLength(0);
    const h2s = root.querySelectorAll('h2');
    expect(h2s).toHaveLength(1);
    expect(h2s[0].text.trim()).toBe(work.title);
  });
});
