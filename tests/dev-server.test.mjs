import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { resolveRequestPath, contentTypeFor, parseRange, isAllowedHost } from '../scripts/dev-server.mjs';

// DNS リバインディング（攻撃者のドメインを 127.0.0.1 に向け直す手口）でファイルを読まれないよう、Host を確認する
test('Host ヘッダーは 127.0.0.1 / localhost だけを許可する', () => {
  for (const host of ['127.0.0.1:8000', '127.0.0.1', 'localhost:8000', 'LOCALHOST:8001', 'localhost']) {
    assert.equal(isAllowedHost(host), true, host);
  }
  for (const host of [undefined, '', 'evil.example', 'evil.example:8000', '127.0.0.1.evil.example', 'localhost.evil.example:8000', '192.168.0.10:8000']) {
    assert.equal(isAllowedHost(host), false, String(host));
  }
});

const ROOT = resolve('site-root');

test('ルート直下のファイルはそのまま解決する', () => {
  assert.equal(resolveRequestPath(ROOT, '/jobs.html?role=actor'), join(ROOT, 'jobs.html'));
});

test('末尾スラッシュは index.html を返す', () => {
  assert.equal(resolveRequestPath(ROOT, '/'), join(ROOT, 'index.html'));
});

test('素の .. はURL解析で正規化され、ルート内に留まる', () => {
  assert.equal(resolveRequestPath(ROOT, '/../secret.txt'), join(ROOT, 'secret.txt'));
});

// URL解析では区切りとみなされず、デコード後に初めて .. になるため、ここで弾く必要がある
test('エンコードされた区切り文字でルート外を指すパスは null を返す', () => {
  assert.equal(resolveRequestPath(ROOT, '/..%2f..%2fsecret.txt'), null);
  assert.equal(resolveRequestPath(ROOT, '/..%5c..%5csecret.txt'), null);
});

test('不正なURLエンコードは null を返す', () => {
  assert.equal(resolveRequestPath(ROOT, '/%E0%A4%A'), null);
});

test('拡張子からContent-Typeを決め、未知のものは汎用型にする', () => {
  assert.match(contentTypeFor('a/b.js'), /^text\/javascript/);
  assert.match(contentTypeFor('a/b.html'), /^text\/html/);
  assert.equal(contentTypeFor('a/b.unknown'), 'application/octet-stream');
});

// 動画のシークにはブラウザの Range リクエスト（206 Partial Content）への対応が必要
test('Range ヘッダーを開始・終了バイトに変換する', () => {
  assert.deepEqual(parseRange('bytes=0-', 1000), { start: 0, end: 999 });
  assert.deepEqual(parseRange('bytes=100-199', 1000), { start: 100, end: 199 });
  assert.deepEqual(parseRange('bytes=-200', 1000), { start: 800, end: 999 });
  assert.deepEqual(parseRange('bytes=900-5000', 1000), { start: 900, end: 999 });
});

test('Range ヘッダーが無ければ null、満たせない範囲は "invalid"', () => {
  assert.equal(parseRange(undefined, 1000), null);
  assert.equal(parseRange('bytes=1000-', 1000), 'invalid');
  assert.equal(parseRange('bytes=500-100', 1000), 'invalid');
  assert.equal(parseRange('items=0-10', 1000), 'invalid');
  assert.equal(parseRange('bytes=0-10,20-30', 1000), 'invalid');
});
