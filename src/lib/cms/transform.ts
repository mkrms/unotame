// 生のレスポンス → ドメイン型（cms-integration）。純粋関数。
// 入力は validate.ts の検証を通ったものとする（必須項目・参照の存在はそこで保証する）。
import type { Category, Work } from '../domain/work';
import { createDescription, processBodyHtml } from './body';
import type { RawCategory, RawWork } from './raw-types';

/** description の上限（microCMS の入力制限と同じ。超えていたら警告） */
export const DESCRIPTION_MAX_LENGTH = 120;
/** 自動生成する description の長さ */
export const AUTO_DESCRIPTION_LENGTH = 100;

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** ISO 8601 の日時を JST の 'YYYY-MM-DD' にする。解釈できなければ undefined */
export function toJstDate(value: string): string | undefined {
  const time = Date.parse(value);
  if (Number.isNaN(time)) return undefined;
  return new Date(time + JST_OFFSET_MS).toISOString().slice(0, 10);
}

/** "old-a, old-b" → ['old-a', 'old-b']。未入力 → [] */
export function parseLegacyWpSlugs(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');
}

export function transformCategory(raw: RawCategory): Category {
  return {
    id: raw.id,
    slug: raw.slug ?? '',
    name: (raw.name ?? '').trim(),
    legacyWpSlugs: parseLegacyWpSlugs(raw.legacyWpSlugs),
  };
}

export const workLabel = (raw: Pick<RawWork, 'id' | 'slug'>) =>
  `works[id=${raw.id} slug="${raw.slug ?? ''}"]`;

export type TransformedWork = { work: Work; warnings: string[] };

export function transformWork(
  raw: RawWork,
  categoriesById: ReadonlyMap<string, Category>,
  opts: { isDraftPreview?: boolean } = {},
): TransformedWork {
  const warnings: string[] = [];
  const categoryId = raw.category?.id;
  const category = categoryId === undefined ? undefined : categoriesById.get(categoryId);
  const date = raw.date === undefined ? undefined : toJstDate(raw.date);
  if (!category || !raw.thumbnail || date === undefined) {
    // validate.ts を通っていれば起きない
    throw new Error(`${workLabel(raw)}: 検証前のデータを変換しようとしました`);
  }

  const body = processBodyHtml(raw.body ?? '');
  if (body.legacyAssetRefCount > 0) {
    warnings.push(
      `${workLabel(raw)}: 本文に "assets/ で始まる参照が ${body.legacyAssetRefCount} 件あります。` +
        '"/assets/ に置き換えましたが、画像を microCMS のメディアへ上げ直して URL を差し替えてください',
    );
  }

  const inputDescription = raw.description?.trim() ?? '';
  if (Array.from(inputDescription).length > DESCRIPTION_MAX_LENGTH) {
    warnings.push(
      `${workLabel(raw)}: description が ${DESCRIPTION_MAX_LENGTH} 文字を超えています（${Array.from(inputDescription).length} 文字）`,
    );
  }

  const title = (raw.title ?? '').trim();
  // 入力が無ければ本文から作る。本文が画像だけなどで文字が取れないときはタイトルを使う（description を空にしない）
  const description =
    inputDescription !== ''
      ? inputDescription
      : createDescription(body.html, AUTO_DESCRIPTION_LENGTH) || title;

  const work: Work = {
    id: raw.id,
    slug: raw.slug ?? '',
    title,
    category,
    thumbnail: {
      url: raw.thumbnail.url,
      width: raw.thumbnail.width ?? 0,
      height: raw.thumbnail.height ?? 0,
      alt: raw.thumbnail.alt ?? '',
    },
    bodyHtml: body.html,
    description,
    date,
    updatedAt: raw.updatedAt,
    isDraftPreview: opts.isDraftPreview ?? false,
  };
  if (raw.legacyWpId !== undefined && raw.legacyWpId !== null) {
    work.legacyWpId = raw.legacyWpId;
  }
  return { work, warnings };
}
