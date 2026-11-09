// サイト共通ヘッダー（ロゴ・グローバルナビ・デモ用ロール切替。要件 C-05 / 4.3）。
// 描画は HTML 文字列を返す純粋関数に分け、DOM 操作（メニュー開閉・ロール変更）は renderHeader に閉じ込める。
import { escapeHTML } from '../lib/utils.js';
import { getRole, setRole, normalizeRole, ROLES } from '../lib/storage.js';
import { getNotificationCount } from '../lib/mypage-data.js';
import { hasDOM, htmlToFragment } from './html-parts.js';
import { NOTIFICATION_PAGE, notificationView, badgeHTML, menuButtonInnerHTML } from './notification-badge.js';

// ナビ6項目＋ロール切替が1行に収まらない幅ではハンバーガーにする。
// variables.css のブレークポイント lg と同じ値（CSS 変数はメディアクエリに使えないため定数で持つ）
export const HEADER_DESKTOP_QUERY = '(min-width: 1024px)';
export const ROLE_CHANGE_EVENT = 'role-change';
/** 応募・スカウトのステータス変更やデモリセットの後にページ側が投げる。ヘッダーは保存値を読み直してロールと通知バッジを更新する */
export const DATA_CHANGE_EVENT = 'stagelink-data-change';

const NAV_ID = 'global-nav';
const ROLE_SELECT_ID = 'role-switch';
const MENU_OPEN_CLASS = 'site-header--menu-open';
const INDEX_PAGE = 'index.html';

const ROLE_OPTION_LABELS = Object.freeze({
  guest: 'ゲスト',
  talent: 'タレント',
  company: '企業',
});

// roles を持たない項目は全ロール共通。ロール限定ページ（3.1）だけ roles で絞る
const NAV_ITEMS = Object.freeze([
  { href: 'talents.html', label: 'タレントを探す' },
  { href: 'jobs.html', label: '案件を探す' },
  { href: 'about.html', label: 'サービス紹介' },
  { href: 'mypage.html', label: 'マイページ', roles: ['talent', 'company'] },
  { href: 'profile-edit.html', label: 'プロフィール編集', roles: ['talent'] },
  { href: 'job-new.html', label: '案件掲載', roles: ['company'] },
]);

/**
 * @param {unknown} role
 * @returns {{ href: string, label: string }[]}
 */
export function getNavItems(role) {
  const current = normalizeRole(role);
  return NAV_ITEMS
    .filter((item) => !item.roles || item.roles.includes(current))
    .map(({ href, label }) => ({ href, label }));
}

/**
 * aria-current の判定に使うため、URL のパスから表示中のファイル名を取り出す。
 * @param {unknown} pathname 例 "/talent_matching/jobs.html"
 * @returns {string} 例 "jobs.html"（ディレクトリなら "index.html"）
 */
export function getCurrentPage(pathname) {
  if (typeof pathname !== 'string') return INDEX_PAGE;
  const last = pathname.split('/').pop() ?? '';
  return last === '' ? INDEX_PAGE : last;
}

/** @param {unknown} role @param {string} currentPage @param {ReturnType<typeof notificationView>} notification 通知バッジ（M-02） @returns {string} ナビの <li> 群 */
function navItemsHTML(role, currentPage, notification = null) {
  return getNavItems(role).map(({ href, label }) => {
    const current = href === currentPage ? ' aria-current="page"' : '';
    const withBadge = notification && href === NOTIFICATION_PAGE;
    const ariaLabel = withBadge ? ` aria-label="${escapeHTML(`${label}（${notification.label}）`)}"` : '';
    const badge = withBadge ? badgeHTML(notification.count) : '';
    return `<li><a class="site-header__link" href="${escapeHTML(href)}"${current}${ariaLabel}>${escapeHTML(label)}${badge}</a></li>`;
  }).join('');
}

/** @param {'guest'|'talent'|'company'} role @returns {string} */
function roleOptionsHTML(role) {
  return ROLES.map((value) => {
    const selected = value === role ? ' selected' : '';
    return `<option value="${value}"${selected}>${ROLE_OPTION_LABELS[value]}</option>`;
  }).join('');
}

/**
 * @param {{ role?: unknown, currentPage?: string, notificationCount?: unknown }} [options]
 * @returns {string}
 */
export function headerHTML({ role, currentPage = INDEX_PAGE, notificationCount } = {}) {
  const current = normalizeRole(role);
  const notification = notificationView(current, notificationCount);
  return `
<header class="site-header">
  <div class="container site-header__inner">
    <a class="site-header__logo" href="${INDEX_PAGE}">StageLink<span class="visually-hidden">（トップページへ）</span></a>
    <nav class="site-header__nav" id="${NAV_ID}" aria-label="グローバル">
      <ul class="site-header__list" role="list" data-nav-list>${navItemsHTML(current, currentPage, notification)}</ul>
    </nav>
    <div class="site-header__actions">
      <label class="site-header__role" for="${ROLE_SELECT_ID}">
        <span class="site-header__role-label">表示<span class="visually-hidden">するロール（デモ用の切替）</span></span>
        <select class="site-header__role-select" id="${ROLE_SELECT_ID}" data-role-switch>${roleOptionsHTML(current)}</select>
      </label>
      <button type="button" class="site-header__menu-button" aria-expanded="false" aria-controls="${NAV_ID}" data-menu-toggle>${menuButtonInnerHTML(notification)}</button>
    </div>
  </div>
</header>`.trim();
}

/**
 * ヘッダーを描画し、メニュー開閉とロール切替を有効にする。
 * @param {HTMLElement|null} container 差し込み先（page-base.html の #site-header）
 * @returns {{ destroy: () => void } | null}
 */
export function renderHeader(container) {
  if (!hasDOM()) return null;
  if (!(container instanceof HTMLElement)) {
    console.warn('renderHeader: ヘッダーの差し込み先が見つかりません');
    return null;
  }

  const currentPage = getCurrentPage(window.location.pathname);
  const initialRole = getRole();
  container.replaceChildren(htmlToFragment(headerHTML({
    role: initialRole, currentPage, notificationCount: getNotificationCount(initialRole),
  })));

  const header = container.querySelector('.site-header');
  const menuButton = container.querySelector('[data-menu-toggle]');
  const nav = container.querySelector(`#${NAV_ID}`);
  const navList = container.querySelector('[data-nav-list]');
  const roleSelect = container.querySelector('[data-role-switch]');
  const desktop = window.matchMedia(HEADER_DESKTOP_QUERY);

  let menuOpen = false;

  const onKeydown = (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    setMenuOpen(false);
  };

  /** @param {boolean} open @param {{ returnFocus?: boolean }} [options] */
  function setMenuOpen(open, { returnFocus = true } = {}) {
    if (open === menuOpen) return;
    menuOpen = open;
    header.classList.toggle(MENU_OPEN_CLASS, open);
    menuButton.setAttribute('aria-expanded', String(open));
    if (open) {
      document.addEventListener('keydown', onKeydown);
      // 開いた直後にナビへ移すと、Tab でリンク → ロール切替 → 閉じるボタンの順にたどれる
      nav.querySelector('a')?.focus();
    } else {
      document.removeEventListener('keydown', onKeydown);
      if (returnFocus) menuButton.focus();
    }
  }

  const onMenuClick = () => setMenuOpen(!menuOpen);
  // 開いたまま PC 幅へ広げると、aria-expanded="true" だけが残って実際の表示と食い違うため閉じる
  const onBreakpointChange = (event) => {
    if (event.matches) setMenuOpen(false, { returnFocus: false });
  };
  /** ナビと通知バッジを描き直す。どちらも固定文言とエスケープ済みの値だけで組み立てた HTML */
  const renderNotifications = (role) => {
    const notification = notificationView(role, getNotificationCount(role));
    navList.innerHTML = navItemsHTML(role, currentPage, notification);
    menuButton.innerHTML = menuButtonInnerHTML(notification);
  };
  const onRoleChange = () => {
    const role = normalizeRole(roleSelect.value);
    // 保存に失敗しても、このページ内では選んだロールで見せ続ける（setRole 側で警告を出す）
    setRole(role);
    renderNotifications(role);
    // ページ側（マイページ等）が表示を切り替えられるよう通知する
    document.dispatchEvent(new CustomEvent(ROLE_CHANGE_EVENT, { detail: { role } }));
  };

  // ステータス変更・デモリセット（同じタブ）や別タブでの保存の後は、保存値からロールと件数を読み直す。
  // リセットでロールの保存値が消えたときに、選択欄だけ古いロールのまま残らないようにするため
  const onDataChange = () => {
    const role = getRole();
    roleSelect.value = role;
    renderNotifications(role);
  };

  menuButton.addEventListener('click', onMenuClick);
  roleSelect.addEventListener('change', onRoleChange);
  desktop.addEventListener('change', onBreakpointChange);
  document.addEventListener(DATA_CHANGE_EVENT, onDataChange);
  window.addEventListener('storage', onDataChange);

  function destroy() {
    setMenuOpen(false, { returnFocus: false });
    menuButton.removeEventListener('click', onMenuClick);
    roleSelect.removeEventListener('change', onRoleChange);
    desktop.removeEventListener('change', onBreakpointChange);
    document.removeEventListener(DATA_CHANGE_EVENT, onDataChange);
    window.removeEventListener('storage', onDataChange);
  }

  return { destroy };
}
