// <dialog> を使った確認・応募ダイアログ。
// ネイティブの showModal() を使うのは、背面の操作無効化・フォーカスの閉じ込め・Esc で閉じる動作を
// ブラウザに任せられ、自前実装の抜け漏れが起きないため。
import { hasDOM } from './html-parts.js';

const DEFAULT_CONFIRM_LABEL = 'OK';
const DEFAULT_CANCEL_LABEL = 'キャンセル';
const TITLE_ID_PREFIX = 'dialog-title-';

// 同じページで複数回開いても aria-labelledby の id が重複しないようにする
let dialogCount = 0;

/**
 * @typedef {Object} ModalOptions
 * @property {string} [title]
 * @property {string|Node} [content]  文字列は textContent で入れる。フォームなどは Node で渡す
 * @property {(dialog: HTMLDialogElement) => (boolean|void|Promise<boolean|void>)} [onConfirm]
 *   false を返すと閉じない（入力チェックで止めたいとき用）
 * @property {string} [confirmLabel]
 * @property {string} [cancelLabel]
 */

/**
 * 既定値の補完（DOM に依存しないのでテストできる）。
 * @param {ModalOptions} [options]
 */
export function resolveModalOptions(options = {}) {
  const { title, content, onConfirm, confirmLabel, cancelLabel } = options ?? {};
  return {
    title: typeof title === 'string' ? title : '',
    content: content ?? '',
    onConfirm: typeof onConfirm === 'function' ? onConfirm : null,
    confirmLabel: confirmLabel || DEFAULT_CONFIRM_LABEL,
    cancelLabel: cancelLabel || DEFAULT_CANCEL_LABEL,
  };
}

/** @param {string} tag @param {string} className @param {string} [text] */
function createElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

/** @param {ReturnType<typeof resolveModalOptions>} options @param {string} titleId */
function buildDialog(options, titleId) {
  const dialog = createElement('dialog', 'dialog');
  dialog.setAttribute('aria-labelledby', titleId);

  const header = createElement('div', 'dialog__header');
  const title = createElement('h2', 'dialog__title', options.title);
  title.id = titleId;
  header.append(title);

  const body = createElement('div', 'dialog__body');
  if (options.content instanceof Node) body.append(options.content);
  else body.append(createElement('p', 'dialog__text', String(options.content)));

  const footer = createElement('div', 'dialog__footer');
  const cancel = createElement('button', 'button button--ghost', options.cancelLabel);
  cancel.type = 'button';
  cancel.dataset.dialogCancel = '';
  const confirm = createElement('button', 'button button--primary', options.confirmLabel);
  confirm.type = 'button';
  confirm.dataset.dialogConfirm = '';
  footer.append(cancel, confirm);

  dialog.append(header, body, footer);
  return { dialog, cancel, confirm };
}

/**
 * ダイアログを開く。閉じると DOM から取り除き、開く前にフォーカスしていた要素へ戻す。
 * @param {ModalOptions} [rawOptions]
 * @returns {{ dialog: HTMLDialogElement, close: () => void } | null} 開けなかったときは null
 */
export function openModal(rawOptions) {
  if (!hasDOM() || !document.body) return null;
  const options = resolveModalOptions(rawOptions);
  // 閉じたあとにキーボード利用者が元の位置を見失わないよう、開く前のフォーカス先を覚えておく
  const returnTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  dialogCount += 1;
  const { dialog, cancel, confirm } = buildDialog(options, `${TITLE_ID_PREFIX}${dialogCount}`);
  if (typeof dialog.showModal !== 'function') {
    console.warn('このブラウザは <dialog> に対応していないため、ダイアログを開けません');
    return null;
  }

  const close = () => {
    if (dialog.open) dialog.close();
  };

  // Esc（cancel イベント）・ボタン・dialog.close() のどれで閉じても、後片付けを1か所で行う
  dialog.addEventListener('close', () => {
    dialog.remove();
    if (returnTarget?.isConnected) returnTarget.focus();
  }, { once: true });

  cancel.addEventListener('click', close);

  confirm.addEventListener('click', async () => {
    if (!options.onConfirm) {
      close();
      return;
    }
    // 非同期処理の途中で二重送信されないよう、終わるまでボタンを押せなくする
    confirm.disabled = true;
    try {
      const result = await options.onConfirm(dialog);
      if (result !== false) close();
    } catch (error) {
      // 失敗時は閉じずに残し、利用者がもう一度試せるようにする
      console.error('ダイアログの確定処理でエラーが発生しました', error);
    } finally {
      confirm.disabled = false;
    }
  });

  // 背面（::backdrop）のクリックでも閉じる。dialog 自体がクリック対象になるのは背面を押したときだけ
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });

  try {
    document.body.append(dialog);
    dialog.showModal();
  } catch (error) {
    console.error('ダイアログを開けませんでした', error);
    dialog.remove();
    return null;
  }
  return { dialog, close };
}
