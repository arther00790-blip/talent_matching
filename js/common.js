// 全ページ共通の初期化（ヘッダー・フッター描画）。
// type="module" のスクリプトは HTML の解析後に実行されるため、DOMContentLoaded を待たずに要素を取得できる。
import { renderHeader } from './components/header.js';
import { renderFooter } from './components/footer.js';

renderHeader(document.getElementById('site-header'));
renderFooter(document.getElementById('site-footer'));
