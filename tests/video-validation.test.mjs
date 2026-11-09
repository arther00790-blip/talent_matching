// #07 自己紹介動画の形式・サイズ・長さチェックのテスト（要件 6.7「チェック条件」）
// 境界（ちょうど上限／1つ超え）と、エラー文に「選択したファイルの実際の値」が入ることを確かめる。
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  VIDEO_MAX_SIZE_MB, VIDEO_MAX_BYTES, VIDEO_MAX_DURATION_SECONDS, VIDEO_ACCEPT, VIDEO_ERRORS,
  isAcceptedVideoFile, formatSizeMB, validateVideoFile, validateVideoDuration,
} from '../js/lib/video-validation.js';

const MB = 1024 * 1024;
const file = (overrides = {}) => ({ name: 'intro.mp4', type: 'video/mp4', size: 10 * MB, ...overrides });

describe('上限値の定数', () => {
  test('50MB・60秒・accept 属性が要件どおり', () => {
    assert.equal(VIDEO_MAX_SIZE_MB, 50);
    assert.equal(VIDEO_MAX_BYTES, 50 * MB);
    assert.equal(VIDEO_MAX_DURATION_SECONDS, 60);
    assert.equal(VIDEO_ACCEPT, 'video/mp4,video/webm,video/quicktime');
  });
});

describe('形式', () => {
  test('MP4 / WebM / MOV は OK', () => {
    for (const [name, type] of [['a.mp4', 'video/mp4'], ['a.webm', 'video/webm'], ['a.mov', 'video/quicktime']]) {
      assert.equal(validateVideoFile(file({ name, type })).valid, true, type);
    }
  });

  test('MIME タイプが空でも拡張子が対応形式なら OK（Windows の MOV など）', () => {
    assert.equal(isAcceptedVideoFile({ name: 'clip.MOV', type: '' }), true);
    assert.equal(isAcceptedVideoFile({ name: 'clip.avi', type: '' }), false);
  });

  test('対応外の形式は NG で、決まった文言を返す', () => {
    for (const target of [file({ name: 'a.avi', type: 'video/x-msvideo' }), file({ name: 'a.png', type: 'image/png' }), file({ name: 'a.mp4', type: 'text/plain' })]) {
      const result = validateVideoFile(target);
      assert.equal(result.valid, false);
      assert.equal(result.code, 'format');
      assert.equal(result.error, '対応している形式は MP4・WebM・MOV です');
    }
  });

  test('ファイル以外の値は形式エラー扱いで例外を出さない', () => {
    assert.equal(validateVideoFile(null).valid, false);
    assert.equal(validateVideoFile(undefined).code, 'format');
  });
});

describe('サイズ', () => {
  test('50MB ちょうどは OK', () => {
    assert.deepEqual(validateVideoFile(file({ size: 50 * MB })), { valid: true, code: '', error: '' });
  });

  test('50MB を1バイトでも超えたら NG（表示は切り上げて 51MB）', () => {
    const result = validateVideoFile(file({ size: 50 * MB + 1 }));
    assert.equal(result.valid, false);
    assert.equal(result.code, 'size');
    assert.equal(result.error, 'ファイルサイズは50MBまでです（選択：51MB）');
  });

  test('エラー文に実際のサイズが入る', () => {
    assert.equal(validateVideoFile(file({ size: 72 * MB })).error, 'ファイルサイズは50MBまでです（選択：72MB）');
    assert.equal(validateVideoFile(file({ size: 75 * MB })).error, 'ファイルサイズは50MBまでです（選択：75MB）');
  });

  test('形式とサイズが両方 NG なら形式を先に伝える（直しても無駄にならない順）', () => {
    assert.equal(validateVideoFile(file({ name: 'a.avi', type: 'video/x-msvideo', size: 80 * MB })).code, 'format');
  });

  test('MB 表示は切り上げ', () => {
    assert.equal(formatSizeMB(72 * MB), '72MB');
    assert.equal(formatSizeMB(72 * MB + 1), '73MB');
  });
});

describe('長さ', () => {
  test('60秒ちょうどは OK', () => {
    assert.deepEqual(validateVideoDuration(60), { valid: true, code: '', error: '' });
    assert.equal(validateVideoDuration(0.5).valid, true);
  });

  test('60秒を超えたら NG で、実際の長さが入る', () => {
    assert.equal(validateVideoDuration(60.2).error, '動画は60秒以内にしてください（選択：1分1秒）');
    assert.equal(validateVideoDuration(84).error, '動画は60秒以内にしてください（選択：1分24秒）');
    assert.equal(validateVideoDuration(90).error, '動画は60秒以内にしてください（選択：1分30秒）');
    assert.equal(validateVideoDuration(120).code, 'duration');
  });

  test('長さが取れない（NaN・Infinity・負数）は読込失敗として扱う', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, -1, undefined, '30']) {
      const result = validateVideoDuration(value);
      assert.equal(result.valid, false);
      assert.equal(result.code, 'load');
      assert.equal(result.error, VIDEO_ERRORS.load);
    }
    assert.equal(VIDEO_ERRORS.load, 'この動画は読み込めませんでした。別のファイルでお試しください');
  });
});
