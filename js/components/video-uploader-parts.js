// video-uploader.js の部品（要素の取得・一言説明と公開同意の欄・ドロップ領域・削除の確認ダイアログ）。
// 1ファイルが長くなりすぎないよう、登録の流れ（状態管理）とは別にしている。
import { validateVideoMeta, countChars, VIDEO_CAPTION_MAX_LENGTH } from '../lib/validation.js';
import { openModal } from './modal.js';

const DRAG_CLASS = 'video-uploader__drop--active';
const PART_NAMES = Object.freeze({
  notice: 'video-unavailable', current: 'video-current', currentPlayer: 'video-current-player',
  replace: 'video-replace', remove: 'video-delete', form: 'video-form', input: 'video-input',
  drop: 'video-drop', fileName: 'video-file-name', error: 'video-error', preview: 'video-preview',
  previewVideo: 'video-preview-video', caption: 'video-caption', captionCount: 'video-caption-count',
  captionError: 'video-caption-error', agreed: 'video-agreed', agreedError: 'video-agreed-error',
  submit: 'video-submit', submitHint: 'video-submit-hint', cancel: 'video-cancel',
});

/**
 * @param {HTMLElement} root
 * @returns {Record<keyof typeof PART_NAMES, HTMLElement>|null} 1つでも欠けていれば null
 */
export function queryUploaderParts(root) {
  const parts = Object.fromEntries(Object.entries(PART_NAMES).map(([key, name]) => [key, root.querySelector(`[data-${name}]`)]));
  return Object.values(parts).every((part) => part instanceof HTMLElement) ? parts : null;
}

function setFieldError(input, errorEl, message) {
  errorEl.textContent = message ?? '';
  errorEl.hidden = !message;
  input.setAttribute('aria-invalid', String(Boolean(message)));
}

/**
 * 一言説明（任意・40文字）と公開同意（必須）。チェックは validation.js の validateVideoMeta をそのまま使う。
 * @param {ReturnType<typeof queryUploaderParts>} el
 */
export function createMetaFields(el) {
  const updateCount = () => {
    el.captionCount.textContent = `${countChars(el.caption.value.trim())} / ${VIDEO_CAPTION_MAX_LENGTH}文字`;
  };
  el.caption.addEventListener('input', () => {
    updateCount();
    setFieldError(el.caption, el.captionError, '');
  });
  el.agreed.addEventListener('change', () => setFieldError(el.agreed, el.agreedError, ''));
  updateCount();

  return {
    /** エラーを表示し、最初の誤りへフォーカスを移す @returns {{ valid: boolean, caption: string }} */
    validate() {
      const { valid, errors } = validateVideoMeta({ caption: el.caption.value, agreed: el.agreed.checked });
      setFieldError(el.caption, el.captionError, errors.caption);
      setFieldError(el.agreed, el.agreedError, errors.agreed);
      if (!valid) (errors.caption ? el.caption : el.agreed).focus();
      return { valid, caption: el.caption.value.trim() };
    },
    reset() {
      el.caption.value = '';
      el.agreed.checked = false;
      setFieldError(el.caption, el.captionError, '');
      setFieldError(el.agreed, el.agreedError, '');
      updateCount();
    },
  };
}

/**
 * ドラッグ＆ドロップでの選択。キーボードでは同じ領域のファイル選択（label → input）で選べる。
 * @param {HTMLElement} drop @param {(file: File|undefined) => void} onFile
 */
export function bindDropZone(drop, onFile) {
  drop.addEventListener('dragover', (event) => {
    event.preventDefault();
    drop.classList.add(DRAG_CLASS);
  });
  drop.addEventListener('dragleave', () => drop.classList.remove(DRAG_CLASS));
  drop.addEventListener('drop', (event) => {
    // 既定の動作だとブラウザが動画ファイルを開いてページから離れてしまう
    event.preventDefault();
    drop.classList.remove(DRAG_CLASS);
    onFile(event.dataTransfer?.files?.[0]);
  });
}

/** @param {() => Promise<boolean|void>} onConfirm */
export function openDeleteDialog(onConfirm) {
  return openModal({
    title: '自己紹介動画を削除しますか？',
    content: '削除した動画は元に戻せません。タレント詳細ページにも表示されなくなります。',
    confirmLabel: '削除する',
    onConfirm,
  });
}
