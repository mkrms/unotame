// URL はここでのみ組み立てる（url-design）。末尾スラッシュあり（trailingSlash: 'always'）。
// ほかの機能が必要なルートはこのオブジェクトに足す。

export const routes = {
  home: () => '/',
  /** トップの About セクション（id="about"）へのページ内リンク（url-design U-10） */
  about: () => '/#about',
  works: (opts?: { category?: string }) =>
    opts?.category ? `/works/?category=${encodeURIComponent(opts.category)}` : '/works/',
  work: (slug: string) => `/works/${slug}/`,
  contact: () => '/contact/',
} as const;

/** サイト内のパスを、astro.config の site（https://unotame.com）を基準にした絶対 URL にする */
export function absoluteUrl(path: string): string {
  return new URL(path, import.meta.env.SITE).href;
}
