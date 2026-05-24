// Ortak TonAPI yardımcıları — DEX adapter'ları paylaşır.
// Tx detayı, op_code, out_msg parse — küçük ve test edilebilir.

const axios = require('axios');
const { Address } = require('@ton/core');

const TONAPI_BASE = 'https://tonapi.io/v2';

// TonAPI SSE 'account_id'ü raw '0:hex64' formatında döner, ancak
// factory sabitlerimiz user-friendly EQ formatında. Bunları aynı
// raw forma indirgeyerek güvenilir karşılaştırma yaparız.
function toRaw(addr) {
  if (!addr) return null;
  if (/^0:[a-fA-F0-9]{64}$/.test(addr)) return addr.toLowerCase();
  try {
    return Address.parse(addr).toRawString().toLowerCase();
  } catch (_) {
    return String(addr).toLowerCase();
  }
}

function addressEquals(a, b) {
  const ra = toRaw(a);
  const rb = toRaw(b);
  return ra && rb && ra === rb;
}

const http = axios.create({
  timeout: 15_000,
  headers: { Accept: 'application/json', 'User-Agent': 'ton-chain-scanner/discovery' },
});

// Op_code'u her durumda 0x... lowercase string'e normalize et.
// TonAPI bazen number, bazen string (hex veya decimal) döner.
function normalizeOpCode(op) {
  if (op == null) return null;
  if (typeof op === 'number') {
    return '0x' + (op >>> 0).toString(16).padStart(8, '0');
  }
  const s = String(op).trim();
  if (/^0x[0-9a-fA-F]+$/.test(s)) {
    // 0x prefix + lowercase, 8 hane'ye pad
    const hex = s.slice(2).toLowerCase().padStart(8, '0');
    return '0x' + hex;
  }
  if (/^[0-9]+$/.test(s)) {
    return '0x' + (Number(s) >>> 0).toString(16).padStart(8, '0');
  }
  return s.toLowerCase();
}

// /v2/blockchain/transactions/{hash} — tek tx detay
async function getTransaction(hashOrId) {
  try {
    const { data } = await http.get(`${TONAPI_BASE}/blockchain/transactions/${encodeURIComponent(hashOrId)}`);
    return data || null;
  } catch (err) {
    if (err.response?.status === 404) return null;
    console.warn(`TonAPI tx fetch hata (${hashOrId}):`, err.message);
    return null;
  }
}

// /v2/blockchain/accounts/{addr}/transactions?lt=&hash=  — alternatif erişim
async function getAccountTx(account, { lt, hash, limit = 1 } = {}) {
  try {
    const params = { limit };
    if (lt) params.lt = lt;
    if (hash) params.hash = hash;
    const { data } = await http.get(
      `${TONAPI_BASE}/blockchain/accounts/${encodeURIComponent(account)}/transactions`,
      { params },
    );
    return data?.transactions || [];
  } catch (err) {
    if (err.response?.status === 404) return [];
    console.warn(`TonAPI account tx hata (${account}):`, err.message);
    return [];
  }
}

// State-init taşıyan out_msg'lerin destination'ı = yeni deploy edilen kontrat
function extractDeployedAddresses(tx) {
  const deployed = [];
  const outs = tx?.out_msgs || [];
  for (const m of outs) {
    // init field var ise yeni kontrat deploy edildi
    if (m.init && m.destination?.address) {
      deployed.push(m.destination.address);
    }
  }
  return deployed;
}

// Tüm out_msg destinations
function extractAllDestinations(tx) {
  const outs = tx?.out_msgs || [];
  return outs
    .filter((m) => m.destination?.address)
    .map((m) => ({ address: m.destination.address, op: normalizeOpCode(m.op_code), hasInit: Boolean(m.init) }));
}

// in_msg op_code
function getInOp(tx) {
  return normalizeOpCode(tx?.in_msg?.op_code);
}

// in_msg source (kim gönderdi)
function getInSource(tx) {
  return tx?.in_msg?.source?.address || null;
}

module.exports = {
  http,
  TONAPI_BASE,
  normalizeOpCode,
  toRaw,
  addressEquals,
  getTransaction,
  getAccountTx,
  extractDeployedAddresses,
  extractAllDestinations,
  getInOp,
  getInSource,
};
