// タレント詳細ページ（要件 T-02 / T-10 / 6.6 / 6.7「表示」）。
// 文字はすべて textContent で入れる（talent-profile.js / video-player.js 側で createElement して組み立てる）。
import { TALENTS, DEMO_TALENT_ID } from '../data/talents.js';
import { JOBS } from '../data/jobs.js';
import { DEMO_COMPANY_ID } from '../data/companies.js';
import { getQueryParams } from '../lib/utils.js';
import { getRole, getProfile, getAddedJobs } from '../lib/storage.js';
import { videoStore } from '../lib/video-store.js';
import { resolveDemoTalent, mergeJobs } from '../lib/job-list.js';
import { selectCompanyJobs } from '../lib/mypage-data.js';
import { ROLE_CHANGE_EVENT } from '../components/header.js';
import { openScoutDialog, SCOUT_SUCCESS_MESSAGE } from '../components/scout-dialog.js';
import { renderEmptyState } from '../components/empty-state.js';
import { showToast } from '../components/toast.js';
import {
  resolveTalentDetail, toTalentProfileView, renderTalentProfile, renderTalentGallery, renderScoutAction,
} from '../components/talent-profile.js';
import { resolveVideoSource, loadStoredIntroVideo, renderVideoPlayer } from '../components/video-player.js';


const SITE_NAME = 'StageLink';
const LIST_PAGE = 'talents.html';
const SCOUT_ROLE = 'company';
const NOT_FOUND_HINT = 'URL が正しいか確認するか、一覧から探してみてください。';
const BACK_LABEL = 'タレント一覧へ戻る';
const RENDER_ERROR_MESSAGE = 'プロフィールを表示できませんでした。ページを再読み込みしてください。';

const body = document.querySelector('[data-talent-detail]');

let player = null;

function renderNotFound(message) {
  const heading = document.createElement('h1');
  heading.className = 'talent-detail__title';
  heading.textContent = message;
  const empty = renderEmptyState({ message: NOT_FOUND_HINT, actionLabel: BACK_LABEL, actionHref: LIST_PAGE });
  body.replaceChildren(heading, ...(empty ? [empty] : []));
  body.classList.add('talent-detail--not-found');
  document.title = `${message} | ${SITE_NAME}`;
}

/**
 * 動画の読み込み（IndexedDB）は非同期なので、枠だけ先に写真の上へ置き、並び順を固定しておく。
 * @param {HTMLElement} slot
 * @param {object} talent
 * @param {string} name
 */
async function setupVideo(slot, talent, name) {
  const stored = await loadStoredIntroVideo(talent.id, videoStore);
  const source = resolveVideoSource({
    talent,
    storedVideo: stored,
    createObjectURL: (blob) => URL.createObjectURL(blob),
  });
  player = renderVideoPlayer(slot, source, { label: `${name}さんの自己紹介動画` });
  // 動画が無いタレントは、空の枠で余白が空かないよう枠ごと隠す
  slot.hidden = !player;
}

function renderDetail(talent) {
  const view = toTalentProfileView(talent, getRole());
  const media = body.querySelector('[data-talent-media]');
  const info = body.querySelector('[data-talent-info]');
  if (!view || !(media instanceof HTMLElement) || !(info instanceof HTMLElement)) {
    throw new Error('詳細ページの描画先が見つかりません');
  }
  document.title = `${view.name} | ${SITE_NAME}`;

  const videoSlot = document.createElement('div');
  videoSlot.className = 'talent-detail__video';
  media.replaceChildren(videoSlot);
  renderTalentGallery(media, view);

  const actions = renderTalentProfile(info, view);
  // スカウトはデモ用企業（DEMO_COMPANY_ID）として送る。添える案件の候補は自社の募集中の案件
  const onScout = () => openScoutDialog({
    companyId: DEMO_COMPANY_ID,
    talentId: talent.id,
    talentName: view.name,
    jobs: selectCompanyJobs(mergeJobs(JOBS, getAddedJobs()), DEMO_COMPANY_ID)
      .map((job) => ({ id: job.id, title: String(job.title ?? '') })),
    onSent: () => showToast(SCOUT_SUCCESS_MESSAGE, { type: 'success' }),
  });
  renderScoutAction(actions, view.canScout, onScout);
  // ロール切替はページを再読み込みしないので、スカウトの枠だけ出し直す
  document.addEventListener(ROLE_CHANGE_EVENT, (event) => {
    renderScoutAction(actions, event.detail?.role === SCOUT_ROLE, onScout);
  });

  const showVideo = () => setupVideo(videoSlot, talent, view.name).catch((error) => {
    console.error('自己紹介動画を表示できませんでした', error);
    videoSlot.hidden = true;
  });
  showVideo();

  // ページを離れるときに Blob URL を解放する。bfcache から戻ったときは作り直す
  window.addEventListener('pagehide', () => {
    player?.destroy();
    player = null;
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted && !player) showVideo();
  });
}

function init() {
  if (!(body instanceof HTMLElement)) {
    console.error('talent.js: 詳細の描画先が見つかりません');
    return;
  }
  try {
    // デモ用タレント本人は、プロフィール編集（#07）で保存した自己紹介文・スキルを重ねて表示する
    const talents = TALENTS.map((item) => (item.id === DEMO_TALENT_ID ? resolveDemoTalent(TALENTS, getProfile()) : item));
    const detail = resolveTalentDetail(getQueryParams().id, talents);
    if (detail.status === 'ok') renderDetail(detail.talent);
    else renderNotFound(detail.message);
  } catch (error) {
    console.error('タレント詳細の描画に失敗しました', error);
    const message = document.createElement('p');
    message.className = 'talent-detail__error';
    message.textContent = RENDER_ERROR_MESSAGE;
    body.replaceChildren(message);
  } finally {
    body.removeAttribute('aria-busy');
  }
}

init();
