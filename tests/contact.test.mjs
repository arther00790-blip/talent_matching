// #09 お問い合わせフォーム（C-02 / 2.5）のテスト
// 画面の判断部分（検証→下書き保存→確認画面用データ→リダイレクト判定→完了時削除）は js/lib/contact-flow.js の関数を対象にする。
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CONTACT_PAGES, CONTACT_FIELD_ORDER, submitContactInput, readContactDraft, resolveConfirmPage,
  prepareContactSubmission, completeContact, getRestoreValues, resolvePresetCategory, CATEGORY_QUERY_KEY,
} from '../js/lib/contact-flow.js';
import { CONTACT_CATEGORIES } from '../js/data/master.js';
import { getQueryParams } from '../js/lib/utils.js';

// トップの「タレントとして登録」などから、種別を選んだ状態で入力画面を開くため
describe('URL による種別の事前選択', () => {
  const preset = (search) => resolvePresetCategory(getQueryParams(search));

  test('マスタにある種別だけを受け付ける', () => {
    assert.equal(CATEGORY_QUERY_KEY, 'category');
    for (const { value } of CONTACT_CATEGORIES) assert.equal(preset(`?category=${value}`), value);
  });

  test('未指定・マスタに無い値・不正な形は空文字（未選択のまま）', () => {
    for (const search of ['', '?', '?category=', '?category=unknown', '?category=%3Cscript%3E', '?other=press', '?category=press&category=other']) {
      assert.equal(preset(search), '', search);
    }
    assert.equal(resolvePresetCategory(null), '');
    assert.equal(resolvePresetCategory({ category: ['press'] }), '');
  });

  test('トップの「タレントとして登録」はタレント登録の種別を選んだ状態で開く', () => {
    const html = read('index.html');
    const match = html.match(/href="(contact\.html\?[^"]*)"[^>]*>タレントとして登録</);
    assert.ok(match, 'ヒーローのリンクが見つからない');
    assert.equal(preset(match[1].slice('contact.html'.length)), 'talent-registration');
  });
});
import { getSteps, CONTACT_STEPS } from '../js/components/step-indicator.js';
import { STORAGE_KEYS, getContactDraft } from '../js/lib/storage.js';
import { CONTACT_LIMITS } from '../js/lib/validation.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');

class MemoryStorage {
  #items = new Map();
  getItem(key) { return this.#items.has(key) ? this.#items.get(key) : null; }
  setItem(key, value) { this.#items.set(key, String(value)); }
  removeItem(key) { this.#items.delete(key); }
}
/** 読めるが書けない（容量超過など）。中身は作成時に渡す */
class ReadOnlyStorage extends MemoryStorage {
  constructor(entries = {}) {
    super();
    for (const [key, value] of Object.entries(entries)) super.setItem(key, value);
  }
  setItem() { throw new Error('QuotaExceededError'); }
}
/** 読み書きはできるが削除だけ失敗する */
class UndeletableStorage extends MemoryStorage {
  removeItem() { throw new Error('SecurityError'); }
}
class BrokenStorage {
  getItem() { throw new Error('SecurityError'); }
  setItem() { throw new Error('QuotaExceededError'); }
  removeItem() { throw new Error('SecurityError'); }
}
const installStorage = (storage) => {
  Object.defineProperty(globalThis, 'sessionStorage', { value: storage, configurable: true, writable: true });
};

const validRaw = () => ({
  name: '  山田 花子  ',
  email: ' hanako@example.com ',
  company: '',
  category: 'job-posting',
  body: 'あ'.repeat(CONTACT_LIMITS.bodyMin),
  agree: true,
});
const savedDraft = (extra = {}) => ({
  name: '山田 花子', email: 'hanako@example.com', company: '', category: 'job-posting',
  body: 'あ'.repeat(CONTACT_LIMITS.bodyMin), agree: true, ...extra,
});

let originalWarn;
beforeEach(() => {
  installStorage(new MemoryStorage());
  // 壊れた保存値を読んだときの警告でテスト出力が埋まらないようにする
  originalWarn = console.warn;
  console.warn = () => {};
});
afterEach(() => {
  console.warn = originalWarn;
  delete globalThis.sessionStorage;
});

describe('入力画面：不正な入力では進めない', () => {
  for (const field of ['name', 'email', 'category', 'body']) {
    test(`必須（${field}）が未入力なら invalid で、下書きは保存しない`, () => {
      const result = submitContactInput({ ...validRaw(), [field]: '   ' });
      assert.equal(result.ok, false);
      assert.equal(result.reason, 'invalid');
      assert.ok(result.errors[field]);
      assert.equal(getContactDraft(), null);
    });
  }

  test('プライバシーポリシーに同意していないと進めない', () => {
    const result = submitContactInput({ ...validRaw(), agree: false });
    assert.equal(result.ok, false);
    assert.ok(result.errors.agree);
  });

  test('メール形式が不正なら具体的なエラー文で進めない', () => {
    for (const email of ['hanako', 'hanako@', 'hanako@example', 'a b@example.com']) {
      const result = submitContactInput({ ...validRaw(), email });
      assert.equal(result.ok, false, email);
      assert.equal(result.errors.email, 'メールアドレスの形式が正しくありません');
    }
  });

  test('本文が9文字・1001文字なら進めない', () => {
    for (const length of [CONTACT_LIMITS.bodyMin - 1, CONTACT_LIMITS.bodyMax + 1]) {
      const result = submitContactInput({ ...validRaw(), body: 'あ'.repeat(length) });
      assert.equal(result.ok, false, `${length}文字`);
      assert.match(result.errors.body, new RegExp(`現在${length}文字`));
      assert.equal(getContactDraft(), null);
    }
  });

  test('本文が10文字・1000文字ちょうどなら進める', () => {
    for (const length of [CONTACT_LIMITS.bodyMin, CONTACT_LIMITS.bodyMax]) {
      const result = submitContactInput({ ...validRaw(), body: 'あ'.repeat(length) });
      assert.equal(result.ok, true, `${length}文字`);
    }
  });

  test('種別がマスタに無い値なら進めない', () => {
    const result = submitContactInput({ ...validRaw(), category: 'hack' });
    assert.equal(result.ok, false);
    assert.ok(result.errors.category);
  });

  test('エラー欄の並び順は画面の上から順', () => {
    assert.deepEqual([...CONTACT_FIELD_ORDER], ['name', 'email', 'company', 'category', 'body', 'agree']);
    const result = submitContactInput({});
    assert.equal(CONTACT_FIELD_ORDER.find((name) => result.errors[name]), 'name');
  });
});

describe('入力画面：正常な入力', () => {
  test('前後の空白を除いた値で下書きが保存され、確認画面へ進む判定になる', () => {
    const result = submitContactInput(validRaw());
    assert.equal(result.ok, true);
    assert.equal(result.redirect, CONTACT_PAGES.confirm);
    assert.deepEqual(getContactDraft(), savedDraft());
  });

  test('FormData 由来のチェック値 "on" も同意として扱い、真偽値で保存する', () => {
    submitContactInput({ ...validRaw(), agree: 'on' });
    assert.equal(getContactDraft().agree, true);
  });

  test('sessionStorage が使えないときは例外を出さず reason: storage を返す', () => {
    installStorage(new BrokenStorage());
    assert.deepEqual(submitContactInput(validRaw()), { ok: false, reason: 'storage' });
  });

  test('確認画面から戻ったときは下書きの値を復元する', () => {
    submitContactInput({ ...validRaw(), company: '架空映像' });
    assert.deepEqual(getRestoreValues(), savedDraft({ company: '架空映像' }));
  });

  test('下書きが無い・壊れているときは復元しない（null）', () => {
    assert.equal(getRestoreValues(), null);
    sessionStorage.setItem(STORAGE_KEYS.contact, '{broken');
    assert.equal(getRestoreValues(), null);
  });
});

describe('確認画面', () => {
  test('下書きが無いと contact.html へのリダイレクト判定になる', () => {
    assert.equal(CONTACT_PAGES.input, 'contact.html');
    assert.deepEqual(resolveConfirmPage(), { redirect: CONTACT_PAGES.input });
  });

  test('正常な下書きは確認画面用の項目（種別は表示ラベル）に変換される', () => {
    submitContactInput(validRaw());
    assert.deepEqual(resolveConfirmPage().items, [
      { key: 'name', label: 'お名前', value: '山田 花子' },
      { key: 'email', label: 'メールアドレス', value: 'hanako@example.com' },
      { key: 'company', label: '会社名', value: '（未入力）' },
      { key: 'category', label: 'お問い合わせ種別', value: '案件掲載について' },
      { key: 'body', label: 'お問い合わせ内容', value: 'あ'.repeat(CONTACT_LIMITS.bodyMin) },
      { key: 'agree', label: 'プライバシーポリシー', value: '同意する' },
    ]);
  });

  test('HTML のような文字列も加工せずそのまま値として渡す（表示側は textContent）', () => {
    const name = '<script>alert(1)</script>';
    submitContactInput({ ...validRaw(), name });
    assert.equal(resolveConfirmPage().items.find((item) => item.key === 'name').value, name);
  });

  test('改ざんされた下書きはリダイレクト判定になる', () => {
    const tampered = [
      savedDraft({ category: 'not-in-master' }),
      savedDraft({ body: 12345678901 }),
      savedDraft({ agree: 'yes' }),
      savedDraft({ email: 'javascript:alert(1)' }),
      savedDraft({ extra: 'x' }),
      savedDraft({ submitted: 'true' }),
      savedDraft({ body: 'あ'.repeat(CONTACT_LIMITS.bodyMax + 1) }),
    ];
    for (const draft of tampered) {
      sessionStorage.setItem(STORAGE_KEYS.contact, JSON.stringify(draft));
      assert.equal(readContactDraft(), null, JSON.stringify(draft).slice(0, 60));
      assert.deepEqual(resolveConfirmPage(), { redirect: CONTACT_PAGES.input });
    }
    for (const raw of ['[]', '"text"', 'null', '{broken']) {
      sessionStorage.setItem(STORAGE_KEYS.contact, raw);
      assert.deepEqual(resolveConfirmPage(), { redirect: CONTACT_PAGES.input }, raw);
    }
  });

  test('「送信する」で送信済みの印を付け、完了画面へ進む判定になる', () => {
    submitContactInput(validRaw());
    assert.deepEqual(prepareContactSubmission(), { ok: true, redirect: CONTACT_PAGES.complete });
    assert.equal(getContactDraft().submitted, true);
  });

  test('下書きが無いまま送信しようとすると contact.html へ戻す', () => {
    assert.deepEqual(prepareContactSubmission(), { ok: false, reason: 'missing', redirect: CONTACT_PAGES.input });
  });

  test('送信済みの印を保存できないときは reason: storage（例外を出さない）', () => {
    installStorage(new ReadOnlyStorage({ [STORAGE_KEYS.contact]: JSON.stringify(savedDraft()) }));
    assert.deepEqual(prepareContactSubmission(), { ok: false, reason: 'storage' });
  });
});

describe('完了画面', () => {
  test('下書きが無いと contact.html へのリダイレクト判定になる', () => {
    assert.deepEqual(completeContact(), { redirect: CONTACT_PAGES.input });
  });

  test('確認画面を経ていない（送信済みの印が無い）下書きでもリダイレクト判定になり、下書きは残す', () => {
    submitContactInput(validRaw());
    assert.deepEqual(completeContact(), { redirect: CONTACT_PAGES.input });
    assert.ok(getContactDraft(), '入力途中の内容は消さない');
  });

  test('完了後に下書きが削除される', () => {
    submitContactInput(validRaw());
    prepareContactSubmission();
    assert.deepEqual(completeContact(), { ok: true, cleared: true });
    assert.equal(getContactDraft(), null);
    assert.equal(sessionStorage.getItem(STORAGE_KEYS.contact), null);
    // 再読み込みすると下書きが無いので入力画面へ戻る
    assert.deepEqual(completeContact(), { redirect: CONTACT_PAGES.input });
  });

  test('削除に失敗しても完了画面は表示できる（cleared: false）', () => {
    installStorage(new UndeletableStorage());
    sessionStorage.setItem(STORAGE_KEYS.contact, JSON.stringify(savedDraft({ submitted: true })));
    assert.deepEqual(completeContact(), { ok: true, cleared: false });
  });
});

describe('ステップ表示', () => {
  test('入力 → 確認 → 完了 の順で、現在ステップと済んだステップを返す', () => {
    assert.deepEqual(CONTACT_STEPS.map((step) => step.label), ['入力', '確認', '完了']);
    assert.deepEqual(getSteps('confirm'), [
      { key: 'input', label: '入力', state: 'done' },
      { key: 'confirm', label: '確認', state: 'current' },
      { key: 'complete', label: '完了', state: 'upcoming' },
    ]);
  });

  test('未知のステップ名は先頭（入力）を現在扱いにする', () => {
    assert.equal(getSteps('unknown')[0].state, 'current');
  });
});

describe('マークアップと安全性', () => {
  /** 指定した name を持つタグ1つ分の文字列を取り出す（属性の並び順に依存しないため） */
  const tagOf = (html, tag, name) => html.match(new RegExp(`<${tag}\\b[^>]*\\bname="${name}"[^>]*>`))?.[0] ?? '';

  test('入力欄の required / type / minlength / maxlength が仕様と定数に一致する', () => {
    const html = read('contact.html');
    const name = tagOf(html, 'input', 'name');
    assert.match(name, /\brequired\b/);
    assert.match(name, new RegExp(`maxlength="${CONTACT_LIMITS.nameMax}"`));
    const email = tagOf(html, 'input', 'email');
    assert.match(email, /type="email"/);
    assert.match(email, /\brequired\b/);
    const company = tagOf(html, 'input', 'company');
    assert.doesNotMatch(company, /\brequired\b/);
    assert.match(company, new RegExp(`maxlength="${CONTACT_LIMITS.companyMax}"`));
    assert.match(tagOf(html, 'select', 'category'), /\brequired\b/);
    const body = tagOf(html, 'textarea', 'body');
    assert.match(body, /\brequired\b/);
    assert.match(body, new RegExp(`minlength="${CONTACT_LIMITS.bodyMin}"`));
    assert.match(body, new RegExp(`maxlength="${CONTACT_LIMITS.bodyMax}"`));
    const agree = tagOf(html, 'input', 'agree');
    assert.match(agree, /type="checkbox"/);
    assert.match(agree, /\brequired\b/);
    assert.match(html, /href="privacy\.html"/);
  });

  test('各入力欄のエラー文が aria-describedby で紐付いている', () => {
    const html = read('contact.html');
    for (const [tag, name] of [['input', 'name'], ['input', 'email'], ['input', 'company'], ['select', 'category'], ['textarea', 'body'], ['input', 'agree']]) {
      const ids = tagOf(html, tag, name).match(/aria-describedby="([^"]+)"/)?.[1].split(/\s+/) ?? [];
      const errorId = ids.find((id) => new RegExp(`id="${id}"[^>]*data-field-error="${name}"`).test(html));
      assert.ok(errorId, `${name} のエラー文が aria-describedby に無い`);
    }
  });

  test('form に action 属性が無い（外部へ送らない）', () => {
    for (const page of ['contact.html', 'contact-confirm.html', 'contact-complete.html']) {
      assert.doesNotMatch(read(page), /<form[^>]*\baction=/, page);
    }
  });

  test('各ページがページ固有の CSS / JS を読み込む', () => {
    for (const page of ['contact', 'contact-confirm', 'contact-complete']) {
      const html = read(`${page}.html`);
      assert.match(html, /<link rel="stylesheet" href="css\/pages\/contact\.css">/, page);
      assert.match(html, new RegExp(`<script type="module" src="js/pages/${page}\\.js"></script>`), page);
    }
  });

  test('問い合わせの JS は外部送信・innerHTML を使わない', () => {
    const files = [
      'js/pages/contact.js', 'js/pages/contact-confirm.js', 'js/pages/contact-complete.js',
      'js/lib/contact-flow.js', 'js/components/step-indicator.js',
    ];
    for (const file of files) {
      const source = read(file);
      for (const pattern of [/\bfetch\s*\(/, /XMLHttpRequest/, /sendBeacon/, /innerHTML/, /insertAdjacentHTML/, /\.submit\s*\(/]) {
        assert.doesNotMatch(source, pattern, `${file}: ${pattern}`);
      }
    }
  });

  test('CSS に HEX / rgb() の直書きが無い', () => {
    assert.doesNotMatch(read('css/pages/contact.css'), /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
  });
});
