// slug の規則（url-design「slug の命名規則」/ D-009・D-010）。
// microCMS 側には入力制限を付けないため（C-1）、命名規則はここでの検証だけで守る。

/** 実績の slug: 英小文字・数字・ハイフン。先頭末尾・連続のハイフン不可。英字を 1 文字以上含む（数字だけの旧 ID と区別する） */
export const SLUG_PATTERN = /^(?=.*[a-z])[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const WORK_SLUG_MIN_LENGTH = 3;
export const WORK_SLUG_MAX_LENGTH = 60;
/** 実績の slug に使えない語 */
export const RESERVED_SLUGS: readonly string[] = ['page', 'category', 'feed', 'index', '404'];

/** カテゴリの slug（?category= の値）: 文字種は実績と同じ。数字だけも可 */
export const CATEGORY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const CATEGORY_SLUG_MIN_LENGTH = 1;
export const CATEGORY_SLUG_MAX_LENGTH = 40;

/** 実績の slug 1 つを検証し、違反の理由を返す（問題なければ空配列） */
export function workSlugProblems(slug: string): string[] {
  if (slug === '') return ['slug が空です'];
  const problems: string[] = [];
  if (!SLUG_PATTERN.test(slug)) {
    problems.push(
      'slug は英小文字・数字・ハイフンのみで、英字を 1 文字以上含み、先頭・末尾・連続のハイフンは使えません',
    );
  }
  if (slug.length < WORK_SLUG_MIN_LENGTH || slug.length > WORK_SLUG_MAX_LENGTH) {
    problems.push(
      `slug は ${WORK_SLUG_MIN_LENGTH}〜${WORK_SLUG_MAX_LENGTH} 文字にしてください（${slug.length} 文字）`,
    );
  }
  if (RESERVED_SLUGS.includes(slug)) {
    problems.push(`slug "${slug}" は予約語のため使えません`);
  }
  return problems;
}

/** カテゴリの slug 1 つを検証し、違反の理由を返す（問題なければ空配列） */
export function categorySlugProblems(slug: string): string[] {
  if (slug === '') return ['slug が空です'];
  const problems: string[] = [];
  if (!CATEGORY_SLUG_PATTERN.test(slug)) {
    problems.push('slug は英小文字・数字・ハイフンのみで、先頭・末尾・連続のハイフンは使えません');
  }
  if (slug.length < CATEGORY_SLUG_MIN_LENGTH || slug.length > CATEGORY_SLUG_MAX_LENGTH) {
    problems.push(
      `slug は ${CATEGORY_SLUG_MIN_LENGTH}〜${CATEGORY_SLUG_MAX_LENGTH} 文字にしてください（${slug.length} 文字）`,
    );
  }
  return problems;
}

export type SlugCheckTarget = {
  /** CMS のコンテンツ ID（あればメッセージに含める） */
  id?: string;
  slug: string;
  legacyWpId?: number;
};

const label = (work: SlugCheckTarget) =>
  work.id === undefined ? `slug="${work.slug}"` : `id=${work.id} slug="${work.slug}"`;

/**
 * 実績の slug（規則・長さ・予約語・重複）と legacyWpId の重複を検証し、違反をすべて返す。
 * 最初の 1 件で止まらない。
 */
export function collectWorkSlugViolations(works: readonly SlugCheckTarget[]): string[] {
  const violations: string[] = [];

  for (const work of works) {
    for (const problem of workSlugProblems(work.slug)) {
      violations.push(`works[${label(work)}]: ${problem}`);
    }
  }

  const bySlug = groupBy(works, (work) => work.slug);
  for (const [slug, group] of bySlug) {
    if (slug !== '' && group.length > 1) {
      violations.push(`slug "${slug}" が重複しています: ${group.map(label).join(', ')}`);
    }
  }

  const byLegacyId = groupBy(
    works.filter((work) => work.legacyWpId !== undefined),
    (work) => String(work.legacyWpId),
  );
  for (const [legacyWpId, group] of byLegacyId) {
    if (group.length > 1) {
      violations.push(`legacyWpId ${legacyWpId} が重複しています: ${group.map(label).join(', ')}`);
    }
  }

  return violations;
}

/** collectWorkSlugViolations の結果が 1 件以上あれば、全件を並べて例外を投げる（url-design） */
export function assertValidWorkSlugs(works: readonly SlugCheckTarget[]): void {
  const violations = collectWorkSlugViolations(works);
  if (violations.length > 0) {
    throw new Error(
      `slug の検証に失敗しました（${violations.length} 件）:\n- ${violations.join('\n- ')}`,
    );
  }
}

function groupBy<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const group = map.get(k);
    if (group) group.push(item);
    else map.set(k, [item]);
  }
  return map;
}
