// 企業用マイページ（要件 B-04 / B-03 / B-01）：応募者一覧・送信したスカウト・掲載中の案件。
// データの抽出と並び順は js/lib/mypage-data.js で済ませ、ここでは描画だけを行う。
import { formatDate } from '../lib/utils.js';
import { STATUS_KINDS } from '../lib/status.js';
import { renderJobCard } from './job-card.js';
import { el, detailLink, section, emptyState, statusBadge, itemCard, itemList, statusActions } from './mypage-parts.js';

const TALENT_PAGE = 'talent.html';
const TALENTS_PAGE = 'talents.html';
const JOB_NEW_PAGE = 'job-new.html';
const UNKNOWN_TALENT = '（退会したタレント）';

/**
 * @typedef {Object} CompanyMypageData
 * @property {object[]} applications 自社案件への応募（新しい順）
 * @property {object[]} scouts       自社が送ったスカウト（新しい順）
 * @property {object[]} jobs         自社の募集中の案件
 * @property {Map<string, object>} jobsById
 * @property {Map<string, string>} talentNames
 * @property {string} companyName
 */

/** タレント名。データが見つからなくても応募・スカウトの記録自体は見せる */
function talentNameNode(data, talentId) {
  const name = data.talentNames.get(talentId);
  return name ? detailLink(TALENT_PAGE, talentId, name) : document.createTextNode(UNKNOWN_TALENT);
}

function applicantsSection(data, onAdvance) {
  const root = section('mypage-applicants', '応募者一覧', '自社の案件に届いた応募です。選考の状況に合わせてステータスを進めてください（応募済 → 選考中 → 採用／見送り）。');
  if (data.applications.length === 0) {
    root.append(emptyState('まだ応募はありません。案件を掲載するか、タレントを探してスカウトしてみましょう。', 'タレントを探す', TALENTS_PAGE));
    return root;
  }
  root.append(itemList(data.applications, (application) => {
    const name = data.talentNames.get(application.talentId) ?? UNKNOWN_TALENT;
    const job = data.jobsById.get(application.jobId);
    return itemCard({
      id: application.id,
      title: talentNameNode(data, application.talentId),
      badge: statusBadge(STATUS_KINDS.application, application.status),
      facts: [['案件', job ? String(job.title ?? '') : ''], ['応募日', formatDate(application.createdAt)]],
      message: String(application.message ?? ''),
      actions: statusActions(STATUS_KINDS.application, application, `${name}さんの応募`, onAdvance),
    });
  }));
  return root;
}

function scoutsSection(data) {
  const root = section('mypage-sent-scouts', '送信したスカウト', 'ステータスは、タレントが読む・返信すると進みます。');
  if (data.scouts.length === 0) {
    root.append(emptyState('まだスカウトを送っていません。タレント詳細の「スカウトする」から送れます。', 'タレントを探す', TALENTS_PAGE));
    return root;
  }
  root.append(itemList(data.scouts, (scout) => {
    const job = data.jobsById.get(scout.jobId);
    return itemCard({
      id: scout.id,
      title: talentNameNode(data, scout.talentId),
      badge: statusBadge(STATUS_KINDS.scout, scout.status),
      facts: [['案件', job ? String(job.title ?? '') : '指定なし'], ['送信日', formatDate(scout.createdAt)]],
      message: String(scout.message ?? ''),
    });
  }));
  return root;
}

function jobsSection(data) {
  const root = section('mypage-company-jobs', '掲載中の案件');
  const action = el('a', 'button button--primary mypage__section-action', '案件を掲載する');
  action.href = JOB_NEW_PAGE;
  root.append(action);
  const cards = data.jobs.map((job) => renderJobCard(job, { companyName: data.companyName })).filter(Boolean);
  if (cards.length === 0) {
    root.append(emptyState('募集中の案件はありません。'));
    return root;
  }
  const grid = el('div', 'mypage__grid');
  grid.append(...cards);
  root.append(grid);
  return root;
}

/**
 * @param {HTMLElement} container
 * @param {CompanyMypageData} data
 * @param {{ onAdvance: (kind: string, id: string, to: string) => void }} handlers
 */
export function renderCompanyMypage(container, data, { onAdvance }) {
  container.replaceChildren(applicantsSection(data, onAdvance), scoutsSection(data), jobsSection(data));
}
