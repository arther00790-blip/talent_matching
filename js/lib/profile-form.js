// プロフィール編集ページ（#07）の判断部分。DOM に触らない純粋関数にして、ページ JS と切り離してテストする。
import { SKILL_TAGS } from '../data/master.js';
import { resolveDemoTalent } from './job-list.js';

/** 編集できるのはデモ用タレント本人として見ているときだけ */
export const PROFILE_EDIT_ROLE = 'talent';
export const ROLE_GATE_MESSAGE = 'タレントに切り替えると編集できます';

const SUBMIT_LABELS = Object.freeze({ create: '登録する', replace: '差し替える' });

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/** @param {unknown} role @returns {{ canEdit: boolean, message: string }} */
export function getEditAccess(role) {
  return role === PROFILE_EDIT_ROLE ? { canEdit: true, message: '' } : { canEdit: false, message: ROLE_GATE_MESSAGE };
}

/** マスタにある値だけを、重複なく元の順で残す（保存値が古い・壊れていてもチェックボックスと食い違わないように） */
function toSkillList(skills) {
  if (!Array.isArray(skills)) return [];
  return [...new Set(skills.filter((skill) => SKILL_TAGS.includes(skill)))];
}

/**
 * フォームの初期値。保存済みの編集内容 → 架空データの本人プロフィール の順に使う。
 * @param {unknown} talents
 * @param {unknown} profile storage.js の getProfile() の戻り値
 * @returns {{ bio: string, skills: string[] }}
 */
export function toProfileFormValues(talents, profile) {
  const talent = resolveDemoTalent(talents, profile);
  return {
    bio: typeof talent?.bio === 'string' ? talent.bio : '',
    skills: toSkillList(talent?.skills),
  };
}

/**
 * 保存する内容。ほかの画面（マイページ等）が保存した項目を消さないよう、既存の保存値に重ねる。
 * @param {unknown} current getProfile() の戻り値
 * @param {{ bio?: unknown, skills?: unknown }} input
 * @returns {Record<string, unknown>}
 */
export function buildProfileUpdate(current, input) {
  const { bio, skills } = isRecord(input) ? input : {};
  return {
    ...(isRecord(current) ? current : {}),
    bio: typeof bio === 'string' ? bio.trim() : '',
    skills: toSkillList(skills),
  };
}

/**
 * 動画登録欄の表示状態。
 * @param {{ hasStored: boolean, candidate: 'none'|'checking'|'invalid'|'valid', replacing: boolean }} state
 *   candidate は「いま選んでいるファイル」のチェック結果
 */
export function getUploaderView({ hasStored, candidate, replacing }) {
  const showPicker = !hasStored || replacing;
  const showPreview = showPicker && candidate === 'valid';
  return {
    showCurrent: hasStored && !replacing,
    showPicker,
    showPreview,
    // 登録ボタン自体は選択欄と一緒に常に見せ、NG のファイル・チェック中は押せないようにして、保存されない動画を「登録した」と誤解させない
    canSubmit: showPreview,
    submitLabel: hasStored ? SUBMIT_LABELS.replace : SUBMIT_LABELS.create,
  };
}
