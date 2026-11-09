// マイページ（要件 T-06 / T-07 / B-04 / 6.3 / 6.6 / 4.5）。ロールで中身を出し分ける。
// 文字はすべて textContent で入れる（mypage-talent.js / mypage-company.js 側で createElement して組み立てる）。
import { JOBS } from '../data/jobs.js';
import { COMPANIES, DEMO_COMPANY_ID } from '../data/companies.js';
import { TALENTS, DEMO_TALENT_ID } from '../data/talents.js';
import { getRole, getApplications, getScouts, getAddedJobs, getProfile } from '../lib/storage.js';
import { mergeJobs, resolveDemoTalent } from '../lib/job-list.js';
import { getRecommendedJobs } from '../lib/recommend.js';
import { getStatusLabel } from '../lib/status.js';
import {
  selectTalentApplications, selectTalentScouts, selectCompanyApplications, selectCompanyScouts, selectCompanyJobs,
  advanceStatus, resetAllDemoData,
} from '../lib/mypage-data.js';
import { videoStore } from '../lib/video-store.js';
import { ROLE_CHANGE_EVENT, DATA_CHANGE_EVENT } from '../components/header.js';
import { showToast } from '../components/toast.js';
import { openModal } from '../components/modal.js';
import { renderTalentMypage, renderVideoNotice } from '../components/mypage-talent.js';
import { renderCompanyMypage } from '../components/mypage-company.js';

const GATE_MESSAGE = 'マイページはタレントまたは企業として表示できます。画面上部の「表示」でロールを切り替えてください。';
const RENDER_ERROR_MESSAGE = 'マイページを表示できませんでした。ページを再読み込みしてください。';
const ADVANCE_ERRORS = Object.freeze({
  'not-found': '対象のデータが見つかりませんでした。表示を最新にしました。',
  'invalid-transition': 'このステータスには進められません（別の画面で更新された可能性があります）。表示を最新にしました。',
  storage: 'ステータスを保存できませんでした。ブラウザの保存領域がいっぱいか、無効になっている可能性があります。',
});
const RESET_MESSAGES = Object.freeze({
  confirm: '応募・スカウト・掲載した案件・お気に入り・プロフィールの編集内容・登録した自己紹介動画をすべて削除し、初期状態に戻します。この操作は取り消せません。',
  done: 'デモデータをリセットしました',
  partial: 'リセットの一部に失敗しました。ページを再読み込みしてもう一度お試しください。',
});

const gate = document.querySelector('[data-mypage-gate]');
const content = document.querySelector('[data-mypage-content]');
const resetButton = document.querySelector('[data-reset-demo]');

const companyNames = new Map(COMPANIES.map((company) => [company.id, company.name]));
const talentNames = new Map(TALENTS.map((talent) => [talent.id, talent.displayName]));

function loadJobs() {
  const jobs = mergeJobs(JOBS, getAddedJobs());
  return { jobs, jobsById: new Map(jobs.map((job) => [job.id, job])) };
}

/** 動画の有無は IndexedDB を読むまで分からないので、ほかの欄を先に出してから案内を差し込む */
async function showVideoNotice(slot) {
  const stored = await videoStore.getVideo(DEMO_TALENT_ID);
  if (slot.isConnected) renderVideoNotice(slot, Boolean(stored));
}

function renderTalent() {
  const { jobs, jobsById } = loadJobs();
  const applications = selectTalentApplications(getApplications(), DEMO_TALENT_ID);
  const talent = resolveDemoTalent(TALENTS, getProfile());
  const recommendations = getRecommendedJobs(jobs, talent, { excludeJobIds: applications.map((item) => item.jobId) });
  const { videoSlot } = renderTalentMypage(content, {
    applications, scouts: selectTalentScouts(getScouts(), DEMO_TALENT_ID), recommendations, jobsById, companyNames,
  }, { onAdvance });
  showVideoNotice(videoSlot).catch((error) => console.warn('自己紹介動画の登録状況を確認できませんでした', error));
}

function renderCompany() {
  const { jobs, jobsById } = loadJobs();
  renderCompanyMypage(content, {
    applications: selectCompanyApplications(getApplications(), jobs, DEMO_COMPANY_ID),
    scouts: selectCompanyScouts(getScouts(), DEMO_COMPANY_ID),
    jobs: selectCompanyJobs(jobs, DEMO_COMPANY_ID),
    jobsById,
    talentNames,
    companyName: companyNames.get(DEMO_COMPANY_ID) ?? '',
  }, { onAdvance });
}

function render(role) {
  try {
    const canView = role === 'talent' || role === 'company';
    gate.textContent = canView ? '' : GATE_MESSAGE;
    gate.hidden = canView;
    content.hidden = !canView;
    if (role === 'talent') renderTalent();
    else if (role === 'company') renderCompany();
    else content.replaceChildren();
  } catch (error) {
    console.error('マイページの描画に失敗しました', error);
    const message = document.createElement('p');
    message.className = 'mypage__error';
    message.textContent = RENDER_ERROR_MESSAGE;
    content.hidden = false;
    content.replaceChildren(message);
  } finally {
    content.removeAttribute('aria-busy');
  }
}

/** 描き直すと押したボタンが消えるので、同じ件のカード（次のボタンがあればそれ）へフォーカスを移す */
function restoreFocus(id) {
  const item = [...content.querySelectorAll('[data-item-id]')].find((node) => node.dataset.itemId === id);
  if (!item) return;
  const next = item.querySelector('button');
  (next ?? item).focus();
}

function onAdvance(kind, id, to) {
  const result = advanceStatus(kind, id, to);
  render(getRole());
  restoreFocus(id);
  if (result.ok) {
    showToast(`ステータスを「${getStatusLabel(kind, result.status)}」にしました`, { type: 'success' });
    // ヘッダーの通知バッジ（未読スカウト・未対応の応募の件数）を更新させる
    document.dispatchEvent(new CustomEvent(DATA_CHANGE_EVENT));
  } else {
    showToast(ADVANCE_ERRORS[result.reason] ?? ADVANCE_ERRORS.storage, { type: 'error' });
  }
}

function onReset() {
  openModal({
    title: 'デモデータをリセットしますか？',
    content: RESET_MESSAGES.confirm,
    confirmLabel: 'リセットする',
    onConfirm: async () => {
      const result = await resetAllDemoData({ store: videoStore });
      // ロールの保存値も消えるので、ヘッダー（ロール選択・バッジ）とマイページを初期状態で描き直す
      document.dispatchEvent(new CustomEvent(DATA_CHANGE_EVENT));
      render(getRole());
      showToast(result.ok ? RESET_MESSAGES.done : RESET_MESSAGES.partial, { type: result.ok ? 'success' : 'error' });
      return true;
    },
  });
}

function init() {
  if (!(gate instanceof HTMLElement) || !(content instanceof HTMLElement) || !(resetButton instanceof HTMLButtonElement)) {
    console.error('mypage.js: 描画先が見つかりません');
    return;
  }
  render(getRole());
  resetButton.addEventListener('click', onReset);
  // ロール切替はページを再読み込みしないので、そのたびに描き直す
  document.addEventListener(ROLE_CHANGE_EVENT, (event) => render(event.detail?.role ?? getRole()));
}

init();
