// #05 タレント一覧・詳細のテスト
// DOM を使わずに検証できるよう、URL⇔フィルター変換・動画ソース選択・詳細の表示状態は純粋関数を対象にする。
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EMPTY_TALENT_FILTERS, parseTalentFilters, talentFiltersToParams, isTalentFilterEmpty, talentFilterFormHTML,
} from '../js/components/talent-filter.js';
import {
  resolveVideoSource, loadStoredIntroVideo, videoPlayerSpec, guessVideoType,
} from '../js/components/video-player.js';
import { resolveTalentDetail, toTalentProfileView } from '../js/components/talent-profile.js';
import { getQueryParams, buildQueryString } from '../js/lib/utils.js';
import { filterTalents } from '../js/lib/filters.js';
import { TALENTS, DEMO_TALENT_ID } from '../js/data/talents.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const RAW_COLOR_PATTERN = /#[0-9A-Fa-f]{3,8}\b|\brgba?\(|\bhsla?\(/;

/** URL に載せて読み戻す（実際のページと同じ経路で往復させる） */
const roundTrip = (state) => parseTalentFilters(getQueryParams(buildQueryString(talentFiltersToParams(state))));

describe('フィルター状態 ⇔ クエリ文字列', () => {
  test('条件なしはクエリが空になる', () => {
    assert.equal(buildQueryString(talentFiltersToParams(EMPTY_TALENT_FILTERS)), '');
    assert.ok(isTalentFilterEmpty(parseTalentFilters(getQueryParams(''))));
  });

  test('全項目を指定した状態が往復で一致する', () => {
    const state = {
      role: 'actor', gender: 'female', ageRange: '20代前半', area: '東京都',
      skills: ['英語', 'ダンス'], keyword: '舞台 明るい', videoOnly: true,
    };
    assert.deepEqual(roundTrip(state), state);
    assert.equal(isTalentFilterEmpty(state), false);
  });

  test('地方名・スキル1件でも往復で一致する', () => {
    const state = { ...EMPTY_TALENT_FILTERS, area: '関東', skills: ['殺陣'] };
    assert.deepEqual(roundTrip(state), state);
  });

  test('チケットの例 ?role=actor&area=東京都 を復元できる', () => {
    const state = parseTalentFilters(getQueryParams('?role=actor&area=%E6%9D%B1%E4%BA%AC%E9%83%BD'));
    assert.equal(state.role, 'actor');
    assert.equal(state.area, '東京都');
    assert.equal(state.videoOnly, false);
    assert.deepEqual(state.skills, []);
  });

  test('マスタに無い値は捨てる（URL を手で書き換えられても壊れない）', () => {
    const state = parseTalentFilters(getQueryParams('?role=hacker&gender=x&ageRange=99&area=火星&skills=<b>&skills=英語&videoOnly=yes'));
    assert.deepEqual(state, { ...EMPTY_TALENT_FILTERS, skills: ['英語'] });
  });

  test('同じキーが複数ある単一項目は先頭を使う', () => {
    assert.equal(parseTalentFilters({ role: ['model', 'actor'] }).role, 'model');
  });

  test('スキルの重複は1つにまとめる', () => {
    assert.deepEqual(parseTalentFilters({ skills: ['英語', '英語'] }).skills, ['英語']);
  });

  test('キーワードは前後の空白を落とし、長すぎる入力は切り詰める', () => {
    assert.equal(parseTalentFilters({ keyword: '  舞台  ' }).keyword, '舞台');
    assert.ok(parseTalentFilters({ keyword: 'あ'.repeat(500) }).keyword.length <= 100);
  });

  test('引数が不正でも空の状態を返す', () => {
    assert.deepEqual(parseTalentFilters(null), EMPTY_TALENT_FILTERS);
    assert.deepEqual(parseTalentFilters('role=actor'), EMPTY_TALENT_FILTERS);
  });

  test('戻り値は filterTalents の条件としてそのまま使える', () => {
    const state = parseTalentFilters(getQueryParams('?videoOnly=1'));
    const result = filterTalents(TALENTS, state);
    assert.ok(result.length > 0);
    assert.ok(result.every((talent) => talent.introVideo));
  });

  test('EMPTY_TALENT_FILTERS は書き換えられない', () => {
    assert.ok(Object.isFrozen(EMPTY_TALENT_FILTERS));
  });
});

describe('フィルターフォームの HTML', () => {
  const html = talentFilterFormHTML();

  test('6.5 の全項目（職種・性別・年齢帯・地域・スキル・キーワード・動画ありのみ）がある', () => {
    for (const name of ['role', 'gender', 'ageRange', 'area', 'skills', 'keyword', 'videoOnly']) {
      assert.match(html, new RegExp(`name="${name}"`), name);
    }
  });

  test('スキルは複数選べるチェックボックス', () => {
    assert.match(html, /type="checkbox"[^>]*name="skills"/);
  });

  test('各入力にラベルが結び付いている', () => {
    for (const id of ['talent-filter-role', 'talent-filter-gender', 'talent-filter-age', 'talent-filter-area', 'talent-filter-keyword']) {
      assert.match(html, new RegExp(`for="${id}"`), id);
      assert.match(html, new RegExp(`id="${id}"`), id);
    }
  });
});

describe('動画ソースの選択', () => {
  const talent = TALENTS.find((item) => item.id === DEMO_TALENT_ID);
  const noVideoTalent = TALENTS.find((item) => !item.introVideo);
  const fakeBlob = { type: 'video/webm', size: 10 };
  const createObjectURL = () => 'blob:fake-url';

  test('IndexedDB の動画があれば Blob URL を使う', () => {
    const source = resolveVideoSource({ talent, storedVideo: { blob: fakeBlob, caption: '登録した動画' }, createObjectURL });
    assert.equal(source.src, 'blob:fake-url');
    assert.equal(source.type, 'video/webm');
    assert.equal(source.isObjectURL, true);
    assert.equal(source.caption, '登録した動画');
  });

  test('IndexedDB に無ければ introVideo.src を使う', () => {
    const source = resolveVideoSource({ talent, storedVideo: null, createObjectURL });
    assert.equal(source.src, talent.introVideo.src);
    assert.equal(source.poster, talent.introVideo.poster);
    assert.equal(source.type, 'video/webm');
    assert.equal(source.isObjectURL, false);
  });

  test('どちらも無ければ null（プレーヤーを出さない）', () => {
    assert.equal(resolveVideoSource({ talent: noVideoTalent, storedVideo: null, createObjectURL }), null);
    assert.equal(resolveVideoSource({}), null);
    assert.equal(resolveVideoSource(), null);
  });

  test('Blob URL を作れない環境・失敗時は introVideo.src に戻る', () => {
    const throwing = () => { throw new Error('unsupported'); };
    assert.equal(resolveVideoSource({ talent, storedVideo: { blob: fakeBlob }, createObjectURL: throwing }).src, talent.introVideo.src);
    assert.equal(resolveVideoSource({ talent, storedVideo: { blob: fakeBlob } }).src, talent.introVideo.src);
  });

  test('Blob そのものを渡されても使える', () => {
    assert.equal(resolveVideoSource({ talent: noVideoTalent, storedVideo: fakeBlob, createObjectURL }).src, 'blob:fake-url');
  });

  test('src が javascript: などの危険な値なら使わない', () => {
    const bad = { ...noVideoTalent, introVideo: { src: 'javascript:alert(1)', poster: 'javascript:alert(1)' } };
    assert.equal(resolveVideoSource({ talent: bad }), null);
  });

  test('拡張子から MIME タイプを推定する', () => {
    assert.equal(guessVideoType('a/b.mp4'), 'video/mp4');
    assert.equal(guessVideoType('a/b.WEBM'), 'video/webm');
    assert.equal(guessVideoType('a/b.mov?x=1'), 'video/quicktime');
    assert.equal(guessVideoType('a/b'), '');
  });
});

describe('IndexedDB からの読み込み（#07 の video-store.js 連携口）', () => {
  test('ストア未指定（#07 完了前）は null', async () => {
    assert.equal(await loadStoredIntroVideo(DEMO_TALENT_ID), null);
  });

  test('デモ用タレント本人だけストアを見る', async () => {
    const calls = [];
    const store = { getVideo: async (id) => { calls.push(id); return { blob: {} }; } };
    assert.deepEqual(await loadStoredIntroVideo(DEMO_TALENT_ID, store), { blob: {} });
    assert.equal(await loadStoredIntroVideo('t002', store), null);
    assert.deepEqual(calls, [DEMO_TALENT_ID]);
  });

  test('ストアが失敗しても例外を出さず null', async () => {
    const store = { getVideo: async () => { throw new Error('blocked'); } };
    assert.equal(await loadStoredIntroVideo(DEMO_TALENT_ID, store), null);
  });
});

describe('動画プレーヤーの属性', () => {
  const source = { src: 'assets/videos/t001.mp4', type: 'video/mp4', poster: 'assets/images/videos/t001.jpg', caption: 'こんにちは', duration: 28 };
  const spec = videoPlayerSpec(source, { tracks: [{ src: 'a.vtt', kind: 'captions', srclang: 'ja', label: '日本語' }] });

  test('controls / preload="metadata" / playsinline / poster があり、自動再生しない', () => {
    assert.equal(spec.attributes.controls, true);
    assert.equal(spec.attributes.preload, 'metadata');
    assert.equal(spec.attributes.playsinline, true);
    assert.equal(spec.attributes.poster, source.poster);
    assert.equal('autoplay' in spec.attributes, false);
  });

  test('<track> を差し込める', () => {
    assert.deepEqual(spec.tracks, [{ src: 'a.vtt', kind: 'captions', srclang: 'ja', label: '日本語' }]);
    assert.deepEqual(videoPlayerSpec(source).tracks, []);
  });

  test('不正なトラックは捨てる', () => {
    assert.deepEqual(videoPlayerSpec(source, { tracks: [{ src: 'javascript:x', kind: 'captions' }, { kind: 'bad', src: 'b.vtt' }] }).tracks, []);
  });

  test('説明文に長さを添える', () => {
    assert.equal(spec.caption, 'こんにちは（28秒）');
  });

  test('ソースが無ければ null', () => {
    assert.equal(videoPlayerSpec(null), null);
  });
});

describe('詳細ページの表示状態', () => {
  test('存在する ID ならタレントを返す', () => {
    const detail = resolveTalentDetail('t001', TALENTS);
    assert.equal(detail.status, 'ok');
    assert.equal(detail.talent.id, 't001');
  });

  test('存在しない ID・ID なしはエラー表示用の状態', () => {
    for (const id of ['t999', '', undefined, null, ['t001', 't002']]) {
      const detail = resolveTalentDetail(id, TALENTS);
      assert.equal(detail.status, 'not-found', String(id));
      assert.equal(detail.message, 'タレントが見つかりませんでした');
      assert.equal(detail.talent, null);
    }
  });

  test('データが配列でなくても落ちない', () => {
    assert.equal(resolveTalentDetail('t001', null).status, 'not-found');
  });
});

describe('プロフィールの表示内容', () => {
  const talent = TALENTS.find((item) => item.id === 't001');

  test('基本情報・スキル・SNS を表示用に整える', () => {
    const view = toTalentProfileView(talent, 'guest');
    assert.equal(view.name, '春風 みなみ');
    assert.equal(view.rolesLabel, '俳優');
    assert.deepEqual(view.facts.map((fact) => fact.label), ['性別', '年齢', '地域', '身長']);
    assert.deepEqual(view.skills, talent.skills);
    assert.deepEqual(view.sns, [{ label: 'Instagram', href: talent.sns.instagram }]);
  });

  test('出演実績は年の古い順（時系列）', () => {
    const view = toTalentProfileView({ ...talent, career: [
      { year: 2025, title: 'B', type: 'CM' }, { year: 2023, title: 'A', type: '舞台' }, { year: 2024, title: 'C', type: 'MV' },
    ] }, 'guest');
    assert.deepEqual(view.career.map((item) => item.title), ['A', 'C', 'B']);
  });

  test('写真には名前入りの alt を付ける', () => {
    const view = toTalentProfileView({ ...talent, images: ['a.jpg', 'b.jpg'] }, 'guest');
    assert.deepEqual(view.images, [
      { src: 'a.jpg', alt: '春風 みなみさんの写真（1枚目）' },
      { src: 'b.jpg', alt: '春風 みなみさんの写真（2枚目）' },
    ]);
  });

  test('スカウトボタンは企業ロールだけ', () => {
    assert.equal(toTalentProfileView(talent, 'company').canScout, true);
    assert.equal(toTalentProfileView(talent, 'talent').canScout, false);
    assert.equal(toTalentProfileView(talent, 'guest').canScout, false);
  });

  test('危険な SNS URL は出さない', () => {
    const view = toTalentProfileView({ ...talent, sns: { x: 'javascript:alert(1)' } }, 'guest');
    assert.deepEqual(view.sns, []);
  });

  test('項目が欠けたデータでも落ちない', () => {
    const view = toTalentProfileView({ id: 'x', displayName: '名無し' }, 'guest');
    assert.deepEqual(view.skills, []);
    assert.deepEqual(view.career, []);
    assert.deepEqual(view.images, []);
    assert.equal(toTalentProfileView(null, 'guest'), null);
  });
});

describe('ページのマークアップ・スタイル', () => {
  test('一覧は件数を aria-live="polite" で知らせる', () => {
    assert.match(read('talents.html'), /aria-live="polite"/);
  });

  test('一覧・詳細ともページ固有の CSS と JS を読み込む', () => {
    assert.match(read('talents.html'), /href="css\/pages\/talents\.css"/);
    assert.match(read('talents.html'), /src="js\/pages\/talents\.js"/);
    assert.match(read('talent.html'), /href="css\/pages\/talent\.css"/);
    assert.match(read('talent.html'), /src="js\/pages\/talent\.js"/);
  });

  test('ページ固有の CSS・JS に生の色値が無い', () => {
    const files = [
      'css/pages/talents.css', 'css/pages/talent.css', 'js/pages/talents.js', 'js/pages/talent.js',
      'js/components/talent-filter.js', 'js/components/video-player.js', 'js/components/talent-profile.js',
    ];
    for (const file of files) assert.doesNotMatch(read(file), RAW_COLOR_PATTERN, file);
  });

  test('詳細ページ系の JS は innerHTML を使わない（textContent で描画する）', () => {
    for (const file of ['js/pages/talent.js', 'js/components/video-player.js', 'js/components/talent-profile.js']) {
      assert.doesNotMatch(read(file), /innerHTML/, file);
    }
  });
});
