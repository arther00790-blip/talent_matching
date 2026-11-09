// カード・空状態・スケルトンで共有する小さな部品。
// バッジの文言や URL の安全確認をカードごとに書くと、片方だけ直し漏れる事故が起きるため1か所にまとめる。
import { escapeHTML } from '../lib/utils.js';

/** 4.4 の TalentRole を画面表示用の日本語にする */
export const ROLE_LABELS = Object.freeze({
  actor: '俳優',
  model: 'モデル',
  voice: '声優',
  dancer: 'ダンサー',
  other: 'その他',
});

// 6.3 の応募ステータス。色だけで状態を伝えないよう、必ずテキストを併記する（要件 3.5）
const STATUS_LABELS = Object.freeze({
  applied: '応募済',
  reviewing: '選考中',
  accepted: '採用',
  declined: '見送り',
});

const ROLE_SEPARATOR = '・';
const FALLBACK_HREF = '#';
// 画面遷移に使ってよいスキーム。javascript: や data: はクリックでスクリプトが動くため通さない
const ALLOWED_SCHEMES = new Set(['http', 'https', 'mailto', 'tel']);
const SCHEME_PATTERN = /^([a-z][a-z0-9+.-]*):/i;
// ブラウザは URL 中のタブ・改行・制御文字を無視するため、"java\tscript:" のような抜け道を先に潰す
const URL_IGNORED_CHARS = /[\u0000- ]/g;

/** @param {unknown} value @returns {value is Record<string, unknown>} */
export function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** @param {unknown} value @returns {string[]} 配列でなければ空配列（データ不備で map が落ちないように） */
export function toStringArray(value) {
  return Array.isArray(value) ? value.filter((item) => item !== null && item !== undefined).map(String) : [];
}

/** @param {unknown} roles @returns {string} 例 "俳優・ダンサー" */
export function formatRoles(roles) {
  return toStringArray(roles).map((role) => ROLE_LABELS[role] ?? role).join(ROLE_SEPARATOR);
}

/**
 * href 属性に入れても安全な URL を返す（エスケープはしないので、出力時に escapeHTML を通す）。
 * @param {unknown} href
 * @returns {string}
 */
export function toSafeHref(href) {
  if (typeof href !== 'string') return FALLBACK_HREF;
  const trimmed = href.trim();
  if (trimmed === '') return FALLBACK_HREF;
  const scheme = trimmed.replace(URL_IGNORED_CHARS, '').match(SCHEME_PATTERN);
  if (scheme && !ALLOWED_SCHEMES.has(scheme[1].toLowerCase())) return FALLBACK_HREF;
  return trimmed;
}

/** ▶ 動画あり（記号は読み上げると冗長なので隠し、テキストで伝える） */
export function videoBadgeHTML() {
  return '<span class="badge badge--video"><span aria-hidden="true">▶</span> 動画あり</span>';
}

/**
 * 応募ステータスのバッジ。未知のステータスは何も出さない（誤った状態を表示しないため）。
 * @param {unknown} status
 * @returns {string}
 */
export function statusBadgeHTML(status) {
  if (typeof status !== 'string' || !Object.hasOwn(STATUS_LABELS, status)) return '';
  return `<span class="badge badge--${escapeHTML(status)}">${STATUS_LABELS[status]}</span>`;
}

/** @param {unknown} items @param {string} className @returns {string} チップの並び */
export function chipListHTML(items, className) {
  const list = toStringArray(items);
  if (list.length === 0) return '';
  const chips = list.map((item) => `<li class="chip chip--sm">${escapeHTML(item)}</li>`).join('');
  return `<ul class="${escapeHTML(className)}" role="list">${chips}</ul>`;
}

/** ブラウザ以外（テスト環境など）では DOM API が無いため、呼び出し前に確認する */
export function hasDOM() {
  return typeof document !== 'undefined' && typeof document.createElement === 'function';
}

/**
 * エスケープ済みの HTML 文字列を DocumentFragment にする。
 * template 要素を使うのは、パース中にスクリプトや画像読み込みを走らせないため。
 * @param {string} html
 * @returns {DocumentFragment|null}
 */
export function htmlToFragment(html) {
  if (!hasDOM()) return null;
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content;
}

/** @param {string} html @returns {Element|null} 先頭の要素 */
export function htmlToElement(html) {
  const fragment = htmlToFragment(html);
  return fragment ? fragment.firstElementChild : null;
}
