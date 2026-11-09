// docs/components.html の見本を描画・動作させる（開発用）。
// 掲載データはすべて架空。画像はプレースホルダー（カード側のグラデーション）を使うため images は空にしている。
import { renderTalentCard } from '../js/components/talent-card.js';
import { renderJobCard } from '../js/components/job-card.js';
import { renderEmptyState } from '../js/components/empty-state.js';
import { renderSkeleton } from '../js/components/skeleton.js';
import { statusBadgeHTML, htmlToFragment } from '../js/components/html-parts.js';
import { showToast } from '../js/components/toast.js';
import { openModal } from '../js/components/modal.js';
import { createBottomSheet } from '../js/components/bottom-sheet.js';

// 「読み込み中」を目で確認できる程度の長さ
const DEMO_LOADING_MS = 2000;
const DEMO_SKELETON_COUNT = 3;
// 見本ページから存在しない詳細ページへ飛ばないよう、リンク先は見本内の見出しにする
const DEMO_HREF = '#heading-talent-cards';
const DEMO_JOB_HREF = '#heading-job-cards';

const SAMPLE_VIDEO = { src: '../assets/videos/sample.webm', poster: '', duration: 20, caption: '自己紹介' };

/** 要件定義書 4.4 の Talent 型に合わせた架空データ */
const SAMPLE_TALENTS = [
  { id: 't901', displayName: '春風 みなみ', roles: ['actor'], gender: 'female', ageRange: '20代前半', area: '東京都', skills: ['殺陣', '英語', '乗馬', '日本舞踊'], genres: ['CM', '舞台'], bio: '', career: [], images: [], introVideo: SAMPLE_VIDEO, isFeatured: true },
  { id: 't902', displayName: '青葉 ソラ', roles: ['model', 'dancer'], gender: 'male', ageRange: '20代後半', area: '大阪府', skills: ['ダンス'], genres: ['MV'], bio: '', career: [], images: [], isFeatured: false },
  { id: 't903', displayName: '七瀬 こはる', roles: ['voice'], gender: 'female', ageRange: '10代', area: '福岡県', skills: ['ナレーション', '歌唱'], genres: ['Web広告'], bio: '', career: [], images: [], introVideo: SAMPLE_VIDEO, isFeatured: false },
  { id: 't904', displayName: '<script>alert("x")</script>エスケープ確認', roles: ['other'], gender: 'unspecified', ageRange: '30代', area: '北海道', skills: ['<b>太字にならない</b>'], genres: [], bio: '', career: [], images: [], isFeatured: false },
];

/** 要件定義書 4.4 の Job 型に合わせた架空データ（matchScore と会社名は見本用に添える） */
const SAMPLE_JOBS = [
  { job: { id: 'j901', companyId: 'c901', title: '炭酸飲料のWeb CM 出演者', genre: 'Web広告', requiredRoles: ['actor'], ageRanges: ['20代前半'], area: '東京都', shootDates: '2026年11月中旬（2日間）', reward: { min: 30000, max: 50000, unit: '日' }, requiredSkills: [], videoPreferred: true, description: '', deadline: '2026-11-30', status: 'open' }, matchScore: 85, companyName: '架空映像スタジオ' },
  { job: { id: 'j902', companyId: 'c902', title: 'アパレル新作のスチール撮影', genre: 'CM', requiredRoles: ['model'], ageRanges: ['20代後半'], area: '大阪府', shootDates: '2026年12月上旬（1日）', reward: { min: 20000, max: 20000, unit: '日' }, requiredSkills: [], description: '', deadline: '2026-11-20', status: 'open' }, matchScore: 60, companyName: 'サンプル広告社' },
  { job: { id: 'j903', companyId: 'c903', title: 'ミュージックビデオのダンサー', genre: 'MV', requiredRoles: ['dancer'], ageRanges: ['20代前半'], area: '神奈川県', shootDates: '2026年11月下旬', reward: { min: 80000, max: 120000, unit: '案件' }, requiredSkills: [], description: '', deadline: '2026-11-10', status: 'open' }, matchScore: 40, companyName: '架空映像スタジオ' },
  { job: { id: 'j904', companyId: 'c902', title: '舞台公演のアンサンブル', genre: '舞台', requiredRoles: ['actor'], ageRanges: ['30代'], area: '東京都', shootDates: '2026年10月', reward: null, requiredSkills: [], description: '', deadline: '2026-10-01', status: 'closed' } },
];

/** @param {string} selector @returns {HTMLElement|null} */
function find(selector) {
  const element = document.querySelector(selector);
  // 見本の一部が欠けても、ほかの見本は動くよう警告だけにとどめる
  if (!element) console.warn(`見本の描画先が見つかりません: ${selector}`);
  return element;
}

function renderStatusBadges() {
  const container = find('#status-badges');
  const html = ['applied', 'reviewing', 'accepted', 'declined'].map(statusBadgeHTML).join('');
  const fragment = htmlToFragment(html);
  if (container && fragment) container.append(fragment);
}

function renderCards() {
  const talents = find('#talent-cards');
  talents?.append(...SAMPLE_TALENTS.map((t) => renderTalentCard(t, { href: DEMO_HREF })).filter(Boolean));

  const jobs = find('#job-cards');
  jobs?.append(...SAMPLE_JOBS
    .map(({ job, matchScore, companyName }) => renderJobCard(job, { matchScore, companyName, href: DEMO_JOB_HREF }))
    .filter(Boolean));
}

function renderEmptyStates() {
  const container = find('#empty-states');
  if (!container) return;
  const linkType = renderEmptyState({
    message: '条件に合うタレントが見つかりませんでした。',
    actionLabel: 'すべてのタレントを見る',
    actionHref: '#heading-talent-cards',
  });
  const buttonType = renderEmptyState({
    message: 'まだ応募した案件はありません。',
    actionLabel: '条件をゆるめて探す',
    onAction: () => showToast('フィルターを解除しました（見本）', { type: 'info' }),
  });
  container.append(...[linkType, buttonType].filter(Boolean));
}

function setupSkeleton() {
  const container = find('#skeleton-demo');
  const button = find('#skeleton-replay');
  if (!container || !button) return;

  const play = () => {
    button.disabled = true;
    container.setAttribute('aria-busy', 'true');
    const skeleton = renderSkeleton(DEMO_SKELETON_COUNT);
    if (skeleton) container.replaceChildren(skeleton);
    setTimeout(() => {
      container.replaceChildren(...SAMPLE_TALENTS.slice(0, DEMO_SKELETON_COUNT)
        .map((t) => renderTalentCard(t, { href: DEMO_HREF })).filter(Boolean));
      container.removeAttribute('aria-busy');
      button.disabled = false;
    }, DEMO_LOADING_MS);
  };
  button.addEventListener('click', play);
  play();
}

function setupToasts() {
  const messages = {
    success: '応募しました！いい知らせが届きますように',
    error: '送信に失敗しました。時間をおいてもう一度お試しください',
    info: 'これはデモサイトです。掲載情報はすべて架空です',
  };
  document.querySelectorAll('[data-toast]').forEach((button) => {
    button.addEventListener('click', () => {
      const type = button.dataset.toast;
      showToast(messages[type] ?? messages.info, { type });
    });
  });
}

/** 応募ダイアログの中身。入力値は DOM API で扱い、innerHTML には入れない */
function buildApplyForm() {
  const field = document.createElement('div');
  field.className = 'form-field';
  const label = document.createElement('label');
  label.className = 'form-field__label';
  label.htmlFor = 'apply-message';
  label.textContent = '企業へのメッセージ';
  const textarea = document.createElement('textarea');
  textarea.className = 'form-field__input';
  textarea.id = 'apply-message';
  const error = document.createElement('p');
  error.className = 'form-field__error';
  error.id = 'apply-message-error';
  error.hidden = true;
  error.textContent = 'メッセージを入力してください';
  field.append(label, textarea, error);
  return { field, textarea, error };
}

function setupDialogs() {
  find('#open-apply-dialog')?.addEventListener('click', () => {
    const { field, textarea, error } = buildApplyForm();
    openModal({
      title: '炭酸飲料のWeb CM 出演者 に応募',
      content: field,
      confirmLabel: '応募する',
      onConfirm: () => {
        // 空のまま送ろうとしたら閉じずにエラーを見せる（false を返すとダイアログは閉じない）
        if (textarea.value.trim() === '') {
          error.hidden = false;
          textarea.setAttribute('aria-invalid', 'true');
          textarea.setAttribute('aria-describedby', error.id);
          textarea.focus();
          return false;
        }
        showToast('応募しました！いい知らせが届きますように', { type: 'success' });
        return true;
      },
    });
  });

  find('#open-confirm-dialog')?.addEventListener('click', () => {
    openModal({
      title: 'デモデータをリセットしますか？',
      content: '応募・スカウト・お気に入りがすべて初期状態に戻ります。（見本なので実際には消えません）',
      confirmLabel: 'リセットする',
      onConfirm: () => showToast('リセットしました（見本）', { type: 'info' }),
    });
  });
}

function setupToggleChips() {
  document.querySelectorAll('#toggle-chips [aria-pressed]').forEach((chip) => {
    chip.addEventListener('click', () => {
      chip.setAttribute('aria-pressed', String(chip.getAttribute('aria-pressed') !== 'true'));
    });
  });
}

function init() {
  renderStatusBadges();
  renderCards();
  renderEmptyStates();
  setupSkeleton();
  setupToasts();
  setupDialogs();
  setupToggleChips();
  createBottomSheet(find('#filter-trigger'), find('#filter-sheet'));
}

document.addEventListener('DOMContentLoaded', init);
