// 案件詳細ページ（要件 T-04 / T-05 / T-08 / 6.6）。
// 文字はすべて textContent で入れる（job-detail.js / apply-dialog.js 側で createElement して組み立てる）。
import { JOBS } from '../data/jobs.js';
import { COMPANIES } from '../data/companies.js';
import { TALENTS, DEMO_TALENT_ID } from '../data/talents.js';
import { calcMatchScore } from '../lib/matching.js';
import { getQueryParams } from '../lib/utils.js';
import { getAddedJobs, getRole, getProfile, hasApplied, getFavorites, toggleFavorite } from '../lib/storage.js';
import { mergeJobs, resolveDemoTalent, MATCH_ROLE } from '../lib/job-list.js';
import { ROLE_CHANGE_EVENT } from '../components/header.js';
import { renderEmptyState } from '../components/empty-state.js';
import { showToast } from '../components/toast.js';
import { resolveJobDetail, toJobDetailView, renderJobDetail, renderFavoriteButton } from '../components/job-detail.js';
import { getApplyState, renderApplyButton, openApplyDialog, APPLY_SUCCESS_MESSAGE } from '../components/apply-dialog.js';

const SITE_NAME = 'StageLink';
const LIST_PAGE = 'jobs.html';
const NOT_FOUND_HINT = 'URL が正しいか確認するか、一覧から探してみてください。';
const BACK_LABEL = '案件一覧へ戻る';
const RENDER_ERROR_MESSAGE = '案件を表示できませんでした。ページを再読み込みしてください。';
const DUPLICATE_MESSAGE = 'この案件には応募済みです。';
const FAVORITE_MESSAGES = Object.freeze({ added: 'お気に入りに追加しました', removed: 'お気に入りから外しました' });
const FAVORITE_ERROR_MESSAGE = 'お気に入りを保存できませんでした。';

const body = document.querySelector('[data-job-detail]');

function showError(error) {
  console.error('案件詳細の描画に失敗しました', error);
  const message = document.createElement('p');
  message.className = 'job-detail__error';
  message.textContent = RENDER_ERROR_MESSAGE;
  body.replaceChildren(message);
}

function renderNotFound(message) {
  const heading = document.createElement('h1');
  heading.className = 'job-detail__title';
  heading.textContent = message;
  const empty = renderEmptyState({ message: NOT_FOUND_HINT, actionLabel: BACK_LABEL, actionHref: LIST_PAGE });
  body.replaceChildren(heading, ...(empty ? [empty] : []));
  body.classList.add('job-detail__body--not-found');
  document.title = `${message} | ${SITE_NAME}`;
}

/** マッチ度はデモ用タレント本人との相性なので、タレントとして見ているときだけ出す */
function matchScoreFor(job, role) {
  if (role !== MATCH_ROLE) return undefined;
  const talent = resolveDemoTalent(TALENTS, getProfile());
  return talent ? calcMatchScore(talent, job) : undefined;
}

/** 応募ボタンの状態はロール・応募履歴・締切で決まるので、変わりうるたびにここで作り直す */
function currentApplyState(job, open, role) {
  return getApplyState({ role, applied: role === MATCH_ROLE && hasApplied(job.id, DEMO_TALENT_ID), open });
}

function setupFavorite(slot, jobId) {
  renderFavoriteButton(slot, getFavorites().includes(jobId), () => {
    const before = getFavorites().includes(jobId);
    const after = toggleFavorite(jobId);
    // toggleFavorite は保存に失敗すると操作前の状態を返すので、変化が無ければ失敗として知らせる
    if (after === before) showToast(FAVORITE_ERROR_MESSAGE, { type: 'error' });
    else showToast(after ? FAVORITE_MESSAGES.added : FAVORITE_MESSAGES.removed, { type: 'info' });
    return after;
  });
}

function renderDetail(job, role) {
  const view = toJobDetailView(job, { companies: COMPANIES });
  if (!view) throw new Error('案件データの形式が正しくありません');
  document.title = `${view.title} | ${SITE_NAME}`;

  const rendered = renderJobDetail(body, view, { matchScore: matchScoreFor(job, role) });
  if (!rendered) throw new Error('詳細ページの描画先が見つかりません');

  let applyButton = null;
  const refreshApply = () => applyButton?.update(currentApplyState(job, view.open, role));
  applyButton = renderApplyButton(rendered.actions, currentApplyState(job, view.open, role), () => {
    openApplyDialog({
      jobId: job.id,
      talentId: DEMO_TALENT_ID,
      jobTitle: view.title,
      // ボタンを「応募済み」に変えてからダイアログが閉じるので、戻ったフォーカス先で新しい状態が読み上げられる
      onApplied: () => {
        refreshApply();
        showToast(APPLY_SUCCESS_MESSAGE, { type: 'success' });
      },
      // 別タブで先に応募していた場合など
      onDuplicate: () => {
        refreshApply();
        showToast(DUPLICATE_MESSAGE, { type: 'info' });
      },
    });
  });
  setupFavorite(rendered.actions, job.id);
}

function init() {
  if (!(body instanceof HTMLElement)) {
    console.error('job.js: 詳細の描画先が見つかりません');
    return;
  }
  try {
    const detail = resolveJobDetail(getQueryParams().id, mergeJobs(JOBS, getAddedJobs()));
    if (detail.status !== 'ok') {
      renderNotFound(detail.message);
      return;
    }
    renderDetail(detail.job, getRole());
    // ロール切替はページを再読み込みしないので、相性バッジと応募ボタンを含めて描き直す。
    // 切替の操作中はフォーカスがヘッダー側にあるため、本文を描き直してもフォーカスは失われない
    document.addEventListener(ROLE_CHANGE_EVENT, (event) => {
      try {
        renderDetail(detail.job, event.detail?.role ?? getRole());
      } catch (error) {
        showError(error);
      }
    });
  } catch (error) {
    showError(error);
  } finally {
    body.removeAttribute('aria-busy');
  }
}

init();
