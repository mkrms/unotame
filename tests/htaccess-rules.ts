// .htaccess の検査（tests/lib/redirects.test.ts・tests/dist/htaccess.test.ts）で共通に使うヘルパー。
// Apache（PCRE）の正規表現は、ここで使う範囲（(?:…)・(?!…)・[^/]・+・*・*?・?・^$）では JS の RegExp と同じ意味に
// なるので、出力したパターンを JS の RegExp として評価して、mod_rewrite のルール照合を模擬する。

/** コメント・空行を除いた行（前後の空白は除く） */
export const effectiveLines = (text: string): string[] =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));

export type ParsedRule = { pattern: string; target: string; flags: string };

/** "RewriteRule {pattern} {target} [flags]" を分解する */
export function parseRule(line: string): ParsedRule {
  const match = /^RewriteRule (\S+) (\S+) \[([^\]]+)\]$/.exec(line);
  if (!match) throw new Error(`RewriteRule ではありません: ${line}`);
  return { pattern: match[1], target: match[2], flags: match[3] };
}

export const rulesOf = (text: string): ParsedRule[] =>
  effectiveLines(text)
    .filter((line) => line.startsWith('RewriteRule '))
    .map(parseRule);

/**
 * https://unotame.com へのクエリなしのリクエストで、最初に一致する（条件なしの）RewriteRule の転送先を返す。
 * mod_rewrite と同じく、.htaccess（ドキュメントルート）では先頭の / を除いたパスに照合する。
 * 条件付きのルール（① 正規化・?p=）は、正規の https / クエリなしのリクエストでは当たらないので対象外。
 * 一致しなければ undefined（リダイレクトせず、ファイルが無ければ ErrorDocument の 404）。
 */
export function firstMatch(text: string, path: string): { target: string } | undefined {
  const lines = effectiveLines(text);
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('RewriteRule ')) continue;
    if (lines[i - 1]?.startsWith('RewriteCond ')) continue;
    const rule = parseRule(lines[i]);
    const match = new RegExp(rule.pattern).exec(path.replace(/^\//, ''));
    if (match) return { target: rule.target.replace(/\$(\d)/g, (_, n: string) => match[+n]) };
  }
  return undefined;
}
