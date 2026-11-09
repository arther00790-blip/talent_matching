// js/lib/utils.js のテスト（escapeHTML は #02、それ以外は #04 で追加）
import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHTML, getQueryParams, buildQueryString, setQueryParams, formatDate, formatDuration,
} from '../js/lib/utils.js';

describe('getQueryParams', () => {
  test('クエリをオブジェクトにする（日本語もデコードされる）', () => {
    assert.deepEqual({ ...getQueryParams('?role=actor&area=%E6%9D%B1%E4%BA%AC%E9%83%BD') }, { role: 'actor', area: '東京都' });
  });

  test('同じキーが複数あれば配列にする（スキルの複数指定）', () => {
    assert.deepEqual({ ...getQueryParams('?skills=英語&skills=ダンス&role=actor') }, { skills: ['英語', 'ダンス'], role: 'actor' });
  });

  test('先頭の ? は省略でき、空なら空オブジェクト', () => {
    assert.deepEqual({ ...getQueryParams('id=t001') }, { id: 't001' });
    assert.deepEqual({ ...getQueryParams('') }, {});
    assert.deepEqual({ ...getQueryParams(undefined) }, {});
  });

  test('__proto__ のようなキーでもプロトタイプを汚染しない', () => {
    const params = getQueryParams('?__proto__=x&constructor=y');
    assert.equal(Object.getPrototypeOf(params), null);
    assert.equal(params.__proto__, 'x');
    assert.equal({}.constructor, Object);
  });
});

describe('buildQueryString', () => {
  test('空の値（"" / null / undefined / false / 空配列）は省く', () => {
    assert.equal(buildQueryString({ role: 'actor', area: '', gender: null, ageRange: undefined, video: false, skills: [] }), '?role=actor');
    assert.equal(buildQueryString({}), '');
  });

  test('配列は同じキーの繰り返しにし、true は "1" にする', () => {
    assert.equal(buildQueryString({ skills: ['英語', 'ダンス'], video: true }),
      `?skills=${encodeURIComponent('英語')}&skills=${encodeURIComponent('ダンス')}&video=1`);
  });

  test('getQueryParams と往復しても一致する', () => {
    const params = { role: 'actor', area: '東京都', skills: ['英語', 'ダンス'], keyword: 'a&b=c' };
    assert.deepEqual({ ...getQueryParams(buildQueryString(params)) }, params);
  });
});

describe('setQueryParams', () => {
  const originalLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
  const originalHistory = Object.getOwnPropertyDescriptor(globalThis, 'history');

  afterEach(() => {
    for (const [name, descriptor] of [['location', originalLocation], ['history', originalHistory]]) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });

  function install(name, value) {
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }

  test('history.replaceState で URL を書き換え、履歴を増やさない', () => {
    const calls = [];
    install('location', { pathname: '/talents.html', hash: '#list' });
    install('history', { state: { keep: true }, replaceState: (...args) => calls.push(args) });
    assert.equal(setQueryParams({ role: 'actor' }), '?role=actor');
    assert.deepEqual(calls, [[{ keep: true }, '', '/talents.html?role=actor#list']]);
  });

  test('条件が空ならクエリなしの URL にする', () => {
    const calls = [];
    install('location', { pathname: '/jobs.html', hash: '' });
    install('history', { state: null, replaceState: (...args) => calls.push(args) });
    assert.equal(setQueryParams({}), '');
    assert.equal(calls[0][2], '/jobs.html');
  });

  test('history が無い・例外を投げる環境でもクエリ文字列を返し、落ちない', () => {
    assert.equal(setQueryParams({ role: 'model' }), '?role=model');
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      install('location', { pathname: '/', hash: '' });
      install('history', { state: null, replaceState: () => { throw new Error('SecurityError'); } });
      assert.equal(setQueryParams({ role: 'model' }), '?role=model');
    } finally {
      console.warn = originalWarn;
    }
  });
});

describe('formatDate', () => {
  test('ISO 日付を「YYYY年M月D日」にする（日付だけの文字列はタイムゾーンでずらさない）', () => {
    assert.equal(formatDate('2026-11-05'), '2026年11月5日');
    assert.equal(formatDate('2027-01-31'), '2027年1月31日');
  });

  test('Date も受け付ける', () => {
    assert.equal(formatDate(new Date(2026, 0, 9, 23, 59)), '2026年1月9日');
  });

  test('日時の文字列は、その瞬間のローカル日付で表示する', () => {
    const value = '2026-10-20T10:00:00+09:00';
    const local = new Date(value);
    assert.equal(formatDate(value), `${local.getFullYear()}年${local.getMonth() + 1}月${local.getDate()}日`);
  });

  test('不正な値は空文字（「Invalid Date」を画面に出さない）', () => {
    assert.equal(formatDate('not-a-date'), '');
    assert.equal(formatDate('2026-02-30'), '');
    assert.equal(formatDate(''), '');
    assert.equal(formatDate(null), '');
    assert.equal(formatDate(new Date(Number.NaN)), '');
  });
});

describe('formatDuration', () => {
  test('84秒は「1分24秒」', () => {
    assert.equal(formatDuration(84), '1分24秒');
  });

  test('1分未満は秒だけ、ちょうどの分は分だけ', () => {
    assert.equal(formatDuration(0), '0秒');
    assert.equal(formatDuration(45), '45秒');
    assert.equal(formatDuration(60), '1分');
    assert.equal(formatDuration(600), '10分');
  });

  test('端数は切り上げる（60.2秒の動画を「1分」と表示して上限内に見せないため）', () => {
    assert.equal(formatDuration(60.2), '1分1秒');
    assert.equal(formatDuration(29.1), '30秒');
  });

  test('負の数・数値以外は空文字', () => {
    assert.equal(formatDuration(-1), '');
    assert.equal(formatDuration(Number.NaN), '');
    assert.equal(formatDuration(Number.POSITIVE_INFINITY), '');
    assert.equal(formatDuration('84'), '');
  });
});

describe('escapeHTML', () => {
  test('& をエスケープする', () => {
    assert.equal(escapeHTML('A&B'), 'A&amp;B');
  });

  test('< と > をエスケープする', () => {
    assert.equal(escapeHTML('<script>'), '&lt;script&gt;');
  });

  test('" をエスケープする（属性値を閉じさせない）', () => {
    assert.equal(escapeHTML('say "hi"'), 'say &quot;hi&quot;');
  });

  test("' をエスケープする（単引用符の属性値を閉じさせない）", () => {
    assert.equal(escapeHTML("it's"), 'it&#39;s');
  });

  test('& を先に処理し、二重エスケープの崩れが起きない', () => {
    assert.equal(escapeHTML('&lt;'), '&amp;lt;');
    assert.equal(escapeHTML(`<a href="x" title='y'>&</a>`), '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
  });

  test('null / undefined は空文字、数値は文字列にする', () => {
    assert.equal(escapeHTML(null), '');
    assert.equal(escapeHTML(undefined), '');
    assert.equal(escapeHTML(42), '42');
  });

  test('記号を含まない日本語はそのまま返す', () => {
    assert.equal(escapeHTML('春風 みなみ'), '春風 みなみ');
  });
});
