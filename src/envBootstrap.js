// HELIUS_API_KEY → SOLANA_RPC_URL (Helius RPC) otomatik bağlama.

function applyHeliusEnv() {
  const key = (process.env.HELIUS_API_KEY || '').trim();
  if (!key) return;

  const rpc = (process.env.SOLANA_RPC_URL || '').trim();
  if (!rpc) {
    process.env.SOLANA_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${key}`;
    console.log('[env] SOLANA_RPC_URL ← Helius (HELIUS_API_KEY)');
  }
}

module.exports = { applyHeliusEnv };
