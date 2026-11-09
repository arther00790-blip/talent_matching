// サイト共通フッター（フッターリンク・デモサイト注記。要件 5.1）。
import { escapeHTML } from '../lib/utils.js';
import { hasDOM, htmlToFragment } from './html-parts.js';

// 要件 5.1 の文言そのまま。架空データ・動画の保存先を誤解させないため、全ページに出す
export const DEMO_NOTICE = 'これはデモサイトです。掲載情報はすべて架空です。アップロードした動画はこのブラウザ内にのみ保存され、外部には送信されません。';

const COPYRIGHT = '© 2026 StageLink（ポートフォリオ用デモ）';

const FOOTER_LINKS = Object.freeze([
  { href: 'about.html', label: 'サービス紹介' },
  { href: 'faq.html', label: 'よくある質問' },
  { href: 'contact.html', label: 'お問い合わせ' },
  { href: 'terms.html', label: '利用規約' },
  { href: 'privacy.html', label: 'プライバシーポリシー' },
]);

/** @returns {string} */
export function footerHTML() {
  const links = FOOTER_LINKS
    .map(({ href, label }) => `<li><a class="site-footer__link" href="${escapeHTML(href)}">${escapeHTML(label)}</a></li>`)
    .join('');
  return `
<footer class="site-footer">
  <div class="container site-footer__inner">
    <nav aria-label="フッター">
      <ul class="site-footer__links" role="list">${links}</ul>
    </nav>
    <p class="site-footer__notice" role="note">${escapeHTML(DEMO_NOTICE)}</p>
    <p class="site-footer__copyright"><small>${escapeHTML(COPYRIGHT)}</small></p>
  </div>
</footer>`.trim();
}

/**
 * @param {HTMLElement|null} container 差し込み先（page-base.html の #site-footer）
 * @returns {boolean} 描画できたか
 */
export function renderFooter(container) {
  if (!hasDOM()) return false;
  if (!(container instanceof HTMLElement)) {
    console.warn('renderFooter: フッターの差し込み先が見つかりません');
    return false;
  }
  container.replaceChildren(htmlToFragment(footerHTML()));
  return true;
}
