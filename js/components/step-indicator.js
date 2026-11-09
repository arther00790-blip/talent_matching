// 「入力 → 確認 → 完了」のステップ表示（要件 C-02）。見た目は css/layouts/form.css の .steps。
// 現在の段階は aria-current="step" に加えて読み上げ用の文言でも伝える（色や太さだけに頼らない。要件 3.5）。

export const CONTACT_STEPS = Object.freeze([
  Object.freeze({ key: 'input', label: '入力' }),
  Object.freeze({ key: 'confirm', label: '確認' }),
  Object.freeze({ key: 'complete', label: '完了' }),
]);

const STATE_TEXT = Object.freeze({ done: '（済み）', current: '（現在のステップ）', upcoming: '' });
const LIST_LABEL = 'お問い合わせの手順';

/**
 * 各段階の状態（DOM に依存しないのでテストできる）。未知の値は先頭を現在扱いにする。
 * @param {string} current
 * @returns {{ key: string, label: string, state: 'done'|'current'|'upcoming' }[]}
 */
export function getSteps(current) {
  const found = CONTACT_STEPS.findIndex((step) => step.key === current);
  const currentIndex = found === -1 ? 0 : found;
  return CONTACT_STEPS.map(({ key, label }, index) => {
    let state = 'upcoming';
    if (index < currentIndex) state = 'done';
    else if (index === currentIndex) state = 'current';
    return { key, label, state };
  });
}

/**
 * @param {Element|null} container 描画先
 * @param {string} current 'input' | 'confirm' | 'complete'
 */
export function renderStepIndicator(container, current) {
  if (!container) return;
  const list = document.createElement('ol');
  list.className = 'steps';
  list.setAttribute('aria-label', LIST_LABEL);
  for (const step of getSteps(current)) {
    const item = document.createElement('li');
    item.className = step.state === 'done' ? 'steps__item steps__item--done' : 'steps__item';
    if (step.state === 'current') item.setAttribute('aria-current', 'step');
    item.append(step.label);
    if (STATE_TEXT[step.state]) {
      const note = document.createElement('span');
      note.className = 'visually-hidden';
      note.textContent = STATE_TEXT[step.state];
      item.append(note);
    }
    list.append(item);
  }
  container.replaceChildren(list);
}
