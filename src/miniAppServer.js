// Mini App — statik UI + GET /api/report/:id

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const reportStore = require('./reportStore');
const { buildReportPayload } = require('./reportPayload');
const { enrichMarketForMiniApp } = require('./marketData');
const miniAppFeed = require('./miniAppFeed');

const PUBLIC_DIR = path.join(__dirname, '..', 'public', 'miniapp');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

function serveStatic(res, filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const cache = ['.html', '.js', '.css'].includes(ext)
    ? 'no-cache, must-revalidate'
    : 'public, max-age=86400';
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': cache,
  });
  fs.createReadStream(filePath).pipe(res);
}

function createMiniAppServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        });
        res.end();
        return;
      }

      const apiMatch = url.pathname.match(/^\/api\/report\/([A-Za-z0-9_-]+)$/);
      if (req.method === 'GET' && apiMatch) {
        const meta = reportStore.getReportMeta(apiMatch[1]);
        if (meta.status === 'not_found') {
          sendJson(res, 404, { error: 'not_found', message: 'Rapor bulunamadi. Yeni token paylasimindaki butonu kullanin.' });
          return;
        }
        if (meta.status === 'expired') {
          sendJson(res, 410, {
            error: 'expired',
            message: 'Rapor suresi doldu (14 gun). Kanalda yeni analiz bekleyin.',
            createdAt: meta.createdAt,
          });
          return;
        }
        const stored = meta.report;
        const payload = buildReportPayload(
          stored.token,
          stored.audit,
          stored.lang,
          stored.level,
        );
        payload.id = apiMatch[1];
        payload.createdAt = stored.createdAt;
        try {
          const tf = url.searchParams.get('tf') || '15m';
          const liveMarket = await enrichMarketForMiniApp(stored.token, { timeframe: tf });
          if (liveMarket) payload.market = liveMarket;
        } catch (e) {
          console.warn('[miniApp] market:', e.message);
        }
        sendJson(res, 200, payload);
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/config') {
        sendJson(res, 200, {
          webAppBase: getWebAppBaseUrl(),
          botApiBase: getBotApiBaseUrl(),
        });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/health') {
        sendJson(res, 200, { ok: true });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/feed/status') {
        const botFeedStore = require('./botFeedStore');
        const { DATA_DIR } = require('./data-path');
        sendJson(res, 200, {
          botCount: botFeedStore.feedCount(),
          feedFile: botFeedStore.FEED_FILE,
          dataDir: DATA_DIR,
        });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/feed') {
        const tab = url.searchParams.get('tab') || 'trending';
        const dex = url.searchParams.get('dex') || 'all';
        const limit = Math.min(40, parseInt(url.searchParams.get('limit') || '24', 10));
        try {
          const feed = await miniAppFeed.buildFeed(tab, limit, dex);
          sendJson(res, 200, feed);
        } catch (e) {
          console.warn('[miniApp] feed:', e.message);
          sendJson(res, 502, { error: 'feed_failed', message: e.message });
        }
        return;
      }

      const openMatch = url.pathname.match(/^\/api\/open\/([1-9A-HJ-NP-Za-km-z]{32,44})$/);
      if (req.method === 'GET' && openMatch) {
        try {
          const result = await miniAppFeed.analyzeMintAndSave(openMatch[1], 'tr');
          sendJson(res, 200, result);
        } catch (e) {
          const code = e.code === 'not_found' ? 404 : 500;
          sendJson(res, code, { error: e.code || 'analyze_failed', message: e.message });
        }
        return;
      }

      let rel = url.pathname === '/' ? '/index.html' : url.pathname;
      if (rel.startsWith('/miniapp')) rel = rel.slice('/miniapp'.length) || '/index.html';
      const safe = path.normalize(rel).replace(/^(\.\.[/\\])+/, '');
      const filePath = path.join(PUBLIC_DIR, safe);
      if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      serveStatic(res, filePath);
    } catch (e) {
      console.error('[miniApp]', e.message);
      sendJson(res, 500, { error: 'server_error' });
    }
  });
}

function getWebAppBaseUrl() {
  const raw = String(process.env.WEB_APP_URL || '').trim();
  if (raw) return raw.replace(/\/$/, '');
  const port = process.env.MINI_APP_PORT || process.env.PORT || '3080';
  return `http://localhost:${port}`;
}

/** İki Railway: DEX UI burada, feed BOT sunucusunda — BOT_API_URL = bot Railway https */
function getBotApiBaseUrl() {
  const raw = String(
    process.env.BOT_API_URL || process.env.SCAN_BOT_API_URL || '',
  ).trim();
  return raw ? raw.replace(/\/$/, '') : '';
}

function buildWebAppUrl(reportId) {
  const base = getWebAppBaseUrl();
  return `${base}/#r=${encodeURIComponent(reportId)}`;
}

function startMiniAppServer() {
  const enabled = ['1', 'true', 'on', 'yes'].includes(
    String(process.env.MINI_APP_ENABLED || '1').trim().toLowerCase(),
  );
  if (!enabled) return null;

  const port = parseInt(process.env.MINI_APP_PORT || process.env.PORT || '3080', 10);
  const server = createMiniAppServer();
  server.on('error', (err) => {
    console.error('[miniApp] HTTP dinleme hatası:', err.message);
    if (err.code === 'EADDRINUSE') {
      console.error(`   Port ${port} dolu — Railway'de MINI_APP_PORT tanımlamayın; sadece PORT kullanılır.`);
    }
    process.exit(1);
  });
  server.listen(port, '0.0.0.0', () => {
    console.log(`   Mini App: http://0.0.0.0:${port}  (WEB_APP_URL=${getWebAppBaseUrl()})`);
  });
  return server;
}

module.exports = {
  createMiniAppServer,
  startMiniAppServer,
  buildWebAppUrl,
  getWebAppBaseUrl,
  getBotApiBaseUrl,
  PUBLIC_DIR,
};
