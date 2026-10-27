// dist/htaccess.txt → dist/.htaccess の改名（src/integrations/htaccess.ts）。一時ディレクトリで確かめる。
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import htaccess, {
  finalizeHtaccess,
  HTACCESS_BUILD_OUTPUT,
  HTACCESS_FILE,
} from '../../src/integrations/htaccess';
import endpointSource from '../../src/pages/htaccess.txt.ts?raw';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'unotame-htaccess-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('finalizeHtaccess', () => {
  it('renames htaccess.txt to .htaccess', () => {
    writeFileSync(join(dir, HTACCESS_BUILD_OUTPUT), 'ErrorDocument 404 /404.html\n');
    finalizeHtaccess(dir);
    expect(existsSync(join(dir, HTACCESS_BUILD_OUTPUT))).toBe(false);
    expect(readFileSync(join(dir, HTACCESS_FILE), 'utf8')).toBe('ErrorDocument 404 /404.html\n');
  });

  it('fails when htaccess.txt was not output', () => {
    expect(() => finalizeHtaccess(dir)).toThrow(HTACCESS_BUILD_OUTPUT);
  });

  it('fails when .htaccess already exists (public/.htaccess)', () => {
    writeFileSync(join(dir, HTACCESS_BUILD_OUTPUT), 'generated\n');
    writeFileSync(join(dir, HTACCESS_FILE), 'manual\n');
    expect(() => finalizeHtaccess(dir)).toThrow('public/.htaccess');
    expect(readFileSync(join(dir, HTACCESS_FILE), 'utf8')).toBe('manual\n');
  });
});

describe('htaccess integration', () => {
  it('hooks astro:build:done only', () => {
    expect(Object.keys(htaccess().hooks)).toEqual(['astro:build:done']);
  });

  it('renames htaccess.txt to .htaccess in the dir given to astro:build:done', async () => {
    writeFileSync(join(dir, HTACCESS_BUILD_OUTPUT), 'ErrorDocument 404 /404.html\n');
    const hook = htaccess().hooks['astro:build:done'];
    expect(hook).toBeTypeOf('function');
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    // Astro は dir を末尾スラッシュ付きの file: URL で渡す
    await hook?.({ dir: pathToFileURL(`${dir}/`), logger } as unknown as Parameters<
      NonNullable<typeof hook>
    >[0]);
    expect(existsSync(join(dir, HTACCESS_BUILD_OUTPUT))).toBe(false);
    expect(readFileSync(join(dir, HTACCESS_FILE), 'utf8')).toBe('ErrorDocument 404 /404.html\n');
    expect(logger.info).toHaveBeenCalledOnce();
  });

  it('matches the endpoint file name', () => {
    // src/pages/htaccess.txt.ts → dist/htaccess.txt
    expect(HTACCESS_BUILD_OUTPUT).toBe('htaccess.txt');
    expect(endpointSource).toContain('export const GET');
  });
});
