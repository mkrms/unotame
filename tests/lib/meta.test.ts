import { describe, expect, it } from 'vitest';
import { buildPageTitle } from '../../src/lib/meta';

describe('buildPageTitle', () => {
  it('returns the site name when no page title is given (top page)', () => {
    expect(buildPageTitle()).toBe('UNOTAME');
  });

  it('joins the page title and the site name with " | "', () => {
    expect(buildPageTitle('WORKS')).toBe('WORKS | UNOTAME');
    expect(buildPageTitle('記事・実績一覧')).toBe('記事・実績一覧 | UNOTAME');
  });

  it('treats empty or blank titles as no title', () => {
    expect(buildPageTitle('')).toBe('UNOTAME');
    expect(buildPageTitle('  ')).toBe('UNOTAME');
  });

  it('trims surrounding whitespace', () => {
    expect(buildPageTitle('  WORKS ')).toBe('WORKS | UNOTAME');
  });

  it('accepts another site name', () => {
    expect(buildPageTitle('WORKS', 'EXAMPLE')).toBe('WORKS | EXAMPLE');
  });
});
