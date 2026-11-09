// 案件一覧ページ（要件 T-03 / 6.4 / 6.5）。
// talents.js と同じく、絞り込み・並び替えの状態は URL のクエリを正本にし、リロード・URL 共有で同じ結果を再現できるようにする。
import { JOBS } from '../data/jobs.js';
import { COMPANIES } from '../data/companies.js';
import { TALENTS } from '../data/talents.js';
import { JOB_SORT_KEYS } from '../lib/filters.js';
import { getQueryParams, setQueryParams } from '../lib/utils.js';
import { getAddedJobs, getRole, getProfile } from '../lib/storage.js';
import { mergeJobs, buildJobResults, resolveDemoTalent, resolveSortKey, MATCH_ROLE } from '../lib/job-list.js';
import { ROLE_CHANGE_EVENT } from '../components/header.js';
import { renderSidebar } from '../components/sidebar.js';
import {
  renderJobFilter, parseJobFilters, jobFiltersToParams, countJobFilters, EMPTY_JOB_FILTERS,
} from '../components/job-filter.js';
import { renderJobCard } from '../components/job-card.js';
import { renderSkeleton } from '../components/skeleton.js';
import { renderEmptyState } from '../components/empty-state.js';

const FILTER_PANEL_ID = 'job-filter-panel';
const FILTER_TITLE = '絞り込み';
const EMPTY_MESSAGE = '条件に合う案件が見つかりませんでした。';
const RELAX_LABEL = '条件をゆるめて探す';
const RENDER_ERROR_MESSAGE = '案件を表示できませんでした。ページを再読み込みしてください。';
const MATCH_UNAVAILABLE_NOTE = 'マッチ度順はタレントに切り替えると選べます';

const grid = document.querySelector('[data-job-results]');
const countText = document.querySelector('[data-job-count]');
const sortSelect = document.querySelector('[data-job-sort]');
const sortNote = document.querySelector('[data-job-sort-note]');

const companyNames = new Map(COMPANIES.map((company) => [company.id, company.name]));

let state = parseJobFilters(getQueryParams());
let role = getRole();
let filter = null;
let trigger = null;

/** @param {number} matched @param {number} total */
function countLabel(matched, total) {
  return matched === total ? `${total}件の案件` : `${total}件中 ${matched}件が条件に合います`;
}

// スマホではフィルターが閉じているので、開かなくても条件が掛かっていることをボタンで分かるようにする
function updateTriggerLabel() {
  if (!trigger) return;
  const active = countJobFilters(state);
  trigger.textContent = active > 0 ? `${FILTER_TITLE}（${active}）` : FILTER_TITLE;
}

// マッチ度順はタレントのときだけ意味があるので、それ以外では選べなくし、理由を文字で添える
function updateSortControl() {
  const matchOption = sortSelect.querySelector(`option[value="${JOB_SORT_KEYS.match}"]`);
  const canMatch = role === MATCH_ROLE;
  if (matchOption) matchOption.disabled = !canMatch;
  sortSelect.value = resolveSortKey(state.sort, role);
  if (sortNote) {
    sortNote.textContent = canMatch ? '' : MATCH_UNAVAILABLE_NOTE;
    sortNote.hidden = canMatch;
  }
}

function resetFilters() {
  state = { ...EMPTY_JOB_FILTERS, sort: state.sort };
  filter?.setState(state);
  update();
  // 押したボタンは再描画で消えるため、フォーカスが迷子にならないよう結果の先頭へ移す
  grid.querySelector('a')?.focus();
}

function renderResults() {
  // デモで追加された案件は別タブで増えることもあるので、描画のたびに読み直す
  const jobs = mergeJobs(JOBS, getAddedJobs());
  const talent = role === MATCH_ROLE ? resolveDemoTalent(TALENTS, getProfile()) : null;
  const results = buildJobResults(jobs, state, { role, talent });
  const cards = results.map(({ job, closed, matchScore }) => renderJobCard(
    // 締切切れも job-card.js の「募集終了」表示に乗せる（カード側の判定は status だけなので、表示用に写しを渡す）
    closed ? { ...job, status: 'closed' } : job,
    { matchScore, companyName: companyNames.get(job.companyId) },
  )).filter(Boolean);

  if (cards.length > 0) {
    grid.replaceChildren(...cards);
  } else {
    const empty = renderEmptyState({ message: EMPTY_MESSAGE, actionLabel: RELAX_LABEL, onAction: resetFilters });
    grid.replaceChildren(...(empty ? [empty] : []));
  }
  countText.textContent = countLabel(results.length, jobs.length);
}

function update() {
  setQueryParams(jobFiltersToParams(state));
  updateTriggerLabel();
  updateSortControl();
  try {
    renderResults();
  } catch (error) {
    console.error('案件一覧の描画に失敗しました', error);
    const message = document.createElement('p');
    message.className = 'jobs-page__error';
    message.textContent = RENDER_ERROR_MESSAGE;
    grid.replaceChildren(message);
  } finally {
    grid.removeAttribute('aria-busy');
  }
}

function init() {
  if (!(grid instanceof HTMLElement) || !(countText instanceof HTMLElement) || !(sortSelect instanceof HTMLSelectElement)) {
    console.error('jobs.js: 一覧の描画先が見つかりません');
    return;
  }
  grid.setAttribute('aria-busy', 'true');
  const skeleton = renderSkeleton();
  if (skeleton) grid.replaceChildren(skeleton);

  const slot = document.querySelector('[data-filter-slot]');
  const sidebar = renderSidebar(slot, { id: FILTER_PANEL_ID, title: FILTER_TITLE });
  trigger = sidebar ? slot.querySelector('[data-filter-trigger]') : null;
  filter = renderJobFilter(sidebar?.body ?? null, state, {
    getSort: () => state.sort,
    onChange: (next) => {
      state = next;
      update();
    },
    // スマホのシートは「この条件で見る」で閉じて、すぐ結果を見られるようにする
    onSubmit: () => sidebar?.sheet?.close(),
  });

  sortSelect.addEventListener('change', () => {
    state = parseJobFilters({ ...state, sort: sortSelect.value });
    update();
  });
  // ロール切替はページを再読み込みしないので、相性バッジとマッチ度順の可否を出し直す
  document.addEventListener(ROLE_CHANGE_EVENT, (event) => {
    role = event.detail?.role ?? getRole();
    update();
  });

  // 結果は次のフレームで差し替える（将来データ取得が非同期になっても「スケルトン → 結果」の流れを変えずに済むため）
  requestAnimationFrame(update);
}

init();
