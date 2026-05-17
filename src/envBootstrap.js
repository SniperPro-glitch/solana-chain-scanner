// HELIUS_API_KEY → SOLANA_RPC_URL (Helius RPC) otomatik bağlama + hatalı RPC URL temizliği.

const axios = require('axios');

function isValidHttpUrl(s) {
  return /^https?:\/\/.+/i.test(String(s || '').trim());
}

function heliusRpcUrl(key) {
  return `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(key)}`;
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
  return k;
}

function applyHeliusEnv() {
  const key = sanitizeHeliusKey(process.env.HELIUS_API_KEY);
  if (key) process.env.HELIUS_API_KEY = key;
  let rpc = (process.env.SOLANA_RPC_URL || '').trim();

  if (rpc && !isValidHttpUrl(rpc)) {
    console.warn(
      `[env] SOLANA_RPC_URL geçersiz (http/https ile başlamalı, Railway ID yazılmaz): "${rpc.slice(0, 48)}" → yok sayılıyor`,
    );
    rpc = '';
    delete process.env.SOLANA_RPC_URL;
  }

  if (!key) return;

  const canonical = heliusRpcUrl(key);
  const isHeliusRpc = /helius/i.test(rpc);
  const keyMismatch = rpc && isHeliusRpc && !rpc.includes(key);
  const missingApiKeyInUrl = rpc && isHeliusRpc && !rpc.includes('api-key');

  if (!rpc || keyMismatch || missingApiKeyInUrl) {
    if (!isHeliusRpc && rpc) return;
    if (keyMismatch || missingApiKeyInUrl) {
      console.log('[env] SOLANA_RPC_URL ← HELIUS_API_KEY ile senkronize edildi');
    } else {
      console.log('[env] SOLANA_RPC_URL ← Helius (HELIUS_API_KEY)');
    }
    process.env.SOLANA_RPC_URL = canonical;
  }
}

async function rpcProbe(rpc, method, params = []) {
  const { data, status } = await axios.post(
    rpc,
    { jsonrpc: '2.0', id: 1, method, params },
    { timeout: 12_000, validateStatus: () => true },
  );
  return { data, status };
}

/** Açılışta Helius RPC doğrula (bot tarama/risk için RPC kullanır). */
async function verifyHeliusRpc() {
  applyHeliusEnv();
  const key = sanitizeHeliusKey(process.env.HELIUS_API_KEY);
  const rpc = (process.env.SOLANA_RPC_URL || '').trim();

  if (!key) {
    console.warn('[env] ⚠️ HELIUS_API_KEY yok — Railway Variables → dashboard.helius.dev → API Keys');
    return false;
  }

  if (key.length < 20) {
    console.error(`[env] ❌ HELIUS_API_KEY çok kısa (${key.length} karakter) — Project ID değil, API Key yapıştırın`);
    return false;
  }

  if (!rpc) {
    console.warn('[env] ⚠️ SOLANA_RPC_URL yok — HELIUS_API_KEY ile otomatik üretilemedi');
    return false;
  }

  try {
    const health = await rpcProbe(rpc, 'getHealth');
    if (health.status === 401 || health.status === 403) {
      console.error('[env] ❌ HELIUS_API_KEY geçersiz (RPC 401) — dashboard.helius.dev → API Keys → yeni key, SOLANA_RPC_URL silin');
      return false;
    }
    if (health.data?.error) {
      console.error(`[env] ❌ Helius RPC: ${health.data.error.message}`);
      return false;
    }

    const slot = await rpcProbe(rpc, 'getSlot');
    if (slot.status === 401 || slot.status === 403) {
      console.error('[env] ❌ HELIUS_API_KEY geçersiz (RPC 401) — anahtarı yenileyin');
      return false;
    }
    if (slot.data?.result == null && slot.data?.error) {
      console.error(`[env] ❌ Helius RPC: ${slot.data.error.message}`);
      return false;
    }

    console.log(`[env] Helius RPC: OK (slot ${slot.data?.result})`);
    return true;
  } catch (e) {
    const st = e.response?.status;
    console.error(`[env] ❌ Helius bağlantı hatası (${st || e.message})`);
    return false;
  }
}

module.exports = { applyHeliusEnv, verifyHeliusRpc, sanitizeHeliusKey, isValidHttpUrl };
