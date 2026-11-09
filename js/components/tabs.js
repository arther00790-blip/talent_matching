// タブ切替（WAI-ARIA Authoring Practices の Tabs パターン、自動アクティベーション）。
// マークアップ側で role="tablist" / "tab" / "tabpanel"・aria-controls・aria-selected を書いておき、ここでは振る舞いだけを足す。
// JS が動かなくても、最初のタブのパネルは HTML のまま読めるようにするため。
// キーの計算は DOM に触れない getNextTabIndex に切り出し、node:test で検証する。

/** 対応するキー（KeyboardEvent.key）。↑↓ は横並びのタブでは使わず、ページのスクロールに残す */
export const TAB_KEYS = Object.freeze({
  next: 'ArrowRight',
  previous: 'ArrowLeft',
  first: 'Home',
  last: 'End',
});

const TAB_SELECTOR = '[role="tab"]';

/**
 * キー操作後に選ぶタブの位置。左右は端で反対側へ回り込む。
 * @param {string} key KeyboardEvent.key
 * @param {number} current 現在のタブの位置
 * @param {number} count タブの数
 * @returns {number|null} 対象外のキー・不正な引数なら null（呼び出し側は既定の動作を妨げない）
 */
export function getNextTabIndex(key, current, count) {
  if (!Number.isInteger(count) || count < 1) return null;
  if (!Number.isInteger(current) || current < 0 || current >= count) return null;
  switch (key) {
    case TAB_KEYS.next:
      return (current + 1) % count;
    case TAB_KEYS.previous:
      return (current - 1 + count) % count;
    case TAB_KEYS.first:
      return 0;
    case TAB_KEYS.last:
      return count - 1;
    default:
      return null;
  }
}

/** @param {Element} tab @returns {HTMLElement|null} */
function panelOf(tab) {
  const id = tab.getAttribute('aria-controls');
  return id ? document.getElementById(id) : null;
}

/**
 * tablist 内のタブに切替とキー操作を付ける。
 * ロービング tabindex：選択中のタブだけを Tab で止まる位置にし、タブ間の移動は矢印キーに任せる。
 * そうすることで、Tab 1回で選択中のパネルへ進める。
 * @param {Element|null} tablist role="tablist" の要素
 * @returns {{ select: (index: number) => void } | null} 構造が不正なら null（パネルは HTML の初期表示のまま残す）
 */
export function initTabs(tablist) {
  if (!(tablist instanceof HTMLElement)) return null;
  const tabs = [...tablist.querySelectorAll(TAB_SELECTOR)];
  const panels = tabs.map(panelOf);
  if (tabs.length === 0 || panels.some((panel) => !panel)) {
    console.error('tabs.js: タブと対応するパネルが見つかりません');
    return null;
  }

  const select = (index, { focus = false } = {}) => {
    tabs.forEach((tab, i) => {
      const selected = i === index;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      panels[i].hidden = !selected;
    });
    if (focus) tabs[index].focus();
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(index));
  });

  tablist.addEventListener('keydown', (event) => {
    const current = tabs.indexOf(/** @type {Element} */ (event.target));
    const next = getNextTabIndex(event.key, current, tabs.length);
    if (next === null) return;
    // Home / End でページ全体がスクロールしないよう、タブの移動として扱ったときだけ既定の動作を止める
    event.preventDefault();
    select(next, { focus: true });
  });

  const initial = tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true');
  select(initial >= 0 ? initial : 0);
  return { select: (index) => select(index) };
}
