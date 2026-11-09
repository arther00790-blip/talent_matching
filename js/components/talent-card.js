// タレントカード。写真を主役にし、自己紹介動画がある人には「▶ 動画あり」バッジを付ける（要件 3.3 / 6.6）。
// 描画は「エスケープ済み HTML を返す純粋関数」と「要素にする薄いラッパー」に分け、前者を node:test で検証する。
import { escapeHTML } from '../lib/utils.js';
import {
  isPlainObject, formatRoles, toSafeHref, videoBadgeHTML, chipListHTML, toStringArray, htmlToElement,
} from './html-parts.js';

const DETAIL_PAGE = 'talent.html';
const META_SEPARATOR = ' / ';
// カードが縦長になりすぎないよう、スキルは先頭の数件だけ見せる（全件は詳細ページで見せる）
const MAX_VISIBLE_SKILLS = 3;

// 写真が無い架空データ用のシルエット。外部画像を使わず、色は currentColor でトークンに従わせる
const PLACEHOLDER_SVG = `<svg class="talent-card__placeholder-icon" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
<circle cx="32" cy="24" r="12" fill="currentColor"/>
<path d="M10 60c0-12 10-20 22-20s22 8 22 20z" fill="currentColor"/>
</svg>`;

/** @param {Record<string, unknown>} talent @param {string} name */
function mediaHTML(talent, name) {
  const [firstImage] = toStringArray(talent.images);
  const visual = firstImage
    ? `<img class="talent-card__image" src="${escapeHTML(firstImage)}" alt="${escapeHTML(name)}さんのプロフィール写真" loading="lazy" decoding="async">`
    : `<div class="talent-card__placeholder">${PLACEHOLDER_SVG}</div>`;
  const badge = talent.introVideo ? `<span class="talent-card__badges">${videoBadgeHTML()}</span>` : '';
  return `<div class="card__media talent-card__media">${visual}${badge}</div>`;
}

/**
 * @param {unknown} talent 要件定義書 4.4 の Talent
 * @param {{ href?: string }} [options] href を省略すると talent.html?id=… へリンクする
 * @returns {string} エスケープ済みの HTML。不正な引数なら空文字
 */
export function talentCardHTML(talent, options = {}) {
  if (!isPlainObject(talent)) return '';
  const name = String(talent.displayName ?? '');
  const href = options?.href ?? `${DETAIL_PAGE}?id=${encodeURIComponent(String(talent.id ?? ''))}`;
  const meta = [formatRoles(talent.roles), talent.ageRange, talent.area]
    .filter((part) => typeof part === 'string' && part !== '')
    .map(escapeHTML)
    .join(META_SEPARATOR);
  const skills = toStringArray(talent.skills).slice(0, MAX_VISIBLE_SKILLS);

  // カード全体をクリック可能にしつつ、リンク名は名前だけにするため、見出し内のリンクを ::after で広げる
  return `<article class="card talent-card">
  ${mediaHTML(talent, name)}
  <div class="card__body talent-card__body">
    <h3 class="talent-card__name"><a class="card__link" href="${escapeHTML(toSafeHref(href))}">${escapeHTML(name)}</a></h3>
    ${meta ? `<p class="talent-card__meta">${meta}</p>` : ''}
    ${chipListHTML(skills, 'talent-card__skills cluster')}
  </div>
</article>`;
}

/**
 * タレントカードの要素を作る（ページ側で append する）。
 * @param {unknown} talent
 * @param {{ href?: string }} [options]
 * @returns {Element|null} DOM が無い環境・不正な引数では null
 */
export function renderTalentCard(talent, options) {
  const html = talentCardHTML(talent, options);
  return html ? htmlToElement(html) : null;
}
