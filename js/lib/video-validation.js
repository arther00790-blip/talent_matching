// 自己紹介動画の形式・サイズ・長さのチェック（要件 6.7「チェック条件」）。
// 一言説明・公開同意のチェックは validation.js の validateVideoMeta が担当し、ここでは「ファイルそのもの」だけを見る。
// DOM に依存しない純粋関数にして、境界値をテストで固定する。
import { formatDuration } from './utils.js';

const BYTES_PER_MB = 1024 * 1024;

export const VIDEO_MAX_SIZE_MB = 50;
export const VIDEO_MAX_BYTES = VIDEO_MAX_SIZE_MB * BYTES_PER_MB;
export const VIDEO_MAX_DURATION_SECONDS = 60;

const ACCEPTED_TYPES = Object.freeze(['video/mp4', 'video/webm', 'video/quicktime']);
// Windows では MOV などの MIME タイプが空で渡ってくることがあるため、拡張子でも判定する
const ACCEPTED_EXTENSIONS = Object.freeze(['mp4', 'webm', 'mov']);
const EXTENSION_PATTERN = /\.([a-z0-9]+)$/i;

/** <input type="file"> の accept 属性。HTML 側と同じ値をテストで確かめる */
export const VIDEO_ACCEPT = ACCEPTED_TYPES.join(',');

export const VIDEO_ERRORS = Object.freeze({
  format: '対応している形式は MP4・WebM・MOV です',
  load: 'この動画は読み込めませんでした。別のファイルでお試しください',
});

const OK = Object.freeze({ valid: true, code: '', error: '' });
const fail = (code, error) => ({ valid: false, code, error });

/**
 * 切り上げるのは、50MB を少し超えたファイルを「50MB」と表示して上限内に見せないため。
 * @param {number} bytes
 * @returns {string} 例 "72MB"
 */
export function formatSizeMB(bytes) {
  return `${Math.ceil(bytes / BYTES_PER_MB)}MB`;
}

/** @param {{ name?: unknown, type?: unknown }} file */
export function isAcceptedVideoFile(file) {
  if (typeof file !== 'object' || file === null) return false;
  const type = typeof file.type === 'string' ? file.type : '';
  if (type !== '') return ACCEPTED_TYPES.includes(type);
  const match = typeof file.name === 'string' ? file.name.match(EXTENSION_PATTERN) : null;
  return Boolean(match) && ACCEPTED_EXTENSIONS.includes(match[1].toLowerCase());
}

/**
 * 選択直後に分かる項目（形式 → サイズ）のチェック。形式を先にするのは、形式が違えばサイズを直しても登録できないため。
 * @param {{ name?: string, type?: string, size?: number }} file File / Blob
 * @returns {{ valid: boolean, code: ''|'format'|'size', error: string }}
 */
export function validateVideoFile(file) {
  if (!isAcceptedVideoFile(file)) return fail('format', VIDEO_ERRORS.format);
  const { size } = file;
  if (typeof size !== 'number' || !Number.isFinite(size) || size < 0) return fail('format', VIDEO_ERRORS.format);
  if (size > VIDEO_MAX_BYTES) {
    return fail('size', `ファイルサイズは${VIDEO_MAX_SIZE_MB}MBまでです（選択：${formatSizeMB(size)}）`);
  }
  return OK;
}

/**
 * loadedmetadata で取れた duration のチェック。長さが取れない動画は再生もできないので読込失敗として伝える。
 * @param {unknown} duration 秒
 * @returns {{ valid: boolean, code: ''|'duration'|'load', error: string }}
 */
export function validateVideoDuration(duration) {
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 0) return fail('load', VIDEO_ERRORS.load);
  if (duration > VIDEO_MAX_DURATION_SECONDS) {
    return fail('duration', `動画は${VIDEO_MAX_DURATION_SECONDS}秒以内にしてください（選択：${formatDuration(duration)}）`);
  }
  return OK;
}
