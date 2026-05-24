/**
 * Watchlist — özel listeler (ad + not) + tokenler + canlı fiyat
 */
(function (global) {
  const STORAGE_KEY = 'sniper_watchlist_v2';
  const LEGACY_KEY = 'sniper_watchlist_v1';
  const MAX_LISTS = 24;
  const MAX_MINTS_PER_LIST = 40;
  const DEFAULT_LIST_ID = 'list_default';

  let modalMode = 'create';
  let modalListId = null;
  let pendingPickEntry = null;
  let pendingPickData = null;
  let reopenPickAfterListCreate = false;

  function $(id) {
    return document.getElementById(id);
  }

  function escHtml(s) {
    if (global.SniperFeedEsc) return global.SniperFeedEsc(s);
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function toast(msg) {
    if (typeof global.showToast === 'function') global.showToast(msg);
  }

  function newListId() {
    return `list_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function defaultState() {
    const t = Date.now();
    return {
      version: 2,
      activeListId: DEFAULT_LIST_ID,
      lists: [{ id: DEFAULT_LIST_ID, name: 'Watchlist', note: '', createdAt: t, mints: [] }],
      tokens: {},
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return migrateLegacyOrDefault();
      const s = JSON.parse(raw);
      if (!s?.lists?.length) return migrateLegacyOrDefault();
      if (!s.tokens || typeof s.tokens !== 'object') s.tokens = {};
      if (!s.lists.some((l) => l.id === s.activeListId)) s.activeListId = s.lists[0].id;
      for (const l of s.lists) {
        if (!Array.isArray(l.mints)) l.mints = [];
        l.name = String(l.name || 'Liste').slice(0, 48);
        l.note = String(l.note || '').slice(0, 240);
      }
      return s;
    } catch {
      return defaultState();
    }
  }

  function migrateLegacyOrDefault() {
    if (localStorage.getItem(STORAGE_KEY)) {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY));
      } catch {
        /* aşağıda varsayılan */
      }
    }
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length) {
          const state = defaultState();
          for (const row of arr) {
            const n = normalizeToken(row);
            if (!n) continue;
            state.tokens[n.mint] = { ...state.tokens[n.mint], ...n };
            if (!state.lists[0].mints.includes(n.mint)) state.lists[0].mints.push(n.mint);
          }
          saveState(state);
          localStorage.removeItem(LEGACY_KEY);
          return state;
        }
      }
    } catch {
      /* yoksay */
    }
    const state = defaultState();
    saveState(state);
    return state;
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* yoksay */
    }
    document.dispatchEvent(new CustomEvent('sniper:watchlist-changed'));
    renderSidebar();
    syncNavBadge();
    renderListBar();
    syncActiveListHeader();
  }

  function readState() {
    return loadState();
  }

  function writeTokensAndLists(mutator) {
    const state = readState();
    mutator(state);
    saveState(state);
    return state;
  }

  function getLists() {
    return readState().lists;
  }

  function getActiveList() {
    const state = readState();
    return state.lists.find((l) => l.id === state.activeListId) || state.lists[0];
  }

  function setActiveListId(id) {
    writeTokensAndLists((state) => {
      if (state.lists.some((l) => l.id === id)) state.activeListId = id;
    });
  }

  function findList(state, id) {
    return state.lists.find((l) => l.id === id);
  }

  function riskObjFromStored(entry) {
    if (!entry?.level && entry?.trustScore == null) return null;
    const lvl = entry.level;
    if (lvl === 'red' || lvl === 'critical') return { band: 'high', label: 'HIGH RISK' };
    if (lvl === 'yellow') return { band: 'mid', label: 'MEDIUM RISK' };
    if (typeof entry.trustScore === 'number' && entry.trustScore >= 70) {
      return { band: 'low', label: 'LOW RISK' };
    }
    if (entry.trustScore != null || lvl) return { band: 'mid', label: 'MEDIUM RISK' };
    return null;
  }

  function normalizeToken(e) {
    const mint = String(e?.mint || '').trim();
    if (!mint) return null;
    return {
      mint,
      symbol: String(e.symbol || '?').toUpperCase().slice(0, 12),
      name: String(e.name || '').slice(0, 80),
      dex: String(e.dex || ''),
      imageUrl: e.imageUrl || null,
      addedAt: Number(e.addedAt) || Date.now(),
      reportId: e.reportId || null,
      level: e.level || null,
      trustScore: e.trustScore ?? null,
      priceUsdFmt: e.priceUsdFmt || null,
      change24h: e.change24h ?? null,
      auditAt: e.auditAt || null,
    };
  }

  function tokenFromState(state, mint) {
    const t = state.tokens[mint];
    return t ? normalizeToken(t) : null;
  }

  function getEntries(listId) {
    const state = readState();
    const list = findList(state, listId || state.activeListId) || state.lists[0];
    const out = [];
    const seen = new Set();
    for (const mint of list.mints) {
      if (seen.has(mint)) continue;
      const n = tokenFromState(state, mint);
      if (!n) continue;
      seen.add(mint);
      out.push(n);
    }
    return out;
  }

  function countAllUniqueMints() {
    const state = readState();
    const s = new Set();
    for (const l of state.lists) for (const m of l.mints) s.add(m);
    return s.size;
  }

  function mintInAnyList(state, mint) {
    return state.lists.some((l) => l.mints.includes(mint));
  }

  function isWatched(mint, listId) {
    const m = String(mint || '').trim();
    if (!m) return false;
    const state = readState();
    const list = findList(state, listId || state.activeListId);
    return list ? list.mints.includes(m) : false;
  }

  function listsForMint(mint) {
    const m = String(mint || '').trim();
    if (!m) return [];
    return readState().lists.filter((l) => l.mints.includes(m));
  }

  function addEntry(entry, listId) {
    const n = normalizeToken(entry);
    if (!n) return false;
    const state = readState();
    const lid = listId || state.activeListId;
    const list = findList(state, lid);
    if (!list) return false;
    if (!list.mints.includes(n.mint) && list.mints.length >= MAX_MINTS_PER_LIST) {
      toast(`Bu listede en fazla ${MAX_MINTS_PER_LIST} token`);
      return false;
    }
    const prev = state.tokens[n.mint];
    state.tokens[n.mint] = { ...prev, ...n, addedAt: prev?.addedAt || Date.now() };
    if (!list.mints.includes(n.mint)) list.mints.unshift(n.mint);
    saveState(state);
    return true;
  }

  function removeMint(mint, listId) {
    const m = String(mint || '').trim();
    if (!m) return false;
    const state = readState();
    const lid = listId || state.activeListId;
    const list = findList(state, lid);
    if (!list || !list.mints.includes(m)) return false;
    list.mints = list.mints.filter((x) => x !== m);
    if (!mintInAnyList(state, m)) delete state.tokens[m];
    saveState(state);
    return true;
  }

  function toggleMint(entry) {
    const n = normalizeToken(entry);
    if (!n) return false;
    if (isWatched(n.mint)) {
      removeMint(n.mint);
      return false;
    }
    addEntry(n);
    return true;
  }

  function patchAudit(mint, patch) {
    const m = String(mint || '').trim();
    if (!m || !patch) return;
    writeTokensAndLists((state) => {
      if (!state.tokens[m]) return;
      state.tokens[m] = { ...state.tokens[m], ...patch, mint: m, auditAt: Date.now() };
    });
  }

  function createList(name, note) {
    const title = String(name || '').trim().slice(0, 48);
    if (!title) {
      toast('Liste adı girin');
      return null;
    }
    const state = readState();
    if (state.lists.length >= MAX_LISTS) {
      toast(`En fazla ${MAX_LISTS} liste`);
      return null;
    }
    const id = newListId();
    state.lists.unshift({
      id,
      name: title,
      note: String(note || '').trim().slice(0, 240),
      createdAt: Date.now(),
      mints: [],
    });
    state.activeListId = id;
    saveState(state);
    return id;
  }

  function updateList(id, patch) {
    writeTokensAndLists((state) => {
      const list = findList(state, id);
      if (!list) return;
      if (patch.name != null) list.name = String(patch.name).trim().slice(0, 48) || list.name;
      if (patch.note != null) list.note = String(patch.note).trim().slice(0, 240);
    });
  }

  function deleteList(id) {
    const state = readState();
    if (state.lists.length <= 1) {
      toast('Son liste silinemez');
      return false;
    }
    const list = findList(state, id);
    if (!list) return false;
    for (const mint of list.mints) {
      if (!state.lists.some((l) => l.id !== id && l.mints.includes(mint))) {
        delete state.tokens[mint];
      }
    }
    state.lists = state.lists.filter((l) => l.id !== id);
    if (state.activeListId === id) state.activeListId = state.lists[0].id;
    saveState(state);
    return true;
  }

  function mergeEntryIntoFeedItem(entry, live) {
    const storedRisk = riskObjFromStored(entry);
    const liveLbl = live?.risk?.label;
    const useStoredRisk = storedRisk && (!liveLbl || liveLbl === 'SCAN' || liveLbl === '—');
    if (live) {
      return {
        ...live,
        watchAddedAt: entry.addedAt,
        reportId: live.reportId || entry.reportId || null,
        imageUrl: live.imageUrl || entry.imageUrl || null,
        level: useStoredRisk ? entry.level : live.level,
        trustScore: useStoredRisk ? entry.trustScore : live.trustScore,
        risk: useStoredRisk ? storedRisk : live.risk,
        priceUsdFmt:
          live.priceUsdFmt && live.priceUsdFmt !== '—' ? live.priceUsdFmt : entry.priceUsdFmt || live.priceUsdFmt,
        change24h: live.change24h ?? entry.change24h,
      };
    }
    const stub = stubFeedItem(entry);
    if (storedRisk) {
      stub.risk = storedRisk;
      stub.level = entry.level;
      stub.trustScore = entry.trustScore;
    }
    if (entry.reportId) stub.reportId = entry.reportId;
    if (entry.priceUsdFmt) stub.priceUsdFmt = entry.priceUsdFmt;
    if (entry.change24h != null) stub.change24h = entry.change24h;
    return stub;
  }

  function stubFeedItem(entry) {
    return {
      rank: 1,
      mint: entry.mint,
      symbol: entry.symbol,
      name: entry.name,
      imageUrl: entry.imageUrl,
      imageFallbacks: [],
      pairLabel: `${entry.symbol}/SOL`,
      dex: entry.dex,
      priceUsdFmt: '—',
      change24h: null,
      marketCapUsdFmt: '—',
      volume24hFmt: '—',
      risk: { band: 'none', label: '—' },
      trustScore: null,
      level: null,
      watchAddedAt: entry.addedAt,
      watchStale: true,
    };
  }

  async function fetchLiveItems(listId) {
    const entries = getEntries(listId);
    if (!entries.length) return [];
    try {
      const res = await fetch('/api/watchlist/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ mints: entries.map((e) => e.mint) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'quotes_failed');
      const byMint = new Map((body.items || []).map((it) => [it.mint, it]));
      return entries.map((e, i) => {
        const live = byMint.get(e.mint);
        return { ...mergeEntryIntoFeedItem(e, live), rank: i + 1 };
      });
    } catch (e) {
      console.warn('[watchlist]', e);
      return entries.map((e, i) => ({ ...mergeEntryIntoFeedItem(e, null), rank: i + 1 }));
    }
  }

  function syncActiveListHeader() {
    const list = getActiveList();
    const title = $('watchlistActiveTitle');
    const note = $('watchlistActiveNote');
    if (title) title.textContent = list?.name || 'Watchlist';
    if (note) {
      note.textContent = list?.note?.trim()
        ? list.note.trim()
        : 'Aktif listeye token eklemek için detayda Listeye ekle kullanın.';
    }
  }

  function renderListBar() {
    const root = $('watchlistListChips');
    if (!root) return;
    const state = readState();
    const activeId = state.activeListId;
    root.innerHTML = state.lists
      .map((l) => {
        const on = l.id === activeId;
        const n = l.mints.length;
        return `<button type="button" class="wl-list-chip${on ? ' active' : ''}" role="tab" aria-selected="${on ? 'true' : 'false'}" data-list-id="${escHtml(l.id)}">${escHtml(l.name)}<span class="wl-chip-count">${n}</span></button>`;
      })
      .join('');
    root.querySelectorAll('[data-list-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.listId === readState().activeListId) return;
        setActiveListId(btn.dataset.listId);
        syncActiveListHeader();
        if (typeof global.getFeedTab === 'function' && global.getFeedTab() === 'watch') {
          void loadView({ force: true });
        }
        syncDetailButton(typeof global.getAppData === 'function' ? global.getAppData() : null);
      });
    });
    syncActiveListHeader();
  }

  function openListModal(mode, listId) {
    modalMode = mode;
    modalListId = listId || null;
    const modal = $('watchlistListModal');
    const title = $('watchlistModalTitle');
    const nameInp = $('watchlistListName');
    const noteInp = $('watchlistListNote');
    const delBtn = $('watchlistListDelete');
    if (!modal || !nameInp) return;
    const state = readState();
    if (mode === 'edit' && listId) {
      const list = findList(state, listId);
      if (!title || !list) return;
      title.textContent = 'Listeyi düzenle';
      nameInp.value = list.name;
      noteInp.value = list.note || '';
      delBtn?.classList.toggle('hidden', state.lists.length <= 1);
    } else {
      if (title) title.textContent = 'Liste oluştur';
      nameInp.value = '';
      noteInp.value = '';
      delBtn?.classList.add('hidden');
    }
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => nameInp.focus(), 80);
  }

  function closeListModal() {
    const modal = $('watchlistListModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    modalListId = null;
    if (reopenPickAfterListCreate && pendingPickData) {
      reopenPickAfterListCreate = false;
      openPickModal(pendingPickData);
    }
  }

  function saveListModal() {
    const name = ($('watchlistListName')?.value || '').trim();
    const note = ($('watchlistListNote')?.value || '').trim();
    if (!name) {
      toast('Liste adı girin');
      return;
    }
    if (modalMode === 'edit' && modalListId) {
      updateList(modalListId, { name, note });
      toast('Liste güncellendi');
    } else {
      const newId = createList(name, note);
      toast('Liste oluşturuldu');
      if (typeof global.getFeedTab === 'function' && global.getFeedTab() === 'watch') {
        void loadView({ force: true });
      }
      if (reopenPickAfterListCreate && pendingPickEntry && newId) {
        reopenPickAfterListCreate = false;
        closeListModal();
        openPickModal(pendingPickData);
        requestAnimationFrame(() => {
          const cb = document.querySelector(`#watchlistPickLists .wl-pick-check[data-list-id="${newId}"]`);
          if (cb) cb.checked = true;
        });
        return;
      }
    }
    closeListModal();
    syncDetailButton(typeof global.getAppData === 'function' ? global.getAppData() : null);
  }

  function openPickModal(data) {
    pendingPickData = data;
    pendingPickEntry = entryFromAppData(data);
    if (!pendingPickEntry) {
      toast('Mint bulunamadı');
      return;
    }
    const symEl = $('watchlistPickSymbol');
    if (symEl) symEl.textContent = pendingPickEntry.symbol;
    renderPickLists();
    const modal = $('watchlistPickModal');
    modal?.classList.remove('hidden');
    modal?.setAttribute('aria-hidden', 'false');
  }

  function closePickModal(keepPending = false) {
    const modal = $('watchlistPickModal');
    modal?.classList.add('hidden');
    modal?.setAttribute('aria-hidden', 'true');
    if (!keepPending) {
      pendingPickEntry = null;
      pendingPickData = null;
      reopenPickAfterListCreate = false;
    }
  }

  function renderPickLists() {
    const root = $('watchlistPickLists');
    if (!root || !pendingPickEntry) return;
    const mint = pendingPickEntry.mint;
    const state = readState();
    root.innerHTML = state.lists
      .map((l) => {
        const on = l.mints.includes(mint);
        return `<label class="wl-pick-row">
      <input type="checkbox" class="wl-pick-check" data-list-id="${escHtml(l.id)}" ${on ? 'checked' : ''} />
      <span class="wl-pick-meta">
        <strong>${escHtml(l.name)}</strong>
        ${l.note ? `<span class="wl-pick-note">${escHtml(l.note)}</span>` : ''}
        <span class="wl-pick-count">${l.mints.length} token</span>
      </span>
    </label>`;
      })
      .join('');
  }

  function savePickModal() {
    const entry = pendingPickEntry;
    const data = pendingPickData;
    if (!entry) return;
    const checks = document.querySelectorAll('#watchlistPickLists .wl-pick-check');
    let changed = false;
    checks.forEach((cb) => {
      const id = cb.dataset.listId;
      const was = isWatched(entry.mint, id);
      if (cb.checked && !was) {
        addEntry(entry, id);
        changed = true;
      }
      if (!cb.checked && was) {
        removeMint(entry.mint, id);
        changed = true;
      }
    });
    if (changed && data) {
      const m = data.market || {};
      patchAudit(entry.mint, {
        reportId: data.reportId || null,
        symbol: entry.symbol,
        level: data.level,
        trustScore: data.trust?.score,
        priceUsdFmt: m.priceUsdFmt,
        change24h: m.priceChange24h,
        imageUrl: m.imageUrl || entry.imageUrl,
      });
    }
    const names = listsForMint(entry.mint).map((l) => l.name);
    if (!names.length) toast(`${entry.symbol} tüm listelerden çıkarıldı`);
    else toast(`${entry.symbol} → ${names.join(', ')}`);
    closePickModal();
    syncDetailButton(data);
    if (typeof global.getFeedTab === 'function' && global.getFeedTab() === 'watch' && typeof global.loadWatchlistView === 'function') {
      void global.loadWatchlistView({ force: true });
    }
  }

  function renderEmptyHtml() {
    const list = getActiveList();
    return `<div class="feed-empty-pro wl-empty" role="status">
      <span class="feed-empty-pro-glow" aria-hidden="true"></span>
      <span class="feed-empty-pro-icon wl-empty-ico" aria-hidden="true"><img class="watchlist-ico-img" src="assets/watchlist-icon.png?v=5" alt="" width="40" height="40" decoding="async" /></span>
      <strong class="feed-empty-pro-title">${escHtml(list?.name || 'Watchlist')} BOŞ</strong>
      <p class="feed-empty-pro-lead">Token detayında <b>Listeye ekle</b> ile <b>${escHtml(list?.name || 'bu listeye')}</b> ekle. Üstteki <b>+</b> ile yeni liste (ör. Solana tokenleri) oluşturabilirsin.</p>
      <span class="feed-empty-pro-tag">YEREL · NOTLU LİSTELER</span>
    </div>`;
  }

  function updateWatchLiveText(n) {
    const el = $('watchlistLiveText');
    if (!el) return;
    el.textContent = n ? `${n} token` : 'BOŞ';
  }

  async function loadView(opts = {}) {
    if (typeof global.showScannerHome === 'function') global.showScannerHome();
    renderListBar();
    const loading = $('feedLoading');
    loading?.classList.remove('hidden');
    try {
      const items = await fetchLiveItems();
      updateWatchLiveText(items.length);
      if (typeof global.setWatchlistFeedItems === 'function') {
        global.setWatchlistFeedItems(items, opts);
      }
    } finally {
      loading?.classList.add('hidden');
    }
  }

  function renderSidebar() {
    const empty = $('dexSidebarWatchEmpty');
    const listEl = $('dexSidebarWatchList');
    if (!empty || !listEl) return;
    const entries = getEntries().slice(0, 5);
    const list = getActiveList();
    if (!entries.length) {
      empty.classList.remove('hidden');
      empty.textContent = list?.note?.trim() || 'Henüz liste yok — token ekle';
      listEl.classList.add('hidden');
      listEl.innerHTML = '';
      return;
    }
    empty.classList.add('hidden');
    listEl.classList.remove('hidden');
    listEl.innerHTML = entries
      .map(
        (e) => `<button type="button" class="dex-sidebar-watch-item" data-mint="${escHtml(e.mint)}">
        ${e.imageUrl ? `<img src="${escHtml(e.imageUrl)}" alt="" width="20" height="20" loading="lazy" decoding="async" />` : `<span class="dex-sidebar-watch-sym">${escHtml(e.symbol.slice(0, 2))}</span>`}
        <span class="dex-sidebar-watch-label">${escHtml(e.symbol)}</span>
      </button>`,
      )
      .join('');
    listEl.querySelectorAll('[data-mint]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mint = btn.dataset.mint;
        if (typeof global.closeDexSidebar === 'function') global.closeDexSidebar();
        if (typeof global.onBottomNav === 'function') global.onBottomNav('watch');
        if (typeof global.openTokenByMint === 'function') global.openTokenByMint(mint);
      });
    });
  }

  function syncNavBadge() {
    const n = countAllUniqueMints();
    document.querySelectorAll('.bnav[data-nav="watch"] .bnav-lbl').forEach((el) => {
      const base = 'Watchlist';
      el.textContent = n ? `${base} (${n})` : base;
    });
  }

  function entryFromAppData(data) {
    const m = data?.market || {};
    const mint = data?.address || m.address || m.tokenAddress;
    if (!mint) return null;
    return normalizeToken({
      mint,
      symbol: m.symbol || data?.symbol,
      name: m.name || data?.name,
      dex: m.dex || data?.dex,
      imageUrl: m.imageUrl || null,
    });
  }

  function syncDetailButton(data) {
    const btn = $('btnWatchlist');
    if (!btn) return;
    const mint = data?.address || data?.market?.address;
    const lists = listsForMint(mint);
    const on = lists.length > 0;
    btn.disabled = false;
    btn.classList.toggle('detail-act-btn--watch-on', on);
    if (!on) btn.textContent = 'Listelere ekle';
    else if (lists.length === 1) btn.textContent = `${lists[0].name} · düzenle`;
    else btn.textContent = `${lists.length} listede · düzenle`;
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function onDetailPickOpen() {
    const data = typeof global.getAppData === 'function' ? global.getAppData() : null;
    openPickModal(data);
  }

  function bind() {
    readState();

    $('watchlistRefresh')?.addEventListener('click', () => {
      if (typeof global.getFeedTab === 'function' && global.getFeedTab() === 'watch') void loadView({ force: true });
      else toast('Watchlist sekmesinde yenileyin');
    });
    $('watchlistNewList')?.addEventListener('click', () => openListModal('create'));
    $('watchlistEditList')?.addEventListener('click', () => {
      const id = readState().activeListId;
      openListModal('edit', id);
    });
    $('watchlistListCancel')?.addEventListener('click', closeListModal);
    $('watchlistModalBackdrop')?.addEventListener('click', closeListModal);
    $('watchlistListSave')?.addEventListener('click', saveListModal);
    $('watchlistListDelete')?.addEventListener('click', () => {
      if (!modalListId) return;
      if (!deleteList(modalListId)) return;
      closeListModal();
      toast('Liste silindi');
      if (typeof global.getFeedTab === 'function' && global.getFeedTab() === 'watch') {
        void loadView({ force: true });
      }
    });
    $('watchlistListName')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveListModal();
      }
    });

    $('btnWatchlist')?.addEventListener('click', onDetailPickOpen);
    $('watchlistPickCancel')?.addEventListener('click', closePickModal);
    $('watchlistPickBackdrop')?.addEventListener('click', closePickModal);
    $('watchlistPickSave')?.addEventListener('click', savePickModal);
    $('watchlistPickNewList')?.addEventListener('click', () => {
      reopenPickAfterListCreate = true;
      closePickModal(true);
      openListModal('create');
    });
    document.addEventListener('sniper:watchlist-changed', () => {
      renderSidebar();
      syncNavBadge();
      renderListBar();
      syncDetailButton(typeof global.getAppData === 'function' ? global.getAppData() : null);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!$('watchlistPickModal')?.classList.contains('hidden')) closePickModal();
      else if (!$('watchlistListModal')?.classList.contains('hidden')) closeListModal();
    });

    renderSidebar();
    syncNavBadge();
    renderListBar();
  }

  global.SniperWatchlist = {
    getEntries,
    getLists,
    getActiveList,
    setActiveListId,
    createList,
    updateList,
    deleteList,
    isWatched,
    addEntry,
    removeMint,
    toggleMint,
    patchAudit,
    fetchLiveItems,
    loadView,
    renderEmptyHtml,
    renderListBar,
    syncDetailButton,
    openPickModal,
    listsForMint,
    renderSidebar,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
