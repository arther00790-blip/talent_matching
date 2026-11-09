// トースト通知（応募完了などの「操作の結果」を邪魔にならない形で知らせる。要件 3.3）。
import { hasDOM } from './html-parts.js';

// 日本語の短文（20〜30字）を読み終えられ、かつ画面に残りすぎない長さ
export const TOAST_DURATION_MS = 4000;
export const TOAST_TYPES = Object.freeze(['success', 'error', 'info']);

const DEFAULT_TYPE = 'info';
const REGION_CLASS = 'toast-region';
const LEAVING_CLASS = 'toast--leaving';
// 退場アニメーション（--duration-normal）の transitionend が来なかった場合の保険
const EXIT_FALLBACK_MS = 400;

// 色だけで種類を伝えないよう、記号と読み上げ用の種別名を添える
const TYPE_META = Object.freeze({
  success: { icon: '✓', label: '完了' },
  error: { icon: '!', label: 'エラー' },
  info: { icon: 'i', label: 'お知らせ' },
});

/**
 * 引数の既定値と不正値の補正（DOM に依存しないのでテストできる）。
 * @param {{ type?: string, duration?: number }} [options]
 * @returns {{ type: 'success'|'error'|'info', duration: number }}
 */
export function resolveToastOptions(options = {}) {
  const { type, duration } = options ?? {};
  return {
    type: TOAST_TYPES.includes(type) ? type : DEFAULT_TYPE,
    duration: Number.isFinite(duration) && duration > 0 ? duration : TOAST_DURATION_MS,
  };
}

/**
 * ライブリージョンは「中身が変わったこと」を読み上げる仕組みなので、
 * 通知のたびに作らず、ページに1つだけ用意して使い回す。
 * @returns {HTMLElement}
 */
function getRegion() {
  const existing = document.querySelector(`.${REGION_CLASS}`);
  if (existing) return existing;
  const region = document.createElement('div');
  region.className = REGION_CLASS;
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', 'polite');
  document.body.append(region);
  return region;
}

/** @param {HTMLElement} toast */
function dismiss(toast) {
  if (!toast.isConnected || toast.classList.contains(LEAVING_CLASS)) return;
  toast.classList.add(LEAVING_CLASS);
  const remove = () => toast.remove();
  toast.addEventListener('transitionend', remove, { once: true });
  setTimeout(remove, EXIT_FALLBACK_MS);
}

/**
 * @param {string} message 表示する文言（textContent で入れるので HTML は解釈されない）
 * @param {{ type?: 'success'|'error'|'info', duration?: number }} [options]
 * @returns {{ element: HTMLElement, dismiss: () => void } | null} DOM が無い環境では null
 */
export function showToast(message, options) {
  if (!hasDOM() || !document.body) return null;
  const { type, duration } = resolveToastOptions(options);
  const meta = TYPE_META[type];

  try {
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;

    const icon = document.createElement('span');
    icon.className = 'toast__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = meta.icon;

    const text = document.createElement('p');
    text.className = 'toast__message';
    const label = document.createElement('span');
    label.className = 'visually-hidden';
    label.textContent = `${meta.label}：`;
    text.append(label, String(message ?? ''));

    // 自動で消える前に読み終えられない人のため、手動でも閉じられるようにする（WCAG 2.2.1）
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast__close';
    close.setAttribute('aria-label', '通知を閉じる');
    close.textContent = '×';
    close.addEventListener('click', () => dismiss(toast));

    toast.append(icon, text, close);
    getRegion().append(toast);
    setTimeout(() => dismiss(toast), duration);
    return { element: toast, dismiss: () => dismiss(toast) };
  } catch (error) {
    // 通知が出せなくても、呼び出し元の処理（応募の保存など）は続けさせる
    console.error('トーストを表示できませんでした', error);
    return null;
  }
}
