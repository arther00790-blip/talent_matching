// タレント詳細のプロフィール（要件 T-02 / 6.6）。
// 表示内容を整える純粋関数（toTalentProfileView）と、textContent だけで組み立てる DOM 描画に分ける。
// プロフィール文や実績名はタレント本人が編集できる値（#07）なので、HTML として解釈させない。
import { GENDERS } from '../data/master.js';
import { isPlainObject, toStringArray, formatRoles, toSafeHref, hasDOM, htmlToFragment, videoBadgeHTML } from './html-parts.js';

export const NOT_FOUND_MESSAGE = 'タレントが見つかりませんでした';

const GENDER_LABELS = new Map(GENDERS.map((item) => [item.value, item.label]));
const SNS_LABELS = Object.freeze({ instagram: 'Instagram', x: 'X' });
// toSafeHref が危険な URL を置き換える値。これが返ったら表示しない
const UNSAFE_HREF = '#';
const SCOUT_ROLE = 'company';

/**
 * @param {unknown} id クエリの id（複数指定や未指定もありうる）
 * @param {unknown} talents
 * @returns {{ status: 'ok', talent: object, message: '' } | { status: 'not-found', talent: null, message: string }}
 */
export function resolveTalentDetail(id, talents) {
  const talent = typeof id === 'string' && id !== '' && Array.isArray(talents)
    ? talents.find((item) => isPlainObject(item) && item.id === id)
    : undefined;
  return talent
    ? { status: 'ok', talent, message: '' }
    : { status: 'not-found', talent: null, message: NOT_FOUND_MESSAGE };
}

/** @param {unknown} career @returns {{year:number|null,title:string,type:string}[]} 年の古い順 */
function normalizeCareer(career) {
  if (!Array.isArray(career)) return [];
  return career.filter(isPlainObject)
    .map((item) => ({
      year: Number.isInteger(item.year) ? item.year : null,
      title: String(item.title ?? ''),
      type: String(item.type ?? ''),
    }))
    .filter((item) => item.title !== '')
    // 年が分からない実績は並べようがないので末尾に寄せる（sort は安定なので同じ年は元の順を保つ）
    .sort((a, b) => (a.year ?? Number.POSITIVE_INFINITY) - (b.year ?? Number.POSITIVE_INFINITY));
}

/** @param {unknown} sns @returns {{label:string,href:string}[]} */
function normalizeSns(sns) {
  if (!isPlainObject(sns)) return [];
  return Object.entries(SNS_LABELS)
    .filter(([key]) => typeof sns[key] === 'string' && sns[key] !== '')
    .map(([key, label]) => ({ label, href: toSafeHref(sns[key]) }))
    .filter((item) => item.href !== UNSAFE_HREF);
}

/**
 * @param {unknown} talent
 * @param {unknown} role 閲覧中のロール（企業のときだけスカウトの枠を出す）
 */
export function toTalentProfileView(talent, role) {
  if (!isPlainObject(talent)) return null;
  const name = String(talent.displayName ?? '');
  const facts = [
    ['性別', GENDER_LABELS.get(talent.gender)],
    ['年齢', talent.ageRange],
    ['地域', talent.area],
    ['身長', Number.isFinite(talent.height) ? `${talent.height}cm` : ''],
  ].filter(([, value]) => typeof value === 'string' && value !== '').map(([label, value]) => ({ label, value }));

  return {
    name,
    rolesLabel: formatRoles(talent.roles),
    hasVideo: Boolean(talent.introVideo),
    facts,
    bio: String(talent.bio ?? ''),
    skills: toStringArray(talent.skills),
    genres: toStringArray(talent.genres),
    career: normalizeCareer(talent.career),
    sns: normalizeSns(talent.sns),
    images: toStringArray(talent.images)
      .map((src) => toSafeHref(src))
      .filter((src) => src !== UNSAFE_HREF)
      .map((src, index) => ({ src, alt: `${name}さんの写真（${index + 1}枚目）` })),
    canScout: role === SCOUT_ROLE,
  };
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
  const wrapper = el('section', 'detail-layout__section talent-profile__section');
  wrapper.append(el('h2', 'talent-profile__heading', title), ...children);
  return wrapper;
}

function chipList(items, emptyText) {
  if (items.length === 0) return el('p', 'talent-profile__empty', emptyText);
  const list = el('ul', 'cluster talent-profile__chips');
  list.setAttribute('role', 'list');
  list.append(...items.map((item) => el('li', 'chip', item)));
  return list;
}

function factsList(facts) {
  const list = el('dl', 'talent-profile__facts');
  for (const fact of facts) {
    const row = el('div', 'talent-profile__fact');
    row.append(el('dt', 'talent-profile__fact-label', fact.label), el('dd', 'talent-profile__fact-value', fact.value));
    list.append(row);
  }
  return list;
}

function careerTimeline(career) {
  if (career.length === 0) return el('p', 'talent-profile__empty', '出演実績はまだ登録されていません。');
  const list = el('ol', 'talent-timeline');
  for (const item of career) {
    const row = el('li', 'talent-timeline__item');
    row.append(el('span', 'talent-timeline__year', item.year === null ? '年不明' : `${item.year}年`));
    const body = el('div', 'talent-timeline__body');
    body.append(el('span', 'talent-timeline__title', item.title));
    if (item.type) body.append(el('span', 'chip chip--sm', item.type));
    row.append(body);
    list.append(row);
  }
  return list;
}

function snsLinks(sns) {
  const list = el('ul', 'cluster talent-profile__sns');
  list.setAttribute('role', 'list');
  for (const item of sns) {
    const link = el('a', 'button button--outline button--sm', item.label);
    link.href = item.href;
    link.target = '_blank';
    // 開いた先のページから window.opener 経由でこのページを書き換えられないようにする
    link.rel = 'noopener noreferrer';
    link.append(el('span', 'visually-hidden', '（新しいタブで開きます）'));
    const li = el('li');
    li.append(link);
    list.append(li);
  }
  return list;
}

/**
 * プロフィール情報の列を描画する（見出し h1 を含む）。
 * @param {HTMLElement} container .detail-layout__info
 * @param {NonNullable<ReturnType<typeof toTalentProfileView>>} view
 * @returns {HTMLElement|null} スカウトボタンの枠
 */
export function renderTalentProfile(container, view) {
  if (!hasDOM() || !(container instanceof HTMLElement) || !view) return null;
  const header = el('header', 'talent-profile__header');
  if (view.rolesLabel) header.append(el('p', 'talent-profile__roles', view.rolesLabel));
  header.append(el('h1', 'talent-profile__name', view.name));
  // バッジは固定文言の HTML（ユーザー入力を含まない）なので、一覧カードと同じ部品を使う
  if (view.hasVideo) header.append(htmlToFragment(videoBadgeHTML()));

  const actions = el('div', 'detail-layout__actions talent-profile__actions');
  const sections = [
    section('自己紹介', el('p', 'talent-profile__bio', view.bio || '自己紹介はまだ登録されていません。')),
    section('基本情報', factsList(view.facts)),
    section('スキル', chipList(view.skills, 'スキルはまだ登録されていません。')),
    section('出演ジャンル', chipList(view.genres, '出演ジャンルはまだ登録されていません。')),
    section('出演実績', careerTimeline(view.career)),
  ];
  if (view.sns.length > 0) sections.push(section('SNS', snsLinks(view.sns)));

  container.replaceChildren(header, actions, ...sections);
  return actions;
}

/**
 * スカウトボタンの枠（企業ロールのみ）。送信処理は #08 で onScout に結び付ける。
 * @param {HTMLElement|null} slot renderTalentProfile の戻り値
 * @param {boolean} canScout
 * @param {() => void} [onScout]
 */
export function renderScoutAction(slot, canScout, onScout) {
  if (!(slot instanceof HTMLElement)) return;
  slot.replaceChildren();
  slot.hidden = !canScout;
  if (!canScout) return;
  const button = el('button', 'button button--primary button--lg', 'スカウトする');
  button.type = 'button';
  button.dataset.scoutButton = '';
  if (typeof onScout === 'function') button.addEventListener('click', onScout);
  slot.append(button);
}

/**
 * 写真ギャラリー。写真が無いときは文言入りの枠を出し、空白のまま崩れて見えないようにする。
 * @param {HTMLElement} container
 * @param {NonNullable<ReturnType<typeof toTalentProfileView>>} view
 */
export function renderTalentGallery(container, view) {
  if (!hasDOM() || !(container instanceof HTMLElement) || !view) return;
  const gallery = el('section', 'talent-gallery');
  gallery.setAttribute('aria-label', '写真');
  if (view.images.length === 0) {
    const placeholder = el('div', 'talent-gallery__placeholder');
    placeholder.append(el('p', 'talent-gallery__placeholder-text', '写真はまだ登録されていません'));
    gallery.append(placeholder);
  } else {
    const list = el('ul', 'talent-gallery__list');
    list.setAttribute('role', 'list');
    view.images.forEach((image, index) => {
      const img = el('img', 'talent-gallery__image');
      img.src = image.src;
      img.alt = image.alt;
      img.decoding = 'async';
      // 1枚目はファーストビューに入るのですぐ読み、2枚目以降はスクロールされるまで待つ
      if (index > 0) img.loading = 'lazy';
      const li = el('li', 'talent-gallery__item');
      li.append(img);
      list.append(li);
    });
    gallery.append(list);
  }
  container.append(gallery);
}
