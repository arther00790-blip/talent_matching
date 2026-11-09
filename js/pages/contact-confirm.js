// お問い合わせ：確認画面（要件 C-02 / 2.5）。下書きを表示し、「送信する」で完了画面へ進む（外部へは送信しない）。
// 下書きの再検証・送信済みの印付けは js/lib/contact-flow.js に任せる。
import { CONTACT_PAGES, resolveConfirmPage, prepareContactSubmission } from '../lib/contact-flow.js';
import { renderStepIndicator } from '../components/step-indicator.js';
import { showToast } from '../components/toast.js';

const STORAGE_ERROR_MESSAGE = 'ブラウザの一時保存が使えないため、送信できませんでした。プライベートブラウズを解除するか、保存領域の設定を確認してください';

const list = document.querySelector('[data-confirm-list]');
const message = document.querySelector('[data-confirm-message]');
const backButton = document.querySelector('[data-confirm-back]');
const sendButton = document.querySelector('[data-confirm-send]');

let sending = false;

function setButtonsDisabled(disabled) {
  backButton.disabled = disabled;
  sendButton.disabled = disabled;
}

/** 入力値は利用者由来なので、必ず textContent で入れる（HTML として解釈させない） */
function renderItems(items) {
  const rows = items.map(({ key, label, value }) => {
    const row = document.createElement('div');
    row.className = `contact__confirm-row contact__confirm-row--${key}`;
    const term = document.createElement('dt');
    term.className = 'contact__confirm-label';
    term.textContent = label;
    const detail = document.createElement('dd');
    detail.className = 'contact__confirm-value';
    detail.textContent = value;
    row.append(term, detail);
    return row;
  });
  list.replaceChildren(...rows);
  list.removeAttribute('aria-busy');
}

/** 下書きが無い・改ざんされているときは入力画面へ。履歴に確認画面を残さないよう replace で移る */
function showOrRedirect() {
  const page = resolveConfirmPage();
  if (page.redirect) {
    window.location.replace(page.redirect);
    return;
  }
  renderItems(page.items);
  sending = false;
  setButtonsDisabled(false);
}

function onSend() {
  if (sending) return;
  sending = true;
  setButtonsDisabled(true);
  const result = prepareContactSubmission();
  if (result.ok) {
    window.location.assign(result.redirect);
    return;
  }
  if (result.reason === 'missing') {
    window.location.replace(result.redirect);
    return;
  }
  sending = false;
  setButtonsDisabled(false);
  message.textContent = STORAGE_ERROR_MESSAGE;
  message.hidden = false;
  showToast(STORAGE_ERROR_MESSAGE, { type: 'error' });
}

function init() {
  if (!(list instanceof HTMLElement) || !(message instanceof HTMLElement)
    || !(backButton instanceof HTMLButtonElement) || !(sendButton instanceof HTMLButtonElement)) {
    console.error('contact-confirm.js: 描画先が見つかりません');
    return;
  }
  try {
    renderStepIndicator(document.querySelector('[data-step-indicator]'), 'confirm');
    backButton.addEventListener('click', () => {
      setButtonsDisabled(true);
      window.location.assign(CONTACT_PAGES.input);
    });
    sendButton.addEventListener('click', onSend);
    showOrRedirect();
    // 完了画面から「戻る」でキャッシュ（bfcache）から表示されたときは、下書きが消えているので判定し直す
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) showOrRedirect();
    });
  } catch (error) {
    console.error('確認画面の表示に失敗しました', error);
    window.location.replace(CONTACT_PAGES.input);
  }
}

init();
