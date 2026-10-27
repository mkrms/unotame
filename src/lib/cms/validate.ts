// ビルド時の検証（cms-integration「ビルド時の検証」）。違反は最初の 1 件で止めず、全部まとめて CmsValidationError にする。
// メッセージにはコンテンツ ID と slug を含める。
import { categorySlugProblems, collectWorkSlugViolations } from '../slug';
import { htmlToPlainText } from './body';
import type { RawCategory, RawWork } from './raw-types';
import { parseLegacyWpSlugs, toJstDate, workLabel } from './transform';

export class CmsValidationError extends Error {
  readonly violations: readonly string[];

  constructor(violations: readonly string[]) {
    super(
      `microCMS のデータに問題があります（${violations.length} 件）:\n- ${violations.join('\n- ')}`,
    );
    this.name = 'CmsValidationError';
    this.violations = violations;
  }
}

const categoryLabel = (raw: Pick<RawCategory, 'id' | 'slug'>) =>
  `categories[id=${raw.id} slug="${raw.slug ?? ''}"]`;

/** 文字も画像・埋め込みも無い本文を「空」とみなす（リッチエディタの空の <p></p> など） */
function isEmptyBody(body: string | undefined): boolean {
  if (body === undefined || body.trim() === '') return true;
  if (/<(img|iframe|video|audio|embed|object)\b/i.test(body)) return false;
  return htmlToPlainText(body) === '';
}

function validateCategories(categories: readonly RawCategory[]): string[] {
  const violations: string[] = [];
  /** slug と legacyWpSlugs をまとめた「旧・新の slug」→ 持ち主 */
  const owners = new Map<string, RawCategory[]>();
  const own = (slug: string, category: RawCategory) => {
    const list = owners.get(slug) ?? [];
    if (!list.includes(category)) list.push(category);
    owners.set(slug, list);
  };

  for (const category of categories) {
    const slug = category.slug ?? '';
    if (!category.name?.trim()) {
      violations.push(`${categoryLabel(category)}: name が空です`);
    }
    for (const problem of categorySlugProblems(slug)) {
      violations.push(`${categoryLabel(category)}: ${problem}`);
    }
    for (const legacySlug of parseLegacyWpSlugs(category.legacyWpSlugs)) {
      for (const problem of categorySlugProblems(legacySlug)) {
        violations.push(`${categoryLabel(category)}: legacyWpSlugs "${legacySlug}": ${problem}`);
      }
    }
  }

  // slug の重複（カテゴリ同士）
  const bySlug = new Map<string, RawCategory[]>();
  for (const category of categories) {
    const slug = category.slug ?? '';
    if (slug === '') continue;
    bySlug.set(slug, [...(bySlug.get(slug) ?? []), category]);
  }
  for (const [slug, group] of bySlug) {
    if (group.length > 1) {
      violations.push(
        `カテゴリの slug "${slug}" が重複しています: ${group.map(categoryLabel).join(', ')}`,
      );
    }
  }

  // legacyWpSlugs が、ほかのカテゴリの slug / legacyWpSlugs と重複しない
  for (const category of categories) {
    if (category.slug) own(category.slug, category);
    for (const legacySlug of parseLegacyWpSlugs(category.legacyWpSlugs)) own(legacySlug, category);
  }
  for (const category of categories) {
    for (const legacySlug of new Set(parseLegacyWpSlugs(category.legacyWpSlugs))) {
      const others = (owners.get(legacySlug) ?? []).filter((other) => other !== category);
      if (others.length > 0) {
        violations.push(
          `${categoryLabel(category)}: legacyWpSlugs "${legacySlug}" がほかのカテゴリと重複しています: ` +
            others.map(categoryLabel).join(', '),
        );
      }
    }
  }

  return violations;
}

function validateWorks(works: readonly RawWork[], categoryIds: ReadonlySet<string>): string[] {
  const violations: string[] = [];

  for (const work of works) {
    const label = workLabel(work);
    if (!work.title?.trim()) violations.push(`${label}: title が空です`);

    const thumbnail = work.thumbnail;
    if (!thumbnail || !thumbnail.url || !thumbnail.width || !thumbnail.height) {
      violations.push(`${label}: thumbnail（URL・幅・高さ）がありません`);
    }

    if (isEmptyBody(work.body)) violations.push(`${label}: body が空です`);

    if (!work.date || toJstDate(work.date) === undefined) {
      violations.push(`${label}: date が日付として解釈できません`);
    }

    const categoryId = work.category?.id;
    if (!categoryId) {
      violations.push(
        `${label}: category の参照がありません（未設定、または参照先が非公開・削除）`,
      );
    } else if (!categoryIds.has(categoryId)) {
      violations.push(
        `${label}: category の参照先（id=${categoryId}）が公開中のカテゴリ一覧にありません`,
      );
    }

    const legacyWpId = work.legacyWpId;
    if (legacyWpId !== undefined && legacyWpId !== null) {
      if (!Number.isInteger(legacyWpId) || legacyWpId <= 0) {
        violations.push(`${label}: legacyWpId は正の整数にしてください（${legacyWpId}）`);
      }
    }
  }

  violations.push(
    ...collectWorkSlugViolations(
      works.map((work) => ({
        id: work.id,
        slug: work.slug ?? '',
        legacyWpId: work.legacyWpId ?? undefined,
      })),
    ),
  );

  return violations;
}

/** 生のレスポンスを検証し、違反をすべて返す（問題なければ空配列） */
export function collectViolations(
  works: readonly RawWork[],
  categories: readonly RawCategory[],
): string[] {
  const categoryIds = new Set(categories.map((category) => category.id));
  return [...validateCategories(categories), ...validateWorks(works, categoryIds)];
}

/** 違反が 1 件以上あれば CmsValidationError を投げる */
export function assertValidContent(
  works: readonly RawWork[],
  categories: readonly RawCategory[],
): void {
  const violations = collectViolations(works, categories);
  if (violations.length > 0) throw new CmsValidationError(violations);
}
