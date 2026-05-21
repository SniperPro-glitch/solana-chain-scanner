/**
 * Admin — Trend Ayarları (trend cursor / CURSOR_SPEC.md)
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const qs = (sel, root) => (root || document).querySelector(sel);
  const qsa = (sel, root) => [...(root || document).querySelectorAll(sel)];

  const page = () => $('page-trending');
  let state = {
    timeframe: '24h',
    chain: 'all',
    trendSelToken: null,
    trendSelPos: 'pin',
    trendNetFilter: 'ALL',
    refreshTimer: null,
    searchTimer: null,
    trendOnList: [],
    lastModalTokens: [],
    modalListHeader: '',
  };

  function posLabel(pos) {
    if (pos === 'pin' || pos === '📌') return '📌 Sabit (en üst)';
    return `${pos}. sıra`;
  }

  function updateAddBtnLabel() {
    const btn = $('trend-add-btn');
    if (!btn || !state.trendSelToken) return;
    btn.textContent = `Trend'e Ekle — ${posLabel(state.trendSelPos)}`;
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
  }

  function setStatus(msg, isErr) {
    const el = $('trendStatus');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('err', !!isErr);
  }

  function sliders() {
    const p = page();
    if (!p) return {};
    const ranges = qsa('input[type="range"]', p);
    return {
      vol: ranges[0],
      txn: ranges[1],
      holder: ranges[2],
      price: ranges[3],
    };
  }

  function bindSliderLabels() {
    const s = sliders();
    const map = [
      [s.vol, 'w-vol'],
      [s.txn, 'w-txn'],
      [s.holder, 'w-holder'],
      [s.price, 'w-price'],
    ];
    map.forEach(([input, labelId]) => {
      if (!input) return;
      input.addEventListener('input', () => {
        const el = $(labelId);
        if (el) el.textContent = `${input.value}%`;
      });
    });
  }

  function readWeights() {
    const s = sliders();
    return {
      volume: Number(s.vol?.value) || 0,
      txns: Number(s.txn?.value) || 0,
      holders: Number(s.holder?.value) || 0,
      priceChange: Number(s.price?.value) || 0,
    };
  }

  function applySettings(settings) {
    if (!settings) return;
    const w = settings.weights || {};
    const s = sliders();
    if (s.vol) { s.vol.value = w.volume ?? 40; $('w-vol').textContent = `${s.vol.value}%`; }
    if (s.txn) { s.txn.value = w.txns ?? 30; $('w-txn').textContent = `${s.txn.value}%`; }
    if (s.holder) { s.holder.value = w.holders ?? 20; $('w-holder').textContent = `${s.holder.value}%`; }
    if (s.price) { s.price.value = w.priceChange ?? 10; $('w-price').textContent = `${s.price.value}%`; }

    const p = page();
    const tfBtns = qsa('.tf-btn2', p);
    const tf = settings.defaults?.timeframe || '24h';
    tfBtns.forEach((btn) => {
      const on = btn.textContent.trim() === tf;
      btn.style.background = on ? 'rgba(0,255,136,.1)' : 'rgba(255,255,255,.04)';
      btn.style.borderColor = on ? 'rgba(0,255,136,.3)' : 'var(--border)';
      btn.style.color = on ? 'var(--green)' : 'var(--muted)';
      btn.style.fontWeight = on ? '600' : 'normal';
    });

    const pageSizeSel = qsa('#page-trending .card select', p)[0];
    if (pageSizeSel) pageSizeSel.value = String(settings.defaults?.pageSize ?? 20);

    const sortSel = qsa('#page-trending .card select', p)[1];
    if (sortSel) {
      const sortMap = { top: '🔥 En Popüler', gainers: '📈 Kazananlar', new: '🆕 Yeni Eklenen', volume: '💰 En Yüksek Hacim' };
      sortSel.value = sortMap[settings.defaults?.sort] || sortMap.top;
    }

    const minVolInput = qs('#page-trending input[type="number"]', p);
    if (minVolInput && settings.view?.minVolumeUsd != null) {
      minVolInput.value = settings.view.minVolumeUsd;
    }
  }

  function readSettingsPayload() {
    const p = page();
    const pageSizeSel = qsa('#page-trending .card select', p)[0];
    const sortSel = qsa('#page-trending .card select', p)[1];
    const sortVal = sortSel?.value || '';
    let sort = 'top';
    if (sortVal.includes('Kazanan')) sort = 'gainers';
    else if (sortVal.includes('Yeni')) sort = 'new';
    else if (sortVal.includes('Hacim')) sort = 'volume';

    const refreshSel = qsa('#page-trending .card select', p)[2];
    let intervalSec = 60;
    const rv = refreshSel?.value || '';
    if (rv.includes('30')) intervalSec = 30;
    else if (rv.includes('2')) intervalSec = 120;
    else if (rv.includes('5')) intervalSec = 300;

    return {
      weights: readWeights(),
      defaults: {
        timeframe: state.timeframe,
        dexFilter: 'all',
        sort,
        pageSize: Number(pageSizeSel?.value) || 20,
      },
      view: {
        hideHighRisk: true,
        minVolumeUsd: Number(qs('#page-trending input[type="number"]', p)?.value) || 0,
      },
      refresh: {
        enabled: true,
        intervalSec,
      },
    };
  }

  async function loadSettings() {
    const data = await window.SniperAdminApi('/api/admin/settings/trend');
    applySettings(data.settings);
  }

  async function saveSettings() {
    const w = readWeights();
    const sum = w.volume + w.txns + w.holders + w.priceChange;
    if (sum !== 100) {
      setStatus(`Ağırlıklar toplamı 100 olmalı (şu an ${sum}).`, true);
      return;
    }
    setStatus('Kaydediliyor…');
    await window.SniperAdminApi('/api/admin/settings/trend', {
      method: 'PUT',
      body: JSON.stringify(readSettingsPayload()),
    });
    setStatus('Ayarlar kaydedildi.');
  }

  function riskPillStyle(level) {
    if (level === 'LOW') return 'background:rgba(0,255,136,.12);color:var(--green)';
    if (level === 'HIGH') return 'background:rgba(255,59,59,.12);color:var(--red)';
    return 'background:rgba(245,166,35,.12);color:var(--yellow)';
  }

  function renderTable(items) {
    const tbody = $('trendTableBody');
    if (!tbody) return;
    if (!items?.length) {
      tbody.innerHTML = '<tr><td colspan="11" style="color:var(--muted);text-align:center;padding:24px;">Liste boş</td></tr>';
      return;
    }

    tbody.innerHTML = items.map((row) => {
      const pin = row.is_pinned || row.rank === 'pin';
      const rankCell = pin
        ? '<td style="color:var(--green);font-weight:700;font-size:13px;">📌</td>'
        : `<td style="color:var(--muted);font-weight:700;font-family:'JetBrains Mono',monospace;">${esc(row.hidden ? '✕' : row.rank)}</td>`;
      const rowStyle = pin ? 'background:rgba(0,255,136,.025);' : (row.hidden ? 'opacity:.45;' : '');
      const chgColor = row.change24hNum >= 0 ? 'var(--green)' : 'var(--red)';
      const statusColor = row.statusColor === 'red' ? 'var(--red)' : (row.statusColor === 'yellow' ? 'var(--yellow)' : 'var(--green)');
      const dexBtn = row.dexUrl
        ? `<button type="button" class="btn btn-ghost btn-sm trend-dex-btn" data-url="${esc(row.dexUrl)}" style="padding:3px 8px;font-size:10px;color:var(--cyan);">DEX ↗</button>`
        : '';
      const removeLabel = row.hidden ? 'Sil' : 'Kaldır';
      const showBtn = row.hidden
        ? `<button type="button" class="btn btn-ghost btn-sm trend-show-btn" data-id="${esc(row.id)}" style="padding:3px 8px;font-size:10px;color:var(--green);">Göster</button>`
        : '';
      return `<tr style="${rowStyle}">
        ${rankCell}
        <td><div class="token-cell"><div class="token-avatar" style="background:linear-gradient(135deg,#00ff88,#00cc6a);color:#05080f;">${esc(row.avatarLetter)}</div><div><div class="token-sym">${esc(row.symbol)}</div><div class="token-pair">${esc(row.pair)}</div></div></div></td>
        <td><span style="font-size:10px;background:rgba(0,255,136,.1);color:var(--green);border-radius:4px;padding:2px 7px;">${esc(row.chainLabel)}</span></td>
        <td style="font-family:'JetBrains Mono',monospace;font-size:11px;">${esc(row.price)}</td>
        <td><span style="color:${chgColor};font-weight:700;">${esc(row.change24h)}</span></td>
        <td style="font-family:'JetBrains Mono',monospace;font-size:11px;">${esc(row.volume)}</td>
        <td style="font-family:'JetBrains Mono',monospace;font-size:11px;">${esc(row.txns)}</td>
        <td><span style="${riskPillStyle(row.riskLevel)};font-size:10px;font-weight:700;border-radius:20px;padding:2px 8px;">${esc(row.risk)}</span></td>
        <td><span style="font-size:10px;color:var(--muted);">${esc(row.source)}</span></td>
        <td><span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:${statusColor};"><span style="width:6px;height:6px;border-radius:50%;background:${statusColor};display:inline-block;"></span>${esc(row.status)}</span></td>
        <td><div style="display:flex;gap:4px;">${dexBtn}${showBtn}<button type="button" class="btn btn-danger btn-sm trend-remove-btn" data-id="${esc(row.id)}" style="padding:3px 8px;font-size:10px;">${removeLabel}</button></div></td>
      </tr>`;
    }).join('');

    qsa('.trend-dex-btn', tbody).forEach((btn) => {
      btn.addEventListener('click', () => {
        const u = btn.dataset.url;
        if (u) window.open(u, '_blank', 'noopener');
      });
    });
    qsa('.trend-remove-btn', tbody).forEach((btn) => {
      btn.addEventListener('click', () => removeTrend(btn.dataset.id));
    });
  }

  async function loadTable() {
    const tbody = $('trendTableBody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="11" style="color:var(--muted);text-align:center;padding:24px;">Yükleniyor…</td></tr>';
    }
    try {
      const chainSel = $('trendChainFilter');
      const chain = chainSel?.value === 'Solana' ? 'all' : 'all';
      const data = await window.SniperAdminApi(
        `/api/admin/trending?timeframe=${encodeURIComponent(state.timeframe)}&chain=${encodeURIComponent(chain)}`,
      );
      state.trendOnList = data.items || [];
      renderTable(state.trendOnList);
      setStatus(state.trendOnList.length ? '' : 'Trend listesi boş — Manuel Ekle ile token ekleyin.');
    } catch (e) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="11" style="color:var(--red);text-align:center;padding:24px;">${esc(e.message || 'Liste yüklenemedi')}</td></tr>`;
      }
      setStatus(e.message || 'Liste yüklenemedi', true);
      throw e;
    }
  }

  async function removeTrend(id) {
    if (!id || !confirm('Trend listesinden kaldırılsın mı?')) return;
    setStatus('Kaldırılıyor…');
    try {
      await window.SniperAdminApi(`/api/admin/trending/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await loadTable();
      setStatus('Kaldırıldı.');
    } catch (e) {
      setStatus(e.message || 'Kaldırılamadı', true);
    }
  }

  function setTf(btn, tf) {
    state.timeframe = tf;
    qsa('.tf-btn', page()).forEach((b) => {
      b.style.background = 'rgba(255,255,255,.05)';
      b.style.borderColor = 'var(--border)';
      b.style.color = 'var(--muted)';
      b.style.fontWeight = 'normal';
    });
    btn.style.background = 'rgba(0,255,136,.1)';
    btn.style.borderColor = 'rgba(0,255,136,.3)';
    btn.style.color = 'var(--green)';
    btn.style.fontWeight = '700';
    loadTable().catch((e) => setStatus(e.message, true));
  }

  window.setTF = setTf;

  /* ——— Modal ——— */
  async function openTrendModal() {
    state.trendSelToken = null;
    state.trendSelPos = 'pin';
    const m = $('trend-modal');
    if (m) m.style.display = 'flex';
    const search = $('trend-search');
    if (search) search.value = '';
    $('trend-selected-area').style.display = 'none';
    updateTrendAddBtn(false);
    const list = $('trend-token-list');
    if (list) {
      list.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted);font-size:12px;">Trend listesi yükleniyor…</div>';
    }
    try {
      if (!state.trendOnList.length) {
        const data = await window.SniperAdminApi('/api/admin/trending');
        state.trendOnList = data.items || [];
      }
      renderModalTokenList('');
    } catch (e) {
      if (list) {
        list.innerHTML = `<div style="text-align:center;padding:24px;color:var(--red);font-size:12px;">${esc(e.message)}</div>`;
      }
    }
  }

  function closeTrendModal() {
    const m = $('trend-modal');
    if (m) m.style.display = 'none';
  }

  window.openTrendModal = openTrendModal;
  window.closeTrendModal = closeTrendModal;

  function updateTrendAddBtn(enabled) {
    const btn = $('trend-add-btn');
    if (!btn) return;
    btn.disabled = !enabled;
    if (enabled) {
      btn.style.background = 'linear-gradient(135deg,var(--green),#00cc6a)';
      btn.style.color = '#05080f';
      btn.style.cursor = 'pointer';
    } else {
      btn.style.background = 'linear-gradient(135deg,#1a3a2a,#0d2018)';
      btn.style.color = 'rgba(0,255,136,.4)';
      btn.style.cursor = 'not-allowed';
    }
  }

  function trendRowsToPickTokens(rows) {
    return (rows || [])
      .filter((r) => !r.hidden)
      .map((r) => ({
        token_id: r.mint,
        sym: r.symbol,
        net: 'SOL',
        dex: r.pair,
        risk: r.risk,
        change: r.change24h,
        inTrend: true,
        trendRank: r.rank,
        trendId: r.id,
      }));
  }

  function renderModalTokenList(query) {
    const q = String(query || '').trim();
    const list = $('trend-token-list');
    if (!list) return;
    if (!q) {
      const tokens = trendRowsToPickTokens(state.trendOnList);
      if (!tokens.length) {
        state.modalListHeader = '';
        list.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-size:12px;">Trend listesi boş. Mint veya sembol arayıp ekleyin.</div>';
        return;
      }
      state.modalListHeader = `<div class="trend-list-header" style="font-size:10px;font-weight:700;color:var(--green);padding:6px 4px 10px;">Şu an trend listesinde (${tokens.length})</div>`;
      renderTrendList(tokens);
      return;
    }
    if (q.length < 2) {
      state.modalListHeader = '';
      list.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-size:12px;">En az 2 karakter (sembol veya mint)</div>';
      return;
    }
    runTokenSearch(q);
  }

  async function runTokenSearch(q) {
    const list = $('trend-token-list');
    if (!list) return;
    state.modalListHeader = '';
    list.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-size:12px;">Aranıyor…</div>';
    try {
      const data = await window.SniperAdminApi(
        `/api/admin/tokens?search=${encodeURIComponent(q)}&net=${encodeURIComponent(state.trendNetFilter)}`,
      );
      const tokens = data.tokens || [];
      state.modalListHeader = `<div class="trend-list-header" style="font-size:10px;font-weight:700;color:var(--cyan);padding:6px 4px 10px;">Arama: "${esc(q)}" (${tokens.length})</div>`;
      renderTrendList(tokens);
    } catch (e) {
      list.innerHTML = `<div style="text-align:center;padding:32px;color:var(--red);font-size:12px;">${esc(e.message)}</div>`;
    }
  }

  function trendSearch(val) {
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(() => {
      renderModalTokenList(String(val || '').trim());
    }, 280);
  }

  window.trendSearch = trendSearch;

  function renderTrendList(tokens) {
    const list = $('trend-token-list');
    if (!list) return;
    state.lastModalTokens = tokens || [];
    if (!tokens.length) {
      list.innerHTML = state.modalListHeader
        || '<div style="text-align:center;padding:32px;color:var(--muted);font-size:12px;">Token bulunamadı</div>';
      return;
    }
    const RISK_COLOR = { LOW: 'var(--green)', MED: 'var(--yellow)', HIGH: 'var(--red)' };
    const rowsHtml = tokens.map((t) => {
      const isSel = state.trendSelToken && state.trendSelToken.token_id === t.token_id;
      const rk = String(t.risk || '').split(' ')[0];
      const rc = RISK_COLOR[rk] || 'var(--muted)';
      const trendBadge = t.inTrend
        ? `<span style="margin-left:6px;font-size:9px;font-weight:700;color:var(--green);border:1px solid rgba(0,255,136,.35);border-radius:4px;padding:1px 5px;">Trend: ${esc(t.trendRank)}</span>`
        : '';
      const chg = String(t.change || '');
      return `<div class="trend-pick-row" data-id="${esc(t.token_id)}" style="display:flex;align-items:center;gap:12px;padding:9px 12px;border-radius:9px;cursor:pointer;border:1px solid ${isSel ? 'rgba(0,255,136,.4)' : 'transparent'};background:${isSel ? 'rgba(0,255,136,.06)' : 'rgba(255,255,255,.02)'};">
        <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,rgba(0,255,136,.2),rgba(0,229,255,.1));display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--green);">${esc((t.sym || '?').charAt(0))}</div>
        <div style="flex:1;min-width:0;"><div style="font-size:12px;font-weight:700;">${esc(t.sym)}${trendBadge}</div><div style="font-size:10px;color:var(--muted);">◎ ${esc(t.net)} · ${esc(t.dex)}</div></div>
        <div style="text-align:right;"><div style="font-size:11px;font-weight:700;color:${chg.startsWith('+') ? 'var(--green)' : 'var(--red)'};">${esc(t.change)}</div><div style="font-size:10px;color:${rc};">${esc(t.risk)}</div></div>
      </div>`;
    }).join('');
    list.innerHTML = state.modalListHeader + rowsHtml;

    qsa('.trend-pick-row', list).forEach((row) => {
      row.addEventListener('click', () => selectTrendToken(row.dataset.id));
    });
  }

  function initTrendPosGrid() {
    const grid = $('trend-pos-grid');
    if (!grid) return;
    const want = state.trendSelPos === 'pin' ? '📌' : String(state.trendSelPos);
    qsa('button', grid).forEach((b) => {
      const label = b.textContent.trim();
      const match = label === want || (want === 'pin' && label === '📌');
      if (match) selectTrendPos(b, label === '📌' ? '📌' : parseInt(label, 10));
    });
  }

  function selectTrendToken(tokenId) {
    const tokens = state.lastModalTokens || [];
    state.trendSelToken = tokens.find((t) => t.token_id === tokenId) || { token_id: tokenId, sym: tokenId.slice(0, 4) };
    if (!state.trendSelPos) state.trendSelPos = 'pin';
    const area = $('trend-selected-area');
    area.style.display = 'flex';
    $('trend-sel-avatar').textContent = (state.trendSelToken.sym || '?').charAt(0);
    $('trend-sel-sym').textContent = state.trendSelToken.sym || tokenId.slice(0, 8);
    initTrendPosGrid();
    updateTrendAddBtn(true);
    updateAddBtnLabel();
    renderTrendList(tokens);
    area.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function trendFilterNet(el, net) {
    state.trendNetFilter = net;
    qsa('.tnet-btn').forEach((b) => {
      b.style.background = 'rgba(255,255,255,.04)';
      b.style.color = 'var(--muted)';
      b.style.borderColor = 'var(--border)';
      b.style.fontWeight = 'normal';
    });
    el.style.background = 'rgba(0,255,136,.1)';
    el.style.color = 'var(--green)';
    el.style.borderColor = 'rgba(0,255,136,.3)';
    el.style.fontWeight = '700';
    trendSearch($('trend-search')?.value || '');
  }

  window.trendFilterNet = trendFilterNet;

  function selectTrendPos(el, pos) {
    state.trendSelPos = pos === '📌' ? 'pin' : pos;
    qsa('#trend-pos-grid button').forEach((b) => {
      b.style.background = 'rgba(255,255,255,.04)';
      b.style.borderColor = 'var(--border)';
      b.style.color = 'var(--text)';
      b.style.fontWeight = 'normal';
      b.style.borderWidth = '1px';
    });
    el.style.background = 'rgba(0,255,136,.15)';
    el.style.borderColor = 'var(--green)';
    el.style.borderWidth = '2px';
    el.style.color = 'var(--green)';
    el.style.fontWeight = '700';
    updateAddBtnLabel();
  }

  window.selectTrendPos = selectTrendPos;

  function clearTrendSel() {
    state.trendSelToken = null;
    $('trend-selected-area').style.display = 'none';
    updateTrendAddBtn(false);
    const btn = $('trend-add-btn');
    if (btn) btn.textContent = "Trend'e Ekle";
    renderModalTokenList($('trend-search')?.value?.trim() || '');
  }

  window.clearTrendSel = clearTrendSel;

  async function confirmTrendAdd() {
    if (!state.trendSelToken) return;
    const isPinned = state.trendSelPos === 'pin';
    setStatus('Ekleniyor…');
    try {
      await window.SniperAdminApi('/api/admin/trending', {
        method: 'POST',
        body: JSON.stringify({
          token_id: state.trendSelToken.token_id,
          position: state.trendSelPos,
          is_pinned: isPinned,
        }),
      });
      closeTrendModal();
      await loadTable();
      setStatus('Trend\'e eklendi.');
    } catch (e) {
      setStatus(e.message || 'Eklenemedi', true);
    }
  }

  window.confirmTrendAdd = confirmTrendAdd;

  async function onPageOpen() {
    if (!page()) return;
    setStatus('');
    try {
      await Promise.all([loadSettings(), loadTable()]);
      setupRefresh();
    } catch (e) {
      setStatus(e.message || 'Yüklenemedi', true);
    }
  }

  function setupRefresh() {
    if (state.refreshTimer) clearInterval(state.refreshTimer);
    state.refreshTimer = setInterval(() => {
      if (page()?.classList.contains('active')) {
        loadTable().catch(() => {});
      }
    }, 60000);
  }

  function bind() {
    if (!page()) return;

    bindSliderLabels();

    $('trendBtnManualAdd')?.addEventListener('click', openTrendModal);

    qsa('.tf-btn', page()).forEach((btn) => {
      btn.addEventListener('click', function () {
        const m = this.getAttribute('onclick');
        const tf = m?.match(/'([^']+)'/)?.[1];
        if (tf) setTf(this, tf);
      });
    });

    const saveBtns = qsa('#page-trending .card button', page()).filter((b) => b.textContent.trim() === 'Kaydet');
    saveBtns.forEach((btn) => btn.addEventListener('click', () => saveSettings().catch((e) => setStatus(e.message, true))));

    $('trend-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'trend-modal') closeTrendModal();
    });

    $('trend-search')?.addEventListener('input', (e) => trendSearch(e.target.value));

    qsa('#trend-modal .tnet-btn').forEach((btn, i) => {
      const nets = ['ALL', 'SOL', 'TON', 'BSC', 'ETH'];
      btn.addEventListener('click', () => trendFilterNet(btn, nets[i] || 'ALL'));
    });

    qsa('#trend-pos-grid button').forEach((btn) => {
      const label = btn.textContent.trim();
      const pos = label === '📌' ? '📌' : parseInt(label, 10);
      btn.addEventListener('click', () => selectTrendPos(btn, pos));
    });

    const modal = $('trend-modal');
    qsa('button', modal).forEach((btn) => {
      if (btn.textContent.trim() === '×' || btn.textContent.trim() === 'İptal') {
        btn.addEventListener('click', closeTrendModal);
      }
    });
    qs('#trend-selected-area button', modal)?.addEventListener('click', clearTrendSel);

    $('trend-add-btn')?.addEventListener('click', () => confirmTrendAdd());

    const orig = window.showPage;
    if (typeof orig === 'function' && !window.__adminTrendShowPatched) {
      window.showPage = function (id) {
        orig(id);
        if (id === 'trending') onPageOpen();
      };
      window.__adminTrendShowPatched = true;
    }

    document.addEventListener('sniper-admin-ready', onPageOpen);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
