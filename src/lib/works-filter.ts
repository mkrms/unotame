// 実績一覧のカテゴリ絞り込みの判断（works-list「純粋関数」）。DOM・window に触れない。
// DOM への反映は src/components/works/works-filter-controller.ts が行う。

/** null = 「全て」。それ以外はカテゴリの slug（'all' という文字列では表さない） */
export type WorksFilter = string | null;

export const CATEGORY_QUERY_KEY = 'category';

/**
 * 絞り込みの対象範囲（ボタン群と一覧を含む要素）に付ける属性。
 * WorksFilter.astro の <script> がこの属性を持つ要素を探して起動する（ページ・dist 検査と共通）。
 */
export const WORKS_FILTER_ROOT_ATTR = 'data-works-filter-root';

/** 相対 URL を URL として扱うための仮の基準（結果には出さない） */
const URL_BASE = 'http://localhost';

/** URL の検索文字列から初期の絞り込みを決める。知らない slug・空・未指定は null（全て） */
export function resolveFilterFromSearch(
  search: string,
  knownSlugs: readonly string[],
): WorksFilter {
  // 同じキーが複数あれば最初の値（URLSearchParams.get）。比較は完全一致
  const value = new URLSearchParams(search).get(CATEGORY_QUERY_KEY);
  if (!value) return null;
  return knownSlugs.includes(value) ? value : null;
}

/** その実績を表示するか */
export function isWorkVisible(workCategorySlug: string, filter: WorksFilter): boolean {
  return filter === null || workCategorySlug === filter;
}

/**
 * 現在の URL（path + search + hash）から、絞り込みを反映した URL を作る。
 * filter が null なら category を取り除き、ほかのクエリと hash は保つ。
 */
export function buildFilterUrl(currentUrl: string, filter: WorksFilter): string {
  const url = new URL(currentUrl, URL_BASE);
  if (filter === null) url.searchParams.delete(CATEGORY_QUERY_KEY);
  else url.searchParams.set(CATEGORY_QUERY_KEY, filter);
  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ''}${url.hash}`;
}

/** 結果件数の読み上げ文（role="status" に入れる） */
export function describeFilterResult(
  filter: WorksFilter,
  categoryName: string | undefined,
  visibleCount: number,
): string {
  if (filter === null) return `すべての実績 ${visibleCount} 件を表示しています`;
  return `${categoryName ?? filter} の実績 ${visibleCount} 件を表示しています`;
}
