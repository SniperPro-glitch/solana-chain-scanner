/**
 * DexScreener tarzı arama paneli — uygulama listesinde anlık arama.
 */
(function (global) {
  const CHAIN_ICONS = {
    solana: 'assets/chains/chain-solana.png?v=1',
    ton: 'assets/chains/chain-ton.png?v=1',
    bsc: 'assets/chains/chain-bsc.png?v=1',
    eth: 'assets/chains/chain-eth.png?v=1',
  };

  const DEX_ICONS = {
    pumpfun: 'assets/dex-pumpfun.png?v=8',
    pumpswap: 'assets/dex-pumpfun.png?v=8',
    raydium: 'assets/dex-raydium.png?v=8',
    meteora: 'assets/dex-meteora.png?v=8',
    orca: 'assets/dex-orca.png?v=8',
  };

  const DEX_FB = {
    pumpfun: 'PUMP',
    raydium: 'RAY',
    meteora: 'MET',
    orca: 'ORCA',
    other: 'DEX',
  };

  let debounceTimer = null;
  let inflight = null;
  let activeIdx = -1;
  let lastItems = [];

  function $(id) {
    return document.getElementById(id);
  }

  function i18n(k, vars) {
    return global.MiniAppI18n?.t(k, vars) ?? k;
  }

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[c]);
  }

  function formatPct(v) {
    if (v == null || Number.isNaN(Number(v))) return '—';
    const n = Number(v);
    return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
  }

  function fmtPrice(item) {
    if (typeof global.sniperFmtPrice === 'function') return global.sniperFmtPrice(item);
    return item?.priceUsdFmt || '—';
  }

  function readChain() {
    if (typeof global.getActiveChain === 'function') return global.getActiveChain();
    try {
      return localStorage.getItem('sniperSidebarChainV1') || 'solana';
    } catch {
      return 'solana';
    }
  }

  function iconStackHtml(item) {
    const chain = item.chain || 'solana';
    const chainSrc = CHAIN_ICONS[chain] || CHAIN_ICONS.solana;
    const dex = item.dexPlatform || 'other';
    const dexSrc = DEX_ICONS[dex];
    const dexInner = dexSrc
      ? `<img src="${esc(dexSrc)}" alt="" width="22" height="22" loading="lazy" decoding="async" />`
      : `<span class="sr-dex-fb dex-${esc(dex)}">${esc(DEX_FB[dex] || DEX_FB.other)}</span>`;
    return `<span class="sr-icon-stack" aria-hidden="true">
      <img class="sr-chain" src="${esc(chainSrc)}" alt="" width="44" height="44" loading="lazy" decoding="async" />
      <span class="sr-dex">${dexInner}</span>
    </span>`;
  }

  function renderRow(item, idx) {
    const chg = item.change24h;
    const up = chg == null || Number(chg) >= 0;
    const quote = esc((item.pairLabel || 'SOL').replace(/^.*\//, '') || 'SOL');
    const sub = [item.marketCapUsdFmt ? `MCap ${item.marketCapUsdFmt}` : '']
      .filter(Boolean)
      .join(' · ');
    return `<button type="button" class="sr-row${idx === activeIdx ? ' active' : ''}" data-idx="${idx}" data-mint="${esc(item.mint)}" data-report="${esc(item.reportId || '')}" data-chain="${esc(item.chain || 'solana')}">
      ${iconStackHtml(item)}
      <span class="sr-main">
        <div class="sr-title">${esc(item.symbol)}<span class="sr-quote"> / ${quote}</span></div>
        <div class="sr-sub">${esc(sub || item.name || '—')}</div>
      </span>
      <span class="sr-stats">
        <span class="sr-price">${esc(fmtPrice(item))}</span>
        <span class="sr-chg ${up ? 'up' : 'down'}">${esc(formatPct(chg))}</span>
      </span>
    </button>`;
  }

  function setStatus(text) {
    const el = $('searchOverlayStatus');
    if (el) el.textContent = text || '';
  }

  function setResultsHtml(html) {
    const el = $('searchOverlayResults');
    if (el) el.innerHTML = html;
  }

  function bindResultClicks() {
    $('searchOverlayResults')?.querySelectorAll('.sr-row').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.idx);
        const item = lastItems[idx];
        if (item) pickResult(item);
      });
    });
  }

  function pickResult(item) {
    closeSearchOverlay();
    if (typeof global.closeDexSidebar === 'function') global.closeDexSidebar();
    if (item.reportId && typeof global.sniperOpenReport === 'function') {
      global.sniperOpenReport(item.reportId);
      return;
    }
    if (item.mint && typeof global.openTokenByMint === 'function') {
      global.openTokenByMint(item.mint);
      return;
    }
    if (typeof global.showToast === 'function') {
      global.showToast(global.MiniAppI18n?.t('toast.tokenOpenFail') ?? 'Token açılamadı');
    }
  }

  async function runSearch(q) {
    const query = String(q || '').trim();
    const clearBtn = $('searchOverlayClear');
    clearBtn?.classList.toggle('hidden', !query);

    if (!query) {
      activeIdx = -1;
      lastItems = [];
      setStatus('');
      setResultsHtml(`<p class="sr-hint">${esc(i18n('search.typeHint'))}</p>`);
      return;
    }

    if (query.length < 1) return;

    const url = `/api/search?q=${encodeURIComponent(query)}&limit=40&chain=solana`;

    if (inflight) inflight.abort?.();
    const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
    inflight = ac;

    setStatus(i18n('search.searching'));

    try {
      const res = await fetch(url, {
        cache: 'no-store',
        signal: ac?.signal,
      });
      const body = await res.json().catch(() => ({}));
      if (ac && inflight !== ac) return;
      if (!res.ok) throw new Error(body.message || 'search_failed');

      lastItems = body.items || [];
      if (!lastItems.length && typeof global.sniperFeedCatalog === 'function') {
        const qLower = query.toLowerCase().replace(/^\$/, '');
        lastItems = global.sniperFeedCatalog().filter((it) => {
          const parts = [it.symbol, it.tokenSymbol, it.mint, it.name, it.pairLabel]
            .filter(Boolean)
            .map((s) => String(s).toLowerCase());
          return parts.some((s) => s.includes(qLower));
        });
      }
      activeIdx = lastItems.length ? 0 : -1;

      if (!lastItems.length) {
        setStatus('');
        setResultsHtml(`<p class="sr-hint">${esc(i18n('search.noMatch'))}</p>`);
        return;
      }

      setStatus(`${lastItems.length} sonuç`);
      setResultsHtml(lastItems.map((it, i) => renderRow(it, i)).join(''));
      bindResultClicks();
    } catch (e) {
      if (e?.name === 'AbortError') return;
      setStatus('');
      setResultsHtml(`<p class="sr-hint">${esc(i18n('search.fail'))}</p>`);
      if (typeof global.showToast === 'function') {
        global.showToast(global.MiniAppI18n?.t('toast.searchError') ?? 'Arama hatası');
      }
    } finally {
      if (inflight === ac) inflight = null;
    }
  }

  function scheduleSearch() {
    const inp = $('searchOverlayInput');
    const q = inp?.value || '';
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => runSearch(q), 180);
  }

  function openSearchOverlay(prefill) {
    const root = $('searchOverlay');
    if (!root) return;
    if (typeof global.closeDexSidebar === 'function') global.closeDexSidebar();

    root.classList.remove('hidden');
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('search-open');
    document.body.classList.remove('sidebar-open');

    const inp = $('searchOverlayInput');
    if (prefill != null && inp) inp.value = String(prefill);
    else if (inp) inp.value = '';

    scheduleSearch();
    setTimeout(() => inp?.focus({ preventScroll: true }), 80);
    if (typeof global.syncTgBackButton === 'function') global.syncTgBackButton();
  }

  function closeSearchOverlay() {
    const root = $('searchOverlay');
    if (!root) return;
    root.classList.add('hidden');
    root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('search-open');
    if (inflight) inflight.abort?.();
    inflight = null;
    activeIdx = -1;
    lastItems = [];
    if (typeof global.syncTgBackButton === 'function') global.syncTgBackButton();
  }

  function moveActive(delta) {
    if (!lastItems.length) return;
    activeIdx = (activeIdx + delta + lastItems.length) % lastItems.length;
    setResultsHtml(lastItems.map((it, i) => renderRow(it, i)).join(''));
    bindResultClicks();
    const row = $('searchOverlayResults')?.querySelector(`.sr-row[data-idx="${activeIdx}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  }

  function bind() {
    $('searchOverlayBackdrop')?.addEventListener('click', closeSearchOverlay);
    $('searchOverlayClose')?.addEventListener('click', closeSearchOverlay);
    $('searchOverlayInput')?.addEventListener('input', scheduleSearch);
    $('searchOverlayClear')?.addEventListener('click', () => {
      const inp = $('searchOverlayInput');
      if (inp) inp.value = '';
      const side = $('sidebarSearchInput');
      if (side) side.value = '';
      scheduleSearch();
      inp?.focus();
    });

    $('searchOverlayInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSearchOverlay();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveActive(1);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveActive(-1);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIdx >= 0 && lastItems[activeIdx]) pickResult(lastItems[activeIdx]);
        else scheduleSearch();
      }
    });

    $('sidebarSearchTrigger')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openSearchOverlay('');
    });

    $('sidebarSearchClear')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof global.clearHomeSearch === 'function') global.clearHomeSearch();
      const oinp = $('searchOverlayInput');
      if (oinp) oinp.value = '';
      closeSearchOverlay();
    });
  }

  global.openSearchOverlay = openSearchOverlay;
  global.closeSearchOverlay = closeSearchOverlay;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})(typeof globalThis !== 'undefined' ? globalThis : window);
