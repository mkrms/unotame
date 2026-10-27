import { describe, expect, it } from 'vitest';
import { resolveAriaCurrent } from '../../src/lib/navigation';

describe('resolveAriaCurrent', () => {
  it.each([
    ['/works/', '/works/', 'page'],
    ['/works/', '/works', 'page'],
    ['/works/', '/works/foo/', 'true'],
    ['/contact/', '/contact/', 'page'],
    ['/#about', '/', undefined],
    ['/works/', '/', undefined],
    ['/works/', '/worksx/', undefined],
    ['/works/', '/404', undefined],
    ['/contact/', '/404.html', undefined],
  ] as const)('(%s, %s) -> %s', (href, pathname, expected) => {
    expect(resolveAriaCurrent(href, pathname)).toBe(expected);
  });

  it('never marks the home link as "true" for nested pages', () => {
    expect(resolveAriaCurrent('/', '/works/')).toBeUndefined();
    expect(resolveAriaCurrent('/', '/')).toBe('page');
  });

  it('ignores links with a query string', () => {
    expect(resolveAriaCurrent('/works/?category=web', '/works/')).toBeUndefined();
  });
});
