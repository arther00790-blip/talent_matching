// 案件検索のフィルターフォーム（要件 T-03 / 6.5）。
// talent-filter.js と同じく URL のクエリを正本にし、「クエリ → 状態」の変換でマスタ・選択肢に無い値を落とす。
// 並び替えはフォームではなく一覧のツールバーで選ぶが、URL で共有できるよう状態には含める。
import { escapeHTML } from '../lib/utils.js';
import { JOB_SORT_KEYS } from '../lib/filters.js';
import { TALENT_ROLES, GENRES, REGIONS, PREFECTURES } from '../data/master.js';
import { hasDOM, htmlToFragment } from './html-parts.js';
import { formatReward } from './job-card.js';

/** 報酬下限の選択肢（円）。自由入力にしないのは、URL に半端な金額が残って共有先で意図が読みにくくなるため */
export const MIN_REWARD_OPTIONS = Object.freeze([10000, 30000, 50000, 100000]);

/** @type {Readonly<{role:string,genre:string,area:string,minReward:string,sort:string}>} */
export const EMPTY_JOB_FILTERS = Object.freeze({
  role: '', genre: '', area: '', minReward: '', sort: JOB_SORT_KEYS.deadline,
});

const ROLE_VALUES = new Set(TALENT_ROLES.map((item) => item.value));
const GENRE_VALUES = new Set(GENRES);
const AREA_VALUES = new Set([...REGIONS.map((region) => region.name), ...PREFECTURES]);
const REWARD_VALUES = new Set(MIN_REWARD_OPTIONS.map(String));
const SORT_VALUES = new Set(Object.values(JOB_SORT_KEYS));
// 並び替えは絞り込み条件ではないので、「条件の数」や「条件なし」の判定から外す
const NON_FILTER_KEYS = new Set(['sort']);

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
/** 同じキーが複数あるときは先頭だけを使う */
const first = (value) => (Array.isArray(value) ? value[0] : value);
const pick = (value, allowed) => {
  const item = first(value);
  return typeof item === 'string' && allowed.has(item) ? item : '';
};

/**
 * クエリやフォームの値を、正規化したフィルター状態にする。
 * @param {unknown} params
 * @returns {{role:string,genre:string,area:string,minReward:string,sort:string}}
 */
export function parseJobFilters(params) {
  if (!isRecord(params)) return { ...EMPTY_JOB_FILTERS };
  const reward = first(params.minReward);
  return {
    role: pick(params.role, ROLE_VALUES),
    genre: pick(params.genre, GENRE_VALUES),
    area: pick(params.area, AREA_VALUES),
    // 数値で渡されても URL 由来の文字列と同じ扱いにする
    minReward: pick(typeof reward === 'number' ? String(reward) : reward, REWARD_VALUES),
    sort: pick(params.sort, SORT_VALUES) || EMPTY_JOB_FILTERS.sort,
  };
}

/**
 * setQueryParams に渡す形にする。空の項目と既定の並び替えは URL に残さない。
 * @param {unknown} state
 * @returns {Record<string, string>}
 */
export function jobFiltersToParams(state) {
  const normalized = parseJobFilters(state);
  const params = {};
  for (const [key, value] of Object.entries(normalized)) {
    if (value !== '' && value !== EMPTY_JOB_FILTERS[key]) params[key] = value;
  }
  return params;
}

/** @param {unknown} state @returns {number} 指定中の絞り込み条件の数（並び替えは含めない） */
export function countJobFilters(state) {
  return Object.keys(jobFiltersToParams(state)).filter((key) => !NON_FILTER_KEYS.has(key)).length;
}

/** @param {unknown} state @returns {boolean} 絞り込み条件が1つも指定されていないか */
export function isJobFilterEmpty(state) {
  return countJobFilters(state) === 0;
}

/* ---------- フォームの HTML（選択肢はすべてマスタ・定数由来） ---------- */

const ANY_OPTION = '<option value="">指定なし</option>';
const option = (value, label) => `<option value="${escapeHTML(value)}">${escapeHTML(label)}</option>`;

function selectFieldHTML(id, name, label, optionsHTML) {
  return `<div class="form-field">
  <label class="form-field__label" for="${id}">${label}</label>
  <select class="form-field__input" id="${id}" name="${name}">${ANY_OPTION}${optionsHTML}</select>
</div>`;
}

// 地方名でも選べるようにし、「関東ならどこでも」という探し方に1操作で応える（タレント検索と同じ）
const areaOptionsHTML = () => REGIONS.map((region) => {
  const prefectures = region.prefectures.length > 1
    ? `${option(region.name, `${region.name}すべて`)}${region.prefectures.map((name) => option(name, name)).join('')}`
    : option(region.prefectures[0], region.prefectures[0]);
  return `<optgroup label="${escapeHTML(region.name)}">${prefectures}</optgroup>`;
}).join('');

// 金額表記は案件カードと同じ formatReward に合わせ、一覧と条件で書き方がずれないようにする
const rewardOptionsHTML = () => MIN_REWARD_OPTIONS
  .map((amount) => option(String(amount), `${formatReward({ min: amount, max: amount })}以上`)).join('');

/** @returns {string} フィルターフォームの HTML */
export function jobFilterFormHTML() {
  return `<form class="job-filter" role="search" aria-label="案件の絞り込み" novalidate>
  ${selectFieldHTML('job-filter-role', 'role', '職種', TALENT_ROLES.map((item) => option(item.value, item.label)).join(''))}
  ${selectFieldHTML('job-filter-genre', 'genre', 'ジャンル', GENRES.map((genre) => option(genre, genre)).join(''))}
  ${selectFieldHTML('job-filter-area', 'area', '地域', areaOptionsHTML())}
  ${selectFieldHTML('job-filter-reward', 'minReward', '報酬下限', rewardOptionsHTML())}
  <div class="job-filter__actions">
    <button type="submit" class="button button--primary job-filter__submit">この条件で見る</button>
    <button type="button" class="button button--ghost" data-filter-clear>条件をクリア</button>
  </div>
</form>`;
}

/* ---------- DOM 操作 ---------- */

const FIELD_NAMES = Object.freeze(['role', 'genre', 'area', 'minReward']);

/**
 * フォームに無い並び替えは、呼び出し側が持っている現在値を引き継ぐ。
 * @param {HTMLFormElement} form
 * @param {string} sort
 */
export function readJobFilterForm(form, sort) {
  const data = new FormData(form);
  return parseJobFilters({ ...Object.fromEntries(FIELD_NAMES.map((name) => [name, data.get(name)])), sort });
}

/** 値はプロパティで入れる（HTML に埋め込まない） @param {HTMLFormElement} form @param {unknown} state */
export function applyJobFilterState(form, state) {
  const normalized = parseJobFilters(state);
  for (const name of FIELD_NAMES) {
    const field = form.elements.namedItem(name);
    if (field) field.value = normalized[name];
  }
}

/**
 * @param {HTMLElement|null} container sidebar.js の data-filter-body
 * @param {unknown} state 初期状態
 * @param {{ getSort?: () => string, onChange?: (state) => void, onSubmit?: () => void }} [handlers]
 * @returns {{ form: HTMLFormElement, setState: (state: unknown) => void } | null}
 */
export function renderJobFilter(container, state, { getSort, onChange, onSubmit } = {}) {
  if (!hasDOM()) return null;
  if (!(container instanceof HTMLElement)) {
    console.warn('renderJobFilter: フィルターの差し込み先が見つかりません');
    return null;
  }
  container.replaceChildren(htmlToFragment(jobFilterFormHTML()));
  const form = container.querySelector('form');
  applyJobFilterState(form, state);

  const emit = () => {
    if (typeof onChange !== 'function') return;
    try {
      onChange(readJobFilterForm(form, typeof getSort === 'function' ? getSort() : EMPTY_JOB_FILTERS.sort));
    } catch (error) {
      console.error('絞り込みの反映でエラーが発生しました', error);
    }
  };

  // 項目はすべてセレクトなので、キーワード入力のような打ち終わり待ち（デバウンス）は要らない
  form.addEventListener('change', emit);
  form.addEventListener('submit', (event) => {
    // ページ遷移で再読み込みさせず、その場で絞り込む（Enter キーでも同じ動きにする）
    event.preventDefault();
    emit();
    if (typeof onSubmit === 'function') onSubmit();
  });
  form.querySelector('[data-filter-clear]')?.addEventListener('click', () => {
    applyJobFilterState(form, EMPTY_JOB_FILTERS);
    emit();
  });

  return { form, setState: (next) => applyJobFilterState(form, next) };
}
