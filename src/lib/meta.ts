import { site } from '../data/site';

/**
 * <title> を組み立てる。ページ名があれば「{ページ名} | {サイト名}」、無ければ（トップ）サイト名だけ。
 * 前後の空白は除き、空文字は「無し」として扱う。
 */
export function buildPageTitle(pageTitle?: string, siteName: string = site.name): string {
  const name = pageTitle?.trim();
  return name ? `${name} | ${siteName}` : siteName;
}
