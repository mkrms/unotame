// 旧 WordPress の URL → 新 URL の 301 リダイレクト（url-design「旧 URL → 新 URL のリダイレクト（301）」）。
// .htaccess の中身を文字列で組み立てる純粋関数だけを置く（ファイルの書き出しは src/pages/htaccess.txt.ts と
// src/integrations/htaccess.ts）。リダイレクト先は routes.* のパスを absoluteUrl() で完全な URL にする
// （http / www で来たリクエストも、1 回の 301 で https://unotame.com の新 URL に届くようにする）。
import { absoluteUrl, routes } from './routes';
import { CATEGORY_SLUG_PATTERN, SLUG_PATTERN } from './slug';

export type LegacyWorkRedirect = { legacyWpId: number; slug: string };
export type LegacyCategoryRedirect = { fromSlug: string; toSlug: string };

/** テンプレート（src/htaccess/htaccess.template）の、生成ルールを差し込む位置 */
export const GENERATED_RULES_PLACEHOLDER = '{{GENERATED_REDIRECT_RULES}}';
/** テンプレートの固定ルールの転送先に使う、サイトのオリジン（astro.config の site）のプレースホルダー */
export const SITE_ORIGIN_PLACEHOLDER = '{{SITE_ORIGIN}}';

/** astro.config の site のオリジン（例 https://unotame.com。末尾スラッシュなし） */
export function siteOrigin(): string {
  return new URL(absoluteUrl('/')).origin;
}

/** 期待件数を下回ったときのエラー（ビルドを止める） */
export class RedirectCountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RedirectCountError';
  }
}

/** 旧 ID を持つ実績から、詳細ページのリダイレクト対応を作る（旧 ID の昇順。ビルド結果を決定的にする） */
export function legacyWorkRedirects(
  works: readonly { slug: string; legacyWpId?: number }[],
): LegacyWorkRedirect[] {
  return works
    .filter((work): work is { slug: string; legacyWpId: number } => work.legacyWpId !== undefined)
    .map(({ legacyWpId, slug }) => ({ legacyWpId, slug }))
    .sort((a, b) => a.legacyWpId - b.legacyWpId);
}

/** カテゴリの旧スラッグ（legacyWpSlugs）から、カテゴリアーカイブのリダイレクト対応を作る（カテゴリ・入力の並び順） */
export function legacyCategoryRedirects(
  categories: readonly { slug: string; legacyWpSlugs: readonly string[] }[],
): LegacyCategoryRedirect[] {
  return categories.flatMap((category) =>
    category.legacyWpSlugs.map((fromSlug) => ({ fromSlug, toSlug: category.slug })),
  );
}

/**
 * 値は CMS 取得時の検証（src/lib/cms/validate.ts）を通っている前提だが、.htaccess に任意の文字列が入らないよう
 * ここでも形式を確かめる（正規表現の特殊文字・改行・空白を含む値を出力しない）。
 */
function assertSafeInput(input: {
  works: readonly LegacyWorkRedirect[];
  categories: readonly LegacyCategoryRedirect[];
}): void {
  const problems: string[] = [];
  for (const { legacyWpId, slug } of input.works) {
    if (!Number.isSafeInteger(legacyWpId) || legacyWpId <= 0) {
      problems.push(`legacyWpId ${String(legacyWpId)} が正の整数ではありません（slug="${slug}"）`);
    }
    if (!SLUG_PATTERN.test(slug)) problems.push(`実績の slug "${slug}" が規則に合いません`);
  }
  for (const { fromSlug, toSlug } of input.categories) {
    if (!CATEGORY_SLUG_PATTERN.test(fromSlug)) {
      problems.push(`カテゴリの旧スラッグ "${fromSlug}" が規則に合いません`);
    }
    if (!CATEGORY_SLUG_PATTERN.test(toSlug)) {
      problems.push(`カテゴリの slug "${toSlug}" が規則に合いません`);
    }
  }
  if (problems.length > 0) {
    throw new Error(`リダイレクトを生成できません:\n- ${problems.join('\n- ')}`);
  }
}

/**
 * 旧詳細 URL `/{category…}/{ID}`・`/{category…}/{ID}/` に一致させるパターン（カテゴリ部分は 1 階層以上・任意）。
 * WP のほかの URL を実績と取り違えないよう、次は除外する:
 * - 先頭が 4 桁の年（日付アーカイブ `/2020/12/`）、または `wp-`（`/wp-json/…`・`/wp-content/…` など）
 * - ID の直前の要素が `page`（ページ送り `/page/2/`・`/works/page/2/`・`/category/web/page/2/`）
 * WP の分割ページ（`/web/123/2/`）は扱わない。
 */
export function legacyWorkPathPattern(legacyWpId: number): string {
  return `^(?![0-9]{4}/|wp-)(?:[^/]+/)*(?!page/)[^/]+/${legacyWpId}/?$`;
}

/** 旧カテゴリアーカイブ `/category/{旧slug}/`（`/category/{親}/{子}/`・ページ送り `…/page/{n}/` を含む）に一致させるパターン */
export function legacyCategoryPathPattern(fromSlug: string): string {
  return `^category/(?:[^/]+/)*${fromSlug}(?:/page/[0-9]+)?/?$`;
}

/**
 * .htaccess の「② 生成ルール」の部分を返す（url-design `buildRedirectRules`）。
 * - 実績ごとに 2 本: `/{category…}/{ID}(/)` と `/?p={ID}`（クエリは破棄）→ `https://unotame.com/works/{slug}/`
 * - カテゴリの旧スラッグごとに 1 本: `/category/(…/){旧slug}(/page/{n})/` → `https://unotame.com/works/?category={slug}`
 *   （テンプレートの汎用カテゴリルールより前に出力される）
 */
export function buildRedirectRules(input: {
  works: readonly LegacyWorkRedirect[];
  categories: readonly LegacyCategoryRedirect[];
}): string {
  assertSafeInput(input);
  const lines: string[] = [];

  lines.push('# --- ② 生成: 旧 WP 実績詳細（legacyWpId → slug） ---');
  if (input.works.length === 0) lines.push('# （旧 ID を持つ実績はありません）');
  for (const { legacyWpId, slug } of input.works) {
    const target = absoluteUrl(routes.work(slug));
    lines.push(
      `# legacyWpId ${legacyWpId}`,
      `RewriteRule ${legacyWorkPathPattern(legacyWpId)} ${target} [R=301,L]`,
      `RewriteCond %{QUERY_STRING} (?:^|&)p=${legacyWpId}(?:&|$)`,
      `RewriteRule ^$ ${target}? [R=301,L]`,
    );
  }

  lines.push('', '# --- ② 生成: カテゴリ（旧スラッグが変わったものだけ） ---');
  if (input.categories.length === 0) lines.push('# （旧スラッグを持つカテゴリはありません）');
  for (const { fromSlug, toSlug } of input.categories) {
    const target = absoluteUrl(routes.works({ category: toSlug }));
    lines.push(`RewriteRule ${legacyCategoryPathPattern(fromSlug)} ${target} [R=301,L]`);
  }

  return lines.join('\n');
}

/**
 * テンプレートの生成ルールのプレースホルダー（ちょうど 1 か所）を生成ルールで、オリジンのプレースホルダーを
 * サイトのオリジンで置き換える。改行は LF にそろえ、末尾を改行 1 つにする
 */
export function renderHtaccess(
  template: string,
  generatedRules: string,
  origin: string = siteOrigin(),
): string {
  const normalized = template.replace(/\r\n?/g, '\n');
  const count = normalized.split(GENERATED_RULES_PLACEHOLDER).length - 1;
  if (count !== 1) {
    throw new Error(
      `.htaccess のテンプレートに ${GENERATED_RULES_PLACEHOLDER} がちょうど 1 か所必要です（${count} か所）`,
    );
  }
  // 生成ルールにはオリジンのプレースホルダーが入らないので、先にテンプレート側だけを置き換える
  const withOrigin = normalized.replaceAll(SITE_ORIGIN_PLACEHOLDER, () => origin);
  return `${withOrigin.replace(GENERATED_RULES_PLACEHOLDER, () => generatedRules).trimEnd()}\n`;
}

const defaultWarn = (message: string) => console.warn(`[redirects] ${message}`);

/**
 * 生成する詳細リダイレクトの件数が期待件数（旧 ID の件数）を下回ったら止める（url-design の安全策）。
 * 編集者が legacyWpId を誤って消した・API の取得漏れなどで、旧 URL が黙って 404 になるのを防ぐ。
 * 上回ったときは警告だけ出す（期待件数を上げないままだと、のちに ID が消えても止まらないため）。
 */
export function assertLegacyRedirectCount(
  actual: number,
  expected: number,
  warn: (message: string) => void = defaultWarn,
): void {
  if (actual < expected) {
    throw new RedirectCountError(
      `旧 URL の詳細リダイレクトが ${actual} 件で、期待件数 ${expected} 件を下回っています。` +
        'CMS の実績の legacyWpId が消えていないか確認してください（期待件数は src/data/redirects.ts）',
    );
  }
  if (actual > expected) {
    warn(
      `旧 URL の詳細リダイレクトが ${actual} 件で、期待件数 ${expected} 件より多くなっています。` +
        `期待件数を ${actual} に上げてください（src/data/redirects.ts の EXPECTED_LEGACY_WORK_REDIRECTS）`,
    );
  }
}

/** CMS から取り出した実績・カテゴリから dist/.htaccess の全文を作る */
export function buildHtaccess(input: {
  template: string;
  works: readonly { slug: string; legacyWpId?: number }[];
  categories: readonly { slug: string; legacyWpSlugs: readonly string[] }[];
  expectedLegacyWorkCount: number;
  /** 警告（ビルドは続行）の出力先。既定は console.warn */
  warn?: (message: string) => void;
}): string {
  const works = legacyWorkRedirects(input.works);
  assertLegacyRedirectCount(works.length, input.expectedLegacyWorkCount, input.warn);
  const rules = buildRedirectRules({
    works,
    categories: legacyCategoryRedirects(input.categories),
  });
  return renderHtaccess(input.template, rules);
}
