// 一覧ページの検索フィルター枠（要件 3.4）。
// 640px 未満では bottom-sheet.js のボトムシート、640px 以上では list.css で常時表示する。
// フィルターの中身（チップ・セレクト等）は各一覧ページ（#05 / #06）が data-filter-body に差し込む。
import { escapeHTML } from '../lib/utils.js';
import { hasDOM, htmlToFragment } from './html-parts.js';
import { createBottomSheet } from './bottom-sheet.js';

const DEFAULT_ID = 'filter-panel';
const DEFAULT_TITLE = '絞り込み';

/**
 * @param {{ id?: string, title?: string }} [options]
 * @returns {string}
 */
export function sidebarHTML({ id = DEFAULT_ID, title = DEFAULT_TITLE } = {}) {
  const safeId = escapeHTML(id);
  const safeTitle = escapeHTML(title);
  return `
<button type="button" class="button button--outline bottom-sheet__trigger list-layout__filter-trigger" data-filter-trigger>${safeTitle}</button>
<aside class="bottom-sheet list-layout__sidebar" id="${safeId}" aria-labelledby="${safeId}-title">
  <div class="bottom-sheet__header">
    <h2 class="bottom-sheet__title" id="${safeId}-title">${safeTitle}</h2>
    <button type="button" class="button button--ghost button--sm bottom-sheet__close" data-bottom-sheet-close>閉じる</button>
  </div>
  <div class="list-layout__filters" data-filter-body></div>
</aside>`.trim();
}

/**
 * フィルター枠を描画し、スマホ幅でのボトムシート開閉を有効にする。
 * @param {HTMLElement|null} container 差し込み先（.list-layout__sidebar-slot）
 * @param {{ id?: string, title?: string }} [options]
 * @returns {{ panel: HTMLElement, body: HTMLElement, sheet: ReturnType<typeof createBottomSheet> } | null}
 */
export function renderSidebar(container, options) {
  if (!hasDOM()) return null;
  if (!(container instanceof HTMLElement)) {
    console.warn('renderSidebar: フィルター枠の差し込み先が見つかりません');
    return null;
  }
  container.replaceChildren(htmlToFragment(sidebarHTML(options)));
  const trigger = container.querySelector('[data-filter-trigger]');
  const panel = container.querySelector('.list-layout__sidebar');
  const body = container.querySelector('[data-filter-body]');
  return { panel, body, sheet: createBottomSheet(trigger, panel) };
}
