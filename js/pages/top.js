// トップページ（要件 C-01 / 3.2）。
// 静的な文言（ヒーロー・特徴・利用ステップ・利用者の声・CTA）は index.html に書き、JS が動かなくても読めるようにする。
// ここでは架空データから描く「注目のタレント」「新着案件」と、利用ステップのタブ切替だけを担当する。
// 抽出は DOM に触れない関数として export し、tests/top.test.mjs で検証する。
import { TALENTS } from '../data/talents.js';
import { JOBS } from '../data/jobs.js';
import { COMPANIES } from '../data/companies.js';
import { isJobOpen, sortJobs, JOB_SORT_KEYS } from '../lib/filters.js';
import { mergeJobs } from '../lib/job-list.js';
import { getAddedJobs } from '../lib/storage.js';
import { hasDOM } from '../components/html-parts.js';
import { renderTalentCard } from '../components/talent-card.js';
import { renderJobCard } from '../components/job-card.js';
import { renderSkeleton } from '../components/skeleton.js';
import { renderEmptyState } from '../components/empty-state.js';
import { initTabs } from '../components/tabs.js';

/** 横スクロールで「まだ先がある」と分かりつつ、トップが重くならない人数 */
export const FEATURED_TALENT_LIMIT = 8;
/** 要件 3.2「新着案件（カード4〜6件）」の上限。PC 3列 × 2行で収まる */
export const NEW_JOB_LIMIT = 6;

// スケルトンは実際に並ぶ枚数に近づけ、描画後にレイアウトが大きく跳ねないようにする
const FEATURED_SKELETON_COUNT = 4;

const MESSAGES = Object.freeze({
  noTalents: '注目のタレントは準備中です。一覧からタレントを探してみてください。',
  noJobs: 'いま募集中の新着案件はありません。案件一覧で募集終了の案件も見られます。',
  error: '表示できませんでした。ページを再読み込みしてください。',
  talentsAction: 'タレント一覧を見る',
  jobsAction: '案件一覧を見る',
});

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * 注目のタレント（isFeatured が true の人）を、架空データの並び順のまま上限まで返す。
 * @param {unknown} talents
 * @returns {object[]}
 */
export function selectFeaturedTalents(talents) {
  if (!Array.isArray(talents)) return [];
  return talents.filter((talent) => isRecord(talent) && talent.isFeatured === true).slice(0, FEATURED_TALENT_LIMIT);
}

/**
 * 新着案件：架空案件とデモで追加した案件を合わせ、募集中のものを新着順に上限まで返す。
 * 応募できない案件をトップで勧めないよう、締切切れ・募集終了は除く。
 * @param {unknown} baseJobs
 * @param {unknown} addedJobs storage.js の getAddedJobs() の戻り値
 * @param {{ now?: Date }} [options]
 * @returns {object[]}
 */
export function selectNewJobs(baseJobs, addedJobs, options = {}) {
  const { now = new Date() } = isRecord(options) ? options : {};
  const open = mergeJobs(baseJobs, addedJobs).filter((job) => isJobOpen(job, now));
  return sortJobs(open, JOB_SORT_KEYS.newest, { now }).slice(0, NEW_JOB_LIMIT);
}

/** @param {HTMLElement} container @param {number} [count] */
function showSkeleton(container, count) {
  container.setAttribute('aria-busy', 'true');
  const skeleton = renderSkeleton(count);
  if (skeleton) container.replaceChildren(skeleton);
}

/**
 * 1セクション分の描画。失敗しても他のセクションやページ全体を巻き込まないよう、ここで例外を受け止める。
 * @param {HTMLElement} container
 * @param {() => (Element|null)[]} build カード要素の配列を返す
 * @param {{ message: string, actionLabel: string, actionHref: string }} empty
 */
function renderSection(container, build, empty) {
  try {
    const cards = build().filter(Boolean);
    if (cards.length > 0) {
      container.replaceChildren(...cards);
    } else {
      const element = renderEmptyState(empty);
      container.replaceChildren(...(element ? [element] : []));
    }
  } catch (error) {
    console.error('トップページの描画に失敗しました', error);
    const message = document.createElement('p');
    message.className = 'top-page__error';
    message.textContent = MESSAGES.error;
    container.replaceChildren(message);
  } finally {
    container.removeAttribute('aria-busy');
  }
}

function buildTalentCards() {
  return selectFeaturedTalents(TALENTS).map((talent) => renderTalentCard(talent));
}

function buildJobCards() {
  const companyNames = new Map(COMPANIES.map((company) => [company.id, company.name]));
  // デモで追加された案件は別タブで増えることもあるので、表示のたびに読み直す
  return selectNewJobs(JOBS, getAddedJobs()).map((job) => renderJobCard(job, { companyName: companyNames.get(job.companyId) }));
}

function init() {
  const talentList = document.querySelector('[data-featured-talents]');
  const jobList = document.querySelector('[data-new-jobs]');

  initTabs(document.querySelector('[data-step-tabs]'));

  if (talentList instanceof HTMLElement) {
    showSkeleton(talentList, FEATURED_SKELETON_COUNT);
  } else {
    console.error('top.js: 注目のタレントの描画先が見つかりません');
  }
  if (jobList instanceof HTMLElement) {
    showSkeleton(jobList, NEW_JOB_LIMIT);
  } else {
    console.error('top.js: 新着案件の描画先が見つかりません');
  }

  // 結果は次のフレームで差し替える（一覧ページと同じく、将来データ取得が非同期になっても流れを変えずに済むため）
  requestAnimationFrame(() => {
    if (talentList instanceof HTMLElement) {
      renderSection(talentList, buildTalentCards, {
        message: MESSAGES.noTalents, actionLabel: MESSAGES.talentsAction, actionHref: 'talents.html',
      });
    }
    if (jobList instanceof HTMLElement) {
      renderSection(jobList, buildJobCards, {
        message: MESSAGES.noJobs, actionLabel: MESSAGES.jobsAction, actionHref: 'jobs.html',
      });
    }
  });
}

// テスト（Node）から抽出関数だけを読み込めるよう、DOM がある環境でだけ描画を始める
if (hasDOM()) init();
