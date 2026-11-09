// 入力チェック（問い合わせ 2.5・応募 T-05・案件掲載 B-01・動画メタ 6.7・プロフィール T-11）。
// HTML の required / type="email" / minlength を基本とし、ここではそれを補う具体的なエラー文を作る。
// 戻り値はすべて { valid, errors } で、errors は「欄名 → エラー文」（画面側が aria-describedby で欄と紐付ける）。
import {
  CONTACT_CATEGORIES, GENRES, TALENT_ROLES, GENDERS, AGE_RANGES, PREFECTURES, SKILL_TAGS, REWARD_UNITS,
} from '../data/master.js';
import { isDateOnlyString, toDateKey } from './utils.js';

export const CONTACT_LIMITS = Object.freeze({ nameMax: 50, companyMax: 100, bodyMin: 10, bodyMax: 1000 });
export const APPLICATION_MESSAGE_MAX_LENGTH = 200;
export const VIDEO_CAPTION_MAX_LENGTH = 40;
// 要件に上限の指定は無いが、詳細ページで読み切れる長さ（400字詰め原稿用紙1枚）に抑える
export const PROFILE_BIO_MAX_LENGTH = 400;
export const JOB_LIMITS = Object.freeze({ titleMax: 60, shootDatesMax: 100, descriptionMax: 2000 });
// RFC 5321 のアドレス全体の上限
const EMAIL_MAX_LENGTH = 254;

// HTML の type="email" と同じ考え方の形式。ただしデモの利用者が誤入力に気づけるよう、ドメインに "." を1つ以上求める
const EMAIL_PATTERN = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const CONTACT_CATEGORY_VALUES = CONTACT_CATEGORIES.map((item) => item.value);
const ROLE_VALUES = TALENT_ROLES.map((item) => item.value);
const GENDER_VALUES = GENDERS.map((item) => item.value);
// チェックボックスは JS の真偽値でも、FormData 由来の "on" でも渡ってくる
const CHECKED_VALUES = new Set([true, 'on']);

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const trimmed = (value) => (typeof value === 'string' ? value.trim() : '');
const toResult = (errors) => ({ valid: Object.keys(errors).length === 0, errors });

const graphemeSegmenter = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter('ja', { granularity: 'grapheme' })
  : null;

/**
 * 見た目の1文字を1として数える（"👨‍👩‍👧" も1文字）。利用者が数える文字数とエラー文の「現在◯文字」をそろえるため。
 * @param {unknown} value
 * @returns {number}
 */
export function countChars(value) {
  if (typeof value !== 'string') return 0;
  if (graphemeSegmenter) return [...graphemeSegmenter.segment(value)].length;
  return [...value].length;
}

/** @param {unknown} value @returns {boolean} */
export function isValidEmail(value) {
  const email = trimmed(value);
  return email.length > 0 && email.length <= EMAIL_MAX_LENGTH && EMAIL_PATTERN.test(email);
}

/**
 * 必須・最大文字数のチェック。エラーが無ければ undefined。
 * @param {unknown} value
 * @param {{ label: string, max: number, required?: boolean, showCount?: boolean }} rule
 */
function checkText(value, { label, max, required = true, showCount = false }) {
  const text = trimmed(value);
  if (text === '') return required ? `${label}を入力してください` : undefined;
  const length = countChars(text);
  if (length > max) return `${label}は${max}文字以内で入力してください${showCount ? `（現在${length}文字）` : ''}`;
  return undefined;
}

/** undefined のエラーを落として errors オブジェクトにする */
const compactErrors = (entries) => Object.fromEntries(Object.entries(entries).filter(([, message]) => message !== undefined));

/**
 * @param {{ name?: string, email?: string, company?: string, category?: string, body?: string, agree?: unknown }} input
 * @returns {{ valid: boolean, errors: Record<string, string> }}
 */
export function validateContact(input) {
  const { name, email, company, category, body, agree } = isRecord(input) ? input : {};
  const bodyText = trimmed(body);
  const bodyLength = countChars(bodyText);

  let bodyError;
  if (bodyText === '') bodyError = 'お問い合わせ内容を入力してください';
  else if (bodyLength < CONTACT_LIMITS.bodyMin) bodyError = `お問い合わせ内容は${CONTACT_LIMITS.bodyMin}文字以上で入力してください（現在${bodyLength}文字）`;
  else if (bodyLength > CONTACT_LIMITS.bodyMax) bodyError = `お問い合わせ内容は${CONTACT_LIMITS.bodyMax}文字以内で入力してください（現在${bodyLength}文字）`;

  let emailError;
  if (trimmed(email) === '') emailError = 'メールアドレスを入力してください';
  else if (!isValidEmail(email)) emailError = 'メールアドレスの形式が正しくありません';

  return toResult(compactErrors({
    name: checkText(name, { label: 'お名前', max: CONTACT_LIMITS.nameMax }),
    email: emailError,
    company: checkText(company, { label: '会社名', max: CONTACT_LIMITS.companyMax, required: false }),
    category: CONTACT_CATEGORY_VALUES.includes(category) ? undefined : 'お問い合わせ種別を選択してください',
    body: bodyError,
    agree: CHECKED_VALUES.has(agree) ? undefined : 'プライバシーポリシーへの同意が必要です',
  }));
}

/**
 * @param {{ message?: string }} input
 * @returns {{ valid: boolean, errors: Record<string, string> }}
 */
export function validateApplication(input) {
  const { message } = isRecord(input) ? input : {};
  return toResult(compactErrors({
    message: checkText(message, { label: 'メッセージ', max: APPLICATION_MESSAGE_MAX_LENGTH, showCount: true }),
  }));
}

/** @param {unknown} value @returns {number|null} フォームの数字文字列も数値にする。数値にできなければ null */
function toAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (trimmed(value) === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function checkReward(reward) {
  if (!isRecord(reward)) return '報酬を入力してください';
  const min = toAmount(reward.min);
  const max = toAmount(reward.max);
  if (min === null || max === null || min < 0 || max < 0) return '報酬は0以上の数値で入力してください';
  if (min > max) return '報酬の下限は上限以下にしてください';
  if (!REWARD_UNITS.includes(reward.unit)) return '報酬の単位を選択してください';
  return undefined;
}

/** 選択式の複数項目。required なら1つ以上、どれもマスタにある値であること */
function checkChoices(values, allowed, { emptyMessage, invalidMessage, required = true }) {
  if (values === undefined || (Array.isArray(values) && values.length === 0)) return required ? emptyMessage : undefined;
  if (!Array.isArray(values) || !values.every((value) => allowed.includes(value))) return invalidMessage;
  return undefined;
}

function checkDeadline(deadline, now) {
  if (trimmed(deadline) === '') return '締切日を入力してください';
  if (!isDateOnlyString(deadline)) return '締切日を正しい日付で入力してください';
  return deadline < toDateKey(now) ? '締切日は今日以降の日付にしてください' : undefined;
}

/**
 * 案件掲載フォーム（4.4 の Job 型）。companyId・status・createdAt は画面と storage.js が補うので対象外。
 * @param {Partial<import('../data/jobs.js').Job>} input
 * @param {{ now?: Date }} [options] 締切の過去日判定に使う「今日」（テストで固定するため）
 * @returns {{ valid: boolean, errors: Record<string, string> }}
 */
export function validateJob(input, { now = new Date() } = {}) {
  const job = isRecord(input) ? input : {};
  const hasGender = job.gender !== undefined && job.gender !== '';
  return toResult(compactErrors({
    title: checkText(job.title, { label: '案件タイトル', max: JOB_LIMITS.titleMax, showCount: true }),
    genre: GENRES.includes(job.genre) ? undefined : 'ジャンルを選択してください',
    requiredRoles: checkChoices(job.requiredRoles, ROLE_VALUES, {
      emptyMessage: '募集する職種を1つ以上選択してください', invalidMessage: '職種の選択肢に無い値が含まれています',
    }),
    gender: !hasGender || GENDER_VALUES.includes(job.gender) ? undefined : '性別の指定が正しくありません',
    ageRanges: checkChoices(job.ageRanges, AGE_RANGES, {
      emptyMessage: '募集する年齢帯を1つ以上選択してください', invalidMessage: '年齢帯の選択肢に無い値が含まれています',
    }),
    area: PREFECTURES.includes(job.area) ? undefined : '撮影地域（都道府県）を選択してください',
    shootDates: checkText(job.shootDates, { label: '撮影日程', max: JOB_LIMITS.shootDatesMax }),
    reward: checkReward(job.reward),
    requiredSkills: checkChoices(job.requiredSkills, SKILL_TAGS, {
      required: false, invalidMessage: 'スキルの選択肢に無い値が含まれています',
    }),
    description: checkText(job.description, { label: '案件の説明', max: JOB_LIMITS.descriptionMax, showCount: true }),
    deadline: checkDeadline(job.deadline, now),
  }));
}

/**
 * 自己紹介動画の付帯情報（6.7）。形式・サイズ・長さのチェックは #07 の video-validation.js が担当する。
 * @param {{ caption?: string, agreed?: unknown }} input
 * @returns {{ valid: boolean, errors: Record<string, string> }}
 */
export function validateVideoMeta(input) {
  const { caption, agreed } = isRecord(input) ? input : {};
  return toResult(compactErrors({
    caption: checkText(caption, { label: '一言説明', max: VIDEO_CAPTION_MAX_LENGTH, required: false, showCount: true }),
    agreed: CHECKED_VALUES.has(agreed) ? undefined : '動画の公開に同意してください',
  }));
}

/**
 * プロフィール編集（T-11）。スキルは任意だが、マスタに無い値はマッチ度計算で数えられないため弾く。
 * @param {{ bio?: string, skills?: unknown }} input
 * @returns {{ valid: boolean, errors: Record<string, string> }}
 */
export function validateProfile(input) {
  const { bio, skills } = isRecord(input) ? input : {};
  return toResult(compactErrors({
    bio: checkText(bio, { label: '自己紹介文', max: PROFILE_BIO_MAX_LENGTH, showCount: true }),
    skills: checkChoices(skills, SKILL_TAGS, { required: false, invalidMessage: 'スキルの選択肢に無い値が含まれています' }),
  }));
}
