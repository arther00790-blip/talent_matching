// #07 プロフィール編集（T-11）とアクセス制御・動画登録フォームの状態のテスト
// DOM を使わずに確かめられるよう、ページの判断部分は js/lib/profile-form.js の純粋関数を対象にする。
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PROFILE_EDIT_ROLE, ROLE_GATE_MESSAGE, getEditAccess, toProfileFormValues, buildProfileUpdate, getUploaderView,
} from '../js/lib/profile-form.js';
import { validateProfile, PROFILE_BIO_MAX_LENGTH } from '../js/lib/validation.js';
import { TALENTS, DEMO_TALENT_ID } from '../js/data/talents.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const RAW_COLOR_PATTERN = /#[0-9A-Fa-f]{3,8}\b|\brgba?\(|\bhsla?\(/;
const demo = TALENTS.find((item) => item.id === DEMO_TALENT_ID);

describe('アクセス制御', () => {
  test('タレントだけ編集でき、他のロールは案内文を出す', () => {
    assert.equal(PROFILE_EDIT_ROLE, 'talent');
    assert.deepEqual(getEditAccess('talent'), { canEdit: true, message: '' });
    for (const role of ['guest', 'company', undefined, 'admin']) {
      assert.deepEqual(getEditAccess(role), { canEdit: false, message: ROLE_GATE_MESSAGE });
    }
    assert.equal(ROLE_GATE_MESSAGE, 'タレントに切り替えると編集できます');
  });
});

describe('プロフィールの初期値と保存内容', () => {
  test('未保存なら架空データの本人プロフィールを初期値にする', () => {
    assert.deepEqual(toProfileFormValues(TALENTS, null), { bio: demo.bio, skills: [...demo.skills] });
  });

  test('保存済みの編集内容を優先する（マスタに無いスキルは落とす）', () => {
    const values = toProfileFormValues(TALENTS, { bio: '編集後', skills: ['殺陣', '存在しない'] });
    assert.deepEqual(values, { bio: '編集後', skills: ['殺陣'] });
  });

  test('保存する内容は既存の保存値に自己紹介文・スキルを重ね、前後の空白を落とす', () => {
    const update = buildProfileUpdate({ other: 1, bio: '古い' }, { bio: '  新しい自己紹介  ', skills: ['英語', '英語', 'ダンス'] });
    assert.deepEqual(update, { other: 1, bio: '新しい自己紹介', skills: ['英語', 'ダンス'] });
    assert.deepEqual(buildProfileUpdate(null, { bio: 'a', skills: [] }), { bio: 'a', skills: [] });
  });
});

describe('プロフィールの入力チェック', () => {
  test('自己紹介文は必須・上限文字数あり、スキルはマスタの値のみ', () => {
    assert.equal(validateProfile({ bio: 'こんにちは', skills: ['英語'] }).valid, true);
    assert.equal(validateProfile({ bio: 'こんにちは', skills: [] }).valid, true);
    assert.equal(validateProfile({ bio: '  ', skills: [] }).errors.bio, '自己紹介文を入力してください');
    const long = 'あ'.repeat(PROFILE_BIO_MAX_LENGTH + 1);
    assert.equal(validateProfile({ bio: long }).errors.bio, `自己紹介文は${PROFILE_BIO_MAX_LENGTH}文字以内で入力してください（現在${PROFILE_BIO_MAX_LENGTH + 1}文字）`);
    assert.equal(validateProfile({ bio: 'a'.repeat(PROFILE_BIO_MAX_LENGTH) }).valid, true);
    assert.equal(validateProfile({ bio: 'a', skills: ['存在しない'] }).errors.skills, 'スキルの選択肢に無い値が含まれています');
  });
});

describe('動画登録フォームの表示状態', () => {
  test('未登録なら選択欄を出し、ファイルが OK になるまで登録ボタンは押せない', () => {
    const view = getUploaderView({ hasStored: false, candidate: 'none', replacing: false });
    assert.deepEqual(view, { showCurrent: false, showPicker: true, showPreview: false, canSubmit: false, submitLabel: '登録する' });
  });

  test('NG のファイルを選んだら登録ボタンは無効のまま', () => {
    const view = getUploaderView({ hasStored: false, candidate: 'invalid', replacing: false });
    assert.equal(view.canSubmit, false);
    assert.equal(view.showPicker, true);
  });

  test('OK のファイルなら登録できる', () => {
    const view = getUploaderView({ hasStored: false, candidate: 'valid', replacing: false });
    assert.equal(view.canSubmit, true);
    assert.equal(view.showPreview, true);
  });

  test('登録済みなら現在の動画（差し替え・削除）を出し、選択欄は隠す', () => {
    const view = getUploaderView({ hasStored: true, candidate: 'none', replacing: false });
    assert.equal(view.showCurrent, true);
    assert.equal(view.showPicker, false);
  });

  test('差し替え中は選択欄を出し、ボタンは「差し替える」', () => {
    const view = getUploaderView({ hasStored: true, candidate: 'valid', replacing: true });
    assert.equal(view.showPicker, true);
    assert.equal(view.canSubmit, true);
    assert.equal(view.submitLabel, '差し替える');
  });
});

describe('ページのマークアップと CSS', () => {
  const html = read('profile-edit.html');

  test('ページ固有の CSS / JS を読み込み、accept 属性が要件どおり', () => {
    assert.match(html, /<link rel="stylesheet" href="css\/pages\/profile-edit\.css">/);
    assert.match(html, /<script type="module" src="js\/pages\/profile-edit\.js"><\/script>/);
    assert.match(html, /accept="video\/mp4,video\/webm,video\/quicktime"/);
  });

  test('エラー表示欄は aria-live で読み上げられる', () => {
    assert.match(html, /data-video-error[^>]*aria-live="(polite|assertive)"|aria-live="(polite|assertive)"[^>]*data-video-error/);
  });

  test('ページ固有 CSS に色の直書きが無い', () => {
    assert.doesNotMatch(read('css/pages/profile-edit.css'), RAW_COLOR_PATTERN);
  });
});
