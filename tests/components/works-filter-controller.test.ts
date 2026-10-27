// @vitest-environment happy-dom
// 実績一覧の絞り込みの DOM 挙動（works-list「受け入れ条件 / DOM の挙動」。L-6）。
// initWorksFilter に偽の location / history / prefersReducedMotion を渡して判定する。
// マークアップは works-list「ビルド時に出す HTML」の形（dist の実物は tests/dist/works-list.test.ts で検査）。
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { initWorksFilter } from '../../src/components/works/works-filter-controller';
import { describeFilterResult } from '../../src/lib/works-filter';

const CATEGORIES = [
  { slug: 'web', name: 'Web' },
  { slug: 'design', name: 'Design' },
];
/** 各カードのカテゴリ（web 3 件・design 2 件） */
const ITEMS = ['web', 'design', 'web', 'design', 'web'];

function markup(): string {
  const buttons = [
    `<li><button type="button" class="p-works__filter-button" data-filter="" aria-pressed="true">全て</button></li>`,
    ...CATEGORIES.map(
      ({ slug, name }) =>
        `<li><button type="button" class="p-works__filter-button" data-filter="${slug}" aria-pressed="false">${name}</button></li>`,
    ),
  ].join('');
  const items = ITEMS.map(
    (slug, index) =>
      `<li class="p-works__item" data-category="${slug}"><a href="/works/w${index}/">w${index}</a></li>`,
  ).join('');
  return `
    <div class="p-works" data-works-filter-root>
      <div class="p-works__filter" role="group" aria-labelledby="works-filter-heading">
        <h2 id="works-filter-heading">Category</h2>
        <ul class="p-works__filter-list">${buttons}</ul>
      </div>
      <p class="u-visually-hidden" role="status" data-works-filter-status></p>
      <ul class="p-works__list">${items}</ul>
    </div>`;
}

type HistoryMethod = (state: unknown, unused: string, url?: string | URL | null) => void;
type AnimateCall = (item: HTMLElement, ...args: unknown[]) => void;
type FakeHistory = {
  state: unknown;
  replaceState: Mock<HistoryMethod>;
  /** 呼ばれないことを確かめるために置く（controller の deps の型には無い） */
  pushState: Mock<HistoryMethod>;
};

let root: HTMLElement;
let history: FakeHistory;
let animate: Mock<AnimateCall>;

function setup(search: string, reducedMotion = false) {
  document.body.innerHTML = markup();
  root = document.querySelector<HTMLElement>('[data-works-filter-root]')!;
  history = {
    state: { key: 'state' },
    replaceState: vi.fn<HistoryMethod>(),
    pushState: vi.fn<HistoryMethod>(),
  };
  // カードのフェード（Element.animate）を観測する
  animate = vi.fn<AnimateCall>();
  for (const item of listItems()) {
    (item as unknown as { animate: unknown }).animate = (...args: unknown[]) =>
      animate(item, ...args);
  }
  initWorksFilter(root, {
    location: { pathname: '/works/', search, hash: '' },
    history,
    prefersReducedMotion: () => reducedMotion,
  });
}

const listItems = () => [...root.querySelectorAll<HTMLElement>('[data-category]')];
const buttonOf = (filter: string) =>
  root.querySelector<HTMLButtonElement>(`button[data-filter="${filter}"]`)!;
const pressed = () =>
  [...root.querySelectorAll<HTMLButtonElement>('button[data-filter]')]
    .filter((button) => button.getAttribute('aria-pressed') === 'true')
    .map((button) => button.dataset.filter);
const visibleCategories = () =>
  listItems()
    .filter((item) => !item.hidden)
    .map((item) => item.dataset.category);
const status = () => root.querySelector<HTMLElement>('[role="status"]')!.textContent;

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('initWorksFilter: static HTML', () => {
  it('shows all cards when not initialized', () => {
    document.body.innerHTML = markup();
    const items = [...document.querySelectorAll<HTMLElement>('[data-category]')];
    expect(items).toHaveLength(ITEMS.length);
    expect(items.every((item) => !item.hidden && !item.hasAttribute('hidden'))).toBe(true);
  });
});

describe('initWorksFilter: initialization', () => {
  it('applies ?category=web without replaceState, animation or status', () => {
    setup('?category=web');
    for (const item of listItems()) {
      expect(item.hasAttribute('hidden')).toBe(item.dataset.category !== 'web');
    }
    expect(pressed()).toEqual(['web']);
    expect(history.replaceState).not.toHaveBeenCalled();
    expect(animate).not.toHaveBeenCalled();
    expect(status()).toBe('');
  });

  it.each(['?category=unknown', '?category='])(
    'shows all and removes the query with replaceState for %j',
    (search) => {
      setup(search);
      expect(visibleCategories()).toEqual(ITEMS);
      expect(pressed()).toEqual(['']);
      expect(history.replaceState).toHaveBeenCalledTimes(1);
      expect(history.replaceState).toHaveBeenCalledWith(history.state, '', '/works/');
      expect(status()).toBe('');
    },
  );

  it('does nothing to the URL without a category query', () => {
    setup('');
    expect(visibleCategories()).toEqual(ITEMS);
    expect(pressed()).toEqual(['']);
    expect(history.replaceState).not.toHaveBeenCalled();
  });
});

describe('initWorksFilter: clicking buttons', () => {
  it('filters to Design and updates the URL with replaceState (never pushState)', () => {
    setup('');
    buttonOf('design').click();
    for (const item of listItems()) {
      expect(item.hasAttribute('hidden')).toBe(item.dataset.category !== 'design');
    }
    expect(pressed()).toEqual(['design']);
    expect(history.replaceState).toHaveBeenCalledTimes(1);
    expect(history.replaceState).toHaveBeenCalledWith(history.state, '', '/works/?category=design');
    expect(history.pushState).toHaveBeenCalledTimes(0);
  });

  it('shows all again with "全て" and removes the query', () => {
    setup('');
    buttonOf('design').click();
    buttonOf('').click();
    expect(listItems().every((item) => !item.hasAttribute('hidden'))).toBe(true);
    expect(pressed()).toEqual(['']);
    expect(history.replaceState).toHaveBeenLastCalledWith(history.state, '', '/works/');
    expect(history.pushState).toHaveBeenCalledTimes(0);
  });

  it('does nothing when the selected button is clicked again', () => {
    setup('?category=web');
    buttonOf('web').click();
    expect(history.replaceState).not.toHaveBeenCalled();
    expect(status()).toBe('');
    setup('');
    buttonOf('').click();
    expect(history.replaceState).not.toHaveBeenCalled();
  });

  it('announces the result with describeFilterResult', () => {
    setup('');
    buttonOf('web').click();
    expect(status()).toBe(describeFilterResult('web', 'Web', 3));
    buttonOf('').click();
    expect(status()).toBe(describeFilterResult(null, undefined, ITEMS.length));
  });

  it('keeps the focus on the clicked button', () => {
    setup('');
    const button = buttonOf('design');
    button.focus();
    button.click();
    expect(document.activeElement).toBe(button);
  });

  it('fades in only the shown cards', () => {
    setup('', false);
    buttonOf('design').click();
    const animated = animate.mock.calls.map(([item]) => item.dataset.category);
    expect(animated).toEqual(['design', 'design']);
    const [, keyframes, options] = animate.mock.calls[0];
    expect(keyframes).toEqual([{ opacity: 0 }, { opacity: 1 }]);
    expect(options).toMatchObject({ duration: 300 });
  });

  it('does not animate when reduced motion is preferred', () => {
    setup('', true);
    buttonOf('design').click();
    buttonOf('').click();
    expect(animate).not.toHaveBeenCalled();
  });
});
