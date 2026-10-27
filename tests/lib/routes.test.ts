import { describe, expect, it } from 'vitest';
import { absoluteUrl, routes } from '../../src/lib/routes';

describe('routes', () => {
  it('builds site paths with a trailing slash', () => {
    expect(routes.home()).toBe('/');
    expect(routes.about()).toBe('/#about');
    expect(routes.works()).toBe('/works/');
    expect(routes.works({ category: 'web' })).toBe('/works/?category=web');
    expect(routes.work('abc-def')).toBe('/works/abc-def/');
    expect(routes.contact()).toBe('/contact/');
  });

  it('encodes the category query', () => {
    expect(routes.works({ category: 'a b' })).toBe('/works/?category=a%20b');
  });
});

describe('absoluteUrl', () => {
  it('resolves paths against the https site URL', () => {
    expect(absoluteUrl('/')).toBe('https://unotame.com/');
    expect(absoluteUrl('/works/')).toBe('https://unotame.com/works/');
    expect(absoluteUrl('/ogp.png')).toBe('https://unotame.com/ogp.png');
  });
});
