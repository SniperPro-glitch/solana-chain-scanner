// Manuel güvenilir mint listesi (Solana Bot 2 — yalnızca solana).

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'whitelist.json');

function defaultStore() {
  return { entries: [] };
}

function normalizeAddress(chain, address) {
  const c = (chain || 'solana').toLowerCase();
  if (c !== 'solana') return null;
  const raw = String(address || '').trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(raw)) return null;
  return raw;
}

function load() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(FILE)) return defaultStore();
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!Array.isArray(data.entries)) return defaultStore();
    return data;
  } catch (e) {
    console.error('whitelist.json okuma:', e.message);
    return defaultStore();
  }
}

function save(store) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(store, null, 2));
  } catch (e) {
    console.error('whitelist.json yazma:', e.message);
  }
}

let cache = load();

function refresh() {
  cache = load();
}

function matchToken(token) {
  if (!token) return null;
  const chain = (token.chain || 'solana').toLowerCase();
  if (chain !== 'solana') return null;
  const candidates = [token.tokenAddress, token.address].filter(Boolean);
  for (const addr of candidates) {
    const norm = normalizeAddress(chain, addr);
    if (!norm) continue;
    const hit = cache.entries.find((e) => {
      if ((e.chain || 'solana').toLowerCase() !== 'solana') return false;
      return normalizeAddress('solana', e.address) === norm;
    });
    if (!hit) continue;
    if (hit.expiresAt && new Date(hit.expiresAt).getTime() < Date.now()) continue;
    return {
      label: hit.label || hit.symbol || 'Whitelist',
      symbol: hit.symbol || null,
      tier: hit.tier || 'badge',
      addedAt: hit.addedAt || null,
    };
  }
  return null;
}

function listEntries(chainFilter = null) {
  refresh();
  const now = Date.now();
  return cache.entries
    .filter((e) => {
      if (chainFilter && (e.chain || 'solana').toLowerCase() !== chainFilter.toLowerCase()) return false;
      if (e.expiresAt && new Date(e.expiresAt).getTime() < now) return false;
      return true;
    })
    .sort((a, b) => String(b.addedAt || '').localeCompare(String(a.addedAt || '')));
}

function addEntry({ chain, address, label, symbol, addedBy, expiresAt = null }) {
  refresh();
  const c = 'solana';
  const norm = normalizeAddress(c, address);
  if (!norm) return { ok: false, error: 'Geçersiz Solana mint adresi' };
  cache.entries = cache.entries.filter((e) => normalizeAddress('solana', e.address) !== norm);
  const entry = {
    chain: c,
    address: String(address).trim(),
    label: String(label || symbol || 'Bilinen proje').slice(0, 120),
    symbol: symbol ? String(symbol).slice(0, 32) : null,
    tier: 'badge',
    addedBy: addedBy || null,
    addedAt: new Date().toISOString(),
    expiresAt: expiresAt || null,
  };
  cache.entries.push(entry);
  save(cache);
  return { ok: true, entry };
}

function removeEntry(chain, address) {
  refresh();
  const norm = normalizeAddress('solana', address);
  if (!norm) return { ok: false, error: 'Geçersiz adres' };
  const before = cache.entries.length;
  cache.entries = cache.entries.filter((e) => normalizeAddress('solana', e.address) !== norm);
  save(cache);
  return { ok: true, removed: before - cache.entries.length };
}

module.exports = {
  matchToken,
  listEntries,
  addEntry,
  removeEntry,
  refresh,
  normalizeAddress,
};
