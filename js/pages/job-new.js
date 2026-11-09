// 案件掲載ページ（要件 B-01 / 6.2 応募型の起点）。企業として見ているときだけフォームを出す。
// 判断部分（ロールの出し分け・Job 型への変換・保存）は js/lib/job-form.js、入力チェックは validation.js に任せる。
import { GENRES, TALENT_ROLES, GENDERS, AGE_RANGES, REGIONS, SKILL_TAGS, REWARD_UNITS } from '../data/master.js';
import { getRole } from '../lib/storage.js';
import { countChars, JOB_LIMITS } from '../lib/validation.js';
import { toDateKey } from '../lib/utils.js';
import { getJobPostAccess, createJobPost, JOB_POSTED_REDIRECT } from '../lib/job-form.js';
import { ROLE_CHANGE_EVENT } from '../components/header.js';
import { showToast } from '../components/toast.js';

const PLACEHOLDER_LABEL = '選択してください';
const NO_GENDER_LABEL = '指定なし（性別不問）';
// 案件の募集条件として「回答しない」は意味を持たないため、性別の選択肢から外す
const EXCLUDED_GENDER = 'unspecified';
const SAVE_ERROR_MESSAGE = '案件を保存できませんでした。ブラウザの保存領域がいっぱいか、無効になっている可能性があります';
// validateJob が返すエラーのキー。画面の上から順に並べ、最初のエラー欄へフォーカスを移すのに使う
const FIELD_ORDER = Object.freeze([
  'title', 'genre', 'requiredRoles', 'gender', 'ageRanges', 'area', 'shootDates', 'reward', 'requiredSkills', 'description', 'deadline',
]);
const COUNTED_FIELDS = Object.freeze({ title: JOB_LIMITS.titleMax, description: JOB_LIMITS.descriptionMax });
const MULTI_FIELDS = Object.freeze(['requiredRoles', 'ageRanges', 'requiredSkills']);

const gate = document.querySelector('[data-job-new-gate]');
const form = document.querySelector('[data-job-form]');
const summary = form?.querySelector('[data-form-summary]');

let initialized = false;

/** 選択肢の文字はマスタ由来だが、ほかの画面と同じく textContent（Option のテキスト）で入れる */
function fillSelect(select, items, placeholder) {
  const options = items.map(({ value, label }) => new Option(label, value));
  if (placeholder !== undefined) options.unshift(new Option(placeholder, ''));
  select.replaceChildren(...options);
}

function fillAreaSelect(select) {
  const groups = REGIONS.map((region) => {
    const group = document.createElement('optgroup');
    group.label = region.name;
    group.append(...region.prefectures.map((name) => new Option(name, name)));
    return group;
  });
  select.replaceChildren(new Option(PLACEHOLDER_LABEL, ''), ...groups);
}

function fillChips(container, name, items) {
  container.replaceChildren(...items.map(({ value, label }) => {
    const chip = document.createElement('label');
    chip.className = 'chip chip--selectable';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'chip__input';
    input.name = name;
    input.value = value;
    chip.append(input, label);
    return chip;
  }));
}

const asItems = (values) => values.map((value) => ({ value, label: value }));

function renderOptions() {
  const slot = (key) => form.querySelector(`[data-options="${key}"]`);
  fillSelect(slot('genre'), asItems(GENRES), PLACEHOLDER_LABEL);
  fillSelect(slot('gender'), GENDERS.filter((item) => item.value !== EXCLUDED_GENDER), NO_GENDER_LABEL);
  fillAreaSelect(slot('area'));
  fillSelect(slot('rewardUnit'), REWARD_UNITS.map((unit) => ({ value: unit, label: `／${unit}` })));
  fillChips(slot('requiredRoles'), 'requiredRoles', TALENT_ROLES);
  fillChips(slot('ageRanges'), 'ageRanges', asItems(AGE_RANGES));
  fillChips(slot('requiredSkills'), 'requiredSkills', asItems(SKILL_TAGS));
  // 過去日は選べないようにする（validateJob でも同じ条件で確かめる）
  form.querySelector('[name="deadline"]').min = toDateKey(new Date());
}

function setError(name, message) {
  const error = form.querySelector(`[data-field-error="${name}"]`);
  if (error) {
    error.textContent = message ?? '';
    error.hidden = !message;
  }
  form.querySelector(`[data-field="${name}"]`)?.setAttribute('aria-invalid', String(Boolean(message)));
}

function readForm() {
  const data = new FormData(form);
  const raw = Object.fromEntries(
    ['title', 'genre', 'gender', 'area', 'shootDates', 'rewardMin', 'rewardMax', 'rewardUnit', 'description', 'deadline']
      .map((key) => [key, String(data.get(key) ?? '')]),
  );
  for (const key of MULTI_FIELDS) raw[key] = data.getAll(key).map(String);
  raw.videoPreferred = data.get('videoPreferred') === 'on';
  return raw;
}

/** 最初のエラー欄へ移す。チェックボックスの組（fieldset）は中の最初の入力へ */
function focusField(name) {
  const field = form.querySelector(`[data-field="${name}"]`);
  const target = field instanceof HTMLFieldSetElement ? field.querySelector('input, select') : field;
  target?.focus();
}

function setupCounters() {
  for (const [name, max] of Object.entries(COUNTED_FIELDS)) {
    const input = form.querySelector(`[data-field="${name}"]`);
    const count = form.querySelector(`[data-count-for="${name}"]`);
    if (!input || !count) continue;
    const update = () => {
      const length = countChars(input.value.trim());
      // 上限超えは色だけでなく文言でも伝える
      count.textContent = `${length} / ${max}文字${length > max ? '（上限を超えています）' : ''}`;
    };
    input.addEventListener('input', update);
    update();
  }
}

function onSubmit(event) {
  event.preventDefault();
  const result = createJobPost(readForm());
  if (result.ok) {
    // 遷移先は入力値に依存しない固定の URL（新着順にして掲載した案件を先頭に出す）
    window.location.assign(JOB_POSTED_REDIRECT);
    return;
  }
  if (result.reason === 'storage') {
    showToast(SAVE_ERROR_MESSAGE, { type: 'error' });
    return;
  }
  const invalid = FIELD_ORDER.filter((name) => result.errors[name]);
  for (const name of FIELD_ORDER) setError(name, result.errors[name]);
  summary.textContent = `入力内容を確認してください（${invalid.length}件の項目に誤りがあります）`;
  summary.hidden = false;
  if (invalid.length > 0) focusField(invalid[0]);
}

/** ロール切替はページを再読み込みしないので、そのたびに出し分ける。フォームの準備は最初に掲載できたときだけ */
function applyAccess(role) {
  const access = getJobPostAccess(role);
  gate.textContent = access.message;
  gate.hidden = access.canPost;
  form.hidden = !access.canPost;
  if (!access.canPost || initialized) return;
  initialized = true;
  renderOptions();
  setupCounters();
  form.addEventListener('submit', onSubmit);
}

function init() {
  if (!(gate instanceof HTMLElement) || !(form instanceof HTMLFormElement) || !(summary instanceof HTMLElement)) {
    console.error('job-new.js: 描画先が見つかりません');
    return;
  }
  try {
    applyAccess(getRole());
    document.addEventListener(ROLE_CHANGE_EVENT, (event) => {
      try {
        applyAccess(event.detail?.role ?? getRole());
      } catch (error) {
        console.error('案件掲載フォームの表示を切り替えられませんでした', error);
      }
    });
  } catch (error) {
    console.error('案件掲載ページの準備に失敗しました', error);
  }
}

init();
