// マイページ（タレント用・企業用）で共有する小さな部品。
// 応募・スカウトのメッセージや企業が掲載した案件名は利用者の入力なので、すべて textContent で入れる（innerHTML は使わない）。
import { getStatusLabel, getStatusActionLabel, getNextStatuses } from '../lib/status.js';
import { toSafeHref } from './html-parts.js';
import { renderEmptyState } from './empty-state.js';

/** @param {string} tag @param {string} [className] @param {string} [text] */
export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** 詳細ページへのリンク。id は保存値由来なので encodeURIComponent してから toSafeHref を通す */
export function detailLink(page, id, text, className = 'mypage-item__link') {
  const link = el('a', className, text);
  link.href = toSafeHref(`${page}?id=${encodeURIComponent(String(id ?? ''))}`);
  return link;
}

/**
 * 見出し付きのセクション。
 * @param {string} id 見出しの id（aria-labelledby 用）
 * @param {string} title
 * @param {string} [lead] 見出し下の説明
 */
export function section(id, title, lead) {
  const root = el('section', 'dashboard-layout__section mypage__section');
  root.setAttribute('aria-labelledby', id);
  const heading = el('h2', 'mypage__heading', title);
  heading.id = id;
  root.append(heading);
  if (lead) root.append(el('p', 'mypage__lead', lead));
  return root;
}

/** 空状態。行き止まりにしないよう、次の行動へのリンクを付けられる（要件 3.4） */
export function emptyState(message, actionLabel, actionHref) {
  return renderEmptyState({ message, actionLabel, actionHref }) ?? el('p', 'mypage__empty', message);
}

/** ステータスは色だけでなく必ずテキストでも示す（要件 3.5）。読み上げでは「ステータス：」を前置きする */
export function statusBadge(kind, status) {
  const badge = el('span', `badge badge--${status} mypage-item__status`);
  badge.append(el('span', 'visually-hidden', 'ステータス：'), getStatusLabel(kind, status));
  return badge;
}

/**
 * 1件分のカード。
 * @param {{ id: string, title: Node, badge: Node, facts: [string, string][], message?: string, actions?: Node|null }} parts
 */
export function itemCard({ id, title, badge, facts, message, actions }) {
  const item = el('li', 'card mypage-item');
  item.dataset.itemId = id;
  // ステータスを進めて描き直した後、フォーカスを戻す先にするため（Tab 移動の対象にはしない）
  item.tabIndex = -1;
  const body = el('div', 'card__body mypage-item__body');
  const head = el('div', 'mypage-item__head');
  const heading = el('h3', 'mypage-item__title');
  heading.append(title);
  head.append(heading, badge);
  body.append(head);

  const list = el('dl', 'mypage-item__facts');
  for (const [term, value] of facts) {
    if (!value) continue;
    const row = el('div', 'mypage-item__fact');
    row.append(el('dt', '', term), el('dd', '', value));
    list.append(row);
  }
  body.append(list);
  if (message) body.append(el('p', 'mypage-item__message', message));
  if (actions) body.append(actions);
  item.append(body);
  return item;
}

/** @param {object[]} items @param {(item: object) => HTMLElement} renderItem */
export function itemList(items, renderItem) {
  const list = el('ul', 'mypage__list');
  list.setAttribute('role', 'list');
  list.append(...items.map(renderItem));
  return list;
}

/**
 * 「次へ進める」ボタン群。進める先が無い（終わった）状態なら null。
 * 同じ文言のボタンが一覧に並ぶので、aria-label で「誰の・どの件か」を添える。
 * @param {string} kind
 * @param {{ id: string, status: string }} item
 * @param {string} subject 例 "春風 みなみさんの応募"
 * @param {(kind: string, id: string, to: string) => void} onAdvance
 */
export function statusActions(kind, item, subject, onAdvance) {
  const next = getNextStatuses(kind, item.status);
  if (next.length === 0) return null;
  const group = el('div', 'cluster mypage-item__actions');
  for (const status of next) {
    const button = el('button', 'button button--outline button--sm', getStatusActionLabel(kind, status));
    button.type = 'button';
    button.setAttribute('aria-label', `${subject}を「${getStatusLabel(kind, status)}」にする`);
    button.addEventListener('click', () => onAdvance(kind, item.id, status));
    group.append(button);
  }
  return group;
}
