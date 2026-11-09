// 案件詳細の表示（要件 T-04 / T-08 / 6.6）。
// talent-profile.js と同じく、表示内容を整える純粋関数（toJobDetailView）と textContent だけで組み立てる DOM 描画に分ける。
// 案件名や説明はデモで企業が入力できる値（job-new.html）なので、HTML として解釈させない。
import { GENDERS } from '../data/master.js';
import { isJobOpen } from '../lib/filters.js';
import { getMatchLabel } from '../lib/matching.js';
import { formatDate } from '../lib/utils.js';
import { isPlainObject, toStringArray, formatRoles, hasDOM } from './html-parts.js';
import { formatReward } from './job-card.js';

export const NOT_FOUND_MESSAGE = '案件が見つかりませんでした';
export const VIDEO_WELCOME_TEXT = '自己紹介動画ありを歓迎';

const UNKNOWN_COMPANY = '掲載企業';
const NOT_SPECIFIED = '不問';
const LIST_SEPARATOR = '・';
const GENDER_LABELS = new Map(GENDERS.map((item) => [item.value, item.label]));
const MATCH_TEXT = Object.freeze({ great: '相性◎', good: '相性○' });
const FAVORITE_ICONS = Object.freeze({ on: '★', off: '☆' });

/**
 * @param {unknown} id クエリの id
 * @param {unknown} jobs
 * @returns {{ status: 'ok', job: object, message: '' } | { status: 'not-found', job: null, message: string }}
 */
export function resolveJobDetail(id, jobs) {
  const job = typeof id === 'string' && id !== '' && Array.isArray(jobs)
    ? jobs.find((item) => isPlainObject(item) && item.id === id)
    : undefined;
  return job ? { status: 'ok', job, message: '' } : { status: 'not-found', job: null, message: NOT_FOUND_MESSAGE };
}

/** 6.6「この案件に向いている人」。専用の入力欄は無いので、募集条件から読み手に向けた文に言い換える */
function suitableFor(job, rolesLabel, ageRanges, skills) {
  const items = [];
  if (rolesLabel) items.push(`${rolesLabel}として活動している方、これから挑戦したい方`);
  if (ageRanges.length > 0) items.push(`${ageRanges.join(LIST_SEPARATOR)}の方`);
  if (typeof job.area === 'string' && job.area) items.push(`${job.area}での撮影に参加できる方`);
  items.push(skills.length > 0
    ? `${skills.map((skill) => `「${skill}」`).join('')}を活かしたい方`
    : '特別なスキルは不要です。はじめての方も挑戦しやすい案件です');
  if (typeof job.genre === 'string' && job.genre) items.push(`${job.genre}の現場を経験してみたい方`);
  if (job.videoPreferred === true) items.push('自己紹介動画で雰囲気や声を伝えられる方');
  return items;
}

/**
 * @param {unknown} job
 * @param {{ companies?: unknown, now?: Date }} [options]
 */
export function toJobDetailView(job, { companies, now = new Date() } = {}) {
  if (!isPlainObject(job)) return null;
  const company = Array.isArray(companies) ? companies.find((item) => isPlainObject(item) && item.id === job.companyId) : undefined;
  const rolesLabel = formatRoles(job.requiredRoles);
  const ageRanges = toStringArray(job.ageRanges);
  const skills = toStringArray(job.requiredSkills);
  const text = (value) => (typeof value === 'string' ? value : '');

  return {
    id: text(job.id),
    title: text(job.title),
    genre: text(job.genre),
    companyName: text(company?.name) || UNKNOWN_COMPANY,
    companyDescription: text(company?.description),
    description: text(job.description),
    reward: formatReward(job.reward),
    open: isJobOpen(job, now),
    videoWelcome: job.videoPreferred === true ? VIDEO_WELCOME_TEXT : '',
    conditions: [
      { label: '職種', value: rolesLabel || NOT_SPECIFIED },
      { label: '性別', value: GENDER_LABELS.get(job.gender) ?? NOT_SPECIFIED },
      { label: '年齢', value: ageRanges.join(LIST_SEPARATOR) || NOT_SPECIFIED },
      { label: '地域', value: text(job.area) || NOT_SPECIFIED },
      { label: '必須スキル', value: skills.join(LIST_SEPARATOR) || 'なし' },
    ],
    schedule: [
      { label: '撮影日', value: text(job.shootDates) || '調整中' },
      { label: '応募締切', value: formatDate(job.deadline) || 'なし' },
    ],
    suitableFor: suitableFor(job, rolesLabel, ageRanges, skills),
  };
}

/** @param {boolean} isFavorite @returns {{ pressed: 'true'|'false', icon: string, text: string }} */
export function favoriteButtonView(isFavorite) {
  return { pressed: String(Boolean(isFavorite)), icon: isFavorite ? FAVORITE_ICONS.on : FAVORITE_ICONS.off, text: 'お気に入り' };
}

/* ---------- DOM ---------- */

/** @param {string} tag @param {string} [className] @param {string} [text] */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function section(title, ...children) {
  const wrapper = el('section', 'detail-layout__section job-detail__section');
  wrapper.append(el('h2', 'job-detail__heading', title), ...children);
  return wrapper;
}

function factsList(facts, className) {
  const list = el('dl', className);
  for (const fact of facts) {
    const row = el('div', 'job-facts__row');
    row.append(el('dt', 'job-facts__label', fact.label), el('dd', 'job-facts__value', fact.value));
    list.append(row);
  }
  return list;
}

function badges(view, matchScore) {
  const list = el('div', 'cluster job-detail__badges');
  if (view.genre) list.append(el('span', 'chip chip--sm', view.genre));
  // 「募集終了」は色ではなく文字で伝える（要件 3.5）
  if (!view.open) list.append(el('span', 'badge badge--closed', '募集終了'));
  if (view.videoWelcome) {
    const video = el('span', 'badge badge--video');
    const icon = el('span', '', '▶');
    icon.setAttribute('aria-hidden', 'true');
    video.append(icon, ` ${view.videoWelcome}`);
    list.append(video);
  }
  const label = getMatchLabel(matchScore);
  if (label) list.append(el('span', `badge badge--match-${label}`, `${MATCH_TEXT[label]}（マッチ度 ${Math.round(matchScore)}点）`));
  return list;
}

/**
 * 詳細を描画する。応募・お気に入りボタンは状態が変わるので、ページ側が返り値の枠に差し込む。
 * @param {HTMLElement} container
 * @param {NonNullable<ReturnType<typeof toJobDetailView>>} view
 * @param {{ matchScore?: number }} [options] タレントとして見ているときだけ渡す
 * @returns {{ actions: HTMLElement } | null}
 */
export function renderJobDetail(container, view, { matchScore } = {}) {
  if (!hasDOM() || !(container instanceof HTMLElement) || !view) return null;
  const header = el('header', 'job-detail__header');
  header.append(badges(view, matchScore), el('h1', 'job-detail__title', view.title), el('p', 'job-detail__company', view.companyName));

  const summary = el('aside', 'card job-summary');
  summary.setAttribute('aria-label', '応募の概要');
  const summaryBody = el('div', 'card__body job-summary__body');
  const actions = el('div', 'job-summary__actions');
  summaryBody.append(
    factsList([{ label: '報酬', value: view.reward }, ...view.schedule], 'job-facts job-summary__facts'),
    actions,
  );
  summary.append(summaryBody);

  const suitable = el('ul', 'job-detail__suitable');
  // list-style: none にすると Safari がリストとして読み上げなくなるため、役割を明示する
  suitable.setAttribute('role', 'list');
  suitable.append(...view.suitableFor.map((item) => el('li', 'job-detail__suitable-item', item)));
  const main = el('div', 'job-detail__main');
  main.append(
    section('募集要項', el('p', 'job-detail__text', view.description || '募集要項は準備中です。')),
    section('この案件に向いている人', suitable),
    section('応募条件', factsList(view.conditions, 'job-facts')),
    section('スケジュール・報酬', factsList([...view.schedule, { label: '報酬', value: view.reward }], 'job-facts')),
    section('掲載企業', el('p', 'job-detail__company-name', view.companyName),
      ...(view.companyDescription ? [el('p', 'job-detail__text', view.companyDescription)] : [])),
  );

  container.replaceChildren(header, summary, main);
  return { actions };
}

/**
 * お気に入りボタン（aria-pressed のトグル）。保存は呼び出し側の onToggle が行い、操作後の状態を返す。
 * @param {HTMLElement} slot
 * @param {boolean} isFavorite
 * @param {() => boolean} onToggle
 * @returns {HTMLButtonElement|null}
 */
export function renderFavoriteButton(slot, isFavorite, onToggle) {
  if (!hasDOM() || !(slot instanceof HTMLElement)) return null;
  const button = el('button', 'button button--outline button--lg favorite-button');
  button.type = 'button';
  const icon = el('span', 'favorite-button__icon');
  icon.setAttribute('aria-hidden', 'true');
  const apply = (state) => {
    const view = favoriteButtonView(state);
    button.setAttribute('aria-pressed', view.pressed);
    icon.textContent = view.icon;
  };
  button.append(icon, ` ${favoriteButtonView(isFavorite).text}`);
  apply(isFavorite);
  button.addEventListener('click', () => apply(onToggle()));
  slot.append(button);
  return button;
}
