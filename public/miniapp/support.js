/**
 * Mini App — Canlı destek (kullanıcı / Telegram).
 * Admin panelden AYRI arayüz: tek kolon, alt sheet, sadece mesajlaşma.
 */
(function () {
  const overlay = () => document.getElementById('supportOverlay');
  const messagesEl = () => document.getElementById('supportMessages');
  const statusEl = () => document.getElementById('supportStatus');
  const inputEl = () => document.getElementById('supportInput');
  const ticketLabel = () => document.getElementById('supportTicketId');

  let config = { enabled: true, welcomeMessage: '', pollIntervalSec: 4 };
  let ticket = null;
  let pollTimer = null;
  let bound = false;

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
  }

  function getUserKey() {
    const tg = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (tg?.id) return `tg:${tg.id}`;
    let gid = localStorage.getItem('sniperGuestId');
    if (!gid) {
      gid = `g:${crypto.randomUUID()}`;
      localStorage.setItem('sniperGuestId', gid);
    }
    return gid;
  }

  function getDisplayName() {
    const tg = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (!tg) return 'Misafir';
    return [tg.first_name, tg.last_name].filter(Boolean).join(' ') || tg.username || 'Kullanıcı';
  }

  function getUsername() {
    return window.Telegram?.WebApp?.initDataUnsafe?.user?.username || null;
  }

  function setStatus(msg, type) {
    const el = statusEl();
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'support-status' + (type ? ` ${type}` : '');
  }

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      ...opts,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(opts.headers || {}) },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(body.message || body.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.code = body.error;
      throw err;
    }
    return body;
  }

  function fmtTime(iso) {
    try {
      return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  function userInitials() {
    const n = getDisplayName();
    const p = n.trim().split(/\s+/);
    if (p.length >= 2) return (p[0][0] + p[1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase() || 'SN';
  }

  function renderMessages() {
    const box = messagesEl();
    if (!box) return;
    const av = document.getElementById('supportUserAvatar');
    if (av) av.textContent = userInitials();
    if (!ticket?.messages?.length) {
      box.innerHTML = `<p class="support-welcome">${esc(config.welcomeMessage || 'Merhaba! Destek ekibine yazın — en kısa sürede yanıt verilir.')}</p>`;
      return;
    }
    box.innerHTML = ticket.messages.map((m) => {
      const isAdmin = m.from === 'admin';
      const rowCls = isAdmin ? 'support-msg-row admin' : 'support-msg-row';
      const avText = isAdmin ? 'SN' : userInitials();
      const who = isAdmin ? (m.adminUser ? esc(m.adminUser) : 'Destek ekibi') : 'Siz';
      return `<div class="${rowCls}">
        <div class="support-msg-av">${avText}</div>
        <div>
          <div class="support-msg ${isAdmin ? 'admin' : 'user'}">${esc(m.text)}</div>
          <div class="support-msg-meta">${fmtTime(m.at)} · ${who}</div>
        </div>
      </div>`;
    }).join('');
    box.scrollTop = box.scrollHeight;
  }

  async function loadSession() {
    const key = getUserKey();
    const data = await api(`/api/support/session?userKey=${encodeURIComponent(key)}`);
    config = { ...config, ...(data.config || {}) };
    ticket = data.ticket || null;
    if (ticketLabel()) {
      ticketLabel.textContent = ticket
        ? `Ticket ${ticket.id}`
        : 'Yeni mesajınız destek ekibine iletilecek';
    }
    renderMessages();
    return ticket;
  }

  async function refreshTicket() {
    if (!ticket?.id) {
      await loadSession();
      return;
    }
    try {
      const data = await api(
        `/api/support/poll?ticketId=${encodeURIComponent(ticket.id)}&userKey=${encodeURIComponent(getUserKey())}`,
      );
      const prev = ticket?.messages?.length || 0;
      ticket = data.ticket;
      if ((ticket?.messages?.length || 0) !== prev) renderMessages();
    } catch {
      await loadSession();
    }
  }

  async function sendMessage() {
    const text = (inputEl()?.value || '').trim();
    if (!text) return;
    const btn = document.getElementById('supportSend');
    if (btn) btn.disabled = true;
    setStatus('Gönderiliyor…');
    try {
      const data = await api('/api/support/message', {
        method: 'POST',
        body: JSON.stringify({
          userKey: getUserKey(),
          displayName: getDisplayName(),
          username: getUsername(),
          text,
          ticketId: ticket?.id,
        }),
      });
      ticket = data.ticket;
      if (inputEl()) inputEl().value = '';
      renderMessages();
      setStatus('', 'ok');
      if (ticketLabel() && ticket) ticketLabel.textContent = `Ticket ${ticket.id}`;
      startPoll();
    } catch (e) {
      if (e.code === 'support_disabled') {
        setStatus('Canlı destek şu an kapalı.', 'err');
      } else {
        setStatus(e.message || 'Gönderilemedi', 'err');
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function startPoll() {
    stopPoll();
    const sec = Math.max(3, config.pollIntervalSec || 4);
    pollTimer = setInterval(() => {
      if (overlay()?.classList.contains('hidden')) return;
      refreshTicket().catch(() => {});
    }, sec * 1000);
  }

  function stopPoll() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  async function open() {
    const el = overlay();
    if (!el) return;
    try {
      const cfg = await api('/api/support/config');
      config = cfg.config || config;
      if (!config.enabled) {
        setStatus('Canlı destek şu an kapalı.', 'err');
        el.classList.remove('hidden');
        el.setAttribute('aria-hidden', 'false');
        return;
      }
      await loadSession();
      el.classList.remove('hidden');
      el.setAttribute('aria-hidden', 'false');
      document.body.classList.add('support-sheet-open');
      setStatus('');
      startPoll();
      inputEl()?.focus();
    } catch (e) {
      setStatus(e.message || 'Bağlantı hatası', 'err');
      el.classList.remove('hidden');
    }
  }

  function close() {
    const el = overlay();
    if (!el) return;
    el.classList.add('hidden');
    el.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('support-sheet-open');
    stopPoll();
  }

  function bind() {
    if (bound) return;
    bound = true;
    document.getElementById('supportOverlayBackdrop')?.addEventListener('click', close);
    document.getElementById('supportOverlayClose')?.addEventListener('click', close);
    document.getElementById('supportSend')?.addEventListener('click', sendMessage);
    inputEl()?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    document.querySelector('[data-sidebar-nav="support"]')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof window.closeDexSidebar === 'function') window.closeDexSidebar();
      open();
    });
  }

  window.SniperSupport = { open, close };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
