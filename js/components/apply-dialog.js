// 応募ボタンと応募ダイアログ（要件 T-05 / 6.6）。
// ダイアログの枠（フォーカスの閉じ込め・Esc・閉じたら元のボタンへフォーカスを戻す）は modal.js に任せ、
// ここでは「押せるかどうか」「送信して保存する」「一言メッセージの入力欄」だけを持つ。
import { addApplication, hasApplied } from '../lib/storage.js';
import { validateApplication, countChars, APPLICATION_MESSAGE_MAX_LENGTH } from '../lib/validation.js';
import { openModal } from './modal.js';
import { hasDOM } from './html-parts.js';

export const APPLY_SUCCESS_MESSAGE = '応募しました！いい知らせが届きますように';
/** 応募できるのはタレントとして見ているときだけ（デモ用タレント本人として応募する） */
export const APPLY_ROLE = 'talent';

const LABELS = Object.freeze({ apply: 'この案件に応募する', applied: '応募済み', closed: '募集終了' });
const REASONS = Object.freeze({
  guest: 'ゲストのままでは応募できません。タレントに切り替えると応募できます',
  company: '企業として閲覧中のため応募できません。タレントに切り替えると応募できます',
  applied: 'この案件には応募済みです。選考の状況はマイページで確認できます',
  closed: 'この案件の募集は終了しました',
});
const STORAGE_ERROR_MESSAGE = '応募を保存できませんでした。ブラウザの保存領域がいっぱいか、無効になっている可能性があります';
const MESSAGE_PLACEHOLDER = '例：朝のシーン、自然な笑顔でがんばります！';

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === 'string' && value !== '';

/**
 * 応募ボタンの表示。無効のときは理由を文章で返し、画面に必ず出す（色やグレーアウトだけで伝えない）。
 * 応募済みは募集終了より優先する（締切後に見返したときも「応募した」事実のほうが大事なため）。
 * @param {{ role?: unknown, applied?: boolean, open?: boolean }} [input]
 * @returns {{ enabled: boolean, label: string, reason: string }}
 */
export function getApplyState({ role, applied = false, open = true } = {}) {
  const isTalent = role === APPLY_ROLE;
  if (isTalent && applied) return { enabled: false, label: LABELS.applied, reason: REASONS.applied };
  if (!open) return { enabled: false, label: LABELS.closed, reason: REASONS.closed };
  if (!isTalent) return { enabled: false, label: LABELS.apply, reason: role === 'company' ? REASONS.company : REASONS.guest };
  return { enabled: true, label: LABELS.apply, reason: '' };
}

/**
 * 入力チェック → 重複確認 → 保存。例外は出さず、画面が出し分けられる理由を返す。
 * @param {{ jobId?: unknown, talentId?: unknown, message?: unknown }} input
 * @returns {{ ok: true, application: object } | { ok: false, reason: 'invalid'|'duplicate'|'storage', errors?: Record<string,string> }}
 */
export function submitApplication(input) {
  if (!isRecord(input) || !isNonEmptyString(input.jobId) || !isNonEmptyString(input.talentId)) {
    return { ok: false, reason: 'invalid', errors: {} };
  }
  const { jobId, talentId } = input;
  const message = typeof input.message === 'string' ? input.message.trim() : '';
  const { valid, errors } = validateApplication({ message });
  if (!valid) return { ok: false, reason: 'invalid', errors };
  if (hasApplied(jobId, talentId)) return { ok: false, reason: 'duplicate' };

  const application = addApplication({ jobId, talentId, message });
  if (application) return { ok: true, application };
  // addApplication は重複でも保存失敗でも null なので、どちらだったかを確かめ直す（別タブで応募した場合など）
  return { ok: false, reason: hasApplied(jobId, talentId) ? 'duplicate' : 'storage' };
}

/* ---------- DOM ---------- */

let fieldCount = 0;

/** @param {string} tag @param {string} [className] @param {string} [text] */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * 応募ボタン。無効でも disabled 属性は使わず aria-disabled にする。
 * disabled だとフォーカスできず、ダイアログを閉じたあと（応募済みに変わったボタン）へフォーカスを戻せないうえ、
 * キーボード利用者が無効の理由にたどり着けなくなるため。
 * @param {HTMLElement} slot
 * @param {ReturnType<typeof getApplyState>} state
 * @param {() => void} onApply
 * @returns {{ button: HTMLButtonElement, update: (state: ReturnType<typeof getApplyState>) => void } | null}
 */
export function renderApplyButton(slot, state, onApply) {
  if (!hasDOM() || !(slot instanceof HTMLElement)) return null;
  fieldCount += 1;
  const reasonId = `apply-reason-${fieldCount}`;
  const button = el('button', 'button button--primary button--lg apply-button');
  button.type = 'button';
  const reason = el('p', 'apply-button__reason');
  reason.id = reasonId;

  let current = state;
  const update = (next) => {
    current = next;
    button.textContent = next.label;
    button.setAttribute('aria-disabled', String(!next.enabled));
    reason.textContent = next.reason;
    reason.hidden = next.reason === '';
    if (next.reason) button.setAttribute('aria-describedby', reasonId);
    else button.removeAttribute('aria-describedby');
  };
  button.addEventListener('click', () => {
    if (current.enabled && typeof onApply === 'function') onApply();
  });

  update(state);
  slot.append(button, reason);
  return { button, update };
}

function buildMessageField() {
  fieldCount += 1;
  const ids = { input: `apply-message-${fieldCount}`, help: `apply-help-${fieldCount}`, error: `apply-error-${fieldCount}` };
  const field = el('div', 'form-field apply-dialog__field');
  const label = el('label', 'form-field__label', 'ひとことメッセージ');
  label.htmlFor = ids.input;
  label.append(el('span', 'form-field__required', '必須'));
  const textarea = el('textarea', 'form-field__input apply-dialog__message');
  textarea.id = ids.input;
  textarea.name = 'message';
  textarea.rows = 4;
  textarea.required = true;
  textarea.placeholder = MESSAGE_PLACEHOLDER;
  textarea.setAttribute('aria-describedby', `${ids.help} ${ids.error}`);
  // maxlength 属性は UTF-16 の単位で数えるため絵文字で早く止まってしまう。見た目の文字数で数える countChars に合わせ、上限は送信時に伝える
  const help = el('p', 'form-field__help apply-dialog__count');
  help.id = ids.help;
  const error = el('p', 'form-field__error');
  error.id = ids.error;
  error.hidden = true;

  const updateCount = () => {
    const length = countChars(textarea.value.trim());
    const over = length > APPLICATION_MESSAGE_MAX_LENGTH;
    // 上限超えは色だけでなく文言でも伝える
    help.textContent = `${length} / ${APPLICATION_MESSAGE_MAX_LENGTH}文字${over ? '（上限を超えています）' : ''}`;
    help.classList.toggle('apply-dialog__count--over', over);
  };
  const showError = (message) => {
    error.textContent = message;
    error.hidden = !message;
    textarea.setAttribute('aria-invalid', String(Boolean(message)));
  };
  textarea.addEventListener('input', () => {
    updateCount();
    if (!error.hidden) showError('');
  });
  updateCount();
  field.append(label, textarea, help, error);
  return { field, textarea, showError };
}

/**
 * 応募ダイアログを開く。送信に成功・重複したら閉じ、入力不備や保存失敗のときは開いたままにして直せるようにする。
 * @param {{ jobId: string, talentId: string, jobTitle: string, onApplied?: (application: object) => void, onDuplicate?: () => void }} options
 * @returns {ReturnType<typeof openModal>}
 */
export function openApplyDialog({ jobId, talentId, jobTitle, onApplied, onDuplicate }) {
  if (!hasDOM()) return null;
  const content = el('div', 'apply-dialog');
  content.append(el('p', 'apply-dialog__job', `「${jobTitle}」に応募します。企業に向けて、ひとことメッセージを添えてください。`));
  const { field, textarea, showError } = buildMessageField();
  content.append(field);

  const modal = openModal({
    title: '案件に応募する',
    content,
    confirmLabel: '応募する',
    onConfirm: () => {
      const result = submitApplication({ jobId, talentId, message: textarea.value });
      if (result.ok) {
        onApplied?.(result.application);
        return true;
      }
      if (result.reason === 'duplicate') {
        onDuplicate?.();
        return true;
      }
      showError(result.reason === 'storage' ? STORAGE_ERROR_MESSAGE : (result.errors?.message ?? ''));
      textarea.focus();
      return false;
    },
  });
  // showModal は先頭のフォーカス可能要素（入力欄）にフォーカスするが、ブラウザ差で迷わないよう明示する
  if (modal) textarea.focus();
  return modal;
}
