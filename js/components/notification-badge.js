// ヘッダーの通知バッジ（要件 M-02）。header.js が200行を超えないよう、バッジの HTML 組み立てだけをここに分ける。
// 件数の計算は js/lib/mypage-data.js（タレント＝未読スカウト、企業＝未対応の応募）。
import { escapeHTML } from '../lib/utils.js';
import { normalizeRole } from '../lib/storage.js';
import { getNotificationLabel } from '../lib/mypage-data.js';

/** バッジはマイページへのリンクに付ける（届いたスカウト・応募者一覧がある場所） */
export const NOTIFICATION_PAGE = 'mypage.html';
const MENU_LABEL = 'メニュー';

/**
 * @param {unknown} role
 * @param {unknown} count
 * @returns {{ count: number, label: string } | null} 出すものが無ければ null（0件・ゲスト・不正な値）
 */
export function notificationView(role, count) {
  const label = getNotificationLabel(normalizeRole(role), count);
  return label ? { count, label } : null;
}

/** 数字は見た目用（aria-hidden）。件数の意味はリンクの aria-label で読み上げ、二重に読まれないようにする */
export function badgeHTML(count) {
  return `<span class="site-header__badge" aria-hidden="true">${escapeHTML(count)}</span>`;
}

/**
 * スマホ幅ではナビが閉じていてリンクのバッジが見えないため、メニューボタンにも件数を出す。
 * @param {ReturnType<typeof notificationView>} notification
 * @returns {string} メニューボタンの中身
 */
export function menuButtonInnerHTML(notification) {
  const text = notification ? `${MENU_LABEL}（${notification.label}）` : MENU_LABEL;
  const badge = notification
    ? `<span class="site-header__badge site-header__menu-badge" aria-hidden="true" data-menu-badge>${escapeHTML(notification.count)}</span>`
    : '';
  return `<span class="site-header__menu-icon" aria-hidden="true"></span><span class="visually-hidden">${escapeHTML(text)}</span>${badge}`;
}
