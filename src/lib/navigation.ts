export type AriaCurrent = 'page' | 'true';

/** パスを末尾スラッシュありにそろえる（'/works' → '/works/'）。拡張子付き（'/404.html'）はそのまま */
function normalizePathname(pathname: string): string {
  if (pathname.endsWith('/')) return pathname;
  const lastSegment = pathname.slice(pathname.lastIndexOf('/') + 1);
  return lastSegment.includes('.') ? pathname : `${pathname}/`;
}

/**
 * リンク先と現在のパスから aria-current の値を決める（layout.md L-5）。
 * - href に '#' か '?' を含む（ページ内リンク・クエリ付き）→ undefined
 * - 正規化した pathname が href と一致 → 'page'
 * - href が '/' でなく、pathname が href で始まる（その区画の中にいる）→ 'true'
 * - それ以外 → undefined
 */
export function resolveAriaCurrent(href: string, pathname: string): AriaCurrent | undefined {
  if (href.includes('#') || href.includes('?')) return undefined;
  const current = normalizePathname(pathname);
  if (current === href) return 'page';
  if (href !== '/' && current.startsWith(href)) return 'true';
  return undefined;
}
