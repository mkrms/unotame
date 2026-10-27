import { compileString } from 'sass';
import { describe, expect, it } from 'vitest';
import styleSource from '../../src/styles/style.scss?raw';

// 相対の @use を src/styles/ から解決させるための URL（file: URL なら Sass がファイルシステムから読む）
const stylesDir = new URL('../../src/styles/', import.meta.url);

/** src/styles/ に置いたファイルとして SCSS をコンパイルし、CSS と警告を返す */
function compile(source: string, fileName = '_test.scss') {
  const warnings: string[] = [];
  const { css } = compileString(source, {
    url: new URL(fileName, stylesDir),
    logger: {
      warn: (message) => warnings.push(message),
      debug: () => {},
    },
  });
  return { css, warnings };
}

/** mixin を 1 つだけ使ったルールをコンパイルし、出力されたメディアクエリを返す */
function mediaQueryOf(mixin: string): string {
  const { css } = compile(
    `@use 'foundation/mixins' as *;\n.a { @include ${mixin} { color: red; } }`,
  );
  const match = css.match(/@media ([^{]+)\{/);
  if (!match) throw new Error(`no @media in output of ${mixin}: ${css}`);
  return match[1].trim();
}

describe('breakpoint mixins (style-migration S-5)', () => {
  it('sp / ov-sp do not overlap at 768px', () => {
    expect(mediaQueryOf('sp')).toBe('screen and (width <= 768px)');
    expect(mediaQueryOf('ov-sp')).toBe('screen and (width > 768px)');
  });

  it('pc / ov-pc do not overlap at 1366px', () => {
    expect(mediaQueryOf('pc')).toBe('screen and (width <= 1366px)');
    expect(mediaQueryOf('ov-pc')).toBe('screen and (width > 1366px)');
  });
});

describe('style.scss', () => {
  const { css, warnings } = compile(styleSource, 'style.scss');

  it('compiles without deprecation or other warnings', () => {
    expect(warnings).toEqual([]);
  });

  it('outputs @font-face before the layout rules', () => {
    const fontFace = css.indexOf('@font-face');
    const header = css.indexOf('.l-header');
    expect(fontFace).toBeGreaterThanOrEqual(0);
    expect(header).toBeGreaterThan(fontFace);
  });

  it('outputs the utilities last', () => {
    const utility = css.indexOf('.u-sp-none');
    expect(utility).toBeGreaterThanOrEqual(0);
    for (const selector of [
      '.l-header',
      '.l-footer',
      '.c-btn-view-more',
      '.c-loader',
      '.c-work-card',
    ]) {
      expect(css.lastIndexOf(selector), selector).toBeLessThan(utility);
    }
  });
});
