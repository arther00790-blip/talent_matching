// 自己紹介動画プレーヤー（要件 T-10 / 6.7「表示」）。
// どの動画を流すか（IndexedDB の本人動画か、架空データのサンプルか）の判断は純粋関数に分けてテストし、
// DOM 生成は createElement + プロパティ代入だけで行う（URL や説明文を HTML として解釈させないため）。
import { formatDuration } from '../lib/utils.js';
import { DEMO_TALENT_ID } from '../data/talents.js';
import { hasDOM, isPlainObject, toSafeHref } from './html-parts.js';

const VIDEO_TYPES = Object.freeze({ mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' });
const EXTENSION_PATTERN = /\.([a-z0-9]+)(?:[?#].*)?$/i;
// toSafeHref が危険な URL を置き換える値。これが返ったら「使える URL が無い」とみなす
const UNSAFE_HREF = '#';
// <track> の kind として HTML 仕様で決まっている値
const TRACK_KINDS = new Set(['subtitles', 'captions', 'descriptions', 'chapters', 'metadata']);

const LOAD_ERROR_MESSAGE = '動画を読み込めませんでした。時間をおいて、もう一度お試しください。';
const FALLBACK_MESSAGE = 'お使いのブラウザは動画の再生に対応していません。';

/** @param {unknown} value @returns {string} 安全に使える相対・http(s) URL。無ければ空文字 */
function safeURL(value) {
  const href = toSafeHref(value);
  return href === UNSAFE_HREF ? '' : href;
}

/** @param {unknown} src @returns {string} 拡張子から推定した MIME タイプ。分からなければ空文字 */
export function guessVideoType(src) {
  if (typeof src !== 'string') return '';
  const match = src.match(EXTENSION_PATTERN);
  return match ? VIDEO_TYPES[match[1].toLowerCase()] ?? '' : '';
}

/** Blob そのもの、または { blob, caption, duration } の形を受け付ける（#07 の保存形式に依存しすぎないため） */
function unwrapStored(storedVideo) {
  if (typeof storedVideo !== 'object' || storedVideo === null) return null;
  if ('blob' in storedVideo) {
    return storedVideo.blob ? { blob: storedVideo.blob, caption: storedVideo.caption, duration: storedVideo.duration } : null;
  }
  return 'size' in storedVideo ? { blob: storedVideo } : null;
}

/**
 * @typedef {Object} VideoSource
 * @property {string} src
 * @property {string} type         MIME タイプ（分からなければ空文字）
 * @property {string} poster       サムネイル（無ければ空文字）
 * @property {string} caption
 * @property {number|undefined} duration 秒
 * @property {boolean} isObjectURL  true なら使い終わったら URL.revokeObjectURL が必要
 */

/**
 * 動画ソースの優先順位：IndexedDB の本人動画 → introVideo.src。どちらも無ければ null。
 * @param {{ talent?: unknown, storedVideo?: unknown, createObjectURL?: (blob: unknown) => string }} [input]
 * @returns {VideoSource|null}
 */
export function resolveVideoSource({ talent, storedVideo, createObjectURL } = {}) {
  const intro = isPlainObject(talent) && isPlainObject(talent.introVideo) ? talent.introVideo : null;
  const stored = unwrapStored(storedVideo);

  if (stored && typeof createObjectURL === 'function') {
    try {
      return {
        src: createObjectURL(stored.blob),
        type: typeof stored.blob.type === 'string' ? stored.blob.type : '',
        // 本人が差し替えた動画にサンプルのサムネイルを出すと別の動画に見えるため、ポスターは付けない
        poster: '',
        caption: typeof stored.caption === 'string' ? stored.caption : '',
        duration: Number.isFinite(stored.duration) ? stored.duration : undefined,
        isObjectURL: true,
      };
    } catch (error) {
      console.warn('保存した動画を読み込めませんでした。サンプル動画を表示します', error);
    }
  }

  const src = intro ? safeURL(intro.src) : '';
  if (!src) return null;
  return {
    src,
    type: guessVideoType(src),
    poster: safeURL(intro.poster),
    caption: typeof intro.caption === 'string' ? intro.caption : '',
    duration: Number.isFinite(intro.duration) ? intro.duration : undefined,
    isObjectURL: false,
  };
}

/**
 * IndexedDB の本人動画を読む。#07 の video-store.js の videoStore を store として渡す（省略時は IndexedDB を見ない）。
 * @param {unknown} talentId
 * @param {{ getVideo?: (id: string) => Promise<unknown> }} [store]
 * @returns {Promise<unknown|null>} 失敗しても null（サンプル動画で表示を続けるため）
 */
export async function loadStoredIntroVideo(talentId, store) {
  // 動画を登録できるのはデモ用タレント本人だけなので、他人のページでは IndexedDB を開かない
  if (talentId !== DEMO_TALENT_ID || !store || typeof store.getVideo !== 'function') return null;
  try {
    return (await store.getVideo(talentId)) ?? null;
  } catch (error) {
    console.warn('保存した自己紹介動画を読み込めませんでした', error);
    return null;
  }
}

/** @param {unknown} tracks @returns {{src:string,kind:string,srclang:string,label:string}[]} */
function normalizeTracks(tracks) {
  if (!Array.isArray(tracks)) return [];
  return tracks.filter(isPlainObject).map((track) => ({
    src: safeURL(track.src),
    kind: String(track.kind ?? ''),
    srclang: String(track.srclang ?? ''),
    label: String(track.label ?? ''),
  })).filter((track) => track.src && TRACK_KINDS.has(track.kind));
}

/**
 * <video> に付ける属性。autoplay は付けない（音が突然鳴るのを防ぎ、通信量を利用者に委ねる）。
 * @param {VideoSource|null} source
 * @param {{ tracks?: unknown }} [options] 字幕などの <track>（後から差し込めるようにしておく）
 */
export function videoPlayerSpec(source, { tracks } = {}) {
  if (!isPlainObject(source) || typeof source.src !== 'string' || source.src === '') return null;
  const length = formatDuration(source.duration);
  const caption = [source.caption, length && `（${length}）`].filter(Boolean).join('');
  return {
    attributes: { controls: true, preload: 'metadata', playsinline: true, poster: source.poster ?? '' },
    sources: [{ src: source.src, type: source.type ?? '' }],
    tracks: normalizeTracks(tracks),
    caption,
  };
}

/* ---------- DOM ---------- */

function buildVideo(spec, label, onError) {
  const video = document.createElement('video');
  video.className = 'video-player__video';
  video.controls = true;
  video.preload = spec.attributes.preload;
  video.playsInline = true;
  // 古い iOS Safari はプロパティではなく属性だけを見るため、属性でも付ける
  video.setAttribute('playsinline', '');
  if (spec.attributes.poster) video.poster = spec.attributes.poster;
  video.setAttribute('aria-label', label);

  for (const item of spec.sources) {
    const sourceEl = document.createElement('source');
    sourceEl.src = item.src;
    if (item.type) sourceEl.type = item.type;
    // <source> の読み込み失敗は video ではなく source 側にだけ通知される
    sourceEl.addEventListener('error', onError);
    video.append(sourceEl);
  }
  for (const item of spec.tracks) {
    const track = document.createElement('track');
    Object.assign(track, { src: item.src, kind: item.kind, srclang: item.srclang, label: item.label });
    video.append(track);
  }
  const fallback = document.createElement('p');
  fallback.textContent = FALLBACK_MESSAGE;
  video.append(fallback);
  video.addEventListener('error', onError);
  return video;
}

/**
 * @param {HTMLElement|null} container
 * @param {VideoSource|null} source null ならプレーヤーを出さない
 * @param {{ label?: string, tracks?: unknown }} [options]
 * @returns {{ element: HTMLElement, destroy: () => void } | null}
 */
export function renderVideoPlayer(container, source, { label = '自己紹介動画', tracks } = {}) {
  if (!hasDOM() || !(container instanceof HTMLElement)) return null;
  const spec = videoPlayerSpec(source, { tracks });
  if (!spec) return null;

  const figure = document.createElement('figure');
  figure.className = 'video-player';
  const error = document.createElement('p');
  error.className = 'video-player__error';
  error.hidden = true;

  // ファイルが無い・壊れているときに、黒い枠だけが残って「再生できるのか」迷わせないよう文言で知らせる
  let video = null;
  const onError = () => {
    if (!error.hidden) return;
    figure.classList.add('video-player--error');
    if (video) video.hidden = true;
    error.textContent = LOAD_ERROR_MESSAGE;
    error.hidden = false;
  };
  video = buildVideo(spec, label, onError);
  figure.append(video, error);

  if (spec.caption) {
    const caption = document.createElement('figcaption');
    caption.className = 'video-player__caption';
    caption.textContent = spec.caption;
    figure.append(caption);
  }
  container.append(figure);

  let destroyed = false;
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    video.pause();
    // Blob URL は明示的に解放しないと、ページを閉じるまで動画データがメモリに残る
    if (source.isObjectURL) URL.revokeObjectURL(source.src);
    figure.remove();
  };
  return { element: figure, destroy };
}
