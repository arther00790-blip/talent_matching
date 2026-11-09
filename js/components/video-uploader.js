// 自己紹介動画の選択・チェック・プレビュー・登録・差し替え・削除（要件 T-09 / 6.7）。
// マークアップは profile-edit.html の [data-video-uploader] にあり、ここでは状態に応じて表示を切り替えるだけにする。
// 文言はすべて textContent で入れる（ファイル名などの利用者由来の値を HTML として解釈させないため）。
import { validateVideoFile, validateVideoDuration } from '../lib/video-validation.js';
import { videoStore, VIDEO_STORE_UNAVAILABLE_MESSAGE } from '../lib/video-store.js';
import { getUploaderView } from '../lib/profile-form.js';
import { readVideoDuration } from './video-probe.js';
import { resolveVideoSource, renderVideoPlayer } from './video-player.js';
import { queryUploaderParts, createMetaFields, bindDropZone, openDeleteDialog } from './video-uploader-parts.js';
import { showToast } from './toast.js';

export const VIDEO_SAVED_MESSAGE = '動画を登録しました';
const MESSAGES = Object.freeze({
  unavailable: `${VIDEO_STORE_UNAVAILABLE_MESSAGE}。登録した動画は、このページを開いている間だけ表示されます。`,
  sessionSaved: `${VIDEO_STORE_UNAVAILABLE_MESSAGE}。このページを開いている間だけ表示します`,
  saveFailed: '動画を保存できませんでした。このページを開いている間だけ表示します',
  deleted: '動画を削除しました',
  deleteFailed: '動画を削除できませんでした。時間をおいて、もう一度お試しください',
  checking: '動画を確認しています…',
  submitHint: '条件に合う動画を選ぶと登録できます',
});

/**
 * @param {HTMLElement|null} root
 * @param {{ talentId: string, store?: ReturnType<typeof import('../lib/video-store.js').createVideoStore> }} options
 */
export async function setupVideoUploader(root, { talentId, store = videoStore }) {
  const el = root instanceof HTMLElement ? queryUploaderParts(root) : null;
  if (!el) {
    console.error('video-uploader: 必要な要素が見つかりません');
    return;
  }
  const meta = createMetaFields(el);
  const state = { available: true, stored: null, replacing: false, busy: false, candidate: 'none', file: null, url: '', duration: undefined, token: 0 };
  let player = null;

  const render = () => {
    const view = getUploaderView({ hasStored: Boolean(state.stored), candidate: state.candidate, replacing: state.replacing });
    el.current.hidden = !view.showCurrent;
    el.form.hidden = !view.showPicker;
    el.preview.hidden = !view.showPreview;
    el.cancel.hidden = !state.replacing;
    el.submit.textContent = view.submitLabel;
    el.submit.disabled = !view.canSubmit || state.busy;
    el.submitHint.textContent = state.candidate === 'checking' ? MESSAGES.checking : MESSAGES.submitHint;
    el.submitHint.hidden = view.canSubmit;
  };

  // 前のプレーヤーの destroy() が Blob URL を解放するので、作り直す前に必ず呼ぶ
  const renderCurrent = () => {
    player?.destroy();
    player = null;
    if (!state.stored) return;
    const source = resolveVideoSource({ storedVideo: state.stored, createObjectURL: (blob) => URL.createObjectURL(blob) });
    player = renderVideoPlayer(el.currentPlayer, source, { label: '登録済みの自己紹介動画' });
  };

  const showError = (message) => {
    el.error.textContent = message;
    el.input.setAttribute('aria-invalid', String(Boolean(message)));
  };

  // 選び直したとき・登録後・ページ離脱時に、前のプレビューの Blob URL をメモリから解放する
  const clearCandidate = () => {
    state.token += 1;
    if (state.url) URL.revokeObjectURL(state.url);
    el.previewVideo.removeAttribute('src');
    el.previewVideo.load();
    Object.assign(state, { candidate: 'none', file: null, url: '', duration: undefined });
    el.fileName.hidden = true;
    showError('');
  };

  const handleFile = async (file) => {
    if (!file) return;
    clearCandidate();
    const { token } = state;
    el.fileName.textContent = `選択中：${file.name}`;
    el.fileName.hidden = false;
    const fileCheck = validateVideoFile(file);
    if (!fileCheck.valid) {
      state.candidate = 'invalid';
      showError(fileCheck.error);
      render();
      return;
    }
    state.candidate = 'checking';
    render();
    state.url = URL.createObjectURL(file);
    const duration = await readVideoDuration(el.previewVideo, state.url);
    // 確認中に別のファイルが選ばれていたら、古い結果で上書きしない
    if (token !== state.token) return;
    const durationCheck = validateVideoDuration(duration);
    if (durationCheck.valid) Object.assign(state, { candidate: 'valid', file, duration });
    else {
      state.candidate = 'invalid';
      showError(durationCheck.error);
    }
    render();
  };

  const resetForm = () => {
    clearCandidate();
    meta.reset();
  };

  const submit = async () => {
    if (state.candidate !== 'valid' || state.busy) return;
    const { valid, caption } = meta.validate();
    if (!valid) return;
    state.busy = true;
    render();
    const input = { blob: state.file, caption, duration: state.duration };
    let toast = { message: VIDEO_SAVED_MESSAGE, type: 'success' };
    if (state.available) {
      const result = await store.saveVideo(talentId, input);
      if (result.ok) state.stored = (await store.getVideo(talentId)) ?? input;
      else toast = { message: MESSAGES.saveFailed, type: 'error' };
    } else toast = { message: MESSAGES.sessionSaved, type: 'info' };
    // 保存に失敗しても選んだ動画は失わせず、このページを開いている間は表示しておく
    if (toast.type !== 'success') state.stored = input;
    Object.assign(state, { busy: false, replacing: false });
    resetForm();
    renderCurrent();
    render();
    showToast(toast.message, { type: toast.type });
    el.replace.focus();
  };

  const confirmDelete = () => openDeleteDialog(async () => {
    if (state.available) {
      const result = await store.deleteVideo(talentId);
      if (!result.ok) {
        showToast(MESSAGES.deleteFailed, { type: 'error' });
        return true;
      }
    }
    state.stored = null;
    renderCurrent();
    render();
    showToast(MESSAGES.deleted, { type: 'success' });
    // 押した削除ボタンは消えるので、ダイアログが閉じてから動画の選択欄へフォーカスを移す
    setTimeout(() => el.input.focus(), 0);
    return true;
  });

  el.input.addEventListener('change', () => {
    const file = el.input.files?.[0];
    // 同じファイルを選び直しても change が来るよう、値を空に戻しておく（File 自体は手元に残る）
    el.input.value = '';
    handleFile(file);
  });
  bindDropZone(el.drop, handleFile);
  el.form.addEventListener('submit', (event) => {
    event.preventDefault();
    submit().catch((error) => {
      console.error('動画の登録に失敗しました', error);
      state.busy = false;
      render();
    });
  });
  el.replace.addEventListener('click', () => {
    state.replacing = true;
    render();
    el.input.focus();
  });
  el.cancel.addEventListener('click', () => {
    state.replacing = false;
    resetForm();
    render();
    el.replace.focus();
  });
  el.remove.addEventListener('click', confirmDelete);
  window.addEventListener('pagehide', () => {
    clearCandidate();
    player?.destroy();
    player = null;
    render();
  });
  // bfcache から戻ったときは、pagehide で解放した登録済み動画を作り直す
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) renderCurrent();
  });

  render();
  const availability = await store.checkAvailability();
  state.available = availability.available;
  el.notice.textContent = state.available ? '' : MESSAGES.unavailable;
  el.notice.hidden = state.available;
  if (state.available) state.stored = await store.getVideo(talentId);
  renderCurrent();
  render();
}
