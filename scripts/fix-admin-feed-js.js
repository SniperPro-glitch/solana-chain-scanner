const fs = require('fs');
const p = require('path').join(__dirname, '..', 'public', 'admin', 'admin-feed.js');

const content = `/**
 * Admin — Token Feed: ekleme modalı + liste.
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const qs = (sel, root) => (root || document).querySelector(sel);

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
  }

  function setStatus(msg, isErr) {
    const el = $('adminFeedModalStatus');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('err', !!isErr);
  }

  function openModal() {
    const m = $('adminFeedModal');
    if (!m) return;
    if ($('adminFeedInput')) $('adminFeedInput').value = '';
    const prev = $('adminFeedAddPreview');
    if (prev) {
      prev.classList.add('hidden');
      prev.innerHTML = '';
    }
    setStatus('');
    m.classList.remove('hidden');
    m.setAttribute('aria-hidden', 'false');
    $('adminFeedInput')?.focus();
  }

  function closeModal() {
    const m = $('adminFeedModal');
    if (!m) return;
    m.classList.add('hidden');
    m.setAttribute('aria-hidden', 'true');
  }

  function rowHtml(it, i) {
    const risk = it.risk?.label || '—';
    const riskClass = it.risk?.band === 'high' ? 'high' : (it.risk?.band === 'mid' ? 'med' : 'low');
    const chg = it.change24h;
    const chgStr = chg != null ? \`\${Number(chg).toFixed(1)}%\` : '—';
    const chgColor = chg != null && chg >= 0 ? 'var(--green)' : 'var(--red)';
    const mint = it.mint || '';
    return \`
      <tr data-mint="\${esc(mint)}">
        <td style="color:var(--muted)">\${i + 1}</td>
        <td>
          <div class="token-cell">
            <div class="token-avatar">\${esc((it.symbol || '?').slice(0, 2))}</div>
            <div>
              <div class="token-sym">\${esc(it.symbol)}</div>
              <div class="token-pair">\${esc(it.dexLabel || it.dex || '')}</div>
            </div>
          </div>
        </td>
        <td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted)">\${esc(mint.slice(0, 8))}…\${esc(mint.slice(-4))}</td>
        <td><span class="dex-badge">\${esc(it.dexShort || it.dex || '—')}</span></td>
        <td style="font-family:'JetBrains Mono',monospace;">\${esc(it.marketCapUsdFmt || '—')}</td>
        <td style="color:var(--cyan);font-family:'JetBrains Mono',monospace;">\${esc(it.priceUsdFmt || '—')}</td>
        <td style="color:\${chgColor}">\${chgStr}</td>
        <td><span class="risk-pill \${riskClass}">\${esc(risk)}</span></td>
        <td>—</td>
        <td><span class="dot green" style="display:inline-block"></span></td>
        <td>—</td>
      </tr>\`;
  }

  function renderFeedTable(items) {
    const tbody = qs('#page-feed tbody');
    if (!tbody) return;
    const list = items || [];
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="11" style="color:var(--muted);padding:16px">Feed boş — <strong>Token Ekle</strong> ile mint veya link girin.</td></tr>';
      return;
    }
    tbody.innerHTML = list.map((it, i) => rowHtml(it, i)).join('');
  }

  async function loadFeed() {
    if (!window.SniperAdminApi) return;
    try {
      const data = await window.SniperAdminApi('/api/admin/feed');
      renderFeedTable(data.items || []);
    } catch (e) {
      console.warn('[admin-feed]', e);
    }
  }

  function showPreview(item) {
    const box = $('adminFeedAddPreview');
    if (!box || !item) return;
    const risk = item.risk?.label || '—';
    box.classList.remove('hidden');
    box.innerHTML = \`
      <div class="token-cell">
        <div class="token-avatar">\${esc((item.symbol || '?').slice(0, 2))}</div>
        <div>
          <div class="token-sym">\${esc(item.symbol)}</div>
          <div class="token-pair">\${esc(item.dexLabel || item.dex || '')} · \${esc(item.marketCapUsdFmt || '—')}</div>
        </div>
      </div>
      <p style="margin:8px 0 0;font-size:11px;color:var(--muted)">Risk: \${esc(risk)} · Mint: \${esc(item.mint)}</p>\`;
  }

  async function submitAdd() {
    const input = String($('adminFeedInput')?.value || '').trim();
    if (!input) {
      setStatus('Mint veya link girin.', true);
      return;
    }
    const btn = $('adminFeedSubmit');
    if (btn) btn.disabled = true;
    setStatus('Dex verisi alınıyor…');
    try {
      const result = await window.SniperAdminApi('/api/admin/feed/add', {
        method: 'POST',
        body: JSON.stringify({ input }),
      });
      if (result.item) showPreview(result.item);
      setStatus(\`\${result.symbol || 'Token'} feed'e eklendi.\`);
      await loadFeed();
      setTimeout(closeModal, 900);
    } catch (e) {
      setStatus(e.message || 'Eklenemedi', true);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function bind() {
    if (!$('adminFeedModal')) return;
    $('btnAdminFeedAdd')?.addEventListener('click', openModal);
    $('adminFeedModalClose')?.addEventListener('click', closeModal);
    $('adminFeedModalBackdrop')?.addEventListener('click', closeModal);
    $('adminFeedSubmit')?.addEventListener('click', () => submitAdd());
    $('adminFeedInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitAdd();
    });
    const orig = window.showPage;
    if (typeof orig === 'function') {
      window.showPage = function (id) {
        orig(id);
        if (id === 'feed') loadFeed();
      };
    }
    document.addEventListener('sniper-admin-ready', () => loadFeed());
  }

  window.SniperAdminFeed = { loadFeed, openModal };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
`;

fs.writeFileSync(p, content.replace(/<\/motion>/g, '</div>').replace(/<motion /g, '<motion '));
// second pass - the template might still have motion in token-avatar line
let fixed = fs.readFileSync(p, 'utf8');
fixed = fixed.replace(/<motion class="token-avatar">/g, '<div class="token-avatar">');
fs.writeFileSync(p, fixed);
console.log('fixed admin-feed.js');
