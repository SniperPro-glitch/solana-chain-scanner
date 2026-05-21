// Canlı destek — ticket + mesajlar (dosya).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA_DIR } = require('./data-path');

const STORE_PATH = path.join(DATA_DIR, 'support-tickets.json');

const DEFAULT_CONFIG = {
  enabled: true,
  welcomeMessage: 'Merhaba! SNIPER destek ekibine yazın — en kısa sürede yanıt verilir.',
  pollIntervalSec: 4,
};

function loadRaw() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
      return {
        config: { ...DEFAULT_CONFIG, ...(data.config || {}) },
        tickets: Array.isArray(data.tickets) ? data.tickets : [],
      };
    }
  } catch (e) {
    console.warn('[support] load:', e.message);
  }
  return { config: { ...DEFAULT_CONFIG }, tickets: [] };
}

function saveRaw(data) {
  const next = {
    config: { ...DEFAULT_CONFIG, ...(data.config || {}) },
    tickets: Array.isArray(data.tickets) ? data.tickets : [],
    updatedAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

function nextTicketId(tickets) {
  const n = tickets.length + 1;
  return `T-${String(1000 + n)}`;
}

function loadConfig() {
  return loadRaw().config;
}

function saveConfig(patch) {
  const data = loadRaw();
  data.config = {
    ...data.config,
    enabled: patch.enabled != null ? !!patch.enabled : data.config.enabled,
    welcomeMessage: patch.welcomeMessage != null
      ? String(patch.welcomeMessage).trim().slice(0, 500)
      : data.config.welcomeMessage,
    pollIntervalSec: patch.pollIntervalSec != null
      ? Math.max(3, Math.min(60, parseInt(patch.pollIntervalSec, 10) || 4))
      : data.config.pollIntervalSec,
  };
  return saveRaw(data).config;
}

function publicTicket(t) {
  return {
    id: t.id,
    userKey: t.userKey,
    displayName: t.displayName,
    username: t.username || null,
    status: t.status,
    category: t.category || 'general',
    priority: t.priority || 'normal',
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    lastMessageAt: t.lastMessageAt,
    messages: (t.messages || [])
      .filter((m) => m.from !== 'note')
      .map((m) => ({
        id: m.id,
        from: m.from,
        text: m.text,
        at: m.at,
        adminUser: m.adminUser || null,
      })),
    unreadUser: t.unreadUser || 0,
  };
}

function adminTicket(t) {
  return {
    ...publicTicket(t),
    internalNote: t.internalNote || '',
    assignedTo: t.assignedTo || null,
    unreadAdmin: t.unreadAdmin || 0,
  };
}

function findOpenByUser(userKey) {
  const key = String(userKey || '').trim();
  if (!key) return null;
  const data = loadRaw();
  const open = ['open', 'waiting', 'active'];
  return data.tickets
    .filter((t) => t.userKey === key && open.includes(t.status))
    .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))[0] || null;
}

function getTicket(id) {
  return loadRaw().tickets.find((t) => t.id === id) || null;
}

function addUserMessage({ userKey, displayName, username, text, ticketId }) {
  const cfg = loadConfig();
  if (!cfg.enabled) {
    throw Object.assign(new Error('Canlı destek şu an kapalı'), { code: 'support_disabled' });
  }
  const msgText = String(text || '').trim();
  if (!msgText || msgText.length < 1) {
    throw Object.assign(new Error('Mesaj boş olamaz'), { code: 'bad_input' });
  }
  if (msgText.length > 2000) {
    throw Object.assign(new Error('Mesaj çok uzun (max 2000)'), { code: 'bad_input' });
  }

  const data = loadRaw();
  const key = String(userKey || '').trim();
  if (!key) throw Object.assign(new Error('userKey gerekli'), { code: 'bad_input' });

  let ticket = ticketId ? data.tickets.find((t) => t.id === ticketId) : null;
  if (!ticket) ticket = findOpenByUser(key);

  const now = new Date().toISOString();
  const message = {
    id: crypto.randomUUID(),
    from: 'user',
    text: msgText,
    at: now,
  };

  if (!ticket) {
    ticket = {
      id: nextTicketId(data.tickets),
      userKey: key,
      displayName: String(displayName || 'Misafir').trim().slice(0, 80),
      username: username ? String(username).replace(/^@/, '').slice(0, 64) : null,
      status: 'waiting',
      category: 'general',
      priority: 'normal',
      internalNote: '',
      assignedTo: null,
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
      messages: [message],
      unreadAdmin: 1,
      unreadUser: 0,
    };
    data.tickets.unshift(ticket);
  } else {
    if (ticket.userKey !== key) {
      throw Object.assign(new Error('Yetkisiz'), { code: 'forbidden' });
    }
    if (ticket.status === 'closed' || ticket.status === 'resolved') {
      throw Object.assign(new Error('Ticket kapalı — yeni mesaj için yeni talep açın'), { code: 'ticket_closed' });
    }
    ticket.messages.push(message);
    ticket.lastMessageAt = now;
    ticket.updatedAt = now;
    ticket.unreadAdmin = (ticket.unreadAdmin || 0) + 1;
    if (ticket.status === 'open') ticket.status = 'waiting';
  }

  saveRaw(data);
  return publicTicket(ticket);
}

function addAdminReply({ ticketId, adminUser, text }) {
  return addAdminMessage({ ticketId, adminUser, text, type: 'reply' });
}

function addAdminMessage({ ticketId, adminUser, text, type = 'reply' }) {
  const msgText = String(text || '').trim();
  if (!msgText) throw Object.assign(new Error('Mesaj boş'), { code: 'bad_input' });
  const msgType = type === 'note' ? 'note' : 'reply';

  const data = loadRaw();
  const ticket = data.tickets.find((t) => t.id === ticketId);
  if (!ticket) throw Object.assign(new Error('Ticket bulunamadı'), { code: 'not_found' });

  const now = new Date().toISOString();
  ticket.messages.push({
    id: crypto.randomUUID(),
    from: msgType === 'note' ? 'note' : 'admin',
    text: msgText,
    at: now,
    adminUser: String(adminUser || 'admin').slice(0, 64),
  });
  ticket.updatedAt = now;
  if (msgType === 'reply') {
    ticket.lastMessageAt = now;
    ticket.status = ticket.status === 'waiting' ? 'active' : ticket.status;
    ticket.unreadUser = (ticket.unreadUser || 0) + 1;
    ticket.unreadAdmin = 0;
  }

  saveRaw(data);
  return adminTicket(ticket);
}

function applyTicketAction(id, action, adminUser) {
  const data = loadRaw();
  const ticket = data.tickets.find((t) => t.id === id);
  if (!ticket) throw Object.assign(new Error('Ticket bulunamadı'), { code: 'not_found' });

  const act = String(action || '').toLowerCase();
  const agent = String(adminUser || 'admin').slice(0, 64);
  switch (act) {
    case 'resolve':
      ticket.status = 'resolved';
      break;
    case 'close':
      ticket.status = 'closed';
      break;
    case 'takeover':
      ticket.status = 'active';
      ticket.assignedTo = agent;
      break;
    case 'transfer':
      ticket.status = 'waiting';
      ticket.assignedTo = null;
      break;
    default:
      throw Object.assign(new Error('Geçersiz aksiyon'), { code: 'bad_input' });
  }
  ticket.updatedAt = new Date().toISOString();
  saveRaw(data);
  return adminTicket(ticket);
}

function ticketUserInfo(ticket) {
  if (!ticket) return null;
  const lastUserMsg = [...(ticket.messages || [])].reverse().find((m) => m.from === 'user');
  return {
    userKey: ticket.userKey,
    displayName: ticket.displayName,
    username: ticket.username,
    plan: ticket.priority === 'high' ? 'Premium' : 'Standart',
    wallet: '—',
    registeredAt: ticket.createdAt,
    lastActiveAt: ticket.lastMessageAt,
    chain: 'Solana',
    lastToken: lastUserMsg?.text?.match(/[1-9A-HJ-NP-Za-km-z]{4,44}/)?.[0]?.slice(0, 8) + '…' || '—',
    riskScore: '—',
    scanCount: '—',
  };
}

function updateTicket(id, patch) {
  const data = loadRaw();
  const ticket = data.tickets.find((t) => t.id === id);
  if (!ticket) throw Object.assign(new Error('Ticket bulunamadı'), { code: 'not_found' });

  if (patch.status != null) ticket.status = String(patch.status);
  if (patch.category != null) ticket.category = String(patch.category).slice(0, 32);
  if (patch.priority != null) ticket.priority = String(patch.priority).slice(0, 16);
  if (patch.internalNote != null) ticket.internalNote = String(patch.internalNote).slice(0, 2000);
  if (patch.assignedTo != null) ticket.assignedTo = String(patch.assignedTo).slice(0, 64);
  ticket.updatedAt = new Date().toISOString();

  saveRaw(data);
  return adminTicket(ticket);
}

function markUserRead(ticketId, userKey) {
  const data = loadRaw();
  const ticket = data.tickets.find((t) => t.id === ticketId && t.userKey === userKey);
  if (!ticket) return null;
  ticket.unreadUser = 0;
  saveRaw(data);
  return publicTicket(ticket);
}

function markAdminRead(ticketId) {
  const data = loadRaw();
  const ticket = data.tickets.find((t) => t.id === ticketId);
  if (!ticket) return null;
  ticket.unreadAdmin = 0;
  saveRaw(data);
  return adminTicket(ticket);
}

function listTickets({ status, tab, q, limit = 100 } = {}) {
  const data = loadRaw();
  let list = [...data.tickets];
  const tabKey = tab || status;
  if (tabKey === 'open') {
    list = list.filter((t) => ['open', 'waiting', 'active'].includes(t.status));
  } else if (tabKey === 'waiting') {
    list = list.filter((t) => t.status === 'waiting');
  } else if (tabKey === 'resolved') {
    list = list.filter((t) => ['resolved', 'closed'].includes(t.status));
  } else if (tabKey && tabKey !== 'all') {
    list = list.filter((t) => t.status === tabKey);
  }
  const ql = String(q || '').trim().toLowerCase();
  if (ql) {
    list = list.filter((t) => {
      const hay = [
        t.id, t.displayName, t.username, t.userKey,
        ...(t.messages || []).slice(-3).map((m) => m.text),
      ].join(' ').toLowerCase();
      return hay.includes(ql);
    });
  }
  list.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
  return list.slice(0, limit).map(adminTicket);
}

function stats() {
  const data = loadRaw();
  const tickets = data.tickets || [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  const todayCount = tickets.filter((t) => new Date(t.createdAt).getTime() >= todayMs).length;
  return {
    total: tickets.length,
    waiting: tickets.filter((t) => t.status === 'waiting').length,
    active: tickets.filter((t) => ['active', 'open'].includes(t.status)).length,
    closed: tickets.filter((t) => ['closed', 'resolved'].includes(t.status)).length,
    today: todayCount,
    unreadAdmin: tickets.reduce((s, t) => s + (t.unreadAdmin || 0), 0),
  };
}

function tabCounts() {
  const data = loadRaw();
  const tickets = data.tickets || [];
  return {
    open: tickets.filter((t) => ['open', 'waiting', 'active'].includes(t.status)).length,
    waiting: tickets.filter((t) => t.status === 'waiting').length,
    resolved: tickets.filter((t) => ['resolved', 'closed'].includes(t.status)).length,
    active: tickets.filter((t) => ['active', 'open'].includes(t.status)).length,
  };
}

module.exports = {
  loadConfig,
  saveConfig,
  findOpenByUser,
  getTicket,
  addUserMessage,
  addAdminReply,
  addAdminMessage,
  applyTicketAction,
  ticketUserInfo,
  updateTicket,
  markUserRead,
  markAdminRead,
  listTickets,
  stats,
  tabCounts,
  publicTicket,
  adminTicket,
};
