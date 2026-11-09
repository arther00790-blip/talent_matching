// お問い合わせ（要件 C-02 / 2.5）の画面遷移の判断部分。DOM に触れない関数にして、3つのページ JS と切り離してテストする。
// 入力チェックは validation.js の validateContact、保存は storage.js の下書き関数（sessionStorage）に任せる。
// 外部への送信は一切しない（要件 5.2）。「送信する」は完了画面へ進むだけ。
import { CONTACT_CATEGORIES } from '../data/master.js';
import { validateContact } from './validation.js';
import { getContactDraft, saveContactDraft, clearContactDraft } from './storage.js';

/** 遷移先は固定の相対 URL。入力値やクエリから組み立てると遷移先を操作されうるため */
export const CONTACT_PAGES = Object.freeze({
  input: 'contact.html',
  confirm: 'contact-confirm.html',
  complete: 'contact-complete.html',
});

/** validateContact のエラーのキー。画面の上から順に並べ、最初のエラー欄へフォーカスを移すのに使う */
export const CONTACT_FIELD_ORDER = Object.freeze(['name', 'email', 'company', 'category', 'body', 'agree']);

const TEXT_FIELDS = Object.freeze(['name', 'email', 'company', 'category', 'body']);
// 確認画面を経たことの印。完了画面を直接開いただけで「受け付けました」と出さないために使う
const SUBMITTED_KEY = 'submitted';
const DRAFT_KEYS = new Set([...CONTACT_FIELD_ORDER, SUBMITTED_KEY]);
// チェックボックスは JS の真偽値でも、FormData 由来の "on" でも渡ってくる
const CHECKED_VALUES = new Set([true, 'on']);

const CONFIRM_LABELS = Object.freeze({
  name: 'お名前',
  email: 'メールアドレス',
  company: '会社名',
  category: 'お問い合わせ種別',
  body: 'お問い合わせ内容',
  agree: 'プライバシーポリシー',
});
const EMPTY_LABEL = '（未入力）';
const AGREED_LABEL = '同意する';

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * フォームから読んだ値を下書きの形にする（前後の空白を除き、同意は真偽値にそろえる）。
 * @param {unknown} raw { name, email, company, category, body, agree }
 * @returns {{ name: string, email: string, company: string, category: string, body: string, agree: boolean }}
 */
export function toContactInput(raw) {
  const form = isRecord(raw) ? raw : {};
  const input = Object.fromEntries(TEXT_FIELDS.map((key) => [key, text(form[key])]));
  return { ...input, agree: CHECKED_VALUES.has(form.agree) };
}

/**
 * 入力画面の「確認画面へ」。変換 → 入力チェック → 下書き保存。例外は出さず、画面が出し分けられる理由を返す。
 * @param {unknown} raw
 * @returns {{ ok: true, redirect: string } | { ok: false, reason: 'invalid', errors: Record<string, string> } | { ok: false, reason: 'storage' }}
 */
export function submitContactInput(raw) {
  const input = toContactInput(raw);
  const { valid, errors } = validateContact(input);
  if (!valid) return { ok: false, reason: 'invalid', errors };
  return saveContactDraft(input) ? { ok: true, redirect: CONTACT_PAGES.confirm } : { ok: false, reason: 'storage' };
}

/**
 * sessionStorage の値は利用者が開発者ツールで書き換えられるため、読み出すたびに型・形式を確かめ直す。
 * 知らないキー・文字列でない値・入力チェックに通らない値が1つでもあれば、下書きは無いものとして扱う。
 * @returns {{ name: string, email: string, company: string, category: string, body: string, agree: true, submitted: boolean } | null}
 */
export function readContactDraft() {
  const draft = getContactDraft();
  if (!isRecord(draft)) return null;
  if (!Object.keys(draft).every((key) => DRAFT_KEYS.has(key))) return null;
  if (!TEXT_FIELDS.every((key) => typeof draft[key] === 'string')) return null;
  if (draft.agree !== true) return null;
  if (draft[SUBMITTED_KEY] !== undefined && typeof draft[SUBMITTED_KEY] !== 'boolean') return null;
  if (!validateContact(draft).valid) return null;
  const fields = Object.fromEntries(TEXT_FIELDS.map((key) => [key, draft[key]]));
  return { ...fields, agree: true, submitted: draft[SUBMITTED_KEY] === true };
}

/**
 * 確認画面から「戻る」で入力画面に来たときに、欄へ戻す値。下書きが無い・不正なら null（空のフォームのまま）。
 * @returns {{ name: string, email: string, company: string, category: string, body: string, agree: boolean } | null}
 */
export function getRestoreValues() {
  const draft = readContactDraft();
  if (!draft) return null;
  return Object.fromEntries(CONTACT_FIELD_ORDER.map((key) => [key, draft[key]]));
}

/** 入力画面を種別を選んだ状態で開くためのクエリ名（例 contact.html?category=talent-registration） */
export const CATEGORY_QUERY_KEY = 'category';
const CATEGORY_VALUES = new Set(CONTACT_CATEGORIES.map(({ value }) => value));

/**
 * クエリから事前選択する種別を決める。URL は誰でも作れるため、マスタにある値の完全一致だけを受け付ける。
 * 同じキーが複数ある（配列になる）など、形が不正なら選ばない。
 * @param {unknown} params utils.js の getQueryParams() の戻り値
 * @returns {string} 種別の value。選ばない場合は空文字
 */
export function resolvePresetCategory(params) {
  const value = isRecord(params) ? params[CATEGORY_QUERY_KEY] : undefined;
  return typeof value === 'string' && CATEGORY_VALUES.has(value) ? value : '';
}

/**
 * 確認画面に並べる「項目名と表示値」。種別は内部値ではなく表示ラベルにする。
 * 値は加工せずに返すので、表示側は必ず textContent で入れること。
 * @param {NonNullable<ReturnType<typeof readContactDraft>>} draft
 * @returns {{ key: string, label: string, value: string }[]}
 */
export function toConfirmItems(draft) {
  const categoryLabel = CONTACT_CATEGORIES.find((item) => item.value === draft.category)?.label ?? EMPTY_LABEL;
  const values = {
    name: draft.name,
    email: draft.email,
    company: draft.company === '' ? EMPTY_LABEL : draft.company,
    category: categoryLabel,
    body: draft.body,
    agree: AGREED_LABEL,
  };
  return CONTACT_FIELD_ORDER.map((key) => ({ key, label: CONFIRM_LABELS[key], value: values[key] }));
}

/**
 * 確認画面を開いたとき。下書きが無い・不正なら入力画面へ戻す。
 * @returns {{ redirect: string } | { items: { key: string, label: string, value: string }[] }}
 */
export function resolveConfirmPage() {
  const draft = readContactDraft();
  return draft ? { items: toConfirmItems(draft) } : { redirect: CONTACT_PAGES.input };
}

/**
 * 確認画面の「送信する」。サーバーには送らず、確認を経た印を付けて完了画面へ進める。
 * @returns {{ ok: true, redirect: string } | { ok: false, reason: 'missing', redirect: string } | { ok: false, reason: 'storage' }}
 */
export function prepareContactSubmission() {
  const draft = readContactDraft();
  if (!draft) return { ok: false, reason: 'missing', redirect: CONTACT_PAGES.input };
  const saved = saveContactDraft({ ...draft, [SUBMITTED_KEY]: true });
  return saved ? { ok: true, redirect: CONTACT_PAGES.complete } : { ok: false, reason: 'storage' };
}

/**
 * 完了画面を開いたとき。確認を経た下書きがあれば削除して完了表示、無ければ入力画面へ戻す。
 * 入力途中（確認前）の下書きは、完了画面を直接開かれても消さない。
 * @returns {{ redirect: string } | { ok: true, cleared: boolean }}
 */
export function completeContact() {
  const draft = readContactDraft();
  if (!draft?.submitted) return { redirect: CONTACT_PAGES.input };
  return { ok: true, cleared: clearContactDraft() };
}
