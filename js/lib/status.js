// 応募・スカウトのステータス遷移（要件 6.3）。DOM にも保存先にも触れない純粋関数だけを置く。
// 遷移表を1か所で持つのは、マイページのボタン表示と保存前のチェックが食い違い、
// 「押せるのに保存されない」「保存値が逆戻りする」状態を作らないため。
import { APPLICATION_STATUSES, SCOUT_STATUSES } from '../data/master.js';

export const STATUS_KINDS = Object.freeze({ application: 'application', scout: 'scout' });

// 6.3：応募は applied → reviewing → accepted / declined、スカウトは sent → read → replied。
// 戻す・飛ばす遷移は無い（デモで「流れ」を見せるためのボタンなので、一方向に進むだけにする）
const TRANSITIONS = Object.freeze({
  application: Object.freeze({
    applied: Object.freeze(['reviewing']),
    reviewing: Object.freeze(['accepted', 'declined']),
    accepted: Object.freeze([]),
    declined: Object.freeze([]),
  }),
  scout: Object.freeze({
    sent: Object.freeze(['read']),
    read: Object.freeze(['replied']),
    replied: Object.freeze([]),
  }),
});

// 応募の表示名は html-parts.js の statusBadgeHTML と同じ語。スカウトの sent は受け取る側の言葉で「未読」と表示する
const LABELS = Object.freeze({
  application: Object.freeze({ applied: '応募済', reviewing: '選考中', accepted: '採用', declined: '見送り' }),
  scout: Object.freeze({ sent: '未読', read: '既読', replied: '返信済' }),
});

// ボタンの文言は「押すとどうなるか」を動詞で書く
const ACTION_LABELS = Object.freeze({
  application: Object.freeze({ reviewing: '選考中にする', accepted: '採用する', declined: '見送る' }),
  scout: Object.freeze({ read: '既読にする', replied: '返信済みにする' }),
});

export const STATUS_VALUES = Object.freeze({ application: APPLICATION_STATUSES, scout: SCOUT_STATUSES });

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
// hasOwn で引くのは、"constructor" などの値で Object.prototype のプロパティを拾わないため
const lookup = (table, key) => (typeof key === 'string' && Object.hasOwn(table, key) ? table[key] : undefined);

/**
 * @param {unknown} kind STATUS_KINDS のいずれか
 * @param {unknown} status
 * @returns {string[]} 次に進める先（終わった状態・未知の値は空）
 */
export function getNextStatuses(kind, status) {
  const table = lookup(TRANSITIONS, kind);
  const next = table ? lookup(table, status) : undefined;
  return next ? [...next] : [];
}

/** @param {unknown} kind @param {unknown} from @param {unknown} to @returns {boolean} */
export function canTransition(kind, from, to) {
  return getNextStatuses(kind, from).includes(to);
}

/**
 * 保存前の判定。対象の取得と保存は呼び出し側（mypage-data.js）が行う。
 * @param {unknown} kind
 * @param {unknown} item 現在の応募／スカウト
 * @param {unknown} to
 * @returns {{ ok: true, status: string } | { ok: false, reason: 'not-found'|'invalid-transition' }}
 */
export function resolveTransition(kind, item, to) {
  if (!lookup(TRANSITIONS, kind) || !isRecord(item)) return { ok: false, reason: 'not-found' };
  return canTransition(kind, item.status, to) ? { ok: true, status: to } : { ok: false, reason: 'invalid-transition' };
}

/** @param {unknown} kind @param {unknown} status @returns {string} 未知の値は空文字（誤った状態を表示しないため） */
export function getStatusLabel(kind, status) {
  const table = lookup(LABELS, kind);
  return (table && lookup(table, status)) ?? '';
}

/** @param {unknown} kind @param {unknown} status 進める先 @returns {string} */
export function getStatusActionLabel(kind, status) {
  const table = lookup(ACTION_LABELS, kind);
  return (table && lookup(table, status)) ?? '';
}
