/**
 * Admin — Canlı Destek (SUPPORT masaüstü tasarımı, birebir layout).
 */
(function () {
  const $ = (id) => document.getElementById(id);

  let tickets = [];
  let selectedId = null;
  let activeTab = 'open';
  let composeMode = 'reply';
  let pollTimer = null;
  let adminName = 'Admin';
  let uiBound = false;
  let updatingFields = false;

  const MACROS = [
    'Merhaba! SNIPER destek — size nasıl yardımcı olabilirim?',
    'Lütfen sorunlu tokenın contract adresini (CA) paylaşır mısınız?',
    'Tarayıcı önbelleğini temizleyip tekrar deneyin.',
    'Teşekkürler, talebinizi çözüldü olarak işaretledik.',
  ];

  const PRIORITY = {
    high: ['Yüksek', 'rgba(255,59,59,0.15)', 'var(--red)'],
    normal: ['Orta', 'rgba(245,166,35,0.15)', 'var(--yellow)'],
    low: ['Düşük', 'rgba(0,255,136,0.12)', 'var(--green)'],
  };

  const CAT_COLORS = {
    token: ['var(--blue)', 'rgba(59,130,246,0.15)'],
    payment: ['var(--purple)', 'rgba(124,58,237,0.15)'],
    report: ['var(--red)', 'rgba(255,59,59,0.15)'],
    default: ['var(--muted)', 'rgba(255,255,255,0.06)'],
  };

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
  }

  function initials(name) {
    const p = String(name || '?').trim().split(/\s+/);
    if (p.length >= 2) return (p[0][0] + p[1][0]).toUpperCase();
    return String(name || '?').slice(0, 2).toUpperCase();
  }

  function avatarColor(name) {
    const colors = [
      ['rgba(0,255,136,0.12)', 'var(--green)'],
      ['rgba(0,229,255,0.1)', 'var(--cyan)'],
      ['rgba(124,58,237,0.12)', 'var(--purple)'],
      ['rgba(59,130,246,0.1)', 'var(--blue)'],
      ['rgba(255,59,59,0.1)', 'var(--red)'],
    ];
    let h = 0;
    for (let i = 0; i < String(name).length; i++) h += String(name).charCodeAt(i);
    return colors[h % colors.length];
  }

  function relTime(iso) {
    try {
      const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
      if (m < 1) return 'şimdi';
      if (m < 60) return `${m}d`;
      const h = Math.floor(m / 60);
      if (h < 24) return `${h}s`;
      return `${Math.floor(h / 24)}g`;
    } catch {
      return '—';
    }
  }

  function fmtTime(iso) {
    try {
      return new Date(iso).toLocaleString('tr-TR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return '—';
    }
  }

  function categoryLabel(c) {
    return { general: 'Genel', technical: 'Teknik', token: 'Token Issue', payment: 'Premium', report: 'Report' }[c] || c;
  }

  function tabFilter(t) {
    if (activeTab === 'open') return ['open', 'waiting', 'active'].includes(t.status);
    if (activeTab === 'waiting') return t.status === 'waiting';
    return ['resolved', 'closed'].includes(t.status);
  }

  function filteredTickets() {
    const q = ($('supSearch')?.value || '').trim().toLowerCase();
    return tickets.filter((t) => {
      if (!tabFilter(t)) return false;
      if (!q) return true;
      const hay = [t.id, t.displayName, t.username, t.userKey,
        ...(t.messages || []).slice(-2).map((m) => m.text)].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }

  function selected() {
    return tickets.find((t) => t.id === selectedId) || null;
  }

  function setStatus(msg, isErr) {
    const el = $('supportAdminStatus');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('err', !!isErr);
  }

  function setSupportLayoutMode(on) {
    document.querySelector('.content')?.classList.toggle('content--support', !!on);
    document.getElementById('appLayout')?.classList.toggle('layout-support-view', !!on);
    if (on) window.SniperAdminSidebar?.close?.();
    if (!on) {
      document.getElementById('supportAdminRoot')?.classList.remove('sup-ticket-picked', 'sup-detail-open');
    }
  }

  function setTicketPickedUi(picked) {
    const root = document.getElementById('supportAdminRoot');
    if (!root) return;
    root.classList.toggle('sup-ticket-picked', !!picked);
  }

  function getAdminProfile() {
    try {
      const raw = sessionStorage.getItem('sniperAdminProfileV1');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function renderTabCounts(counts, stats) {
    const c = counts || {};
    if ($('supCountOpen')) $('supCountOpen').textContent = c.open ?? 0;
    if ($('supCountWaiting')) $('supCountWaiting').textContent = c.waiting ?? 0;
    if ($('supCountResolved')) $('supCountResolved').textContent = c.resolved ?? 0;
    if ($('supActiveCount')) $('supActiveCount').textContent = c.active ?? stats?.active ?? 0;
  }

  function renderTicketList() {
    const list = $('support-ticket-list');
    if (!list) return;
    const rows = filteredTickets();
    if (!rows.length) {
      list.innerHTML = '<p style="padding:16px;color:var(--muted);font-size:12px;text-align:center;">Bu sekmede ticket yok</p>';
      return;
    }
    list.innerHTML = rows.map((t) => {
      const last = (t.messages || []).filter((m) => m.from !== 'note').slice(-1)[0];
      const preview = last?.text?.slice(0, 80) || '—';
      const active = t.id === selectedId;
      const [bg, fg] = avatarColor(t.displayName);
      const [pLabel, pBg, pFg] = PRIORITY[t.priority] || PRIORITY.normal;
      const [cFg, cBg] = CAT_COLORS[t.category] || CAT_COLORS.default;
      const handle = t.username ? `@${esc(t.username)}` : esc(t.displayName);
      const unread = t.unreadAdmin > 0
        ? '<span style="width:7px;height:7px;border-radius:50%;background:var(--cyan);margin-left:auto;"></span>' : '';
      return `<div class="sup-ticket-item${active ? ' active' : ''}" data-id="${esc(t.id)}" role="button" tabindex="0">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
          <div style="width:36px;height:36px;border-radius:50%;background:${bg};color:${fg};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0;position:relative;">
            ${esc(initials(t.displayName))}
            <span style="position:absolute;bottom:0;right:0;width:9px;height:9px;border-radius:50%;background:var(--green);border:2px solid var(--surface2);"></span>
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:12px;font-weight:700;color:var(--text);display:flex;justify-content:space-between;">
              ${handle} <span style="font-size:10px;color:var(--muted);font-weight:400;">${relTime(t.lastMessageAt)}</span>
            </div>
          </div>
        </div>
        <div style="font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:5px;">${esc(preview)}</div>
        <div style="display:flex;align-items:center;gap:5px;">
          <span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:20px;background:${pBg};color:${pFg};">${pLabel}</span>
          <span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:20px;background:${cBg};color:${cFg};">${esc(categoryLabel(t.category))}</span>
          ${unread}
        </div>
      </div>`;
    }).join('');

    list.querySelectorAll('.sup-ticket-item').forEach((el) => {
      el.addEventListener('click', () => selectTicket(el.dataset.id));
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter') selectTicket(el.dataset.id); });
    });
  }

  function renderMessages(t) {
    const box = $('supMessages');
    if (!box) return;
    if (!t) {
      box.innerHTML = '<p style="text-align:center;color:var(--muted);font-size:12px;padding:24px;">Soldan bir konuşma seçin</p>';
      return;
    }
    const msgs = t.messages || [];
    if (!msgs.length) {
      box.innerHTML = '<p style="color:var(--muted);font-size:12px;">Henüz mesaj yok</p>';
      return;
    }
    let lastDay = '';
    box.innerHTML = msgs.map((m) => {
      const day = new Date(m.at).toLocaleDateString('tr-TR');
      let divider = '';
      if (day !== lastDay) {
        lastDay = day;
        divider = `<div style="text-align:center;font-size:10px;color:var(--muted2);display:flex;align-items:center;gap:8px;"><span style="flex:1;height:1px;background:var(--border);display:block;"></span>${day}<span style="flex:1;height:1px;background:var(--border);display:block;"></span></div>`;
      }
      if (m.from === 'note') {
        return `${divider}<div style="padding:8px 12px;border-radius:8px;background:rgba(245,166,35,0.08);border:1px dashed rgba(245,166,35,0.3);font-size:11px;color:var(--yellow);font-style:italic;">
          <strong>İç not</strong> · ${esc(m.adminUser || '')}<br/>${esc(m.text)}
          <div style="font-size:10px;color:var(--muted2);margin-top:4px;">${fmtTime(m.at)}</div>
        </div>`;
      }
      const isOut = m.from === 'admin';
      const [bg, fg] = isOut ? ['rgba(0,255,136,0.15)', 'var(--green)'] : avatarColor(t.displayName);
      const av = isOut ? initials(adminName) : initials(t.displayName);
      const label = isOut ? `${adminName} (Siz)` : (t.username ? `@${t.username}` : t.displayName);
      if (isOut) {
        return `${divider}<div style="display:flex;gap:10px;align-items:flex-end;flex-direction:row-reverse;">
          <div style="width:30px;height:30px;border-radius:50%;background:${bg};color:${fg};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;flex-shrink:0;">${esc(av)}</div>
          <div style="text-align:right;">
            <div style="font-size:10px;font-weight:700;color:var(--muted);margin-bottom:3px;">${esc(label)}</div>
            <div class="sup-bubble-max" style="padding:10px 14px;border-radius:14px;border-bottom-right-radius:4px;background:linear-gradient(135deg,#1a3a2a,#0d2018);border:1px solid rgba(0,255,136,0.2);font-size:12px;color:var(--text);line-height:1.6;">${esc(m.text)}</div>
            <div style="font-size:10px;color:var(--muted2);margin-top:3px;">${fmtTime(m.at)}</div>
          </div>
        </div>`;
      }
      return `${divider}<div style="display:flex;gap:10px;align-items:flex-end;">
        <div style="width:30px;height:30px;border-radius:50%;background:${bg};color:${fg};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;flex-shrink:0;">${esc(av)}</div>
        <div>
          <div style="font-size:10px;font-weight:700;color:var(--green);margin-bottom:3px;">${esc(label)}</div>
          <div class="sup-bubble-max" style="padding:10px 14px;border-radius:14px;border-bottom-left-radius:4px;background:var(--surface2);border:1px solid var(--border);font-size:12px;color:var(--text);line-height:1.6;">${esc(m.text)}</div>
          <div style="font-size:10px;color:var(--muted2);margin-top:3px;">${fmtTime(m.at)}</div>
        </div>
      </div>`;
    }).join('');
    box.scrollTop = box.scrollHeight;
  }

  function kvRow(k, v, vColor) {
    return `<div style="display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04);min-width:0;">
      <span style="font-size:11px;color:var(--muted);flex-shrink:0;">${esc(k)}</span>
      <span class="sup-kv-val" style="font-size:11px;font-weight:600;color:${vColor || 'var(--text)'};font-family:'JetBrains Mono',monospace;">${esc(v)}</span>
    </div>`;
  }

  function renderChatPanel(t) {
    if (!t) {
      if ($('supChatAvatar')) $('supChatAvatar').firstChild
        ? ($('supChatAvatar').childNodes[0].textContent = '—')
        : ($('supChatAvatar').textContent = '—');
      if ($('supChatTitle')) $('supChatTitle').textContent = 'Konuşma seçin';
      if ($('supChatSub')) $('supChatSub').textContent = 'Soldan bir ticket seçin';
      if ($('supAiBox')) $('supAiBox').style.display = 'none';
      renderMessages(null);
      return;
    }

    const ini = initials(t.displayName);
    const [bg, fg] = avatarColor(t.displayName);
    const av = $('supChatAvatar');
    if (av) {
      av.style.background = bg;
      av.style.color = fg;
      av.innerHTML = `${esc(ini)}<span style="position:absolute;bottom:0;right:0;width:10px;height:10px;border-radius:50%;background:var(--green);border:2px solid var(--bg2);"></span>`;
    }

    const title = t.username ? `@${t.username}` : t.displayName;
    if ($('supChatTitle')) {
      $('supChatTitle').innerHTML = `${esc(title)}
        <span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:20px;background:rgba(124,58,237,0.15);color:var(--purple);">${t.priority === 'high' ? 'Premium' : 'Üye'}</span>
        <span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:20px;background:rgba(59,130,246,0.15);color:var(--blue);">◎ Solana</span>`;
    }
    if ($('supChatSub')) {
      $('supChatSub').innerHTML = `${esc(t.userKey)} · <span style="color:var(--green);">● Online</span>`;
    }

    const lastUser = [...(t.messages || [])].reverse().find((m) => m.from === 'user');
    if ($('supAiBox')) {
      $('supAiBox').style.display = lastUser ? 'flex' : 'none';
      if ($('supAiSummary') && lastUser) $('supAiSummary').textContent = lastUser.text.slice(0, 200);
    }

    if ($('supPanelAvatar')) {
      $('supPanelAvatar').textContent = ini;
      $('supPanelAvatar').style.background = bg;
      $('supPanelAvatar').style.color = fg;
    }
    if ($('supPanelName')) $('supPanelName').textContent = title;
    if ($('supPanelTg')) $('supPanelTg').textContent = t.userKey;
    if ($('supPanelTags')) {
      $('supPanelTags').innerHTML = `
        <span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:20px;background:rgba(124,58,237,0.15);color:var(--purple);">${t.priority === 'high' ? 'Premium ★' : 'Standart'}</span>
        <span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:20px;background:rgba(0,255,136,0.12);color:var(--green);">● Aktif</span>
        <span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:20px;background:rgba(59,130,246,0.15);color:var(--blue);">Solana</span>`;
    }
    if ($('supTicketCreated')) $('supTicketCreated').textContent = fmtTime(t.createdAt);
    updatingFields = true;
    if ($('supSelCategory')) $('supSelCategory').value = t.category || 'general';
    if ($('supSelPriority')) $('supSelPriority').value = t.priority || 'normal';
    if ($('supSelStatus')) $('supSelStatus').value = t.status || 'waiting';
    updatingFields = false;

    renderMessages(t);
  }

  function renderUserPanel(user) {
    const kv = $('supUserKv');
    const act = $('supUserActivity');
    if (kv && user) {
      kv.innerHTML = [
        kvRow('Cüzdan', user.wallet || '—', 'var(--green)'),
        kvRow('Kayıt', fmtTime(user.registeredAt)),
        kvRow('Son Aktif', fmtTime(user.lastActiveAt), 'var(--green)'),
        kvRow('Plan', user.plan || '—', 'var(--purple)'),
      ].join('');
    }
    if (act && user) {
      act.innerHTML = [
        kvRow('Son Token', user.lastToken || '—', 'var(--cyan)'),
        kvRow('Zincir', user.chain || '◎ Solana'),
        kvRow('Risk Skoru', user.riskScore || '—', 'var(--yellow)'),
        kvRow('Toplam Tarama', user.scanCount || '—'),
      ].join('');
    }
  }

  async function loadTickets(silent) {
    const q = ($('supSearch')?.value || '').trim();
    const data = await window.SniperAdminApi(
      `/api/admin/support/tickets?tab=all&q=${encodeURIComponent(q)}`,
    );
    tickets = data.tickets || [];
    renderTabCounts(data.tabCounts, data.stats);
    if (!silent && !selectedId && filteredTickets().length) selectedId = filteredTickets()[0].id;
    setTicketPickedUi(!!selectedId);
    renderTicketList();
    if (selectedId) await loadTicketDetail(selectedId, silent);
    else renderChatPanel(null);
  }

  async function loadTicketDetail(id, silent) {
    if (!id) { renderChatPanel(null); return; }
    const [ticketRes, userRes] = await Promise.all([
      window.SniperAdminApi(`/api/admin/support/tickets/${encodeURIComponent(id)}`),
      window.SniperAdminApi(`/api/admin/support/tickets/${encodeURIComponent(id)}/user`).catch(() => ({ user: null })),
    ]);
    const idx = tickets.findIndex((t) => t.id === id);
    if (idx >= 0) tickets[idx] = ticketRes.ticket;
    else tickets.unshift(ticketRes.ticket);
    renderTicketList();
    renderChatPanel(ticketRes.ticket);
    renderUserPanel(userRes.user);
    if (!silent) setStatus('');
  }

  function selectTicket(id) {
    selectedId = id;
    setTicketPickedUi(!!id);
    window.SniperAdminSidebar?.close?.();
    renderTicketList();
    loadTicketDetail(id).catch((e) => setStatus(e.message, true));
  }

  async function sendMessage() {
    const t = selected();
    if (!t) return setStatus('Önce ticket seçin', true);
    const text = $('supReplyInput')?.value?.trim();
    if (!text) return;
    setStatus('Gönderiliyor…');
    try {
      await window.SniperAdminApi(`/api/admin/support/tickets/${encodeURIComponent(t.id)}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          message: text,
          type: composeMode === 'note' ? 'note' : 'reply',
        }),
      });
      $('supReplyInput').value = '';
      await loadTickets(true);
      setStatus(composeMode === 'note' ? 'İç not kaydedildi.' : 'Yanıt gönderildi.');
    } catch (e) {
      setStatus(e.message, true);
    }
  }

  async function patchTicket(patch) {
    const t = selected();
    if (!t) return;
    await window.SniperAdminApi(`/api/admin/support/tickets/${encodeURIComponent(t.id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    await loadTickets(true);
  }

  async function runAction(action) {
    const t = selected();
    if (!t) return setStatus('Önce ticket seçin', true);
    try {
      await window.SniperAdminApi(`/api/admin/support/tickets/${encodeURIComponent(t.id)}/actions`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      await loadTickets(true);
      setStatus('Kayıt başarılı.');
    } catch (e) {
      setStatus(e.message, true);
    }
  }

  function setTabUi(btn) {
    document.querySelectorAll('.sup-tab-btn').forEach((b) => {
      const on = b === btn;
      b.classList.toggle('active', on);
      b.style.color = on ? 'var(--green)' : 'var(--muted)';
      b.style.borderBottom = on ? '2px solid var(--green)' : '2px solid transparent';
      const span = b.querySelector('span[id^="supCount"]');
      if (span) {
        span.style.background = on ? 'rgba(0,255,136,0.15)' : 'var(--surface2)';
        span.style.color = on ? 'var(--green)' : 'inherit';
      }
    });
  }

  function setComposeUi(btn) {
    document.querySelectorAll('.sup-compose-tab').forEach((b) => {
      const on = b === btn;
      b.classList.toggle('active', on);
      b.style.color = on ? 'var(--green)' : 'var(--muted)';
      b.style.borderBottom = on ? '2px solid var(--green)' : '2px solid transparent';
    });
  }

  async function openConfigModal() {
    let cfg = { enabled: true, welcomeMessage: '', pollIntervalSec: 4 };
    try {
      const data = await window.SniperAdminApi('/api/admin/support/config');
      cfg = data.config || cfg;
    } catch (e) {
      setStatus(e.message, true);
      return;
    }
    const enabled = window.confirm(`Canlı destek şu an: ${cfg.enabled ? 'AÇIK' : 'KAPALI'}\n\nAçmak/kapatmak için Tamam = toggle`);
    if (!enabled) return;
    try {
      await window.SniperAdminApi('/api/admin/support/config', {
        method: 'PUT',
        body: JSON.stringify({ enabled: !cfg.enabled, welcomeMessage: cfg.welcomeMessage }),
      });
      setStatus(`Destek ${!cfg.enabled ? 'açıldı' : 'kapatıldı'}.`);
    } catch (e) {
      setStatus(e.message, true);
    }
  }

  function bindUi() {
    if (uiBound) return;
    uiBound = true;

    document.querySelectorAll('.sup-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab || 'open';
        setTabUi(btn);
        renderTicketList();
        const first = filteredTickets()[0];
        if (first) selectTicket(first.id);
        else { selectedId = null; setTicketPickedUi(false); renderChatPanel(null); }
      });
    });
    $('supSearch')?.addEventListener('input', renderTicketList);
    document.querySelectorAll('.sup-compose-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        composeMode = btn.dataset.compose || 'reply';
        setComposeUi(btn);
        if ($('supReplyInput')) {
          const ph = { note: 'İç not…', macro: 'Makro metni — Gönder ile yollar', reply: 'Mesajınızı yazın…' };
          $('supReplyInput').placeholder = ph[composeMode] || ph.reply;
        }
        if (composeMode === 'macro' && $('supReplyInput') && !$('supReplyInput').value.trim()) {
          $('supReplyInput').value = MACROS[0];
        }
      });
    });
    $('supSendBtn')?.addEventListener('click', sendMessage);
    $('supReplyInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    $('supBtnConfig')?.addEventListener('click', openConfigModal);

    $('supBackToList')?.addEventListener('click', () => {
      selectedId = null;
      setTicketPickedUi(false);
      renderChatPanel(null);
      renderTicketList();
    });

    $('supToggleDetail')?.addEventListener('click', () => {
      document.getElementById('supportAdminRoot')?.classList.toggle('sup-detail-open');
    });

    ['supSelCategory', 'supSelPriority', 'supSelStatus'].forEach((id) => {
      $(id)?.addEventListener('change', () => {
        if (updatingFields || !selected()) return;
        patchTicket({
          category: $('supSelCategory')?.value,
          priority: $('supSelPriority')?.value,
          status: $('supSelStatus')?.value,
        }).then(() => setStatus('Ticket güncellendi.')).catch((e) => setStatus(e.message, true));
      });
    });
    document.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => runAction(btn.dataset.action));
    });
  }

  function startPoll() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      if ($('page-support')?.classList.contains('active')) loadTickets(true).catch(() => {});
    }, 5000);
  }

  function stopPoll() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  async function onPageOpen() {
    setSupportLayoutMode(true);
    setStatus('');
    try {
      const profile = getAdminProfile();
      if (profile?.username) adminName = profile.username;
      bindUi();
      await loadTickets();
      startPoll();
    } catch (e) {
      setStatus(e.message || 'Yüklenemedi', true);
    }
  }

  function onPageLeave() {
    setSupportLayoutMode(false);
    stopPoll();
  }

  function bind() {
    const orig = window.showPage;
    if (typeof orig === 'function' && !window.__adminSupportPatched) {
      window.showPage = function (id) {
        if (id !== 'support') onPageLeave();
        orig(id);
        if (id === 'support') onPageOpen();
      };
      window.__adminSupportPatched = true;
    }
    document.addEventListener('sniper-admin-ready', () => {
      if ($('page-support')?.classList.contains('active')) onPageOpen();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
