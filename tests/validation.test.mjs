// js/lib/validation.js のテスト（要件 2.5 / 4.4 / 6.7）
// 戻り値は { valid, errors }。errors は「欄名 → 具体的なエラー文」で、画面側が欄の横に出せる形にする。
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  isValidEmail, countChars,
  validateContact, validateApplication, validateJob, validateVideoMeta,
  CONTACT_LIMITS, APPLICATION_MESSAGE_MAX_LENGTH, VIDEO_CAPTION_MAX_LENGTH,
} from '../js/lib/validation.js';

const text = (length) => 'あ'.repeat(length);

const validContact = () => ({
  name: '山田 花子',
  email: 'hanako@example.com',
  company: '',
  category: 'talent-registration',
  body: text(CONTACT_LIMITS.bodyMin),
  agree: true,
});

describe('isValidEmail', () => {
  test('一般的な形式は OK', () => {
    for (const email of ['a@example.com', 'first.last+tag@sub.example.co.jp', 'user_1@example-site.jp']) {
      assert.equal(isValidEmail(email), true, email);
    }
  });

  test('形式が崩れたものは NG', () => {
    for (const email of ['', 'plain', 'a@', '@example.com', 'a@example', 'a b@example.com', 'a@@example.com', 'a@example..com', 'a@.example.com', 42, null]) {
      assert.equal(isValidEmail(email), false, String(email));
    }
  });

  test('前後の空白は許容する（コピペ時の混入を弾かない）', () => {
    assert.equal(isValidEmail('  a@example.com '), true);
  });
});

describe('countChars', () => {
  test('絵文字や結合文字を見た目の1文字として数える', () => {
    assert.equal(countChars('あいう'), 3);
    assert.equal(countChars('👍'), 1);
    assert.equal(countChars('👨‍👩‍👧'), 1);
    assert.equal(countChars(null), 0);
  });
});

describe('validateContact', () => {
  test('上限・下限は 2.5 どおり（本文 10〜1000文字）', () => {
    assert.equal(CONTACT_LIMITS.bodyMin, 10);
    assert.equal(CONTACT_LIMITS.bodyMax, 1000);
  });

  test('正しい入力は valid', () => {
    assert.deepEqual(validateContact(validContact()), { valid: true, errors: {} });
  });

  test('本文の境界値：9文字 NG／10文字 OK／1000文字 OK／1001文字 NG', () => {
    const check = (length) => validateContact({ ...validContact(), body: text(length) });
    assert.equal(check(9).valid, false);
    assert.equal(check(9).errors.body, 'お問い合わせ内容は10文字以上で入力してください（現在9文字）');
    assert.equal(check(10).valid, true);
    assert.equal(check(1000).valid, true);
    assert.equal(check(1001).valid, false);
    assert.equal(check(1001).errors.body, 'お問い合わせ内容は1000文字以内で入力してください（現在1001文字）');
  });

  test('本文は前後の空白を除いて数える（空白だけで10文字にできない）', () => {
    const result = validateContact({ ...validContact(), body: `   ${text(9)}   ` });
    assert.equal(result.valid, false);
  });

  test('メール形式が不正なら具体的なエラー文', () => {
    const result = validateContact({ ...validContact(), email: 'hanako@example' });
    assert.equal(result.valid, false);
    assert.equal(result.errors.email, 'メールアドレスの形式が正しくありません');
  });

  test('必須項目が空ならそれぞれにエラー、任意の会社名は空でよい', () => {
    const result = validateContact({ name: ' ', email: '', company: '', category: '', body: '', agree: false });
    assert.equal(result.valid, false);
    assert.deepEqual(Object.keys(result.errors).sort(), ['agree', 'body', 'category', 'email', 'name']);
    assert.equal(result.errors.name, 'お名前を入力してください');
    assert.equal(result.errors.email, 'メールアドレスを入力してください');
    assert.equal(result.errors.category, 'お問い合わせ種別を選択してください');
    assert.equal(result.errors.body, 'お問い合わせ内容を入力してください');
    assert.equal(result.errors.agree, 'プライバシーポリシーへの同意が必要です');
  });

  test('種別はマスタにある値だけ', () => {
    assert.equal(validateContact({ ...validContact(), category: 'spam' }).errors.category, 'お問い合わせ種別を選択してください');
  });

  test('名前・会社名の長さ上限', () => {
    const tooLong = validateContact({
      ...validContact(), name: text(CONTACT_LIMITS.nameMax + 1), company: text(CONTACT_LIMITS.companyMax + 1),
    });
    assert.equal(tooLong.errors.name, `お名前は${CONTACT_LIMITS.nameMax}文字以内で入力してください`);
    assert.equal(tooLong.errors.company, `会社名は${CONTACT_LIMITS.companyMax}文字以内で入力してください`);
    assert.equal(validateContact({ ...validContact(), name: text(CONTACT_LIMITS.nameMax) }).valid, true);
  });

  test('同意はチェックボックスの true だけを有効にする（"false" 文字列を同意扱いしない）', () => {
    assert.equal(validateContact({ ...validContact(), agree: 'false' }).valid, false);
    assert.equal(validateContact({ ...validContact(), agree: 'on' }).valid, true);
  });

  test('引数が無くても落ちない', () => {
    assert.equal(validateContact(undefined).valid, false);
  });
});

describe('validateApplication', () => {
  test('一言メッセージは必須・上限あり（上限は定数）', () => {
    assert.equal(validateApplication({ message: 'よろしくお願いします' }).valid, true);
    assert.equal(validateApplication({ message: '  ' }).errors.message, 'メッセージを入力してください');
    assert.equal(validateApplication({ message: text(APPLICATION_MESSAGE_MAX_LENGTH) }).valid, true);
    assert.equal(validateApplication({ message: text(APPLICATION_MESSAGE_MAX_LENGTH + 1) }).errors.message,
      `メッセージは${APPLICATION_MESSAGE_MAX_LENGTH}文字以内で入力してください（現在${APPLICATION_MESSAGE_MAX_LENGTH + 1}文字）`);
    assert.equal(validateApplication(null).valid, false);
  });
});

const NOW = new Date(2026, 10, 2, 12, 0);
const validJob = () => ({
  title: '清涼飲料のWeb CM出演者募集',
  genre: 'Web広告',
  requiredRoles: ['actor'],
  gender: '',
  ageRanges: ['20代前半'],
  area: '東京都',
  shootDates: '2026年12月上旬（1日）',
  reward: { min: '30000', max: 50000, unit: '日' },
  requiredSkills: ['英語'],
  videoPreferred: true,
  description: '明るい雰囲気の方を募集します。',
  deadline: '2026-11-30',
});

describe('validateJob', () => {
  test('Job 型に沿った正しい入力は valid（報酬はフォーム由来の数字文字列も可）', () => {
    assert.deepEqual(validateJob(validJob(), { now: NOW }), { valid: true, errors: {} });
  });

  test('必須項目が無ければそれぞれにエラー', () => {
    const result = validateJob({}, { now: NOW });
    assert.equal(result.valid, false);
    for (const field of ['title', 'genre', 'requiredRoles', 'ageRanges', 'area', 'shootDates', 'reward', 'description', 'deadline']) {
      assert.equal(typeof result.errors[field], 'string', field);
    }
  });

  test('マスタに無い職種・ジャンル・地域・年齢帯・性別・スキルは NG', () => {
    const result = validateJob({
      ...validJob(), requiredRoles: ['ninja'], genre: 'ラジオ', area: '架空県', ageRanges: ['100代'], gender: 'robot', requiredSkills: ['念力'],
    }, { now: NOW });
    assert.deepEqual(Object.keys(result.errors).sort(), ['ageRanges', 'area', 'gender', 'genre', 'requiredRoles', 'requiredSkills']);
  });

  test('報酬：負の数・数値以外・下限＞上限・単位不正は NG', () => {
    const errorOf = (reward) => validateJob({ ...validJob(), reward }, { now: NOW }).errors.reward;
    assert.equal(errorOf({ min: -1, max: 100, unit: '日' }), '報酬は0以上の数値で入力してください');
    assert.equal(errorOf({ min: 'abc', max: 100, unit: '日' }), '報酬は0以上の数値で入力してください');
    assert.equal(errorOf({ min: 500, max: 100, unit: '日' }), '報酬の下限は上限以下にしてください');
    assert.equal(errorOf({ min: 100, max: 100, unit: '時間' }), '報酬の単位を選択してください');
  });

  test('締切：日付の形式・過去日は NG、今日は OK', () => {
    const errorOf = (deadline) => validateJob({ ...validJob(), deadline }, { now: NOW }).errors.deadline;
    assert.equal(errorOf('2026/11/30'), '締切日を正しい日付で入力してください');
    assert.equal(errorOf('2026-02-30'), '締切日を正しい日付で入力してください');
    assert.equal(errorOf('2026-11-01'), '締切日は今日以降の日付にしてください');
    assert.equal(errorOf('2026-11-02'), undefined);
  });

  test('タイトル・説明の文字数上限', () => {
    const result = validateJob({ ...validJob(), title: text(1000), description: text(10000) }, { now: NOW });
    assert.match(result.errors.title, /文字以内で入力してください/);
    assert.match(result.errors.description, /文字以内で入力してください/);
  });
});

describe('validateVideoMeta', () => {
  test('一言説明は任意・40文字以内、公開への同意は必須', () => {
    assert.equal(VIDEO_CAPTION_MAX_LENGTH, 40);
    assert.equal(validateVideoMeta({ caption: '', agreed: true }).valid, true);
    assert.equal(validateVideoMeta({ caption: text(40), agreed: true }).valid, true);
    assert.equal(validateVideoMeta({ caption: text(41), agreed: true }).errors.caption, '一言説明は40文字以内で入力してください（現在41文字）');
    assert.equal(validateVideoMeta({ caption: 'よろしく', agreed: false }).errors.agreed, '動画の公開に同意してください');
    assert.equal(validateVideoMeta(undefined).valid, false);
  });
});
