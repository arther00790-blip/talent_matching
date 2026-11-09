// スケルトン表示。データ描画前に「カードが並ぶ場所」を先に見せ、レイアウトのガタつきを防ぐ（要件 3.4）。
import { htmlToFragment } from './html-parts.js';

// 一覧の1画面分（スマホ1列〜PC3列×2行）に収まる数
export const DEFAULT_SKELETON_COUNT = 6;
// 誤って大きな数を渡しても DOM が膨れて重くならないよう上限を設ける
export const MAX_SKELETON_COUNT = 24;

const LOADING_TEXT = '読み込み中です';

/** @param {unknown} count @returns {number} */
function normalizeCount(count) {
  if (!Number.isInteger(count) || count < 1) return DEFAULT_SKELETON_COUNT;
  return Math.min(count, MAX_SKELETON_COUNT);
}

const SKELETON_CARD = `<div class="skeleton-card" aria-hidden="true">
  <div class="skeleton skeleton--media"></div>
  <div class="skeleton-card__body">
    <div class="skeleton skeleton--text"></div>
    <div class="skeleton skeleton--text skeleton--short"></div>
  </div>
</div>`;

/**
 * 形だけの箱は読み上げても意味が無いので aria-hidden にし、状態は1つのテキストだけで伝える。
 * テキストは position:absolute の .visually-hidden なので、グリッドのマス目を消費しない。
 * @param {unknown} [count]
 * @returns {string}
 */
export function skeletonHTML(count) {
  const cards = Array.from({ length: normalizeCount(count) }, () => SKELETON_CARD).join('');
  return `<span class="visually-hidden">${LOADING_TEXT}</span>${cards}`;
}

/**
 * 一覧コンテナにそのまま append できる DocumentFragment を返す。
 * ラッパー要素で包まないのは、ページ側のグリッドにカードと同じ形で並べたいため。
 * 呼び出し側は描画中にコンテナへ aria-busy="true" を付け、描画後に外す。
 * @param {unknown} [count]
 * @returns {DocumentFragment|null} DOM が無い環境では null
 */
export function renderSkeleton(count) {
  return htmlToFragment(skeletonHTML(count));
}
