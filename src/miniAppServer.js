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
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function sendJson(res, code, obj, extraHeaders = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': extraHeaders['Cache-Control'] || 'no-store',
    'Access-Control-Allow-Origin': '*',
    ...extraHeaders,
  });
  res.end(body);
}

async function sendDexChartJson(res, ref, tf, live) {
  const { getPairChart } = require('./dexscreenerApi');
  const { chartStatsFromCandles } = require('./tokenLogo');
  const { normalizeTimeframe } = require('./marketData');
  const t0 = Date.now();
  const timeframe = normalizeTimeframe(tf);
  const { pair, candles, poolAddress, priceUsd, source, mint } = await getPairChart(ref, timeframe, { fresh: live });
  const serverMs = Date.now() - t0;
  const cacheMs = live ? 4000 : 30000;
  sendJson(res, 200, {
    pair,
    poolAddress,
    mint,
    timeframe,
    candles,
    priceUsd,
    stats: chartStatsFromCandles(candles),
    live,
    source: source || 'dexscreener',
    cacheMs,
    serverMs,
  });
}

/** DEX Railway: rapor/feed bot sunucusunda; status/config yerel kalsın. */
function shouldProxyToBot(pathname, searchParams) {
  if (pathname === '/api/feed/status' || pathname === '/api/config') return false;
  if (pathname.startsWith('/api/trades/')) return false;
  // Feed + arama her zaman bu serviste (multiChainFeed / appSearch) — localhost'ta da çalışır.
  if (pathname === '/api/feed' || pathname === '/api/search') return false;
  return (
    pathname.startsWith('/api/report/')
    || pathname.startsWith('/api/open/')
  );
}

function getBotApiCandidates() {
  try {
    const { getBotApiCandidatesFromEnv } = require('../scripts/railway-env');
    const fromEnv = getBotApiCandidatesFromEnv();
    if (fromEnv.length) return fromEnv;
  } catch {
    /* yoksay */
  }
  const single = getBotApiBaseUrl();
  return single ? [single] : [];
}

function isDexProxyLoop(req) {
  const reqHost = String(req?.headers?.host || '').split(':')[0].toLowerCase();
  if (!reqHost) return false;
  for (const base of getBotApiCandidates()) {
    try {
      if (new URL(base).hostname.toLowerCase() === reqHost) return true;
    } catch {
      /* yoksay */
    }
  }
  const web = getWebAppBaseUrl();
  try {
    if (web && new URL(web).hostname.toLowerCase() === reqHost) {
      const bot = getBotApiBaseUrl();
      if (bot && new URL(bot).hostname.toLowerCase() === reqHost) return true;
    }
  } catch {
    /* yoksay */
  }
  return false;
}

function shouldUseBotHttpProxy(req) {
  try {
    const pg = require('./pgClient');
    const { dexHasSharedDatabase } = require('../scripts/railway-env');
    if (pg.enabled() || dexHasSharedDatabase()) return false;
  } catch {
    /* yoksay */
  }
  const candidates = getBotApiCandidates();
  if (!candidates.length) return false;

  if (isDexProxyLoop(req)) {
    console.warn(
      `[miniApp] proxy atlandı: BOT_API_URL bu servisin domain'i — döngü/timeout riski`,
    );
    return false;
  }
  return true;
}

function sendDexMisconfig(res) {
  const pg = require('./pgClient');
  sendJson(res, 502, {
    error: 'dex_misconfigured',
    message:
      'DEX ve bot aynı public domain\'de. DEX servisine DATABASE_URL=${{ Postgres.DATABASE_URL }} ekleyin (Postgres → Connect → DEX).',
    hints: {
      databaseUrlSet: pg.enabled(),
      webAppUrl: getWebAppBaseUrl(),
      botApiUrl: getBotApiBaseUrl() || null,
      fix: 'Railway → DEX servisi → Variables → DATABASE_URL = Reference → Postgres → DATABASE_URL → Redeploy',
    },
  });
}

async function proxyBotApi(res, url) {
  const candidates = getBotApiCandidates();
  if (!candidates.length) return false;

  let lastErr = null;
  for (const botBase of candidates) {
    const target = `${botBase}${url.pathname}${url.search}`;
    try {
      const r = await fetch(target, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(45000),
      });
      const text = await r.text();
      if (candidates.length > 1 && botBase !== candidates[0]) {
        console.log(`[miniApp] proxy OK (yedek): ${botBase}`);
      }
      res.writeHead(r.status, {
        'Content-Type': r.headers.get('content-type') || 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(text);
      return true;
    } catch (e) {
      lastErr = e;
      console.warn(`[miniApp] proxy fail ${botBase}: ${e.message}`);
    }
  }

  console.warn('[miniApp] BOT_API_URL proxy: tüm adresler başarısız —', lastErr?.message);
  sendJson(res, 502, {
    error: 'bot_proxy_failed',
    message: lastErr?.message || 'fetch failed',
    tried: candidates,
  });
  return true;
}

const MINIAPP_BUILD_ID = String(
  process.env.RAILWAY_DEPLOYMENT_ID || process.env.RAILWAY_GIT_COMMIT_SHA || '',
).trim().slice(0, 12) || 'dev';

function serveStatic(res, filePath, extraHeaders = {}) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const cache = ['.html', '.js', '.css'].includes(ext)
    ? 'no-store, no-cache, must-revalidate'
    : 'public, max-age=86400';
  const headers = {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': extraHeaders['Cache-Control'] || cache,
    ...extraHeaders,
  };

  if (ext === '.html' && path.basename(filePath) === 'index.html') {
    let html = fs.readFileSync(filePath, 'utf8');
    html = html.replace(/__BUILD_ID__/g, MINIAPP_BUILD_ID);
    res.writeHead(200, headers);
    res.end(html);
    return;
  }

  res.writeHead(200, headers);
  fs.createReadStream(filePath).pipe(res);
}

function createMiniAppServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Crop-Key, Authorization, X-Admin-Token, X-Admin-Action-Token',
        });
        res.end();
        return;
      }

      if (url.pathname === '/api/promo-banner') {
        const promoBannerStore = require('./promoBannerStore');
        const { getPromoBanner } = require('./miniAppPromo');
        if (req.method === 'GET') {
          sendJson(res, 200, getPromoBanner());
          return;
        }
        if (req.method === 'POST') {
          const { verifyAdmin } = require('./adminPanel');
          const auth = verifyAdmin(req);
          if (!auth.ok) {
            sendJson(res, 403, {
              error: 'use_admin_panel',
              message: 'Banner yalnızca /admin/ panelinden yönetilir.',
            });
            return;
          }
          const { assertActionAuthForRoute } = require('./adminActionAuth');
          const actionGate = assertActionAuthForRoute(req, url, auth);
          if (!actionGate.ok) {
            sendJson(res, 403, actionGate);
            return;
          }
          const raw = await readBody(req);
          const payload = JSON.parse(raw.toString('utf8') || '{}');
          const saved = promoBannerStore.saveConfig(payload);
          console.log('[miniApp] promo-banner kaydedildi (admin)');
          sendJson(res, 200, { ok: true, saved });
          return;
        }
      }

      if (url.pathname === '/api/crop-profiles') {
        const cropProfiles = require('./cropProfiles');
        if (req.method === 'GET') {
          const baked = cropProfiles.loadBakedProfiles();
          if (!baked) {
            sendJson(res, 404, { error: 'no_baked_profiles' });
            return;
          }
          sendJson(res, 200, baked);
          return;
        }
        if (req.method === 'POST') {
          if (!cropProfiles.isPublishAuthorized(req)) {
            sendJson(res, 403, { error: 'forbidden', message: 'CROP_PUBLISH_KEY gerekli veya CROP_LOCK_PROFILES=1' });
            return;
          }
          try {
            const raw = await readBody(req);
            const payload = JSON.parse(raw.toString('utf8') || '{}');
            const saved = cropProfiles.saveBakedProfiles(payload);
            console.log('[miniApp] crop-profiles kaydedildi:', cropProfiles.DATA_FILE);
            sendJson(res, 200, { ok: true, saved });
          } catch (e) {
            console.warn('[miniApp] crop-profiles POST:', e.message);
            sendJson(res, 400, { error: 'crop_save_failed', message: e.message });
          }
          return;
        }
      }

      if (url.pathname === '/api/miniapp-version' && req.method === 'GET') {
        let appV = '';
        try {
          const indexPath = path.join(PUBLIC_DIR, 'index.html');
          const html = fs.readFileSync(indexPath, 'utf8');
          const m3 = html.match(/app\.js\?v=([^"&]+)/);
          appV = m3?.[1] || '';
        } catch {
          /* yoksay */
        }
        sendJson(res, 200, {
          build: MINIAPP_BUILD_ID,
          git: String(process.env.RAILWAY_GIT_COMMIT_SHA || '').slice(0, 7),
          webAppEntry: getWebAppEntryUrl(),
          assets: { appV },
          chart: 'dexscreener_embed',
        });
        return;
      }

      const dexChartMatch = url.pathname.match(/^\/api\/dex\/chart\/([A-Za-z0-9]+)$/);
      if (req.method === 'GET' && dexChartMatch) {
        const tf = url.searchParams.get('tf') || '15m';
        const live = url.searchParams.get('live') === '1';
        try {
          await sendDexChartJson(res, dexChartMatch[1], tf, live);
        } catch (e) {
          console.warn('[miniApp] dex chart:', e.message);
          sendJson(res, 502, { error: 'dex_chart_failed', message: e.message });
        }
        return;
      }

      const dexPairMatch = url.pathname.match(/^\/api\/dex\/pair\/([A-Za-z0-9]+)$/);
      if (req.method === 'GET' && dexPairMatch) {
        const tf = url.searchParams.get('tf') || '15m';
        const live = url.searchParams.get('live') === '1';
        try {
          await sendDexChartJson(res, dexPairMatch[1], tf, live);
        } catch (e) {
          console.warn('[miniApp] dex pair:', e.message);
          sendJson(res, 502, { error: 'dex_pair_failed', message: e.message });
        }
        return;
      }

      const dexPoolMatch = url.pathname.match(/^\/api\/dex\/token\/([A-Za-z0-9]+)\/pool$/);
      if (req.method === 'GET' && dexPoolMatch) {
        try {
          const { resolvePoolAddressForMint } = require('./dexscreenerApi');
          const poolAddress = await resolvePoolAddressForMint(dexPoolMatch[1]);
          sendJson(res, 200, { poolAddress: poolAddress || null, mint: dexPoolMatch[1] });
        } catch (e) {
          console.warn('[miniApp] dex pool:', e.message);
          sendJson(res, 502, { error: 'dex_pool_failed', message: e.message });
        }
        return;
      }

      if (req.method === 'GET' && shouldProxyToBot(url.pathname, url.searchParams)) {
        if (shouldUseBotHttpProxy(req)) {
          if (await proxyBotApi(res, url)) return;
        } else {
          try {
            const pg = require('./pgClient');
            if (!pg.enabled()) {
              sendDexMisconfig(res);
              return;
            }
          } catch {
            sendDexMisconfig(res);
            return;
          }
        }
      }

      const apiMatch = url.pathname.match(/^\/api\/report\/([A-Za-z0-9_-]+)$/);
      if (req.method === 'GET' && apiMatch) {
        const meta = await reportStore.getReportMetaAsync(apiMatch[1]);
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
        const supportStore = require('./supportStore');
        const botUser = String(process.env.BOT_USERNAME || process.env.MINI_APP_BOT_USERNAME || '')
          .replace(/^@/, '')
          .trim();
        const { loadConfig: loadTrendConfig } = require('./trendConfigStore');
        const { isMiniAppOnlyMode } = require('../scripts/railway-env');
        const hasBotToken = !!String(process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '').trim();
        const miniOnly = isMiniAppOnlyMode();
        sendJson(res, 200, {
          webAppBase: getWebAppBaseUrl(),
          webAppEntry: getWebAppEntryUrl(),
          botApiBase: getBotApiBaseUrl(),
          telegramBotUsername: botUser || 'solachainscanbot',
          bot: {
            miniAppOnly: miniOnly,
            tokenConfigured: hasBotToken,
            listensToStart: !miniOnly || hasBotToken,
          },
          support: supportStore.loadConfig(),
          trend: loadTrendConfig(),
        });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/health') {
        sendJson(res, 200, { ok: true });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/feed/status') {
        const botFeedStore = require('./botFeedStore');
        const { DATA_DIR, isPersistentDataDir } = require('./data-path');
        const pg = require('./pgClient');
        const { isMiniAppOnlyMode } = require('../scripts/railway-env');
        const misconfigured = isMiniAppOnlyMode() && !pg.enabled() && isDexProxyLoop(req);
        sendJson(res, misconfigured ? 503 : 200, {
          botCount: await botFeedStore.feedCountAsync(),
          reportCount: await reportStore.reportCountAsync(),
          storage: pg.enabled() ? 'postgresql' : 'file',
          persistent: isPersistentDataDir(),
          feedFile: botFeedStore.FEED_FILE,
          dataDir: DATA_DIR,
          botApiProxy: getBotApiBaseUrl() || null,
          dexMode: isMiniAppOnlyMode(),
          needsDatabaseUrl: misconfigured,
          fix: misconfigured
            ? 'DEX Variables: DATABASE_URL=${{ Postgres.DATABASE_URL }} then redeploy DEX'
            : null,
        });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/feed') {
        const tab = url.searchParams.get('tab') || 'trending';
        const dex = url.searchParams.get('dex') || 'all';
        const chain = url.searchParams.get('chain') || 'solana';
        const q = url.searchParams.get('q') || '';
        const limit = Math.min(40, parseInt(url.searchParams.get('limit') || '24', 10));
        try {
          const { buildFeed } = require('./multiChainFeed');
          const feed = await buildFeed(tab, limit, dex, chain, q);
          const feedCache = q ? 'no-store' : 'private, max-age=20';
          sendJson(res, 200, feed, { 'Cache-Control': feedCache });
        } catch (e) {
          console.warn('[miniApp] feed:', e.message);
          sendJson(res, 502, { error: 'feed_failed', message: e.message });
        }
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/search') {
        const q = url.searchParams.get('q') || '';
        const chain = url.searchParams.get('chain') || 'all';
        const limit = Math.min(50, parseInt(url.searchParams.get('limit') || '40', 10));
        try {
          const { searchListedTokens } = require('./appSearch');
          const body = await searchListedTokens(q, limit, chain);
          sendJson(res, 200, body, { 'Cache-Control': 'private, max-age=8' });
        } catch (e) {
          console.warn('[miniApp] search:', e.message);
          sendJson(res, 502, { error: 'search_failed', message: e.message });
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

      const { handleMiniAppAdminAccess } = require('./miniAppAdminAccess');
      if (handleMiniAppAdminAccess(req, res, url, sendJson)) return;

      const { handlePublicSupportApi } = require('./supportApi');
      if (url.pathname.startsWith('/api/support')) {
        const handled = await handlePublicSupportApi(req, res, url, sendJson);
        if (handled) return;
      }

      const { handleAdminApi, ADMIN_PUBLIC_DIR } = require('./adminPanel');
      if (url.pathname.startsWith('/api/admin')) {
        const handled = await handleAdminApi(req, res, url, {
          sendJson,
          getWebAppBaseUrl,
          getBotApiBaseUrl,
        });
        if (handled) return;
      }

      if (url.pathname === '/admin') {
        res.writeHead(302, { Location: '/admin/' });
        res.end();
        return;
      }
      if (url.pathname.startsWith('/admin/')) {
        let rel = url.pathname.replace(/^\/admin\/?/, '') || 'index.html';
        if (rel === '/' || rel === '') rel = 'index.html';
        const safe = path.normalize(rel).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
        const filePath = path.join(ADMIN_PUBLIC_DIR, safe);
        if (!filePath.startsWith(ADMIN_PUBLIC_DIR)) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }
        serveStatic(res, filePath);
        return;
      }

      if (url.pathname === '/miniapp' || url.pathname === '/miniapp/') {
        res.writeHead(302, { Location: '/' });
        res.end();
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

function normalizePublicUrl(raw) {
  const { normalizePublicUrl: norm } = require('../scripts/railway-env');
  return norm(raw);
}

function getWebAppBaseUrl() {
  const raw = String(process.env.WEB_APP_URL || '').trim();
  if (raw) return normalizePublicUrl(raw);
  const port = process.env.MINI_APP_PORT || process.env.PORT || '3080';
  return `http://localhost:${port}`;
}

/** Telegram Mini App aynı URL’yi agresif önbelleğe alır — her deploy’da farklı ?dv= zorunlu. */
function getWebAppEntryUrl() {
  const base = getWebAppBaseUrl();
  const v = MINIAPP_BUILD_ID;
  if (!v || v === 'dev') return base;
  try {
    const u = new URL(base);
    u.searchParams.set('dv', v);
    return u.toString();
  } catch {
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}dv=${encodeURIComponent(v)}`;
  }
}

/** İki Railway: DEX UI burada, feed BOT sunucusunda — BOT_API_URL = bot Railway https */
function getBotApiBaseUrl() {
  try {
    const { normalizeBotApiUrl } = require('../scripts/railway-env');
    return normalizeBotApiUrl(
      process.env.BOT_API_URL || process.env.SCAN_BOT_API_URL || '',
    );
  } catch {
    const raw = String(
      process.env.BOT_API_URL || process.env.SCAN_BOT_API_URL || '',
    ).trim();
    return raw ? normalizePublicUrl(raw) : '';
  }
}

function buildWebAppUrl(reportId) {
  const base = getWebAppEntryUrl();
  const u = new URL(base);
  u.hash = `r=${encodeURIComponent(reportId)}`;
  return u.toString();
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
    const candidates = getBotApiCandidates();
    if (candidates.length) {
      console.log(`   DEX→Bot proxy: ${candidates.join(' | ')}`);
      const { probeBotApiFromDex, isMiniAppOnlyMode } = require('../scripts/railway-env');
      if (isMiniAppOnlyMode()) {
        probeBotApiFromDex().catch((e) => console.warn('[dex] probe:', e.message));
      }
    }
  });
  return server;
}

module.exports = {
  createMiniAppServer,
  startMiniAppServer,
  buildWebAppUrl,
  getWebAppBaseUrl,
  getWebAppEntryUrl,
  getBotApiBaseUrl,
  PUBLIC_DIR,
};
