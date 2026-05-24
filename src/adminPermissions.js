// Admin panel — izin tanımları ve rol şablonları.

const FOUNDER_PROFILE = {
  displayName: 'JUSTİN EVAN',
  displayTitle: 'OWNER',
  roleLabel: 'Kurucu',
};

/** Yalnızca kurucu (.env) yönetir — başka adminlere atanamaz. */
const FOUNDER_ONLY_KEYS = [
  'channels',
  'trending',
  'risk',
  'chains',
  'env',
  'settings',
  'admins.manage',
];

const PERMISSIONS = [
  { key: 'dashboard', label: 'Dashboard', founderOnly: false },
  { key: 'feed.view', label: 'Token Feed (Görüntüle)', founderOnly: false },
  { key: 'feed.write', label: 'Token Ekle / Kaldır', founderOnly: false },
  { key: 'banner', label: 'App Banner', founderOnly: false },
  { key: 'channels', label: 'Bot & Kanallar', founderOnly: true },
  { key: 'trending', label: 'Trend Ayarları', founderOnly: true },
  { key: 'risk', label: 'Risk Filtreleri', founderOnly: true },
  { key: 'chains', label: 'Zincir Yönetimi', founderOnly: true },
  { key: 'env', label: 'Ortam Değişkenleri', founderOnly: true },
  { key: 'settings', label: 'Genel Ayarlar', founderOnly: true },
  { key: 'support', label: 'Canlı Destek', founderOnly: false },
  { key: 'admins.manage', label: 'Admin Ekle / Sil / Yetki', founderOnly: true },
];

const ALL_KEYS = PERMISSIONS.map((p) => p.key);
const ASSIGNABLE_PERMISSIONS = PERMISSIONS.filter((p) => !p.founderOnly);
const ASSIGNABLE_KEYS = ASSIGNABLE_PERMISSIONS.map((p) => p.key);
const FOUNDER_ONLY_PERMISSIONS = PERMISSIONS.filter((p) => p.founderOnly);

const ROLE_PRESETS = {
  viewer: {
    label: 'Görüntüleyici',
    icon: '👁',
    permissions: ['dashboard', 'feed.view'],
  },
  moderator: {
    label: 'Moderatör',
    icon: '🛡',
    permissions: ['dashboard', 'feed.view', 'feed.write', 'banner', 'support'],
  },
  admin: {
    label: 'Admin',
    icon: '⚙️',
    permissions: [
      'dashboard', 'feed.view', 'feed.write', 'banner', 'support',
    ],
  },
  founder: {
    label: 'Kurucu',
    icon: '👑',
    permissions: [...ALL_KEYS],
  },
};

function stripFounderOnly(list) {
  const set = new Set(list || []);
  for (const k of FOUNDER_ONLY_KEYS) set.delete(k);
  return [...set];
}

function normalizePermissions(list) {
  return normalizeAssignablePermissions(list);
}

/** Kayıtlı kullanıcılar için — kurucuya özel izinler asla kaydedilmez. */
function normalizeAssignablePermissions(list) {
  const set = new Set();
  for (const k of list || []) {
    const key = String(k || '').trim();
    if (ASSIGNABLE_KEYS.includes(key)) set.add(key);
  }
  return [...set];
}

function permissionsFromRole(role) {
  const preset = ROLE_PRESETS[role];
  if (!preset) return normalizeAssignablePermissions(ROLE_PRESETS.viewer.permissions);
  if (role === 'founder') return [...ALL_KEYS];
  return normalizeAssignablePermissions(preset.permissions);
}

function hasPermission(userPerms, key, { isFounder = false } = {}) {
  if (!key) return false;
  if (isFounder) return true;
  if (FOUNDER_ONLY_KEYS.includes(key)) return false;
  const perms = userPerms || [];
  return perms.includes(key);
}

/** Kurucuya özel sayfa/API slug'ları */
const FOUNDER_ONLY_PAGES = ['channels', 'trending', 'risk', 'chains', 'admins', 'env', 'settings'];

function filterRolePresetsForAssignable() {
  const out = {};
  for (const [role, preset] of Object.entries(ROLE_PRESETS)) {
    if (role === 'founder') continue;
    out[role] = {
      ...preset,
      permissions: normalizeAssignablePermissions(preset.permissions),
    };
  }
  return out;
}

module.exports = {
  FOUNDER_PROFILE,
  FOUNDER_ONLY_KEYS,
  FOUNDER_ONLY_PAGES,
  PERMISSIONS,
  ASSIGNABLE_PERMISSIONS,
  ASSIGNABLE_KEYS,
  FOUNDER_ONLY_PERMISSIONS,
  ALL_KEYS,
  ROLE_PRESETS,
  normalizePermissions,
  normalizeAssignablePermissions,
  permissionsFromRole,
  hasPermission,
  filterRolePresetsForAssignable,
  stripFounderOnly,
};
