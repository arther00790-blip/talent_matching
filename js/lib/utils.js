// 汎用ユーティリティ（HTMLエスケープ・クエリ文字列・日付と秒数の整形）。
// escapeHTML は #02 のカード描画のために先行実装し、残りは #04 で追加した。

// & を最初に置換しないと、後から足した &lt; などの & を再びエスケープして壊してしまう
const HTML_ESCAPE_MAP = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
});

const HTML_ESCAPE_PATTERN = /[&<>"']/g;

/**
 * テンプレート文字列で HTML を組み立てるときに、値をタグや属性として解釈させないための変換。
 * 要素の中身にも属性値（"…" / '…' どちらの引用符でも）にも使える。
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHTML(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(HTML_ESCAPE_PATTERN, (char) => HTML_ESCAPE_MAP[char]);
}

/* ---------- クエリ文字列（絞り込み状態を URL に残し、共有・再読み込みで復元するため） ---------- */

/**
 * @param {string} [search] 省略時は現在の location.search
 * @returns {Record<string, string|string[]>} 同じキーが複数あれば配列。
 *   プロトタイプを持たないオブジェクトにして、"__proto__" などのキーで Object.prototype を汚染させない
 */
export function getQueryParams(search = globalThis.location?.search) {
  const params = Object.create(null);
  if (typeof search !== 'string' || search === '') return params;
  for (const [key, value] of new URLSearchParams(search)) {
    const current = params[key];
    if (current === undefined) params[key] = value;
    else params[key] = Array.isArray(current) ? [...current, value] : [current, value];
  }
  return params;
}

// クエリに載せない値。条件を外した項目が "?area=" のように URL に残ると見づらいため
const isEmptyQueryValue = (value) => value === undefined || value === null || value === '' || value === false;
const QUERY_TRUE_VALUE = '1';

/**
 * @param {Record<string, unknown>} params 配列は同じキーの繰り返し、true は "1" にする
 * @returns {string} 先頭に "?" を付けた文字列。条件が無ければ空文字
 */
export function buildQueryString(params) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (isEmptyQueryValue(item)) continue;
      searchParams.append(key, item === true ? QUERY_TRUE_VALUE : String(item));
    }
  }
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

/**
 * 絞り込みのたびに履歴が増えると「戻る」で一覧から出られなくなるため、pushState ではなく replaceState を使う。
 * @param {Record<string, unknown>} params
 * @returns {string} 反映したクエリ文字列（history が使えない環境でも返す）
 */
export function setQueryParams(params) {
  const query = buildQueryString(params);
  const { history, location } = globalThis;
  if (!history || typeof history.replaceState !== 'function' || !location) return query;
  try {
    history.replaceState(history.state, '', `${location.pathname}${query}${location.hash ?? ''}`);
  } catch (error) {
    console.warn('URL に絞り込み条件を反映できませんでした', error);
  }
  return query;
}

/* ---------- 日付・秒数 ---------- */

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** @param {unknown} value @returns {Date|null} */
function toDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string' || value === '') return null;
  const dateOnly = value.match(DATE_ONLY_PATTERN);
  if (dateOnly) {
    // "2026-11-05" を new Date() に渡すと UTC 扱いになり、日本以外のタイムゾーンで前日に見えるため、ローカル日付として組み立てる
    const [year, month, day] = dateOnly.slice(1).map(Number);
    const date = new Date(year, month - 1, day);
    // 2026-02-30 のような存在しない日は Date が翌月に繰り上げてしまうので、組み立て直して一致しなければ不正とする
    const isSameDay = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
    return isSameDay ? date : null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * @param {unknown} value ISO 日付・日時の文字列、または Date
 * @returns {string} 例 "2026年11月5日"。不正な値は空文字
 */
export function formatDate(value) {
  const date = toDate(value);
  if (!date) return '';
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

const SECONDS_PER_MINUTE = 60;

/**
 * @param {unknown} seconds
 * @returns {string} 例 84 → "1分24秒"、60 → "1分"、45 → "45秒"。不正な値は空文字
 */
export function formatDuration(seconds) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return '';
  // 切り上げるのは、60.2秒の動画を「1分」と表示して「60秒以内」の上限に収まっているように見せないため
  const total = Math.ceil(seconds);
  const minutes = Math.floor(total / SECONDS_PER_MINUTE);
  const rest = total % SECONDS_PER_MINUTE;
  if (minutes === 0) return `${rest}秒`;
  return rest === 0 ? `${minutes}分` : `${minutes}分${rest}秒`;
}

const DATE_PART_LENGTH = 2;
const padDatePart = (value) => String(value).padStart(DATE_PART_LENGTH, '0');

/**
 * 締切などの "YYYY-MM-DD" と辞書順で比較できる、ローカル日付のキー。
 * @param {Date} date
 * @returns {string} 例 "2026-11-02"
 */
export function toDateKey(date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

/**
 * @param {unknown} value
 * @returns {boolean} 実在する日付の "YYYY-MM-DD" か（2026-02-30 などは false）
 */
export function isDateOnlyString(value) {
  return typeof value === 'string' && DATE_ONLY_PATTERN.test(value) && toDate(value) !== null;
}
