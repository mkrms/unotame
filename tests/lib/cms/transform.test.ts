import { describe, expect, it } from 'vitest';
import { createDescription, htmlToPlainText, processBodyHtml } from '../../../src/lib/cms/body';
import {
  parseLegacyWpSlugs,
  toJstDate,
  transformCategory,
  transformWork,
} from '../../../src/lib/cms/transform';
import { rawCategory, rawWork } from './helpers';

const categoriesById = new Map([['cat-web', transformCategory(rawCategory())]]);

describe('transformCategory / parseLegacyWpSlugs', () => {
  it('splits legacyWpSlugs by comma and trims', () => {
    expect(transformCategory(rawCategory({ legacyWpSlugs: 'old-a, old-b' })).legacyWpSlugs).toEqual(
      ['old-a', 'old-b'],
    );
  });

  it('returns [] when legacyWpSlugs is empty', () => {
    expect(transformCategory(rawCategory()).legacyWpSlugs).toEqual([]);
    expect(parseLegacyWpSlugs('')).toEqual([]);
    expect(parseLegacyWpSlugs(null)).toEqual([]);
    expect(parseLegacyWpSlugs(' , ')).toEqual([]);
  });
});

describe('toJstDate', () => {
  it('converts UTC to the JST date', () => {
    expect(toJstDate('2023-03-31T15:00:00.000Z')).toBe('2023-04-01');
    expect(toJstDate('2023-03-31T14:59:59.000Z')).toBe('2023-03-31');
  });

  it('returns undefined for an unparsable value', () => {
    expect(toJstDate('not-a-date')).toBeUndefined();
  });
});

describe('transformWork', () => {
  it('fills every field of Work', () => {
    const { work, warnings } = transformWork(
      rawWork({ legacyWpId: 123, description: '説明文' }),
      categoriesById,
    );
    expect(work).toEqual({
      id: 'work01',
      slug: 'sample-work',
      legacyWpId: 123,
      title: 'サンプル実績',
      category: { id: 'cat-web', slug: 'web', name: 'Web制作', legacyWpSlugs: [] },
      thumbnail: {
        url: 'https://images.microcms-assets.io/assets/dummy/thumb.png',
        width: 1200,
        height: 800,
        alt: '',
      },
      bodyHtml: '<p>本文です。</p>',
      description: '説明文',
      date: '2024-02-01',
      updatedAt: '2024-02-03T04:05:06.000Z',
      isDraftPreview: false,
    });
    expect(warnings).toEqual([]);
  });

  it('leaves legacyWpId undefined when not entered', () => {
    expect(transformWork(rawWork(), categoriesById).work.legacyWpId).toBeUndefined();
    expect(
      transformWork(rawWork({ legacyWpId: null }), categoriesById).work.legacyWpId,
    ).toBeUndefined();
  });

  it('uses the thumbnail alt when present, otherwise ""', () => {
    const withAlt = rawWork({
      thumbnail: { url: 'https://example.com/a.png', width: 1, height: 1, alt: '代替' },
    });
    expect(transformWork(withAlt, categoriesById).work.thumbnail.alt).toBe('代替');
    expect(transformWork(rawWork(), categoriesById).work.thumbnail.alt).toBe('');
  });

  it('generates the description from the body when empty', () => {
    const long = 'あ'.repeat(150);
    const { work } = transformWork(
      rawWork({ body: `<h2>見出し</h2>\n<p>${long}</p>`, description: '  ' }),
      categoriesById,
    );
    expect(work.description).toBe(`見出し ${'あ'.repeat(96)}…`);
    expect(Array.from(work.description)).toHaveLength(101);
  });

  it('warns once with the content ID when the body has "assets/', () => {
    const { work, warnings } = transformWork(
      rawWork({ body: '<p><img src="assets/img/a.png"><img src="assets/img/b.png"></p>' }),
      categoriesById,
    );
    expect(work.bodyHtml).toContain('src="/assets/img/a.png"');
    expect(work.bodyHtml).not.toContain('"assets/');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('id=work01');
    expect(warnings[0]).toContain('2 件');
  });

  it('warns when the description is longer than 120 characters', () => {
    const { warnings } = transformWork(rawWork({ description: 'い'.repeat(121) }), categoriesById);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('120');
  });

  it('marks draft previews', () => {
    expect(
      transformWork(rawWork(), categoriesById, { isDraftPreview: true }).work.isDraftPreview,
    ).toBe(true);
  });
});

describe('processBodyHtml', () => {
  it('replaces "assets/ with "/assets/ and counts it', () => {
    const result = processBodyHtml('<p><img src="assets/img/a.png" alt=""></p>');
    expect(result.html).toContain('src="/assets/img/a.png"');
    expect(result.legacyAssetRefCount).toBe(1);
  });

  it('does not touch other paths', () => {
    const html = '<a href="https://example.com/assets/x">x</a>';
    expect(processBodyHtml(html)).toEqual({ html, legacyAssetRefCount: 0 });
  });

  it('adds loading="lazy" and decoding="async" to <img>', () => {
    expect(processBodyHtml('<img src="https://x/a.png" alt="">').html).toBe(
      '<img src="https://x/a.png" alt="" loading="lazy" decoding="async">',
    );
    expect(processBodyHtml('<img src="https://x/a.png" alt="" />').html).toBe(
      '<img src="https://x/a.png" alt="" loading="lazy" decoding="async" />',
    );
  });

  it('keeps an existing loading / decoding attribute', () => {
    expect(processBodyHtml('<img src="a.png" loading="eager">').html).toBe(
      '<img src="a.png" loading="eager" decoding="async">',
    );
    expect(processBodyHtml('<IMG SRC="a.png" DECODING="sync">').html).toBe(
      '<IMG SRC="a.png" DECODING="sync" loading="lazy">',
    );
  });

  it('does not mistake data-loading for loading', () => {
    expect(processBodyHtml('<img src="a.png" data-loading="x">').html).toBe(
      '<img src="a.png" data-loading="x" loading="lazy" decoding="async">',
    );
  });
});

describe('htmlToPlainText / createDescription', () => {
  it('strips tags, decodes entities and collapses whitespace', () => {
    expect(htmlToPlainText('<p>A&amp;B&nbsp; <strong>強調</strong>です</p>\n<p>次</p>')).toBe(
      'A&B 強調です 次',
    );
  });

  it('does not add … when the text is short', () => {
    expect(createDescription('<p>短い本文</p>')).toBe('短い本文');
  });

  it('cuts at 100 characters and adds …', () => {
    expect(createDescription(`<p>${'x'.repeat(120)}</p>`)).toBe(`${'x'.repeat(100)}…`);
  });
});

describe('description fallback', () => {
  it('uses the title when the body has no text (image only)', () => {
    const { work } = transformWork(
      rawWork({ title: ' 画像だけの実績 ', body: '<p><img src="https://x/a.png" alt=""></p>' }),
      categoriesById,
    );
    expect(work.description).toBe('画像だけの実績');
  });

  it('uses the title when the body is empty', () => {
    expect(transformWork(rawWork({ body: '' }), categoriesById).work.description).toBe(
      'サンプル実績',
    );
    expect(transformWork(rawWork({ body: undefined }), categoriesById).work.bodyHtml).toBe('');
  });

  it('prefers the entered description over the title', () => {
    const { work } = transformWork(
      rawWork({ body: '<p><img src="https://x/a.png" alt=""></p>', description: '入力値' }),
      categoriesById,
    );
    expect(work.description).toBe('入力値');
  });
});

describe('processBodyHtml: scope of the "assets/ replacement', () => {
  it.each([
    [
      'src',
      '<img src="assets/a.png">',
      '<img src="/assets/a.png" loading="lazy" decoding="async">',
    ],
    ['href', '<a href="assets/a.pdf">a</a>', '<a href="/assets/a.pdf">a</a>'],
    ['srcset', '<source srcset="assets/a.webp">', '<source srcset="/assets/a.webp">'],
    ['poster', '<video poster="assets/a.png"></video>', '<video poster="/assets/a.png"></video>'],
    ['upper-case attribute', '<a HREF="assets/a.pdf">a</a>', '<a HREF="/assets/a.pdf">a</a>'],
  ])('replaces it in %s', (_name, html, expected) => {
    expect(processBodyHtml(html)).toEqual({ html: expected, legacyAssetRefCount: 1 });
  });

  it('does not touch "assets/ in text or code', () => {
    const html =
      '<pre><code>const path = "assets/img/a.png";</code></pre><p>"assets/ と書く</p>' +
      '<a title="assets/x" data-src="assets/y">x</a>';
    expect(processBodyHtml(html)).toEqual({ html, legacyAssetRefCount: 0 });
  });
});

describe('processBodyHtml: <img> detection', () => {
  it('handles > inside a quoted attribute value', () => {
    expect(processBodyHtml('<img alt="a > b" src="x.png">').html).toBe(
      '<img alt="a > b" src="x.png" loading="lazy" decoding="async">',
    );
    expect(processBodyHtml("<img alt='a>b' src='x.png' />").html).toBe(
      '<img alt=\'a>b\' src=\'x.png\' loading="lazy" decoding="async" />',
    );
  });

  it('does not mistake <imgx> or text for an image', () => {
    const html = '<imgx src="a.png"><p>&lt;img&gt;</p>';
    expect(processBodyHtml(html).html).toBe(html);
  });
});

describe('htmlToPlainText: numeric character references', () => {
  it('decodes valid references', () => {
    expect(htmlToPlainText('&#65;&#x42;&#X1F600;')).toBe('AB\u{1F600}');
  });

  it('keeps out-of-range references as they are instead of throwing', () => {
    expect(htmlToPlainText('a&#x110000;b')).toBe('a&#x110000;b');
    expect(htmlToPlainText('a&#99999999999999999999;b')).toBe('a&#99999999999999999999;b');
    expect(createDescription('<p>&#1114112;</p>')).toBe('&#1114112;');
  });

  it('keeps unknown named references', () => {
    expect(htmlToPlainText('&unknown;')).toBe('&unknown;');
  });
});
