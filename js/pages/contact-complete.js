// お問い合わせ：完了画面（要件 C-02 / 2.5）。確認画面を経た下書きを削除して、受付の案内を出す。
// 確認画面を経ずに開かれた（下書きが無い・送信済みの印が無い）ときは入力画面へ戻す。判定は js/lib/contact-flow.js。
import { CONTACT_PAGES, completeContact } from '../lib/contact-flow.js';
import { renderStepIndicator } from '../components/step-indicator.js';

const CLEAR_FAILED_MESSAGE = '一時保存していた入力内容を削除できませんでした。ブラウザのタブを閉じると削除されます';
const NOTE_WITHOUT_CLEAR = 'このサイトはデモのため、入力内容は外部へ送信されていません。';

const body = document.querySelector('[data-complete-body]');
const heading = document.querySelector('[data-complete-heading]');
const note = document.querySelector('[data-complete-note]');
const warning = document.querySelector('[data-complete-warning]');

function init() {
  if (!(body instanceof HTMLElement) || !(heading instanceof HTMLElement)
    || !(note instanceof HTMLElement) || !(warning instanceof HTMLElement)) {
    console.error('contact-complete.js: 描画先が見つかりません');
    return;
  }
  try {
    const result = completeContact();
    if (result.redirect) {
      // 履歴に完了画面を残さないよう replace で移る
      window.location.replace(result.redirect);
      return;
    }
    renderStepIndicator(document.querySelector('[data-step-indicator]'), 'complete');
    if (!result.cleared) {
      // 「削除しました」と事実と違う案内を出さないよう、注記を差し替える
      note.textContent = NOTE_WITHOUT_CLEAR;
      warning.textContent = CLEAR_FAILED_MESSAGE;
      warning.hidden = false;
    }
    body.hidden = false;
    // 画面が切り替わったことをスクリーンリーダーにも伝えるため、見出しへフォーカスを移す
    heading.focus();
  } catch (error) {
    console.error('完了画面の表示に失敗しました', error);
    window.location.replace(CONTACT_PAGES.input);
  }
}

init();
