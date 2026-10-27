// TopMessage の単体描画（top-page「Message」）。文言が HTML として解釈されずエスケープされることを確かめる。
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { parse } from 'node-html-parser';
import { beforeAll, describe, expect, it } from 'vitest';
import TopMessage from '../../src/components/top/TopMessage.astro';
import type { Profile } from '../../src/lib/domain/profile';

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create();
});

describe('TopMessage (container API)', () => {
  it('escapes HTML in the heading, the lines and the signature', async () => {
    const message: Profile['message'] = {
      heading: '<b>見出し</b> "quoted"',
      lines: ['1 行目 <b>bold</b>', '', '"引用" & <i>x</i>'],
      signature: '<script>alert(1)</script>',
    };
    const html = await container.renderToString(TopMessage, { props: { message } });
    const root = parse(html);

    // タグとして解釈されていない
    expect(root.querySelectorAll('b')).toHaveLength(0);
    expect(root.querySelectorAll('i')).toHaveLength(0);
    expect(root.querySelectorAll('script')).toHaveLength(0);
    // エスケープされた文字として出ている
    expect(html).toContain('&lt;b&gt;');
    expect(html).not.toContain('<b>');
    // テキストとしては元の文言のまま
    expect(root.querySelector('h3')?.text.trim()).toBe(message.heading);
    expect(root.text).toContain('"引用" & <i>x</i>');
    expect(root.text).toContain(message.signature);
  });
});
