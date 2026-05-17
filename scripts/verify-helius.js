#!/usr/bin/env node
// Helius anahtarını test et: node scripts/verify-helius.js
// .env içinde HELIUS_API_KEY=... olmalı

require('dotenv').config();
const axios = require('axios');
const { applyHeliusEnv, sanitizeHeliusKey } = require('../src/envBootstrap');

applyHeliusEnv();
const key = sanitizeHeliusKey(process.env.HELIUS_API_KEY);
const rpc = (process.env.SOLANA_RPC_URL || '').trim();

if (!key) {
  console.error('HELIUS_API_KEY yok — .env veya ortam değişkeni ekleyin');
  process.exit(1);
}

const prefix = key.length >= 8 ? `${key.slice(0, 4)}…${key.slice(-4)}` : '(çok kısa)';
console.log(`Key uzunluk: ${key.length}, önek: ${prefix}`);
console.log(`RPC URL: ${rpc.replace(key, '***')}`);

axios
  .post(rpc, { jsonrpc: '2.0', id: 1, method: 'getSlot' }, { validateStatus: () => true, timeout: 15_000 })
  .then(({ status, data }) => {
    if (status === 401 || status === 403) {
      console.error(`❌ HTTP ${status} — anahtar geçersiz veya iptal edilmiş`);
      console.error('→ dashboard.helius.dev → API Keys → Create New → kopyala → Railway HELIUS_API_KEY');
      process.exit(1);
    }
    if (data?.error) {
      console.error('❌ RPC hata:', data.error.message);
      process.exit(1);
    }
    console.log(`✅ OK — slot ${data.result}`);
    process.exit(0);
  })
  .catch((e) => {
    console.error('❌', e.message);
    process.exit(1);
  });
