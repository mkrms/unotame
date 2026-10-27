// 実績一覧の絞り込みの DOM 側（works-list「DOM を扱う部分」）。jQuery を使わない素の TS。
// 判断（表示するか・URL・読み上げ文）は src/lib/works-filter.ts の純粋関数に任せ、ここは DOM への反映だけを行う。
import {
  buildFilterUrl,
  CATEGORY_QUERY_KEY,
  describeFilterResult,
  isWorkVisible,
  resolveFilterFromSearch,
  type WorksFilter,
} from '../../lib/works-filter';

export type FilterControllerDeps = {
  location: Pick<Location, 'pathname' | 'search' | 'hash'>;
  history: Pick<History, 'replaceState' | 'state'>;
  /** matchMedia('(prefers-reduced-motion: reduce)').matches */
  prefersReducedMotion: () => boolean;
};

/** 表示されたカードのフェード（現行 600ms → 300ms。works-list L-9） */
const FADE_DURATION_MS = 300;

/** DOM の data-filter="" を「全て」（null）として読む */
const toFilter = (value: string | undefined): WorksFilter => (value ? value : null);

/** root（絞り込み UI と一覧を含む要素）に挙動を付ける。テストでは deps を差し替える */
export function initWorksFilter(root: HTMLElement, deps: FilterControllerDeps): void {
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('button[data-filter]')];
  const items = [...root.querySelectorAll<HTMLElement>('[data-category]')];
  const status = root.querySelector<HTMLElement>('[data-works-filter-status]');
  if (buttons.length === 0) return;

  const knownSlugs = buttons
    .map((button) => button.dataset.filter)
    .filter((slug): slug is string => !!slug);

  const currentUrl = () => `${deps.location.pathname}${deps.location.search}${deps.location.hash}`;

  /** ボタンの選択状態と各カードの hidden を filter に合わせる。表示されたカードを返す */
  function apply(filter: WorksFilter): HTMLElement[] {
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(toFilter(button.dataset.filter) === filter));
    }
    const shown: HTMLElement[] = [];
    for (const item of items) {
      const visible = isWorkVisible(item.dataset.category ?? '', filter);
      item.hidden = !visible;
      if (visible) shown.push(item);
    }
    return shown;
  }

  // 1. 初期化: URL の ?category= から決める。アニメーション・読み上げはしない
  let current = resolveFilterFromSearch(deps.location.search, knownSlugs);
  apply(current);
  if (current === null && new URLSearchParams(deps.location.search).has(CATEGORY_QUERY_KEY)) {
    // 知らない slug・空の ?category= は URL から取り除き、表示と一致させる（works-list L-3）
    deps.history.replaceState(deps.history.state, '', buildFilterUrl(currentUrl(), null));
  }

  // 2. ボタン操作（<button> なので Enter / Space でも click が届く）
  for (const button of buttons) {
    button.addEventListener('click', () => {
      const filter = toFilter(button.dataset.filter);
      if (filter === current) return; // 選択中のボタンでは何も変えない
      current = filter;

      const shown = apply(filter);
      // 履歴を増やさない（U-9。pushState は使わない）
      deps.history.replaceState(deps.history.state, '', buildFilterUrl(currentUrl(), filter));
      if (status) {
        const name = filter === null ? undefined : button.textContent?.trim();
        status.textContent = describeFilterResult(filter, name, shown.length);
      }
      if (!deps.prefersReducedMotion()) {
        for (const item of shown) {
          item.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_DURATION_MS });
        }
      }
    });
  }
}
