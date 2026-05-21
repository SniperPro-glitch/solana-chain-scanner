// Canlı destek — HTTP handlers (mini app + admin).

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 64 * 1024) {
        reject(new Error('body_too_large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

async function handlePublicSupportApi(req, res, url, sendJson) {
  const supportStore = require('./supportStore');

  if (req.method === 'GET' && url.pathname === '/api/support/config') {
    sendJson(res, 200, { config: supportStore.loadConfig() });
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/support/session') {
    const userKey = url.searchParams.get('userKey') || '';
    const ticket = supportStore.findOpenByUser(userKey);
    sendJson(res, 200, {
      ticket: ticket ? supportStore.publicTicket(ticket) : null,
      config: supportStore.loadConfig(),
    });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/support/message') {
    try {
      const body = await parseJsonBody(req);
      const ticket = supportStore.addUserMessage({
        userKey: body.userKey,
        displayName: body.displayName,
        username: body.username,
        text: body.text,
        ticketId: body.ticketId,
      });
      sendJson(res, 200, { ok: true, ticket });
    } catch (e) {
      const code = e.code === 'support_disabled' ? 503 : (e.code === 'forbidden' ? 403 : 400);
      sendJson(res, code, { error: e.code || 'support_failed', message: e.message });
    }
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/support/poll') {
    const ticketId = url.searchParams.get('ticketId') || '';
    const userKey = url.searchParams.get('userKey') || '';
    const ticket = supportStore.getTicket(ticketId);
    if (!ticket || ticket.userKey !== userKey) {
      sendJson(res, 404, { error: 'not_found', message: 'Ticket bulunamadı' });
      return true;
    }
    const pub = supportStore.markUserRead(ticketId, userKey);
    sendJson(res, 200, { ticket: pub });
    return true;
  }

  return false;
}

async function handleAdminSupportApi(req, res, url, sendJson, auth) {
  const supportStore = require('./supportStore');
  const { hasPermission } = require('./adminPermissions');

  if (!hasPermission(auth.permissions, 'support', { isFounder: auth.isFounder })) {
    sendJson(res, 403, { error: 'forbidden', message: 'Canlı destek yetkisi yok' });
    return true;
  }

  const ticketMatch = url.pathname.match(/^\/api\/admin\/support\/tickets\/([^/]+)$/);
  const replyMatch = url.pathname.match(/^\/api\/admin\/support\/tickets\/([^/]+)\/reply$/);
  const messagesMatch = url.pathname.match(/^\/api\/admin\/support\/tickets\/([^/]+)\/messages$/);
  const userMatch = url.pathname.match(/^\/api\/admin\/support\/tickets\/([^/]+)\/user$/);
  const actionsMatch = url.pathname.match(/^\/api\/admin\/support\/tickets\/([^/]+)\/actions$/);

  if (req.method === 'GET' && url.pathname === '/api/admin/support/stats') {
    sendJson(res, 200, { stats: supportStore.stats(), config: supportStore.loadConfig() });
    return true;
  }

  if (url.pathname === '/api/admin/support/config') {
    if (req.method === 'GET') {
      sendJson(res, 200, { config: supportStore.loadConfig() });
      return true;
    }
    if (req.method === 'PUT') {
      try {
        const body = await parseJsonBody(req);
        const config = supportStore.saveConfig(body);
        sendJson(res, 200, { ok: true, config });
      } catch (e) {
        sendJson(res, 400, { error: 'save_failed', message: e.message });
      }
      return true;
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/support/tickets') {
    const status = url.searchParams.get('status') || 'all';
    const tab = url.searchParams.get('tab') || '';
    const q = url.searchParams.get('q') || '';
    sendJson(res, 200, {
      tickets: supportStore.listTickets({ status, tab, q }),
      stats: supportStore.stats(),
      tabCounts: supportStore.tabCounts(),
    });
    return true;
  }

  if (messagesMatch && req.method === 'GET') {
    const id = decodeURIComponent(messagesMatch[1]);
    const ticket = supportStore.markAdminRead(id);
    if (!ticket) {
      sendJson(res, 404, { error: 'not_found' });
      return true;
    }
    sendJson(res, 200, { messages: ticket.messages || [] });
    return true;
  }

  if (userMatch && req.method === 'GET') {
    const id = decodeURIComponent(userMatch[1]);
    const raw = supportStore.getTicket(id);
    if (!raw) {
      sendJson(res, 404, { error: 'not_found' });
      return true;
    }
    sendJson(res, 200, { user: supportStore.ticketUserInfo(raw) });
    return true;
  }

  if (actionsMatch && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const id = decodeURIComponent(actionsMatch[1]);
      const ticket = supportStore.applyTicketAction(id, body.action, auth.username);
      sendJson(res, 200, { ok: true, ticket });
    } catch (e) {
      const code = e.code === 'not_found' ? 404 : 400;
      sendJson(res, code, { error: e.code || 'action_failed', message: e.message });
    }
    return true;
  }

  if (messagesMatch && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const id = decodeURIComponent(messagesMatch[1]);
      const ticket = supportStore.addAdminMessage({
        ticketId: id,
        adminUser: auth.username,
        text: body.message || body.text,
        type: body.type === 'note' ? 'note' : 'reply',
      });
      sendJson(res, 200, { ok: true, ticket });
    } catch (e) {
      sendJson(res, 400, { error: 'message_failed', message: e.message });
    }
    return true;
  }

  if (req.method === 'POST' && replyMatch) {
    try {
      const body = await parseJsonBody(req);
      const ticket = supportStore.addAdminReply({
        ticketId: decodeURIComponent(replyMatch[1]),
        adminUser: auth.username,
        text: body.text,
      });
      sendJson(res, 200, { ok: true, ticket });
    } catch (e) {
      sendJson(res, 400, { error: 'reply_failed', message: e.message });
    }
    return true;
  }

  if (ticketMatch) {
    const id = decodeURIComponent(ticketMatch[1]);
    if (req.method === 'GET') {
      const ticket = supportStore.markAdminRead(id);
      if (!ticket) {
        sendJson(res, 404, { error: 'not_found' });
        return true;
      }
      sendJson(res, 200, { ticket });
      return true;
    }
    if (req.method === 'PATCH') {
      try {
        const body = await parseJsonBody(req);
        const ticket = supportStore.updateTicket(id, body);
        sendJson(res, 200, { ok: true, ticket });
      } catch (e) {
        sendJson(res, 400, { error: 'update_failed', message: e.message });
      }
      return true;
    }
  }

  return false;
}

module.exports = {
  handlePublicSupportApi,
  handleAdminSupportApi,
  parseJsonBody,
};
