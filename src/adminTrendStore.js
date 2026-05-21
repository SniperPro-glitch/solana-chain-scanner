// Admin — manuel trend listesi (pin, sıra, gizle).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA_DIR } = require('./data-path');

const STORE_PATH = path.join(DATA_DIR, 'admin-trend-list.json');

function loadRaw() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    }
  } catch (e) {
    console.warn('[admin-trend] load:', e.message);
  }
  return { manual: [], hiddenMints: [], updatedAt: null };
}

function saveRaw(data) {
  const next = {
    manual: Array.isArray(data.manual) ? data.manual : [],
    hiddenMints: Array.isArray(data.hiddenMints) ? data.hiddenMints : [],
    updatedAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

function listManual() {
  return loadRaw().manual;
}

function listHidden() {
  return new Set(loadRaw().hiddenMints.map(String));
}

function addManual({ token_id, position, is_pinned }) {
  const mint = String(token_id || '').trim();
  if (!mint) throw Object.assign(new Error('token_id gerekli'), { code: 'bad_input' });

  const data = loadRaw();
  data.manual = data.manual.filter((e) => e.mint !== mint);
  const pos = position === 'pin' || position === '📌' || is_pinned
    ? 'pin'
    : Math.max(1, parseInt(position, 10) || 1);

  data.manual.push({
    id: crypto.randomUUID(),
    mint,
    position: pos,
    is_pinned: pos === 'pin' || !!is_pinned,
    source: 'manual',
    addedAt: Date.now(),
  });
  data.manual.sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    const pa = a.position === 'pin' ? 0 : Number(a.position) || 99;
    const pb = b.position === 'pin' ? 0 : Number(b.position) || 99;
    return pa - pb;
  });
  data.hiddenMints = data.hiddenMints.filter((m) => m !== mint);
  return saveRaw(data);
}

function removeById(id) {
  const data = loadRaw();
  const entry = data.manual.find((e) => e.id === id);
  if (entry) {
    data.manual = data.manual.filter((e) => e.id !== id);
    saveRaw(data);
    return { ok: true, type: 'manual', mint: entry.mint };
  }
  return null;
}

function hideMint(mint) {
  const m = String(mint || '').trim();
  if (!m) return loadRaw();
  const data = loadRaw();
  if (!data.hiddenMints.includes(m)) data.hiddenMints.push(m);
  data.manual = data.manual.filter((e) => e.mint !== m);
  return saveRaw(data);
}

function unhideMint(mint) {
  const m = String(mint || '').trim();
  const data = loadRaw();
  data.hiddenMints = data.hiddenMints.filter((x) => x !== m);
  return saveRaw(data);
}

module.exports = {
  loadRaw,
  listManual,
  listHidden,
  addManual,
  removeById,
  hideMint,
  unhideMint,
};
