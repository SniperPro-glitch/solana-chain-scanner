/**
 * Admin — Token Feed listesi + Token Ekle tam sayfa.
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const qs = (sel, root) => (root || document).querySelector(sel);

  let lastPreviewItem = null;
  let logoDataUrl = '';

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
  }

  function setStatus(msg, isErr) {
    const el = $('addTokenStatus');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('err', !!isErr);
  }

  function resolveInput() {
    const contract = String($('addTokenContract')?.value || '').trim();
    const dexUrl = String($('addTokenDexUrl')?.value || '').trim();
    return contract || dexUrl;
  }

  function initials(sym) {
    const s = String(sym || '?').trim();
    return s.slice(0, 2).toUpperCase() || '?';
  }

  function setAvatarEl(el, sym, imgUrl) {
    if (!el) return;
    const url = imgUrl || logoDataUrl || '';
    if (url) {
      el.style.backgroundImage = `url("${url.replace(/"/g, '')}")`;
      el.textContent = '';
    } else {
      el.style.backgroundImage = '';
      el.textContent = initials(sym);
    }
  }

  function syncFormPreview() {
    const sym = String($('addTokenSymbol')?.value || '').trim() || 'SEMBOL';
    const name = String($('addTokenName')?.value || '').trim() || 'Token Adı';
    const logoUrl = String($('addTokenLogoUrl')?.value || '').trim();

    if ($('addTokenPreviewSym')) $('addTokenPreviewSym').textContent = sym;
    if ($('addTokenPreviewName')) $('addTokenPreviewName').textContent = name;
    if ($('addTokenSummaryName')) {
      $('addTokenSummaryName').textContent = name === 'Token Adı' ? 'Token adı girilmedi' : name;
    }

    setAvatarEl($('addTokenLogoAvatar'), sym, logoUrl);
    setAvatarEl($('addTokenSummaryAvatar'), sym, logoUrl);

    const dexSel = $('addTokenDex');
    const dexLabel = dexSel?.selectedOptions?.[0]?.text || '—';
    if ($('addTokenSumDex')) $('addTokenSumDex').textContent = dexLabel;

    const dexUrl = String($('addTokenDexUrl')?.value || '').trim();
    if ($('addTokenSumDexUrl')) {
      $('addTokenSumDexUrl').textContent = dexUrl ? 'Bağlı' : '—';
      $('addTokenSumDexUrl').title = dexUrl;
    }
  }

  function itemDexUrl(item) {
    return item?.dexUrl || item?.dexPageUrl || item?.dexScreenerUrl || null;
  }

  function applyPreviewItem(item) {
    if (!item) return;
    lastPreviewItem = item;
    const symEl = $('addTokenSymbol');
    const nameEl = $('addTokenName');
    const contractEl = $('addTokenContract');
    const dexEl = $('addTokenDexUrl');
    const logoEl = $('addTokenLogoUrl');
    const poolEl = $('addTokenPool');

    if (symEl && !String(symEl.value || '').trim()) symEl.value = item.symbol || '';
    if (nameEl && !String(nameEl.value || '').trim()) nameEl.value = item.name || item.symbol || '';
    if (contractEl && item.mint && !String(contractEl.value || '').trim()) contractEl.value = item.mint;

    const dexUrl = itemDexUrl(item);
    if (dexEl && dexUrl) dexEl.value = dexUrl;

    if (logoEl && item.imageUrl && !String(logoEl.value || '').trim()) logoEl.value = item.imageUrl;
    if (poolEl && item.poolAddress && !String(poolEl.value || '').trim()) poolEl.value = item.poolAddress;

    if ($('addTokenSumRisk')) $('addTokenSumRisk').textContent = item.risk?.label || '—';
    syncFormPreview();
  }

  function resetAddForm() {
    lastPreviewItem = null;
    logoDataUrl = '';
    ['addTokenContract', 'addTokenSymbol', 'addTokenName', 'addTokenLogoUrl', 'addTokenDexUrl', 'addTokenPool'].forEach((id) => {
      const el = $(id);
      if (el) el.value = '';
    });
    if ($('addTokenDex')) $('addTokenDex').selectedIndex = 0;
    if ($('addTokenPublishNow')) $('addTokenPublishNow').checked = true;
    if ($('addTokenSumRisk')) $('addTokenSumRisk').textContent = '—';
    setStatus('');
    syncFormPreview();
  }

  function openAddPage() {
    resetAddForm();
    if (typeof window.showPage === 'function') window.showPage('add-token');
    $('addTokenContract')?.focus();
  }

  function goFeed() {
    if (typeof window.showPage === 'function') window.showPage('feed');
  }

  function rowHtml(it, i) {
    const risk = it.risk?.label || '—';
    const riskClass = it.risk?.band === 'high' ? 'high' : (it.risk?.band === 'mid' ? 'med' : 'low');
    const chg = it.change24h;
    const chgStr = chg != null ? `${Number(chg).toFixed(1)}%` : '—';
    const chgColor = chg != null && chg >= 0 ? 'var(--green)' : 'var(--red)';
    const mint = it.mint || '';
    return `
      <tr data-mint="${esc(mint)}">
        <td style="color:var(--muted)">${i + 1}</td>
        <td>
          <div class="token-cell">
            <div class="token-avatar">${esc((it.symbol || '?').slice(0, 2))}</div>
            <div>
              <div class="token-sym">${esc(it.symbol)}</div>
              <div class="token-pair">${esc(it.dexLabel || it.dex || '')}</div>
            </div>
          </div>
        </td>
        <td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted)">${esc(mint.slice(0, 8))}…${esc(mint.slice(-4))}</td>
        <td><span class="dex-badge">${esc(it.dexShort || it.dex || '—')}</span></td>
        <td style="font-family:'JetBrains Mono',monospace;">${esc(it.marketCapUsdFmt || '—')}</td>
        <td style="color:var(--cyan);font-family:'JetBrains Mono',monospace;">${esc(it.priceUsdFmt || '—')}</td>
        <td style="color:${chgColor}">${chgStr}</td>
        <td><span class="risk-pill ${riskClass}">${esc(risk)}</span></td>
        <td>—</td>
        <td><span class="dot green" style="display:inline-block"></span></td>
        <td>—</td>
      </tr>`;
  }

  function renderFeedTable(items) {
    const tbody = qs('#page-feed tbody');
    if (!tbody) return;
    const list = items || [];
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="11" style="color:var(--muted);padding:16px">Feed boş — <strong>+ Token Ekle</strong> ile mint veya link girin.</td></tr>';
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

  async function fetchPreview() {
    const input = resolveInput();
    if (!input) {
      setStatus('Contract veya piyasa linki girin.', true);
      return;
    }
    const btn = $('addTokenFetchPreview');
    if (btn) btn.disabled = true;
    setStatus('Dex verisi alınıyor…');
    try {
      const result = await window.SniperAdminApi('/api/admin/feed/preview', {
        method: 'POST',
        body: JSON.stringify({ input }),
      });
      if (result.item) applyPreviewItem(result.item);
      if (result.duplicate) {
        setStatus(result.duplicateMessage || 'Bu token zaten feed listesinde.', true);
      } else {
        setStatus('Önizleme güncellendi.');
      }
    } catch (e) {
      setStatus(e.message || 'Önizleme alınamadı', true);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function submitAdd() {
    const input = resolveInput();
    if (!input) {
      setStatus('Contract adresi veya piyasa linki zorunlu.', true);
      return;
    }
    const btn = $('addTokenSubmit');
    if (btn) btn.disabled = true;
    setStatus('Token feed\'e ekleniyor…');
    try {
      const result = await window.SniperAdminApi('/api/admin/feed/add', {
        method: 'POST',
        body: JSON.stringify({ input }),
      });
      if (result.item) applyPreviewItem(result.item);
      setStatus(`${result.symbol || 'Token'} feed'e eklendi.`);
      await loadFeed();
      setTimeout(goFeed, 800);
    } catch (e) {
      if (e.code === 'duplicate') {
        setStatus(e.message || 'Bu token zaten feed listesinde.', true);
      } else {
        setStatus(e.message || 'Eklenemedi', true);
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function bindAddPage() {
    if (!$('page-add-token')) return;

    $('btnAdminFeedAdd')?.addEventListener('click', (e) => {
      e.preventDefault();
      openAddPage();
    });

    $('addTokenCancel')?.addEventListener('click', goFeed);
    qs('.add-token-crumb-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      goFeed();
    });

    $('addTokenSubmit')?.addEventListener('click', submitAdd);
    $('addTokenFetchPreview')?.addEventListener('click', fetchPreview);

    $('addTokenDexOpen')?.addEventListener('click', () => {
      const u = String($('addTokenDexUrl')?.value || '').trim();
      if (u) window.open(u, '_blank', 'noopener');
    });

    ['addTokenSymbol', 'addTokenName', 'addTokenLogoUrl', 'addTokenDexUrl'].forEach((id) => {
      $(id)?.addEventListener('input', syncFormPreview);
    });
    $('addTokenDex')?.addEventListener('change', syncFormPreview);

    $('addTokenLogoFile')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        logoDataUrl = String(reader.result || '');
        if ($('addTokenLogoUrl')) $('addTokenLogoUrl').value = '';
        syncFormPreview();
      };
      reader.readAsDataURL(file);
    });

    $('addTokenContract')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') fetchPreview();
    });
  }

  function bind() {
    bindAddPage();

    const orig = window.showPage;
    if (typeof orig === 'function') {
      window.showPage = function (id) {
        orig(id);
        if (id === 'feed') loadFeed();
        if (id === 'add-token') syncFormPreview();
      };
    }

    document.addEventListener('sniper-admin-ready', () => loadFeed());
    document.querySelectorAll('[data-goto="feed"]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        goFeed();
      });
    });
  }

  window.SniperAdminFeed = { loadFeed, openAddPage };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
