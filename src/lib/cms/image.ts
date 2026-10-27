// microCMS 画像 API（imgix の Rendering API）の URL を組み立てる（cms-integration「7. 画像」案 I）。
// auto=format は使えないため、形式は fm で明示する。SVG は変換できないのでパラメータを付けない。
import type { ImageAsset } from '../domain/work';

export type CmsImageOptions = {
  width?: number;
  height?: number;
  fit?: 'crop' | 'clip' | 'max' | 'fill' | 'scale';
  format?: 'webp' | 'jpg' | 'png' | 'avif';
  quality?: number;
};

function isSvg(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().endsWith('.svg');
  } catch {
    return url.split(/[?#]/)[0].toLowerCase().endsWith('.svg');
  }
}

export function cmsImageUrl(image: Pick<ImageAsset, 'url'>, opts: CmsImageOptions = {}): string {
  if (isSvg(image.url)) return image.url;

  const params = new URLSearchParams();
  if (opts.width !== undefined) params.set('w', String(opts.width));
  if (opts.height !== undefined) params.set('h', String(opts.height));
  if (opts.fit !== undefined) params.set('fit', opts.fit);
  if (opts.format !== undefined) params.set('fm', opts.format);
  if (opts.quality !== undefined) params.set('q', String(opts.quality));

  const query = params.toString();
  if (query === '') return image.url;
  return `${image.url}${image.url.includes('?') ? '&' : '?'}${query}`;
}
