// HELIUS_API_KEY → SOLANA_RPC_URL (Helius RPC) otomatik bağlama + hatalı RPC URL temizliği.

const axios = require('axios');

function isValidHttpUrl(s) {
  return /^https?:\/\/.+/i.test(String(s || '').trim());
}

function heliusRpcUrl(key) {
  // Helius docs: ham api-key query param (encode genelde gerekmez)
  return `https://mainnet.helius-rpc.com/?api-key=${key}`;
}

function readHeliusKeyFromEnv() {
  return sanitizeHeliusKey(
    process.env.HELIUS_API_KEY
    || process.env.HELIUS_KEY
    || '',
  );
}

/** Railway’de tırnak, boşluk veya "HELIUS_API_KEY=..." ile yapıştırılmış değerleri düzelt. */
function sanitizeHeliusKey(raw) {
  let k = String(raw || '').trim();
  if (
    (k.startsWith('"') && k.endsWith('"'))
    || (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1).trim();
  }
  k = k.replace(/^HELIUS_API_KEY\s*=\s*/i, '').trim();
  // Bazen https://...?api-key=XXX tam URL yapıştırılır
  const m = k.match(/[?&]api-key=([^&]+)/i);
  if (m) k = decodeURIComponent(m[1]).trim();
  return k;
}

function keyFingerprint(key) {
  if (!key || key.length < 8) return `(uzunluk ${key?.length || 0})`;
  return `${key.slice(0, 4)}…${key.slice(-4)} (${key.length} kar.)`;
}

function applyHeliusEnv() {
  const key = readHeliusKeyFromEnv();
  if (key) process.env.HELIUS_API_KEY = key;

  let rpc = (process.env.SOLANA_RPC_URL || '').trim();
  const customRpc = ['1', 'true', 'yes', 'on'].includes(
    String(process.env.SOLANA_RPC_CUSTOM || '').trim().toLowerCase(),
  );

  if (rpc && !isValidHttpUrl(rpc)) {
    console.warn(
      `[env] SOLANA_RPC_URL geçersiz: "${rpc.slice(0, 48)}" → yok sayılıyor`,
    );
    rpc = '';
    delete process.env.SOLANA_RPC_URL;
  }

  if (!key) return;

  // HELIUS_API_KEY varsa varsayılan: her zaman Helius RPC (eski yanlış SOLANA_RPC_URL üzerine yaz)
  if (!customRpc) {
    const canonical = heliusRpcUrl(key);
    if (rpc !== canonical) {
      if (rpc) {
        console.log('[env] SOLANA_RPC_URL ← HELIUS_API_KEY (önceki URL yok sayıldı)');
      } else {
        console.log('[env] SOLANA_RPC_URL ← Helius (HELIUS_API_KEY)');
      }
      process.env.SOLANA_RPC_URL = canonical;
    }
  }
}

async function rpcProbe(rpc, method, params = []) {
  const { data, status } = await axios.post(
    rpc,
    { jsonrpc: '2.0', id: 1, method, params },
    {
      timeout: 12_000,
      validateStatus: () => true,
      headers: { 'Content-Type': 'application/json' },
    },
  );
  return { data, status };
}

/** Açılışta Helius RPC doğrula (bot tarama/risk için RPC kullanır). */
async function verifyHeliusRpc() {
  applyHeliusEnv();
  const key = readHeliusKeyFromEnv();
  const rpc = (process.env.SOLANA_RPC_URL || '').trim();

  if (!key) {
    console.warn('[env] ⚠️ HELIUS_API_KEY yok — Railway Variables → dashboard.helius.dev → API Keys');
    return false;
  }

  if (key.length < 32) {
    console.error(
      `[env] ❌ HELIUS_API_KEY çok kısa (${key.length} karakter) — dashboard API Keys tablosundan tam UUID kopyalayın`,
    );
    return false;
  }

  if (!rpc) {
    console.warn('[env] ⚠️ SOLANA_RPC_URL yok');
    return false;
  }

  try {
    const slot = await rpcProbe(rpc, 'getSlot');
    if (slot.status === 401 || slot.status === 403) {
      console.error(
        `[env] ❌ HELIUS_API_KEY geçersiz (RPC ${slot.status}) — önek ${keyFingerprint(key)}`,
      );
      console.error('[env]    1) dashboard.helius.dev → API Keys → satırdaki UUID (Key ID) → kopyala');
      console.error('[env]    2) Railway → HELIUS_API_KEY = sadece key (tırnak yok)');
      console.error('[env]    3) SOLANA_RPC_URL değişkenini sil');
      console.error('[env]    4) Redeploy — veya PC: node scripts/verify-helius.js');
      return false;
    }
    if (slot.data?.result == null && slot.data?.error) {
      console.error(`[env] ❌ Helius RPC: ${slot.data.error.message}`);
      return false;
    }

    console.log(`[env] Helius RPC: OK (slot ${slot.data?.result}, key ${keyFingerprint(key)})`);
    return true;
  } catch (e) {
    const st = e.response?.status;
    console.error(`[env] ❌ Helius bağlantı hatası (${st || e.message})`);
    return false;
  }
}

module.exports = {
  applyHeliusEnv,
  verifyHeliusRpc,
  sanitizeHeliusKey,
  readHeliusKeyFromEnv,
  isValidHttpUrl,
};
