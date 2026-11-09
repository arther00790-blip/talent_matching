// 検索フィルター用のボトムシート（要件 3.4）。
// 640px 未満では下から出るシート、640px 以上では CSS 側でサイドに常時表示するため、開閉はスマホ幅だけで行う。
import { hasDOM } from './html-parts.js';

// variables.css のブレークポイント sm と同じ値（CSS 変数はメディアクエリに使えないため定数で持つ）
export const BOTTOM_SHEET_DESKTOP_QUERY = '(min-width: 640px)';

const OPEN_CLASS = 'bottom-sheet--open';
const BACKDROP_CLASS = 'bottom-sheet__backdrop';
const BACKDROP_OPEN_CLASS = 'bottom-sheet__backdrop--open';
const CLOSE_SELECTOR = '[data-bottom-sheet-close]';
const PANEL_ID_PREFIX = 'bottom-sheet-';
const FOCUSABLE_SELECTOR = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])',
  'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

let sheetCount = 0;

/** @param {HTMLElement} panel @returns {HTMLElement[]} */
function getFocusable(panel) {
  return [...panel.querySelectorAll(FOCUSABLE_SELECTOR)];
}

/**
 * @param {HTMLElement|null} trigger 開閉ボタン（aria-expanded を同期する）
 * @param {HTMLElement|null} panel   シートにする要素（class="bottom-sheet"）
 * @returns {{ open: () => void, close: () => void, toggle: () => void, isOpen: () => boolean, destroy: () => void } | null}
 */
export function createBottomSheet(trigger, panel) {
  if (!hasDOM()) return null;
  if (!(trigger instanceof HTMLElement) || !(panel instanceof HTMLElement)) {
    console.warn('createBottomSheet: 開閉ボタンまたはパネルが見つかりません');
    return null;
  }

  sheetCount += 1;
  if (!panel.id) panel.id = `${PANEL_ID_PREFIX}${sheetCount}`;
  trigger.setAttribute('aria-controls', panel.id);
  trigger.setAttribute('aria-expanded', 'false');

  const desktop = window.matchMedia(BOTTOM_SHEET_DESKTOP_QUERY);
  const backdrop = document.createElement('div');
  backdrop.className = BACKDROP_CLASS;
  // body 直下に置くのは、パネルの親がグリッドでも余計なマス目を作らないため
  document.body.append(backdrop);

  let opened = false;

  const onKeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    // 背面は暗くして操作させない見た目なので、Tab でも背面へ抜けないようシート内で循環させる
    const focusable = getFocusable(panel);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  function open() {
    // PC 幅ではサイドに常時表示されているので、開閉の概念が無い
    if (opened || desktop.matches) return;
    opened = true;
    panel.classList.add(OPEN_CLASS);
    backdrop.classList.add(BACKDROP_OPEN_CLASS);
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    trigger.setAttribute('aria-expanded', 'true');
    document.addEventListener('keydown', onKeydown);
    const [firstFocusable] = getFocusable(panel);
    (firstFocusable ?? panel).focus();
  }

  /** @param {{ returnFocus?: boolean }} [options] */
  function close({ returnFocus = true } = {}) {
    if (!opened) return;
    opened = false;
    panel.classList.remove(OPEN_CLASS);
    backdrop.classList.remove(BACKDROP_OPEN_CLASS);
    panel.removeAttribute('role');
    panel.removeAttribute('aria-modal');
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', onKeydown);
    // 開いたボタンへ戻すことで、キーボード利用者が元の位置から操作を続けられる
    if (returnFocus) trigger.focus();
  }

  const toggle = () => (opened ? close() : open());
  const onCloseClick = (event) => {
    if (event.target instanceof Element && event.target.closest(CLOSE_SELECTOR)) close();
  };
  // 開いたまま PC 幅へ広げると、シートの状態だけが残って aria-expanded と食い違うため閉じる
  const onBreakpointChange = (event) => {
    if (event.matches) close({ returnFocus: false });
  };
  const onBackdropClick = () => close();

  trigger.addEventListener('click', toggle);
  panel.addEventListener('click', onCloseClick);
  backdrop.addEventListener('click', onBackdropClick);
  desktop.addEventListener('change', onBreakpointChange);

  // フォーカス可能な要素が無いシートでも、開いたときにフォーカスを移せるようにする
  if (!panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '-1');

  function destroy() {
    close({ returnFocus: false });
    trigger.removeEventListener('click', toggle);
    panel.removeEventListener('click', onCloseClick);
    backdrop.removeEventListener('click', onBackdropClick);
    desktop.removeEventListener('change', onBreakpointChange);
    backdrop.remove();
  }

  return { open, close, toggle, isOpen: () => opened, destroy };
}
