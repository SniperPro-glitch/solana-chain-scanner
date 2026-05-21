// Admin panel — ek yönetici hesapları (kurucu dışı).

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./data-path');
const {
  normalizeAssignablePermissions,
  permissionsFromRole,
} = require('./adminPermissions');

const STORE_PATH = path.join(DATA_DIR, 'admin-users.json');

function loadRaw() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
      return { users: Array.isArray(data.users) ? data.users : [] };
    }
  } catch (e) {
    console.warn('[admin-users] load:', e.message);
  }
  return { users: [] };
}

function saveRaw(data) {
  const next = { users: data.users || [], updatedAt: new Date().toISOString() };
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64);
  return `${salt.toString('base64')}:${hash.toString('base64')}`;
}

function verifyPassword(password, stored) {
  const raw = String(stored || '');
  const [saltB64, hashB64] = raw.split(':');
  if (!saltB64 || !hashB64) return false;
  try {
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    const actual = crypto.scryptSync(String(password), salt, 64);
    if (expected.length !== actual.length) return false;
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    roleLabel: row.roleLabel,
    permissions: normalizeAssignablePermissions(row.permissions),
    active: row.active !== false,
    lastLoginAt: row.lastLoginAt || null,
    createdAt: row.createdAt || null,
    isFounder: false,
    canDelete: true,
  };
}

function listUsers() {
  return loadRaw().users.map(publicUser);
}

function findByUsername(username) {
  const u = String(username || '').trim().toLowerCase();
  return loadRaw().users.find((r) => r.username.toLowerCase() === u) || null;
}

function findById(id) {
  return loadRaw().users.find((r) => r.id === id) || null;
}

function createUser({ username, password, role, permissions }) {
  const name = String(username || '').trim();
  if (!name || name.length < 2) {
    throw Object.assign(new Error('Kullanıcı adı en az 2 karakter'), { code: 'bad_input' });
  }
  if (!password || String(password).length < 6) {
    throw Object.assign(new Error('Şifre en az 6 karakter'), { code: 'bad_input' });
  }
  if (findByUsername(name)) {
    throw Object.assign(new Error('Bu kullanıcı adı zaten var'), { code: 'duplicate' });
  }
  const roleKey = String(role || 'viewer').trim();
  const perms = permissions?.length
    ? normalizeAssignablePermissions(permissions)
    : permissionsFromRole(roleKey);
  const preset = require('./adminPermissions').ROLE_PRESETS[roleKey];
  const row = {
    id: crypto.randomUUID(),
    username: name,
    passwordHash: hashPassword(password),
    role: roleKey,
    roleLabel: preset?.label || roleKey,
    permissions: perms,
    active: true,
    lastLoginAt: null,
    createdAt: new Date().toISOString(),
  };
  const data = loadRaw();
  data.users.push(row);
  saveRaw(data);
  return publicUser(row);
}

function updateUser(id, patch) {
  const data = loadRaw();
  const idx = data.users.findIndex((r) => r.id === id);
  if (idx < 0) throw Object.assign(new Error('Kullanıcı bulunamadı'), { code: 'not_found' });

  const row = data.users[idx];
  if (patch.password) {
    if (String(patch.password).length < 6) {
      throw Object.assign(new Error('Şifre en az 6 karakter'), { code: 'bad_input' });
    }
    row.passwordHash = hashPassword(patch.password);
  }
  if (patch.role != null) {
    const roleKey = String(patch.role).trim();
    const preset = require('./adminPermissions').ROLE_PRESETS[roleKey];
    row.role = roleKey;
    row.roleLabel = preset?.label || roleKey;
    if (!patch.permissions) {
      row.permissions = permissionsFromRole(roleKey);
    }
  }
  if (patch.permissions != null) {
    row.permissions = normalizeAssignablePermissions(patch.permissions);
  }
  if (patch.active != null) row.active = !!patch.active;

  data.users[idx] = row;
  saveRaw(data);
  return publicUser(row);
}

function deleteUser(id) {
  const data = loadRaw();
  const before = data.users.length;
  data.users = data.users.filter((r) => r.id !== id);
  if (data.users.length === before) {
    throw Object.assign(new Error('Kullanıcı bulunamadı'), { code: 'not_found' });
  }
  saveRaw(data);
  return { ok: true };
}

function verifyStoredUser(username, password) {
  const row = findByUsername(username);
  if (!row || row.active === false) return null;
  if (!verifyPassword(password, row.passwordHash)) return null;
  touchLastLogin(row.id);
  return publicUser(row);
}

function touchLastLogin(id) {
  const data = loadRaw();
  const row = data.users.find((r) => r.id === id);
  if (!row) return;
  row.lastLoginAt = new Date().toISOString();
  saveRaw(data);
}

module.exports = {
  listUsers,
  findByUsername,
  findById,
  createUser,
  updateUser,
  deleteUser,
  verifyStoredUser,
};
