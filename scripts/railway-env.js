// Railway deploy: WEB_APP_URL https, Postgres PGHOST → DATABASE_URL otomatik.

function isMiniAppOnlyMode() {
  return ['1', 'true', 'on', 'yes', 'dex', 'miniapp'].includes(
    String(process.env.MINIAPP_ONLY || process.env.SERVICE_MODE || '').trim().toLowerCase(),
  );
}

function normalizePublicUrl(raw) {
  let u = String(raw || '').trim().replace(/\/$/, '');
  if (!u || /^\$\{\{/.test(u)) return '';
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u;
}

/** Bot API — public https veya railway.internal http */
function normalizeBotApiUrl(raw) {
  let u = String(raw || '').trim().replace(/\/$/, '');
  if (!u || /^\$\{\{/.test(u)) return '';
  if (/\.railway\.internal/i.test(u)) {
    if (!/^https?:\/\//i.test(u)) u = `http://${u}`;
    return u;
  }
  return normalizePublicUrl(u);
}

function getBotApiCandidatesFromEnv() {
  const out = [];
  const privDom = String(process.env.BOT_RAILWAY_PRIVATE_DOMAIN || '').trim();
  if (privDom && !/^\$\{\{/.test(privDom)) {
    const port = String(process.env.BOT_SERVICE_PORT || '8080').trim();
    out.push(`http://${privDom}:${port}`);
  }

  const privUrl = normalizeBotApiUrl(process.env.BOT_API_PRIVATE_URL || '');
  if (privUrl) out.push(privUrl);

  const pub = normalizeBotApiUrl(
    process.env.BOT_API_URL || process.env.SCAN_BOT_API_URL || '',
  );
  if (pub) out.push(pub);

  return [...new Set(out)];
}

function dexHasSharedDatabase() {
  return !!resolveDatabaseUrl();
}

function buildPgUrlFromParts() {
  const host = String(process.env.PGHOST || process.env.POSTGRES_HOST || '').trim();
  if (!host) return '';
  const user = encodeURIComponent(process.env.PGUSER || process.env.POSTGRES_USER || 'postgres');
  const pass = encodeURIComponent(process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || '');
  const db = process.env.PGDATABASE || process.env.POSTGRES_DB || 'railway';
  const port = process.env.PGPORT || process.env.POSTGRES_PORT || '5432';
  return `postgresql://${user}:${pass}@${host}:${port}/${db}`;
}

function resolveDatabaseUrl() {
  const candidates = [
    process.env.DATABASE_PRIVATE_URL,
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRESQL_URL,
    process.env.RAILWAY_DATABASE_URL,
  ];
  for (const c of candidates) {
    const s = String(c || '').trim();
    if (s && !/^\$\{\{/.test(s)) return s;
  }
  return buildPgUrlFromParts();
}

function applyRailwayEnv() {
  const onRailway = !!(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);

  const webRaw = String(process.env.WEB_APP_URL || '').trim();
  if (webRaw) {
    const fixed = normalizePublicUrl(webRaw);
    if (fixed !== webRaw.replace(/\/$/, '')) {
      console.log(`[railway-env] WEB_APP_URL → ${fixed}`);
    }
    process.env.WEB_APP_URL = fixed;
  } else if (onRailway && process.env.RAILWAY_PUBLIC_DOMAIN) {
    process.env.WEB_APP_URL = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
    console.log(`[railway-env] WEB_APP_URL otomatik: ${process.env.WEB_APP_URL}`);
  }

  if (!String(process.env.DATA_DIR || '').trim() && onRailway) {
    const mount = String(process.env.RAILWAY_VOLUME_MOUNT_PATH || '').trim();
    process.env.DATA_DIR = mount || '/app/data';
  }

  const pgUrl = resolveDatabaseUrl();
  if (pgUrl) {
    if (!String(process.env.DATABASE_URL || '').trim()
      || /^\$\{\{/.test(String(process.env.DATABASE_URL))) {
      process.env.DATABASE_URL = pgUrl;
      console.log('[railway-env] PostgreSQL bağlantısı hazır (DATABASE_URL)');
    }
  } else if (onRailway && process.env.PGHOST) {
    console.warn('[railway-env] PGHOST var ama URL kurulamadı — Postgres Variables kontrol edin');
  }

  if (isMiniAppOnlyMode()) {
    const botRaw = String(process.env.BOT_API_URL || process.env.SCAN_BOT_API_URL || '').trim();
    if (botRaw && !/^\$\{\{/.test(botRaw)) {
      const fixed = normalizeBotApiUrl(botRaw);
      if (fixed !== botRaw.replace(/\/$/, '')) {
        console.log(`[railway-env] BOT_API_URL → ${fixed}`);
      }
      process.env.BOT_API_URL = fixed;
    } else if (!botRaw) {
      console.warn(
        '[railway-env] DEX: BOT_API_URL yok — Variables: BOT_API_URL=https://<bot-servisi>.up.railway.app',
      );
    } else {
      console.warn('[railway-env] BOT_API_URL çözülmemiş (${{ ... }}) — Railway Reference kaydedin');
    }

    const privDom = String(process.env.BOT_RAILWAY_PRIVATE_DOMAIN || '').trim();
    if (privDom && !/^\$\{\{/.test(privDom)) {
      const port = String(process.env.BOT_SERVICE_PORT || '8080').trim();
      process.env.BOT_API_PRIVATE_URL = `http://${privDom}:${port}`;
      console.log(`[railway-env] Bot iç ağ yedek: ${process.env.BOT_API_PRIVATE_URL}`);
    }

    const web = normalizePublicUrl(process.env.WEB_APP_URL || '');
    const bot = normalizeBotApiUrl(process.env.BOT_API_URL || '');
    if (web && bot && web === bot) {
      console.warn(
        '[railway-env] ⚠️ BOT_API_URL = WEB_APP_URL (proxy döngüsü / timeout) — aynı domain iki serviste olamaz',
      );
    }

    if (dexHasSharedDatabase()) {
      console.log(
        '[railway-env] DEX + Postgres: rapor/liste DB\'den — BOT_API_URL proxy kapalı (önerilen)',
      );
    } else if (!getBotApiCandidatesFromEnv().length) {
      console.warn(
        '[railway-env] DEX: DATABASE_URL veya BOT_RAILWAY_PRIVATE_DOMAIN ekleyin',
      );
    }
  }
}

async function probeBotApiFromDex() {
  if (!isMiniAppOnlyMode()) return;
  if (dexHasSharedDatabase()) {
    console.log('[dex] Postgres aktif — HTTP bot probe atlandı');
    return;
  }
  const candidates = getBotApiCandidatesFromEnv();
  if (!candidates.length) return;

  for (const base of candidates) {
    const url = `${base}/api/feed/status`;
    try {
      const r = await fetch(url, {
        signal: AbortSignal.timeout(12000),
        headers: { Accept: 'application/json' },
      });
      const ok = r.ok ? 'OK' : `HTTP ${r.status}`;
      console.log(`[dex] Bot API ${ok}: ${url}`);
      return;
    } catch (e) {
      console.warn(`[dex] Bot API deneme başarısız (${base}): ${e.message}`);
    }
  }
  console.error(
    '[dex] Bot API erişilemiyor — DEX Variables: BOT_API_URL=https://solana-chain-scanner-production.up.railway.app',
  );
  console.error(
    '   veya iç ağ: BOT_RAILWAY_PRIVATE_DOMAIN=${{ solana-chain-scanner.RAILWAY_PRIVATE_DOMAIN }} BOT_SERVICE_PORT=8080',
  );
}

module.exports = {
  applyRailwayEnv,
  normalizePublicUrl,
  normalizeBotApiUrl,
  resolveDatabaseUrl,
  getBotApiCandidatesFromEnv,
  probeBotApiFromDex,
  isMiniAppOnlyMode,
  dexHasSharedDatabase,
};
