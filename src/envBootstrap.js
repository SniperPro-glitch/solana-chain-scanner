// HELIUS_API_KEY → SOLANA_RPC_URL (Helius RPC) otomatik bağlama + hatalı RPC URL temizliği.

function isValidHttpUrl(s) {
  return /^https?:\/\/.+/i.test(String(s || '').trim());
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

  if (!rpc && key) {
    process.env.SOLANA_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${key}`;
    console.log('[env] SOLANA_RPC_URL ← Helius (HELIUS_API_KEY)');
    return;
  }

  if (key && rpc && !rpc.includes('api-key') && /helius/i.test(rpc)) {
    process.env.SOLANA_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${key}`;
    console.log('[env] SOLANA_RPC_URL Helius anahtarı ile güncellendi');
  }
}

module.exports = { applyHeliusEnv, isValidHttpUrl };
