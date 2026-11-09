// スカウト送信ダイアログ（要件 B-03 / 6.2 スカウト型）。talent.html の「スカウトする」から開く。
// ダイアログの枠（フォーカスの閉じ込め・Esc・閉じたら元のボタンへフォーカスを戻す）は modal.js に任せ、
// ここでは「入力チェックして保存する」処理と入力欄だけを持つ（apply-dialog.js と同じ分け方）。
import { addScout } from '../lib/storage.js';
import { countChars } from '../lib/validation.js';
import { openModal } from './modal.js';
import { hasDOM } from './html-parts.js';

export const SCOUT_SUCCESS_MESSAGE = 'スカウトを送信しました';
// 応募メッセージ（200字）より長めにする。企業は依頼内容や撮影の雰囲気まで書きたいことが多いため
export const SCOUT_MESSAGE_MAX_LENGTH = 400;

const STORAGE_ERROR_MESSAGE = 'スカウトを保存できませんでした。ブラウザの保存領域がいっぱいか、無効になっている可能性があります';
const EMPTY_MESSAGE = 'メッセージを入力してください';
const MESSAGE_PLACEHOLDER = '例：自己紹介動画を拝見しました。新作Web CMの出演をご検討いただけませんか。';
const NO_JOB_LABEL = '指定しない';

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === 'string' && value !== '';

/** @param {string} message 前後の空白を落とした値 @returns {string} エラー文（問題なければ空文字） */
function checkMessage(message) {
  if (message === '') return EMPTY_MESSAGE;
  const length = countChars(message);
  return length > SCOUT_MESSAGE_MAX_LENGTH
    ? `メッセージは${SCOUT_MESSAGE_MAX_LENGTH}文字以内で入力してください（現在${length}文字）`
    : '';
}

/**
 * 入力チェック → 保存。例外は出さず、画面が出し分けられる理由を返す。
 * @param {{ companyId?: unknown, talentId?: unknown, jobId?: unknown, message?: unknown }} input
 * @returns {{ ok: true, scout: object } | { ok: false, reason: 'invalid'|'storage', errors?: Record<string,string> }}
 */
export function submitScout(input) {
  if (!isRecord(input) || !isNonEmptyString(input.companyId) || !isNonEmptyString(input.talentId)) {
    return { ok: false, reason: 'invalid', errors: {} };
  }
  const message = typeof input.message === 'string' ? input.message.trim() : '';
  const error = checkMessage(message);
  if (error) return { ok: false, reason: 'invalid', errors: { message: error } };
  const scout = addScout({
    companyId: input.companyId,
    talentId: input.talentId,
    jobId: isNonEmptyString(input.jobId) ? input.jobId : undefined,
    message,
  });
  return scout ? { ok: true, scout } : { ok: false, reason: 'storage' };
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

/** 関連する案件（任意）。選択肢の文字は textContent で入れる（企業が掲載した案件名を含むため） */
function buildJobField(jobs, id) {
  const field = el('div', 'form-field scout-dialog__field');
  const label = el('label', 'form-field__label', '関連する案件（任意）');
  label.htmlFor = id;
  const select = el('select', 'form-field__input');
  select.id = id;
  select.name = 'jobId';
  select.append(new Option(NO_JOB_LABEL, ''));
  for (const job of jobs) select.append(new Option(job.title, job.id));
  field.append(label, select);
  return { field, select };
}

function buildMessageField(ids) {
  const field = el('div', 'form-field scout-dialog__field');
  const label = el('label', 'form-field__label', 'メッセージ');
  label.htmlFor = ids.input;
  label.append(el('span', 'form-field__required', '必須'));
  const textarea = el('textarea', 'form-field__input');
  textarea.id = ids.input;
  textarea.name = 'message';
  textarea.rows = 5;
  textarea.required = true;
  textarea.placeholder = MESSAGE_PLACEHOLDER;
  textarea.setAttribute('aria-describedby', `${ids.help} ${ids.error}`);
  // maxlength は UTF-16 単位で数えるため使わず、見た目の文字数（countChars）で数えて送信時に伝える（apply-dialog.js と同じ）
  const help = el('p', 'form-field__help');
  help.id = ids.help;
  const error = el('p', 'form-field__error');
  error.id = ids.error;
  error.hidden = true;

  const updateCount = () => {
    const length = countChars(textarea.value.trim());
    // 上限超えは色だけでなく文言でも伝える
    help.textContent = `${length} / ${SCOUT_MESSAGE_MAX_LENGTH}文字${length > SCOUT_MESSAGE_MAX_LENGTH ? '（上限を超えています）' : ''}`;
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
 * スカウト送信ダイアログを開く。送信できたら閉じ、入力不備・保存失敗のときは開いたままにして直せるようにする。
 * @param {{ companyId: string, talentId: string, talentName: string, jobs?: { id: string, title: string }[], onSent?: (scout: object) => void }} options
 *   jobs：自社の募集中の案件（スカウトに添える案件の候補）
 * @returns {ReturnType<typeof openModal>}
 */
export function openScoutDialog({ companyId, talentId, talentName, jobs = [], onSent }) {
  if (!hasDOM()) return null;
  fieldCount += 1;
  const ids = {
    job: `scout-job-${fieldCount}`, input: `scout-message-${fieldCount}`,
    help: `scout-help-${fieldCount}`, error: `scout-error-${fieldCount}`,
  };
  const content = el('div', 'scout-dialog');
  content.append(el('p', 'scout-dialog__lead', `${talentName}さんにスカウトを送ります。依頼したい内容を伝えましょう。`));
  const options = Array.isArray(jobs) ? jobs.filter((job) => isRecord(job) && isNonEmptyString(job.id)) : [];
  const jobField = options.length > 0 ? buildJobField(options, ids.job) : null;
  const { field, textarea, showError } = buildMessageField(ids);
  if (jobField) content.append(jobField.field);
  content.append(field);

  const modal = openModal({
    title: 'スカウトを送る',
    content,
    confirmLabel: '送信する',
    onConfirm: () => {
      const result = submitScout({ companyId, talentId, jobId: jobField?.select.value, message: textarea.value });
      if (result.ok) {
        onSent?.(result.scout);
        return true;
      }
      showError(result.reason === 'storage' ? STORAGE_ERROR_MESSAGE : (result.errors?.message ?? ''));
      textarea.focus();
      return false;
    },
  });
  // メッセージ入力が主な操作なので、開いたら入力欄から始める
  if (modal) textarea.focus();
  return modal;
}
