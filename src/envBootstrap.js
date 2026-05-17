// HELIUS_API_KEY → SOLANA_RPC_URL (Helius RPC) otomatik bağlama + hatalı RPC URL temizliği.

const axios = require('axios');

function isValidHttpUrl(s) {
  return /^https?:\/\/.+/i.test(String(s || '').trim());
}

function heliusRpcUrl(key) {
  return `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(key)}`;
}

function applyHeliusEnv() {
  const key = (process.env.HELIUS_API_KEY || '').trim();
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

/** Açılışta Helius RPC + REST anahtarını doğrula (401 → Railway’de key düzelt). */
async function verifyHeliusRpc() {
  const key = (process.env.HELIUS_API_KEY || '').trim();
  const rpc = (process.env.SOLANA_RPC_URL || '').trim();

  if (!key) {
    console.warn('[env] ⚠️ HELIUS_API_KEY yok — Railway Variables → helius.dev anahtarı ekleyin');
    return false;
  }

  if (!rpc) {
    console.warn('[env] ⚠️ SOLANA_RPC_URL yok — HELIUS_API_KEY ile otomatik üretilemedi');
    return false;
  }

  try {
    const { data, status } = await axios.post(
      rpc,
      { jsonrpc: '2.0', id: 1, method: 'getHealth' },
      { timeout: 12_000, validateStatus: () => true },
    );
    if (status === 401) {
      console.error('[env] ❌ Helius RPC 401 — HELIUS_API_KEY Railway\'de yanlış veya eski');
      return false;
    }
    if (data?.error) {
      console.error(`[env] ❌ Helius RPC: ${data.error.message}`);
      return false;
    }
    const meta = await axios.get(
      `https://api.helius.xyz/v0/token-metadata?api-key=${encodeURIComponent(key)}&mint=So11111111111111111111111111111111111111112`,
      { timeout: 12_000, validateStatus: () => true },
    );
    if (meta.status === 401) {
      console.error('[env] ❌ HELIUS_API_KEY geçersiz (REST 401) — dashboard.helius.dev → yeni API key');
      return false;
    }
    console.log('[env] Helius RPC + API key: OK');
    return true;
  } catch (e) {
    const st = e.response?.status;
    console.error(`[env] ❌ Helius bağlantı hatası (${st || e.message})`);
    return false;
  }
}

module.exports = { applyHeliusEnv, verifyHeliusRpc, isValidHttpUrl };
