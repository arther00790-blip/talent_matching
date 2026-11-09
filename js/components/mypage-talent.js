// タレント用マイページ（要件 T-06 / T-07 / 6.6）：動画未登録の案内・届いたスカウト・応募履歴・おすすめ案件。
// データの抽出と並び順は js/lib/mypage-data.js・recommend.js で済ませ、ここでは描画だけを行う。
import { formatDate } from '../lib/utils.js';
import { STATUS_KINDS } from '../lib/status.js';
import { renderJobCard } from './job-card.js';
import { el, detailLink, section, emptyState, statusBadge, itemCard, itemList, statusActions } from './mypage-parts.js';

const PROFILE_EDIT_PAGE = 'profile-edit.html';
const JOBS_PAGE = 'jobs.html';
const JOB_PAGE = 'job.html';
const VIDEO_NOTICE = '自己紹介動画を追加すると見つけてもらいやすくなります';
const UNKNOWN_JOB = '（掲載が終了した案件）';
const UNKNOWN_COMPANY = '（不明な企業）';

/**
 * @typedef {Object} TalentMypageData
 * @property {object[]} applications  本人の応募（新しい順）
 * @property {object[]} scouts        本人宛のスカウト（新しい順）
 * @property {{ job: object, matchScore: number }[]} recommendations
 * @property {Map<string, object>} jobsById
 * @property {Map<string, string>} companyNames
 */

/** 案件名。案件データが見つからなくても応募・スカウトの記録自体は見せる */
function jobTitleNode(jobsById, jobId) {
  const job = jobsById.get(jobId);
  return job ? detailLink(JOB_PAGE, job.id, String(job.title ?? '')) : document.createTextNode(UNKNOWN_JOB);
}

function scoutsSection(data, onAdvance) {
  const root = section('mypage-scouts', '届いたスカウト', '企業からのスカウトです。読んだら「既読にする」、返事をしたら「返信済みにする」を押してください（デモ）。');
  if (data.scouts.length === 0) {
    root.append(emptyState('まだスカウトは届いていません。自己紹介動画やプロフィールを充実させると届きやすくなります。', 'プロフィールを編集する', PROFILE_EDIT_PAGE));
    return root;
  }
  root.append(itemList(data.scouts, (scout) => {
    const company = data.companyNames.get(scout.companyId) ?? UNKNOWN_COMPANY;
    const job = data.jobsById.get(scout.jobId);
    return itemCard({
      id: scout.id,
      title: document.createTextNode(`${company}からのスカウト`),
      badge: statusBadge(STATUS_KINDS.scout, scout.status),
      facts: [['届いた日', formatDate(scout.createdAt)], ['案件', job ? String(job.title ?? '') : '']],
      message: String(scout.message ?? ''),
      actions: statusActions(STATUS_KINDS.scout, scout, `${company}からのスカウト`, onAdvance),
    });
  }));
  return root;
}

function applicationsSection(data) {
  const root = section('mypage-applications', '応募履歴');
  if (data.applications.length === 0) {
    root.append(emptyState('まだ応募した案件はありません。気になる案件を探してみましょう。', '案件を探す', JOBS_PAGE));
    return root;
  }
  root.append(itemList(data.applications, (application) => {
    const job = data.jobsById.get(application.jobId);
    return itemCard({
      id: application.id,
      title: jobTitleNode(data.jobsById, application.jobId),
      badge: statusBadge(STATUS_KINDS.application, application.status),
      facts: [['企業', job ? data.companyNames.get(job.companyId) ?? '' : ''], ['応募日', formatDate(application.createdAt)]],
      message: String(application.message ?? ''),
    });
  }));
  return root;
}

function recommendSection(data) {
  const root = section('mypage-recommend', 'おすすめ案件', 'あなたのプロフィールとの相性（マッチ度）が高い順に、募集中の案件を表示しています。');
  const cards = data.recommendations
    .map(({ job, matchScore }) => renderJobCard(job, { matchScore, companyName: data.companyNames.get(job.companyId) }))
    .filter(Boolean);
  if (cards.length === 0) {
    root.append(emptyState('いまおすすめできる募集中の案件はありません。', '案件を探す', JOBS_PAGE));
    return root;
  }
  const grid = el('div', 'mypage__grid');
  grid.append(...cards);
  root.append(grid);
  return root;
}

/**
 * @param {HTMLElement} container
 * @param {TalentMypageData} data
 * @param {{ onAdvance: (kind: string, id: string, to: string) => void }} handlers
 * @returns {{ videoSlot: HTMLElement }} 動画の有無は IndexedDB を読んでから分かるので、案内の枠だけ先に返す
 */
export function renderTalentMypage(container, data, { onAdvance }) {
  const videoSlot = el('div', 'mypage__notice-slot');
  videoSlot.hidden = true;
  container.replaceChildren(videoSlot, scoutsSection(data, onAdvance), applicationsSection(data), recommendSection(data));
  return { videoSlot };
}

/**
 * 動画未登録の案内（6.6）。登録済みなら枠ごと隠す。
 * @param {HTMLElement} slot
 * @param {boolean} hasVideo
 */
export function renderVideoNotice(slot, hasVideo) {
  slot.hidden = hasVideo;
  if (hasVideo) {
    slot.replaceChildren();
    return;
  }
  const notice = el('div', 'mypage__notice');
  notice.append(el('p', 'mypage__notice-text', VIDEO_NOTICE));
  const link = el('a', 'button button--primary', '動画を登録する');
  link.href = PROFILE_EDIT_PAGE;
  notice.append(link);
  slot.replaceChildren(notice);
}
