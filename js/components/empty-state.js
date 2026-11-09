// 空状態（検索結果0件など）。行き止まりにしないよう、次の行動ボタンを置ける形にする（要件 3.4）。
import { escapeHTML } from '../lib/utils.js';
import { isPlainObject, toSafeHref, htmlToElement } from './html-parts.js';

const DEFAULT_MESSAGE = '該当するものが見つかりませんでした。';

// 虫眼鏡のイラスト。意味は文言で伝えるので装飾として読み上げから外す
const ICON_SVG = `<svg class="empty-state__icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
<circle cx="21" cy="21" r="13" fill="none" stroke="currentColor" stroke-width="4"/>
<path d="M31 31l10 10" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
</svg>`;

/**
 * @typedef {Object} EmptyStateOptions
 * @property {string} [message]      表示する文言
 * @property {string} [actionLabel]  次の行動ボタンの文言（無ければボタンを出さない）
 * @property {string} [actionHref]   リンク先。無ければ button 要素になり onAction で処理する
 * @property {() => void} [onAction] actionHref が無いときのクリック処理（renderEmptyState のみ）
 */

/**
 * @param {EmptyStateOptions} [options]
 * @returns {string} エスケープ済みの HTML
 */
export function emptyStateHTML(options = {}) {
  const { message, actionLabel, actionHref } = isPlainObject(options) ? options : {};
  const text = typeof message === 'string' && message !== '' ? message : DEFAULT_MESSAGE;

  let action = '';
  if (actionLabel && actionHref) {
    action = `<a class="button button--primary" href="${escapeHTML(toSafeHref(actionHref))}">${escapeHTML(actionLabel)}</a>`;
  } else if (actionLabel) {
    // 遷移ではなく「フィルター解除」などの操作は、リンクではなくボタンとして読み上げさせる
    action = `<button type="button" class="button button--primary" data-empty-state-action>${escapeHTML(actionLabel)}</button>`;
  }

  return `<div class="empty-state">
  ${ICON_SVG}
  <p class="empty-state__message">${escapeHTML(text)}</p>
  ${action}
</div>`;
}

/**
 * 空状態の要素を作る。onAction はボタン型のときだけ結び付ける。
 * @param {EmptyStateOptions} [options]
 * @returns {Element|null} DOM が無い環境では null
 */
export function renderEmptyState(options = {}) {
  const element = htmlToElement(emptyStateHTML(options));
  if (!element) return null;
  const button = element.querySelector('[data-empty-state-action]');
  const onAction = isPlainObject(options) ? options.onAction : undefined;
  if (button && typeof onAction === 'function') {
    button.addEventListener('click', () => {
      try {
        onAction();
      } catch (error) {
        // ページ側の処理が失敗しても、空状態の表示自体は残す
        console.error('空状態のボタン処理でエラーが発生しました', error);
      }
    });
  }
  return element;
}
