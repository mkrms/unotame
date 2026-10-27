// 実績詳細の Latest の選び方（works-detail「純粋関数」）。表示側の純粋関数で、cms の getLatestWorks は変えない。
import type { Work } from './domain/work';

/**
 * works は date 降順に並んでいる前提（getAllWorks の戻り値）。
 * excludeSlug を除いた先頭 limit 件を返す。元の配列は変更しない。
 */
export function selectLatestWorks(
  works: readonly Work[],
  opts: { limit: number; excludeSlug?: string },
): Work[] {
  return works.filter((work) => work.slug !== opts.excludeSlug).slice(0, Math.max(0, opts.limit));
}
