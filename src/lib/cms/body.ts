// 本文 HTML の最小限の加工と description の自動生成（cms-integration「7. 画像」「4. サムネイルと OGP 用の項目」）。
// 純粋関数。P1 はサニタイズしない（works-detail D-4）。

/**
 * 本文中のテーマ同梱画像への相対参照（現行 WP の replaceAssetsPath と同じ対象）。
 * 本文中のコードの文字列などに当たらないよう、URL を取る属性の値の先頭だけを対象にする。
 */
const LEGACY_ASSETS_REF = /(\s(?:src|href|srcset|poster)=)"assets\//gi;
/** <img> タグ。属性値の中の > で切れないよう、引用符で囲まれた部分はまとめて読む */
const IMG_TAG = /<img\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;

export type ProcessedBody = {
  html: string;
  /** "assets/ を "/assets/ に置き換えた件数（1 以上なら警告を出す） */
  legacyAssetRefCount: number;
};

function hasAttribute(tag: string, name: string): boolean {
  return new RegExp(String.raw`\s${name}(?:\s*=|[\s/>])`, 'i').test(tag);
}

/** <img> に loading="lazy" と decoding="async" を足す（既にある属性は変えない） */
function addImgAttributes(tag: string): string {
  const additions = [
    hasAttribute(tag, 'loading') ? '' : ' loading="lazy"',
    hasAttribute(tag, 'decoding') ? '' : ' decoding="async"',
  ].join('');
  if (additions === '') return tag;
  // 末尾の "/>" か ">" の直前に差し込む
  return tag.replace(/\s*(\/?)>$/, (_match, slash: string) => `${additions}${slash ? ' /' : ''}>`);
}

export function processBodyHtml(html: string): ProcessedBody {
  let legacyAssetRefCount = 0;
  const replaced = html.replace(LEGACY_ASSETS_REF, (_match, attribute: string) => {
    legacyAssetRefCount += 1;
    return `${attribute}"/assets/`;
  });
  return { html: replaced.replace(IMG_TAG, addImgAttributes), legacyAssetRefCount };
}

/** ブロック要素の境目は空白にし、インライン要素はそのまま詰める（日本語の途中に空白を入れない） */
const BLOCK_BOUNDARY =
  /<\/?(?:p|div|br|h[1-6]|li|ul|ol|blockquote|pre|figure|figcaption|table|tr|td|th|hr)\b[^>]*>/gi;

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/** Unicode のコードポイントの上限。これを超える数値文字参照は変換しない */
const MAX_CODE_POINT = 0x10ffff;

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code =
        entity[1].toLowerCase() === 'x'
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      // 範囲外・不正な値で String.fromCodePoint は RangeError を投げるので、変換せずそのまま残す
      return Number.isInteger(code) && code >= 0 && code <= MAX_CODE_POINT
        ? String.fromCodePoint(code)
        : match;
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** 本文 HTML から文字だけを取り出し、空白を詰める */
export function htmlToPlainText(html: string): string {
  const text = html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(BLOCK_BOUNDARY, ' ')
    .replace(/<[^>]*>/g, '');
  return decodeEntities(text).replace(/\s+/g, ' ').trim();
}

/** description の自動生成: 本文の先頭 maxLength 文字。切り詰めたときだけ末尾に … を付ける */
export function createDescription(html: string, maxLength = 100): string {
  const text = htmlToPlainText(html);
  const chars = Array.from(text); // サロゲートペアを分断しない
  return chars.length > maxLength ? `${chars.slice(0, maxLength).join('').trimEnd()}…` : text;
}
