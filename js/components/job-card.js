// 案件カード。相性バッジの「枠」を常に持ち、matchScore に応じて ◎ / ○ を入れる（要件 6.4）。
// 枠を常に置くのは、#08 のおすすめ表示などで後からスコアを差し込んでもレイアウトがずれないようにするため。
import { escapeHTML } from '../lib/utils.js';
import { getMatchLabel } from '../lib/matching.js';
import { isPlainObject, toSafeHref, htmlToElement } from './html-parts.js';

const DETAIL_PAGE = 'job.html';
const NUMBER_LOCALE = 'ja-JP';
const REWARD_FALLBACK = '応相談';

const MATCH_BADGES = Object.freeze({
  great: { className: 'badge--match-great', text: '相性◎' },
  good: { className: 'badge--match-good', text: '相性○' },
});

/** @param {unknown} reward 4.4 の {min, max, unit} @returns {string} 例 "30,000〜50,000円／日" */
export function formatReward(reward) {
  if (!isPlainObject(reward)) return REWARD_FALLBACK;
  const { min, max, unit } = reward;
  if (!Number.isFinite(min) || !Number.isFinite(max)) return REWARD_FALLBACK;
  const format = (value) => value.toLocaleString(NUMBER_LOCALE);
  const range = min === max ? format(min) : `${format(min)}〜${format(max)}`;
  return `${range}円${unit ? `／${unit}` : ''}`;
}

/** @param {unknown} score */
function matchBadgeHTML(score) {
  const label = getMatchLabel(score);
  if (!label) return '';
  const { className, text } = MATCH_BADGES[label];
  // 記号（◎/○）だけだと意味が伝わりにくいので、読み上げ用に点数も添える
  return `<span class="badge ${className}">${text}<span class="visually-hidden">（マッチ度 ${escapeHTML(Math.round(score))}点）</span></span>`;
}

/** @param {string} term @param {string} valueHTML エスケープ済み */
function detailHTML(term, valueHTML) {
  return `<div class="job-card__detail"><dt>${term}</dt><dd>${valueHTML}</dd></div>`;
}

/**
 * @param {unknown} job 要件定義書 4.4 の Job
 * @param {{ matchScore?: number, companyName?: string, href?: string }} [options]
 * @returns {string} エスケープ済みの HTML。不正な引数なら空文字
 */
export function jobCardHTML(job, options = {}) {
  if (!isPlainObject(job)) return '';
  const { matchScore, companyName, href } = options ?? {};
  const link = href ?? `${DETAIL_PAGE}?id=${encodeURIComponent(String(job.id ?? ''))}`;
  const isClosed = job.status === 'closed';

  const tags = [
    job.genre ? `<span class="chip chip--sm">${escapeHTML(job.genre)}</span>` : '',
    job.videoPreferred ? '<span class="badge badge--video"><span aria-hidden="true">▶</span> 動画歓迎</span>' : '',
    isClosed ? '<span class="badge badge--closed">募集終了</span>' : '',
  ].join('');

  const deadline = job.deadline
    ? `<time datetime="${escapeHTML(job.deadline)}">${escapeHTML(job.deadline)}</time>`
    : '';

  return `<article class="card job-card${isClosed ? ' job-card--closed' : ''}">
  <div class="card__body job-card__body">
    <div class="job-card__top">
      <div class="job-card__tags cluster">${tags}</div>
      <div class="job-card__match">${matchBadgeHTML(matchScore)}</div>
    </div>
    <h3 class="job-card__title"><a class="card__link" href="${escapeHTML(toSafeHref(link))}">${escapeHTML(job.title ?? '')}</a></h3>
    ${companyName ? `<p class="job-card__company">${escapeHTML(companyName)}</p>` : ''}
    <dl class="job-card__details">
      ${job.shootDates ? detailHTML('撮影日', escapeHTML(job.shootDates)) : ''}
      ${job.area ? detailHTML('地域', escapeHTML(job.area)) : ''}
      ${detailHTML('報酬', escapeHTML(formatReward(job.reward)))}
      ${deadline ? detailHTML('締切', deadline) : ''}
    </dl>
  </div>
</article>`;
}

/**
 * 案件カードの要素を作る（ページ側で append する）。
 * @param {unknown} job
 * @param {{ matchScore?: number, companyName?: string, href?: string }} [options]
 * @returns {Element|null} DOM が無い環境・不正な引数では null
 */
export function renderJobCard(job, options) {
  const html = jobCardHTML(job, options);
  return html ? htmlToElement(html) : null;
}
