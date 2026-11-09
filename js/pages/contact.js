// お問い合わせ：入力画面（要件 C-02 / 2.5）。HTML の required 等を基本に、欄を離れたとき・入力中にエラー文を出す。
// 判断部分（変換・入力チェック・下書き保存・復元）は js/lib/contact-flow.js に任せ、ここは DOM の読み書きだけを行う。
import { CONTACT_CATEGORIES } from '../data/master.js';
import { validateContact, countChars, CONTACT_LIMITS } from '../lib/validation.js';
import { CONTACT_FIELD_ORDER, toContactInput, submitContactInput, getRestoreValues, resolvePresetCategory } from '../lib/contact-flow.js';
import { getQueryParams } from '../lib/utils.js';
import { renderStepIndicator } from '../components/step-indicator.js';
import { showToast } from '../components/toast.js';

const STORAGE_ERROR_MESSAGE = 'ブラウザの一時保存が使えないため、確認画面へ進めませんでした。プライベートブラウズを解除するか、保存領域の設定を確認してください';
const TEXT_FIELDS = Object.freeze(['name', 'email', 'company', 'category', 'body']);
// 文字数の状態が切り替わったときだけ読み上げる文言（1文字ごとに読み上げると入力の邪魔になるため）
const COUNT_STATUS_TEXT = Object.freeze({
  empty: '',
  short: `お問い合わせ内容が${CONTACT_LIMITS.bodyMin}文字に足りません`,
  ok: '文字数の条件を満たしました',
  over: `お問い合わせ内容が${CONTACT_LIMITS.bodyMax}文字を超えています`,
});

const form = document.querySelector('[data-contact-form]');
const summary = form?.querySelector('[data-form-summary]');
const submitButton = form?.querySelector('[data-contact-submit]');

// 一度エラーを見せた欄だけ入力中に再チェックする（打ち始めた途端に「入力してください」と出さないため）
const touched = new Set();
let submitting = false;

const fieldOf = (name) => form.querySelector(`[data-field="${name}"]`);

function setError(name, message) {
  const error = form.querySelector(`[data-field-error="${name}"]`);
  if (error) {
    error.textContent = message ?? '';
    error.hidden = !message;
  }
  fieldOf(name)?.setAttribute('aria-invalid', String(Boolean(message)));
}

function readForm() {
  const data = new FormData(form);
  const raw = Object.fromEntries(TEXT_FIELDS.map((key) => [key, String(data.get(key) ?? '')]));
  raw.agree = fieldOf('agree').checked;
  return raw;
}

function validateField(name) {
  setError(name, validateContact(toContactInput(readForm())).errors[name]);
}

function fillCategories() {
  const select = form.querySelector('[data-category-options]');
  select.append(...CONTACT_CATEGORIES.map(({ value, label }) => new Option(label, value)));
}

function restoreValues() {
  const values = getRestoreValues();
  if (!values) {
    // 確認画面から戻ったときは本人の入力を優先し、URL の種別指定は初回表示のときだけ使う
    const preset = resolvePresetCategory(getQueryParams());
    if (preset) fieldOf('category').value = preset;
    return;
  }
  for (const name of TEXT_FIELDS) fieldOf(name).value = values[name];
  fieldOf('agree').checked = values.agree;
}

const countState = (length) => {
  if (length === 0) return 'empty';
  if (length < CONTACT_LIMITS.bodyMin) return 'short';
  return length > CONTACT_LIMITS.bodyMax ? 'over' : 'ok';
};

function setupCounter() {
  const body = fieldOf('body');
  const count = form.querySelector('[data-count-for="body"]');
  const status = form.querySelector('[data-count-status]');
  let lastState = null;
  const update = () => {
    const length = countChars(body.value.trim());
    const state = countState(length);
    let note = '';
    if (state === 'short') note = `（あと${CONTACT_LIMITS.bodyMin - length}文字）`;
    if (state === 'over') note = '（上限を超えています）';
    count.textContent = `${length} / ${CONTACT_LIMITS.bodyMax}文字${note}`;
    // 初回（ページ表示時・値の復元時）は読み上げない
    if (lastState !== null && state !== lastState) status.textContent = COUNT_STATUS_TEXT[state];
    lastState = state;
  };
  body.addEventListener('input', update);
  update();
}

function setupLiveValidation() {
  for (const name of CONTACT_FIELD_ORDER) {
    const field = fieldOf(name);
    field.addEventListener('blur', () => {
      touched.add(name);
      validateField(name);
    });
    // チェックボックスは input より change のほうが古いブラウザでも確実に届く
    const eventName = field.type === 'checkbox' ? 'change' : 'input';
    field.addEventListener(eventName, () => {
      if (touched.has(name)) validateField(name);
    });
  }
}

function showSummary(message) {
  summary.textContent = message;
  summary.hidden = !message;
}

function finishSubmitting() {
  submitting = false;
  submitButton.disabled = false;
}

function onSubmit(event) {
  // 送信先は持たない。既定の送信（ページ遷移）を必ず止める
  event.preventDefault();
  if (submitting) return;
  submitting = true;
  submitButton.disabled = true;

  const result = submitContactInput(readForm());
  if (result.ok) {
    window.location.assign(result.redirect);
    return;
  }
  finishSubmitting();
  if (result.reason === 'storage') {
    showSummary(STORAGE_ERROR_MESSAGE);
    showToast(STORAGE_ERROR_MESSAGE, { type: 'error' });
    return;
  }
  const invalid = CONTACT_FIELD_ORDER.filter((name) => result.errors[name]);
  for (const name of CONTACT_FIELD_ORDER) {
    touched.add(name);
    setError(name, result.errors[name]);
  }
  showSummary(`入力内容を確認してください（${invalid.length}件の項目に誤りがあります）`);
  if (invalid.length > 0) fieldOf(invalid[0]).focus();
}

function init() {
  if (!(form instanceof HTMLFormElement) || !(summary instanceof HTMLElement) || !(submitButton instanceof HTMLButtonElement)) {
    console.error('contact.js: フォームの要素が見つかりません');
    return;
  }
  try {
    renderStepIndicator(document.querySelector('[data-step-indicator]'), 'input');
    fillCategories();
    restoreValues();
    setupCounter();
    setupLiveValidation();
    form.addEventListener('submit', onSubmit);
    // 確認画面から「戻る」でキャッシュ（bfcache）から表示されたとき、無効化したままのボタンを戻す
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) finishSubmitting();
    });
  } catch (error) {
    console.error('お問い合わせフォームの準備に失敗しました', error);
    showToast('フォームの準備に失敗しました。ページを再読み込みしてください', { type: 'error' });
  }
}

init();
