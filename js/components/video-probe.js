// 選んだ動画の長さ（秒）を loadedmetadata で読み取る（要件 6.7「長さ」）。
// 読み取りに使った <video> をそのままプレビューに使い回せるよう、要素は呼び出し側から受け取る。

// 壊れたファイルでは loadedmetadata も error も来ないことがあるため、待つ上限を決めておく
export const VIDEO_PROBE_TIMEOUT_MS = 15000;
// MediaRecorder で作った WebM などは duration が Infinity になる。末尾へシークすると実際の長さが分かる
const SEEK_TO_END = Number.MAX_SAFE_INTEGER;

/**
 * @param {HTMLVideoElement} video
 * @param {string} src オブジェクトURL
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<number>} 長さ（秒）。読めなければ NaN（判定は video-validation.js に任せる）
 */
export function readVideoDuration(video, src, { timeoutMs = VIDEO_PROBE_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    let timer = 0;
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener('loadedmetadata', onMetadata);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('error', onError);
    };
    const finish = (duration) => {
      cleanup();
      resolve(duration);
    };
    function onDurationChange() {
      if (!Number.isFinite(video.duration)) return;
      const { duration } = video;
      // シークした位置のままだと、プレビューが最後のコマから始まってしまう
      video.currentTime = 0;
      finish(duration);
    }
    function onMetadata() {
      if (Number.isFinite(video.duration)) {
        finish(video.duration);
        return;
      }
      video.addEventListener('durationchange', onDurationChange);
      video.currentTime = SEEK_TO_END;
    }
    function onError() {
      finish(Number.NaN);
    }

    timer = setTimeout(() => finish(Number.NaN), timeoutMs);
    video.addEventListener('loadedmetadata', onMetadata);
    video.addEventListener('error', onError);
    try {
      video.preload = 'metadata';
      video.src = src;
      video.load();
    } catch (error) {
      console.warn('動画の長さを読み取れませんでした', error);
      finish(Number.NaN);
    }
  });
}
