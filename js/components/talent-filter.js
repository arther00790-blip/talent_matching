// タレント検索のフィルターフォーム（要件 T-01 / B-02 / 6.5）。
// 絞り込み状態は URL のクエリが正本なので、「クエリ → 状態」の変換でマスタに無い値を落とし、
// 手で書き換えた URL や古い共有リンクでも画面が壊れないようにする。
import { escapeHTML } from '../lib/utils.js';
import { TALENT_ROLES, GENDERS, AGE_RANGES, REGIONS, PREFECTURES, SKILL_TAGS } from '../data/master.js';
import { hasDOM, htmlToFragment } from './html-parts.js';

// 長い文字列を URL に載せ続けると共有リンクが扱いにくくなるため、検索語として現実的な長さで切る
export const KEYWORD_MAX_LENGTH = 100;
// 1文字打つたびに再描画すると入力が重く感じるため、打ち終わりを待ってから絞り込む
export const KEYWORD_DEBOUNCE_MS = 300;

/** @type {Readonly<{role:string,gender:string,ageRange:string,area:string,skills:string[],keyword:string,videoOnly:boolean}>} */
export const EMPTY_TALENT_FILTERS = Object.freeze({
  role: '', gender: '', ageRange: '', area: '', skills: Object.freeze([]), keyword: '', videoOnly: false,
});

const ROLE_VALUES = new Set(TALENT_ROLES.map((item) => item.value));
const GENDER_VALUES = new Set(GENDERS.map((item) => item.value));
const AGE_VALUES = new Set(AGE_RANGES);
const AREA_VALUES = new Set([...REGIONS.map((region) => region.name), ...PREFECTURES]);
const SKILL_VALUES = new Set(SKILL_TAGS);
// utils.js の buildQueryString は true を "1" にするので、それだけを「オン」とみなす
const QUERY_TRUE = '1';

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
/** 同じキーが複数あるときは先頭だけを使う（単一選択の項目に配列が来ても破綻させない） */
const first = (value) => (Array.isArray(value) ? value[0] : value);
const pick = (value, allowed) => {
  const item = first(value);
  return typeof item === 'string' && allowed.has(item) ? item : '';
};

/**
 * クエリ（getQueryParams の戻り値）やフォームの値を、正規化したフィルター状態にする。
 * @param {unknown} params
 * @returns {{role:string,gender:string,ageRange:string,area:string,skills:string[],keyword:string,videoOnly:boolean}}
 */
export function parseTalentFilters(params) {
  if (!isRecord(params)) return { ...EMPTY_TALENT_FILTERS, skills: [] };
  const rawSkills = Array.isArray(params.skills) ? params.skills : [params.skills];
  const keyword = first(params.keyword);
  const videoOnly = first(params.videoOnly);
  return {
    role: pick(params.role, ROLE_VALUES),
    gender: pick(params.gender, GENDER_VALUES),
    ageRange: pick(params.ageRange, AGE_VALUES),
    area: pick(params.area, AREA_VALUES),
    skills: [...new Set(rawSkills.filter((skill) => SKILL_VALUES.has(skill)))],
    keyword: typeof keyword === 'string' ? keyword.trim().slice(0, KEYWORD_MAX_LENGTH) : '',
    videoOnly: videoOnly === true || videoOnly === QUERY_TRUE,
  };
}

/**
 * setQueryParams / buildQueryString に渡す形にする。空の項目は URL に残さない。
 * @param {ReturnType<typeof parseTalentFilters>} state
 * @returns {Record<string, string|string[]|boolean>}
 */
export function talentFiltersToParams(state) {
  const normalized = parseTalentFilters(state);
  const params = {};
  for (const [key, value] of Object.entries(normalized)) {
    const isEmpty = value === '' || value === false || (Array.isArray(value) && value.length === 0);
    if (!isEmpty) params[key] = value;
  }
  return params;
}

/** @param {unknown} state @returns {boolean} 条件が1つも指定されていないか */
export function isTalentFilterEmpty(state) {
  return Object.keys(talentFiltersToParams(state)).length === 0;
}

/* ---------- フォームの HTML（選択肢はすべてマスタ由来。入力値は applyTalentFilterState でプロパティに入れる） ---------- */

const ANY_OPTION = '<option value="">指定なし</option>';
const option = (value, label) => `<option value="${escapeHTML(value)}">${escapeHTML(label)}</option>`;

function selectFieldHTML(id, name, label, optionsHTML) {
  return `<div class="form-field">
  <label class="form-field__label" for="${id}">${label}</label>
  <select class="form-field__input" id="${id}" name="${name}">${ANY_OPTION}${optionsHTML}</select>
</div>`;
}

// 地方名でも選べるようにし、「関東ならどこでも」という探し方に1操作で応える
const areaOptionsHTML = () => REGIONS.map((region) => {
  const prefectures = region.prefectures.length > 1
    ? `${option(region.name, `${region.name}すべて`)}${region.prefectures.map((name) => option(name, name)).join('')}`
    : option(region.prefectures[0], region.prefectures[0]);
  return `<optgroup label="${escapeHTML(region.name)}">${prefectures}</optgroup>`;
}).join('');

const skillChipsHTML = () => SKILL_TAGS.map((skill) => `<label class="chip chip--selectable">
  <input class="chip__input" type="checkbox" name="skills" value="${escapeHTML(skill)}">${escapeHTML(skill)}
</label>`).join('');

/** @returns {string} フィルターフォームの HTML */
export function talentFilterFormHTML() {
  return `<form class="talent-filter" role="search" aria-label="タレントの絞り込み" novalidate>
  <div class="form-field">
    <label class="form-field__label" for="talent-filter-keyword">キーワード</label>
    <input class="form-field__input" type="search" id="talent-filter-keyword" name="keyword"
      maxlength="${KEYWORD_MAX_LENGTH}" placeholder="名前・自己紹介・ジャンルなど" autocomplete="off">
  </div>
  <label class="chip chip--selectable talent-filter__video">
    <input class="chip__input" type="checkbox" name="videoOnly" value="${QUERY_TRUE}"><span aria-hidden="true">▶</span> 動画ありのみ
  </label>
  ${selectFieldHTML('talent-filter-role', 'role', '職種', TALENT_ROLES.map((item) => option(item.value, item.label)).join(''))}
  ${selectFieldHTML('talent-filter-gender', 'gender', '性別', GENDERS.map((item) => option(item.value, item.label)).join(''))}
  ${selectFieldHTML('talent-filter-age', 'ageRange', '年齢帯', AGE_RANGES.map((age) => option(age, age)).join(''))}
  ${selectFieldHTML('talent-filter-area', 'area', '地域', areaOptionsHTML())}
  <fieldset class="talent-filter__group">
    <legend class="form-field__label">スキル（選んだものをすべて持つ人）</legend>
    <div class="cluster talent-filter__chips">${skillChipsHTML()}</div>
  </fieldset>
  <div class="talent-filter__actions">
    <button type="submit" class="button button--primary talent-filter__submit">この条件で見る</button>
    <button type="button" class="button button--ghost" data-filter-clear>条件をクリア</button>
  </div>
</form>`;
}

/* ---------- DOM 操作 ---------- */

/** @param {HTMLFormElement} form @returns {ReturnType<typeof parseTalentFilters>} */
export function readTalentFilterForm(form) {
  const data = new FormData(form);
  return parseTalentFilters({
    role: data.get('role'),
    gender: data.get('gender'),
    ageRange: data.get('ageRange'),
    area: data.get('area'),
    skills: data.getAll('skills'),
    keyword: data.get('keyword'),
    videoOnly: data.get('videoOnly'),
  });
}

/**
 * 値はプロパティで入れる（HTML に埋め込まない）ので、キーワードにタグを書かれても解釈されない。
 * @param {HTMLFormElement} form
 * @param {unknown} state
 */
export function applyTalentFilterState(form, state) {
  const normalized = parseTalentFilters(state);
  const { elements } = form;
  for (const name of ['role', 'gender', 'ageRange', 'area', 'keyword']) {
    const field = elements.namedItem(name);
    if (field) field.value = normalized[name];
  }
  const selected = new Set(normalized.skills);
  for (const input of form.querySelectorAll('input[name="skills"]')) input.checked = selected.has(input.value);
  const video = form.querySelector('input[name="videoOnly"]');
  if (video) video.checked = normalized.videoOnly;
}

/**
 * @param {HTMLElement|null} container sidebar.js の data-filter-body
 * @param {unknown} state 初期状態
 * @param {{ onChange?: (state) => void, onSubmit?: () => void }} [handlers]
 * @returns {{ form: HTMLFormElement, setState: (state: unknown) => void } | null}
 */
export function renderTalentFilter(container, state, { onChange, onSubmit } = {}) {
  if (!hasDOM()) return null;
  if (!(container instanceof HTMLElement)) {
    console.warn('renderTalentFilter: フィルターの差し込み先が見つかりません');
    return null;
  }
  container.replaceChildren(htmlToFragment(talentFilterFormHTML()));
  const form = container.querySelector('form');
  applyTalentFilterState(form, state);

  let timerId;
  const emit = () => {
    clearTimeout(timerId);
    if (typeof onChange !== 'function') return;
    try {
      onChange(readTalentFilterForm(form));
    } catch (error) {
      console.error('絞り込みの反映でエラーが発生しました', error);
    }
  };

  form.addEventListener('change', emit);
  form.addEventListener('input', (event) => {
    if (event.target instanceof HTMLInputElement && event.target.name === 'keyword') {
      clearTimeout(timerId);
      timerId = setTimeout(emit, KEYWORD_DEBOUNCE_MS);
    }
  });
  form.addEventListener('submit', (event) => {
    // ページ遷移で再読み込みさせず、その場で絞り込む（Enter キーでも同じ動きにする）
    event.preventDefault();
    emit();
    if (typeof onSubmit === 'function') onSubmit();
  });
  form.querySelector('[data-filter-clear]')?.addEventListener('click', () => {
    applyTalentFilterState(form, EMPTY_TALENT_FILTERS);
    emit();
  });

  return { form, setState: (next) => applyTalentFilterState(form, next) };
}
