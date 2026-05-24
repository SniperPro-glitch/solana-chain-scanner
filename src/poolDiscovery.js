// TON On-Chain Pool Discovery Orchestrator
//
// Akış:
//   1) TonAPI SSE → DeDust + STON.fi factory tx event'lerini dinler
//   2) Adapter'lar tx'i filtreler, yeni pool tespit eder
//   3) Token bazlı dedup (60dk pencere)
//   4) Discovery queue → scanner katmanı bunu fetchNewPools'da kullanır
//
// ECO mode: hiçbir polling yok, sadece event-driven; in-memory queue küçük.

const { EventEmitter } = require('events');
const { SseClient } = require('./sseClient');
const dedust = require('./dexAdapters/dedust');
const stonfi = require('./dexAdapters/stonfi');
const { http, TONAPI_BASE, addressEquals } = require('./dexAdapters/_common');
const storage = require('./storage');

const FACTORIES = [dedust.FACTORY, stonfi.ROUTER];

const DEDUP_WINDOW_MS = 60 * 60 * 1000;        // 60 dakika
const QUEUE_MAX = 200;                         // belleği koru
const POOL_TOKEN_TTL_MS = 30 * 60 * 1000;      // pool→token cache

class PoolDiscovery extends EventEmitter {
  constructor() {
    super();
    this.sse = null;
    this.queue = [];               // FIFO {dex, poolAddress, tokenAddress, detectedAt}
    this.seenTokens = new Map();   // tokenAddress → ts
    this.seenPools = new Map();    // poolAddress → ts
    this.stats = {
      sseEvents: 0,
      heartbeats: 0,
      reconnects: 0,
      poolsFound: 0,
      duplicates: 0,
      adapterErrors: 0,
      startedAt: null,
      lastEventAt: null,
    };
    this.started = false;
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.stats.startedAt = Date.now();

    this.sse = new SseClient({ accounts: FACTORIES });

    this.sse.on('open', (m) => {
      console.log(`✅ TonAPI SSE bağlandı — ${m.accounts} factory dinleniyor (DeDust + STON.fi)`);
      try { storage.recordDiscoveryEvent('sse_connect'); } catch (_) {}
    });
    this.sse.on('heartbeat', () => {
      this.stats.heartbeats++;
      try { storage.recordDiscoveryEvent('heartbeat'); } catch (_) {}
    });
    this.sse.on('reconnect', (m) => {
      this.stats.reconnects++;
      try { storage.recordDiscoveryEvent('sse_disconnect'); } catch (_) {}
      console.log(`🔁 SSE reconnect — sebep: ${m.reason}, ${m.delayMs}ms sonra (#${m.attempt})`);
    });
    this.sse.on('stale', (m) =>
      console.warn(`⚠️ SSE stale ${Math.round(m.idleMs / 1000)}sn — yeniden bağlanılıyor`),
    );
    this.sse.on('error', (err) => {
      this.stats.adapterErrors++;
      try { storage.recordDiscoveryEvent('error'); } catch (_) {}
      console.warn('SSE error:', err.message);
    });
    this.sse.on('message', (evt) => this._onSseMessage(evt).catch((e) => {
      this.stats.adapterErrors++;
      try { storage.recordDiscoveryEvent('error'); } catch (_) {}
      console.warn('Adapter error:', e.message);
    }));

    this.sse.start();
  }

  stop() {
    if (this.sse) this.sse.stop();
    this.sse = null;
    this.started = false;
  }

  async _onSseMessage({ data }) {
    this.stats.sseEvents++;
    this.stats.lastEventAt = Date.now();
    try { storage.recordDiscoveryEvent('sse_event'); } catch (_) {}

    if (!data || typeof data !== 'object') return;
    const { account_id, tx_hash } = data;
    if (!account_id || !tx_hash) return;

    const isDedust = addressEquals(account_id, dedust.FACTORY);
    const isStonfi = addressEquals(account_id, stonfi.ROUTER);
    const dexName = isDedust ? 'DeDust' : (isStonfi ? 'STON.fi' : '?');
    if (process.env.DISCOVERY_DEBUG === '1') {
      // Op code'u logla — kullanıcı hangi event tipinin geldiğini görebilsin
      try {
        const { getTransaction, getInOp } = require('./dexAdapters/_common');
        const tx = await getTransaction(tx_hash);
        console.log(`[SSE event] ${dexName} tx=${tx_hash.slice(0,10)}… in_op=${getInOp(tx) || 'null'}`);
      } catch (_) { /* yoksay */ }
    }

    let detected = null;
    if (isDedust) {
      detected = await dedust.handleSseEvent({ account_id, tx_hash });
    } else if (isStonfi) {
      detected = await stonfi.handleSseEvent({ account_id, tx_hash });
    }
    if (!detected) return;

    // Dedup: pool seviyesi
    if (this._isPoolSeen(detected.poolAddress)) {
      this.stats.duplicates++;
      return;
    }
    this._markPoolSeen(detected.poolAddress);

    // Pool → token map çek (jetton master adresi lazım; sonra dedup uygulanacak)
    const tokenAddress = await resolveBaseToken(detected.poolAddress, detected.dex).catch(() => null);
    if (tokenAddress && this._isTokenSeen(tokenAddress)) {
      this.stats.duplicates++;
      return;
    }
    if (tokenAddress) this._markTokenSeen(tokenAddress);

    const entry = {
      ...detected,
      tokenAddress: tokenAddress || null,
    };

    this._enqueue(entry);
    this.stats.poolsFound++;
    this.emit('pool', entry);

    console.log(
      `🆕 Yeni pool [${entry.dex}] ${entry.poolAddress}${tokenAddress ? ` → token ${tokenAddress}` : ''}`,
    );
  }

  _enqueue(entry) {
    this.queue.push(entry);
    if (this.queue.length > QUEUE_MAX) this.queue.shift();
  }

  // Dış API: scanner.js'in çağıracağı drain — yeni discovery'leri tüketir
  drain(max = 50) {
    const items = this.queue.splice(0, max);
    return items;
  }

  peek() {
    return this.queue.slice();
  }

  getStats() {
    return {
      ...this.stats,
      queueSize: this.queue.length,
      seenTokens: this.seenTokens.size,
      seenPools: this.seenPools.size,
      uptimeSec: this.stats.startedAt ? Math.round((Date.now() - this.stats.startedAt) / 1000) : 0,
    };
  }

  _isPoolSeen(addr) {
    this._gcSeen();
    return this.seenPools.has(addr);
  }
  _markPoolSeen(addr) {
    this.seenPools.set(addr, Date.now());
  }
  _isTokenSeen(addr) {
    this._gcSeen();
    return this.seenTokens.has(addr);
  }
  _markTokenSeen(addr) {
    this.seenTokens.set(addr, Date.now());
  }
  _gcSeen() {
    const cutoff = Date.now() - DEDUP_WINDOW_MS;
    for (const [k, ts] of this.seenPools) if (ts < cutoff) this.seenPools.delete(k);
    for (const [k, ts] of this.seenTokens) if (ts < cutoff) this.seenTokens.delete(k);
  }
}

// ─────────────────────────────────────────────────────────────
// Pool adresi → base jetton master adresi
// DeDust pool: /v2/jettons sorgusu ile, STON.fi pool: aynı yöntem.
// Fallback: GeckoTerminal pool detail (yine TON ağı kaynak).
// ─────────────────────────────────────────────────────────────
const poolTokenCache = new Map(); // poolAddr → { token, ts }

async function resolveBaseToken(poolAddress, dex) {
  const cached = poolTokenCache.get(poolAddress);
  if (cached && Date.now() - cached.ts < POOL_TOKEN_TTL_MS) return cached.token;

  // 1) TonAPI: pool kontratının state'inden jetton wallet'ları bul (DEX-agnostic)
  //    DeDust/STON.fi pool'larının jetton wallet'ları olur; bu wallet'ın
  //    /v2/blockchain/accounts/{addr} → interfaces ile master'ı bulabiliriz.
  //    Daha basit: /v2/accounts/{pool}/jettons → balance'taki jetton listesi
  try {
    const { data } = await http.get(`${TONAPI_BASE}/accounts/${encodeURIComponent(poolAddress)}/jettons`);
    const balances = data?.balances || [];
    // pTON / wTON dışındaki ilk jetton'u al
    const PTON_PREFIXES = [
      'EQA_cc5tIQ4haNbMVFUD_d3q5hQfcwzLR0wb4ev4_d_dY3KW', // pTON v1
      'EQCM3B12QK1e4yZSf8GtBRT0aLMNyEsBc_DhVfRRtOEffLez', // pTON v2.1
    ];
    const real = balances.find((b) => {
      const addr = b.jetton?.address;
      return addr && !PTON_PREFIXES.some((p) => addr.startsWith(p));
    });
    if (real?.jetton?.address) {
      poolTokenCache.set(poolAddress, { token: real.jetton.address, ts: Date.now() });
      return real.jetton.address;
    }
  } catch (_) { /* devam */ }

  // 2) DEX-specific fallback: GeckoTerminal pool detail (TON ağı verisi)
  try {
    const { data } = await http.get(
      `https://api.geckoterminal.com/api/v2/networks/ton/pools/${encodeURIComponent(poolAddress)}?include=base_token`,
    );
    const rel = data?.data?.relationships?.base_token?.data?.id || '';
    const tokenAddress = rel.replace(/^ton_/, '');
    if (tokenAddress) {
      poolTokenCache.set(poolAddress, { token: tokenAddress, ts: Date.now() });
      return tokenAddress;
    }
  } catch (_) { /* yoksay */ }

  return null;
}

// Singleton
let _instance = null;
function getInstance() {
  if (!_instance) _instance = new PoolDiscovery();
  return _instance;
}

module.exports = {
  PoolDiscovery,
  getInstance,
  FACTORIES,
};
