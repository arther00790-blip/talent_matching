// 開発用の静的サーバー。ES Modules は file:// では読み込めないため、依存パッケージなしで HTTP 配信する
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_PORT = 8000;
// 開発用なので自分のPC以外からは接続させない
const HOST = '127.0.0.1';
const PROJECT_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const FALLBACK_TYPE = 'application/octet-stream';

const MIME_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
});

/**
 * リクエストURLを配信ファイルの絶対パスに変換する。
 * ルート外（../ やエンコードされた ..）を指す場合や不正なURLは null を返す。
 */
export function resolveRequestPath(root, requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname);
  } catch {
    return null;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const filePath = normalize(join(root, pathname));
  return filePath.startsWith(root + sep) ? filePath : null;
}

export function contentTypeFor(filePath) {
  return MIME_TYPES[extname(filePath).toLowerCase()] ?? FALLBACK_TYPE;
}

const ALLOWED_HOSTNAMES = Object.freeze(['127.0.0.1', 'localhost']);
const HOST_PATTERN = /^([^:]+)(?::\d+)?$/;

/**
 * DNS リバインディング対策。127.0.0.1 で待ち受けていても、攻撃者のドメインを 127.0.0.1 に
 * 向け直されると外部ページからファイルを読まれうるため、Host ヘッダーの名前で接続元を限定する。
 */
export function isAllowedHost(hostHeader) {
  if (typeof hostHeader !== 'string') return false;
  const match = HOST_PATTERN.exec(hostHeader.trim());
  return Boolean(match) && ALLOWED_HOSTNAMES.includes(match[1].toLowerCase());
}

const RANGE_PATTERN = /^bytes=(\d*)-(\d*)$/;

/**
 * Range ヘッダーを {start, end}（両端含む）に変換する。
 * ブラウザは動画のシーク時に Range で一部だけを要求し、206 が返らないとシークできないため対応する。
 * ヘッダーが無ければ null、単一範囲として満たせなければ 'invalid'（416 を返す）。
 */
export function parseRange(header, size) {
  if (!header) return null;
  const match = RANGE_PATTERN.exec(header.trim());
  if (!match || (match[1] === '' && match[2] === '')) return 'invalid';
  const last = size - 1;
  if (match[1] === '') {
    // "bytes=-N" は末尾 N バイト
    const suffix = Number(match[2]);
    return suffix > 0 && size > 0 ? { start: Math.max(size - suffix, 0), end: last } : 'invalid';
  }
  const start = Number(match[1]);
  const end = match[2] === '' ? last : Math.min(Number(match[2]), last);
  return start <= end && start < size ? { start, end } : 'invalid';
}

async function sendNotFound(res) {
  const body = await readFile(join(PROJECT_ROOT, '404.html')).catch(() => 'Not Found');
  res.writeHead(404, { 'Content-Type': MIME_TYPES['.html'] });
  res.end(body);
}

async function handleRequest(req, res) {
  if (!isAllowedHost(req.headers.host)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden host');
    return;
  }
  const filePath = resolveRequestPath(PROJECT_ROOT, req.url);
  if (!filePath) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }
  try {
    const body = await readFile(filePath);
    // 編集内容をすぐ確認できるよう、ブラウザにキャッシュさせない
    const headers = { 'Content-Type': contentTypeFor(filePath), 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' };
    const range = parseRange(req.headers.range, body.length);
    if (range === 'invalid') {
      res.writeHead(416, { ...headers, 'Content-Range': `bytes */${body.length}` });
      res.end();
      return;
    }
    if (range) {
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${range.start}-${range.end}/${body.length}` });
      res.end(body.subarray(range.start, range.end + 1));
      return;
    }
    res.writeHead(200, headers);
    res.end(body);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EISDIR') {
      await sendNotFound(res);
      return;
    }
    console.error(`配信エラー: ${req.url} (${error.code ?? error.message})`);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal Server Error');
  }
}

export function startServer(port = DEFAULT_PORT) {
  const server = createServer((req, res) => {
    handleRequest(req, res).catch((error) => {
      console.error(`想定外のエラー: ${error.message}`);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`ポート ${port} は使用中です。PORT=8001 npm run dev のように別ポートを指定してください。`);
    } else {
      console.error(`サーバーを起動できません: ${error.message}`);
    }
    process.exitCode = 1;
  });
  server.listen(port, HOST, () => {
    console.log(`StageLink 開発サーバー: http://${HOST}:${port}/  (Ctrl+C で停止)`);
  });
  return server;
}

// テストから import されたときは起動せず、直接実行されたときだけ起動する
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number.parseInt(process.env.PORT ?? '', 10);
  startServer(Number.isInteger(port) && port > 0 ? port : DEFAULT_PORT);
}
