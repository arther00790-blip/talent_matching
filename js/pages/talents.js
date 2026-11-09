// タレント一覧ページ（要件 T-01 / B-02 / 6.5）。
// 絞り込み状態は URL のクエリを正本にし、リロード・URL 共有で同じ結果を再現できるようにする。
import { TALENTS } from '../data/talents.js';
import { filterTalents } from '../lib/filters.js';
import { getQueryParams, setQueryParams } from '../lib/utils.js';
import { renderSidebar } from '../components/sidebar.js';
import {
  renderTalentFilter, parseTalentFilters, talentFiltersToParams, EMPTY_TALENT_FILTERS,
} from '../components/talent-filter.js';
import { renderTalentCard } from '../components/talent-card.js';
import { renderSkeleton } from '../components/skeleton.js';
import { renderEmptyState } from '../components/empty-state.js';

const FILTER_PANEL_ID = 'talent-filter-panel';
const FILTER_TITLE = '絞り込み';
const EMPTY_MESSAGE = '条件に合うタレントが見つかりませんでした。';
const RELAX_LABEL = '条件をゆるめて探す';
const RENDER_ERROR_MESSAGE = 'タレントを表示できませんでした。ページを再読み込みしてください。';

const grid = document.querySelector('[data-talent-results]');
const countText = document.querySelector('[data-talent-count]');

let state = parseTalentFilters(getQueryParams());
let filter = null;
let trigger = null;

/** @param {number} matched @param {number} total */
function countLabel(matched, total) {
  return matched === total ? `${total}人のタレント` : `${total}人中 ${matched}人が条件に合います`;
}

// スマホではフィルターが閉じているので、開かなくても条件が掛かっていることをボタンで分かるようにする
function updateTriggerLabel() {
  if (!trigger) return;
  const active = Object.keys(talentFiltersToParams(state)).length;
  trigger.textContent = active > 0 ? `${FILTER_TITLE}（${active}）` : FILTER_TITLE;
}

function resetFilters() {
  state = { ...EMPTY_TALENT_FILTERS, skills: [] };
  filter?.setState(state);
  update();
  // 押したボタンは再描画で消えるため、フォーカスが迷子にならないよう結果の先頭へ移す
  grid.querySelector('a')?.focus();
}

function renderResults() {
  const results = filterTalents(TALENTS, state);
  const cards = results.map((talent) => renderTalentCard(talent)).filter(Boolean);
  if (cards.length > 0) {
    grid.replaceChildren(...cards);
  } else {
    const empty = renderEmptyState({ message: EMPTY_MESSAGE, actionLabel: RELAX_LABEL, onAction: resetFilters });
    grid.replaceChildren(...(empty ? [empty] : []));
  }
  countText.textContent = countLabel(results.length, TALENTS.length);
}

function update() {
  setQueryParams(talentFiltersToParams(state));
  updateTriggerLabel();
  try {
    renderResults();
  } catch (error) {
    console.error('タレント一覧の描画に失敗しました', error);
    const message = document.createElement('p');
    message.className = 'talents-page__error';
    message.textContent = RENDER_ERROR_MESSAGE;
    grid.replaceChildren(message);
  } finally {
    grid.removeAttribute('aria-busy');
  }
}

function init() {
  if (!(grid instanceof HTMLElement) || !(countText instanceof HTMLElement)) {
    console.error('talents.js: 一覧の描画先が見つかりません');
    return;
  }
  grid.setAttribute('aria-busy', 'true');
  const skeleton = renderSkeleton();
  if (skeleton) grid.replaceChildren(skeleton);

  const slot = document.querySelector('[data-filter-slot]');
  const sidebar = renderSidebar(slot, { id: FILTER_PANEL_ID, title: FILTER_TITLE });
  trigger = sidebar ? slot.querySelector('[data-filter-trigger]') : null;
  filter = renderTalentFilter(sidebar?.body ?? null, state, {
    onChange: (next) => {
      state = next;
      update();
    },
    // スマホのシートは「この条件で見る」で閉じて、すぐ結果を見られるようにする
    onSubmit: () => sidebar?.sheet?.close(),
  });

  // URL にマスタ外の値があった場合も、正規化した状態で URL を書き直してから描画する。
  // 結果は次のフレームで差し替える（将来データ取得が非同期になっても「スケルトン → 結果」の流れを変えずに済むため）
  requestAnimationFrame(update);
}

init();
