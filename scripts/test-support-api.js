#!/usr/bin/env node
/** Canlı destek API smoke test — npm run miniapp:dev çalışırken: node scripts/test-support-api.js */

const BASE = process.env.SUPPORT_TEST_BASE || 'http://127.0.0.1:3080';

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function loginAdmin() {
  const { status, body } = await req('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: process.env.ADMIN_PASSWORD || 'sniper-admin-2025' }),
  });
  if (status !== 200 || !body.token) throw new Error(`Admin login failed ${status} ${JSON.stringify(body)}`);
  return body.token;
}

async function main() {
  console.log('Base:', BASE);

  let r = await req('/api/support/config');
  console.log('GET /api/support/config', r.status, r.body.config?.enabled);
  if (r.status !== 200) throw new Error('config failed');

  const userKey = 'test:user-smoke';
  r = await req('/api/support/message', {
    method: 'POST',
    body: JSON.stringify({
      userKey,
      displayName: 'Test Kullanıcı',
      username: 'test_user',
      text: 'Merhaba, bu bir test mesajıdır.',
    }),
  });
  console.log('POST /api/support/message', r.status, r.body.ticket?.id);
  if (r.status !== 200) throw new Error('message failed');

  const ticketId = r.body.ticket.id;
  r = await req(`/api/support/poll?ticketId=${encodeURIComponent(ticketId)}&userKey=${encodeURIComponent(userKey)}`);
  console.log('GET /api/support/poll', r.status, r.body.ticket?.messages?.length);

  const token = await loginAdmin();
  const auth = { Authorization: `Bearer ${token}` };

  r = await req('/api/admin/support/tickets', { headers: auth });
  console.log('GET /api/admin/support/tickets', r.status, r.body.tickets?.length);
  if (r.status !== 200) throw new Error('admin list failed');

  r = await req(`/api/admin/support/tickets/${encodeURIComponent(ticketId)}/messages`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ message: 'Merhaba! Destek test yanıtı — çalışıyor.', type: 'reply' }),
  });
  console.log('POST admin messages (reply)', r.status, r.body.ok);
  if (r.status !== 200) throw new Error('admin reply failed');

  r = await req(`/api/admin/support/tickets/${encodeURIComponent(ticketId)}/messages`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ message: 'Dahili test notu', type: 'note' }),
  });
  console.log('POST admin messages (note)', r.status);
  if (r.status !== 200) throw new Error('admin note failed');

  r = await req(`/api/admin/support/tickets/${encodeURIComponent(ticketId)}/user`, { headers: auth });
  console.log('GET admin user', r.status, r.body.user?.displayName);
  if (r.status !== 200) throw new Error('admin user failed');

  r = await req(`/api/admin/support/tickets/${encodeURIComponent(ticketId)}/actions`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ action: 'takeover' }),
  });
  console.log('POST admin action takeover', r.status, r.body.ticket?.status);

  r = await req(`/api/support/poll?ticketId=${encodeURIComponent(ticketId)}&userKey=${encodeURIComponent(userKey)}`);
  const hasAdmin = r.body.ticket?.messages?.some((m) => m.from === 'admin');
  console.log('User poll after reply', r.status, 'admin msg:', hasAdmin);
  if (!hasAdmin) throw new Error('admin message not visible to user');

  console.log('\n✓ Tüm destek testleri başarılı');
}

main().catch((e) => {
  console.error('\n✗', e.message);
  process.exit(1);
});
