// サイト共通の値（layout.md）。

export const site = {
  name: 'UNOTAME',
  /** 現行の og:description。ページが description を渡さないときの既定値 */
  description: '「あなた」のために。',
  locale: 'ja',
  ogLocale: 'ja_JP',
  /** public/ に置く。absoluteUrl() で https の絶対 URL にして出す */
  ogImagePath: '/ogp.png',
  /** 現行どおり年は入れない */
  copyright: '© UNOTAME',
} as const;
