/**
 * Yan sidebar — ağlar, arama, menü, sosyal (Discord yok).
 */
(function (global) {
  const STORAGE_KEY = 'sniperSidebarChainV1';
  const CHAIN_ICONS = {
    solana: 'assets/chains/chain-solana.png',
    ton: 'assets/chains/chain-ton.png',
    bsc: 'assets/chains/chain-bsc.png',
    eth: 'assets/chains/chain-eth.png',
  };

  const SOCIAL_ICONS = {
    x: 'assets/social-x.png',
    telegram: 'assets/social-telegram.png',
  };

  const CHAINS = [
    { id: 'solana', label: 'Solana', live: true, dotClass: 'sol', short: 'SOL', fallback: '◎' },
    { id: 'ton', label: 'TON', live: false, dotClass: 'ton', short: 'TON', fallback: 'T' },
    { id: 'bsc', label: 'BSC', live: false, dotClass: 'bsc', short: 'BSC', fallback: 'B' },
    { id: 'eth', label: 'Ethereum', live: false, dotClass: 'eth', short: 'ETH', fallback: 'Ξ' },
  ];

  const SOCIAL = {
    x: 'https://x.com/',
    telegram: 'https://t.me/',
  };

  function onChainIconError(img) {
    const wrap = img.closest('.chain-ico');
    if (!wrap || wrap.dataset.fellBack) return;
    const dot = img.dataset.dot || 'sol';
    const fb = img.dataset.fallback || '◎';
    wrap.dataset.fellBack = '1';
    wrap.innerHTML = `<span class="chain-dot ${dot}" aria-hidden="true">${fb}</span>`;
  }

  function bindChainIcons() {
    document.querySelectorAll('.chain-ico img[data-chain]').forEach((img) => {
      img.addEventListener('error', () => onChainIconError(img));
    });
  }

  function bindSocialIcons() {
    document.querySelectorAll('.dex-sidebar-social img[data-social-icon]').forEach((img) => {
      img.addEventListener('error', () => {
        const parent = img.closest('.dex-sidebar-social');
        if (!parent || parent.dataset.fellBack) return;
        parent.dataset.fellBack = '1';
        const label = img.dataset.label || '';
        img.remove();
        if (!parent.textContent.trim()) parent.textContent = label;
      });
    });
  }

  let activeChain = 'solana';
  let open = false;

  function $(id) {
    return document.getElementById(id);
  }

  function loadChain() {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s && CHAINS.some((c) => c.id === s)) activeChain = s;
    } catch {
      /* yoksay */
    }
  }

  function saveChain(id) {
    activeChain = id;
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* yoksay */
    }
    document.dispatchEvent(new CustomEvent('sniper:chain', { detail: { chain: id } }));
    syncChainUi();
  }

  function i18n(k, vars) {
    return global.MiniAppI18n?.t(k, vars) ?? k;
  }

  function toast(msg) {
    if (typeof global.showToast === 'function') global.showToast(msg);
  }

  function syncChainUi() {
    const chain = CHAINS.find((c) => c.id === activeChain) || CHAINS[0];
    document.querySelectorAll('.dex-sidebar-chain[data-chain]').forEach((btn) => {
      const on = btn.dataset.chain === activeChain;
      btn.classList.toggle('active', on);
    });
    if (typeof global.updateHeaderChainPill === 'function') {
      global.updateHeaderChainPill(activeChain);
    } else {
      const pill = $('headerChainPill');
      const txt = pill?.querySelector('.chain-pill-txt');
      if (txt) txt.textContent = chain.short;
    }
    const meta = $('feedMetaText');
    if (meta && !meta.dataset.lockChain) {
      const c = global.MiniAppI18n?.chainUi?.(activeChain) || chain;
      meta.textContent = i18n('meta.chainLoading', { chain: c.label || chain.label, src: c.src || i18n('chain.soon') });
    }
  }

  function panelWidth() {
    const panel = $('dexSidebar')?.querySelector('.dex-sidebar-panel');
    return panel?.offsetWidth || 292;
  }

  function clearDragStyles() {
    const root = $('dexSidebar');
    const panel = root?.querySelector('.dex-sidebar-panel');
    const backdrop = $('dexSidebarBackdrop');
    root?.classList.remove('dex-sidebar--dragging');
    if (panel) panel.style.transform = '';
    if (backdrop) backdrop.style.opacity = '';
  }

  function setSidebarDrag(px) {
    const root = $('dexSidebar');
    const panel = root?.querySelector('.dex-sidebar-panel');
    const backdrop = $('dexSidebarBackdrop');
    if (!root || !panel) return;
    const w = panelWidth();
    const x = Math.max(0, Math.min(w, px));
    root.classList.add('dex-sidebar--dragging');
    root.style.pointerEvents = 'auto';
    panel.style.transform = `translateX(calc(-100% + ${x}px))`;
    if (backdrop) backdrop.style.opacity = String((x / w) * 0.62);
    return x;
  }

  function syncDrawerRail() {
    const rail = $('sidebarDrawerRail');
    if (!rail) return;
    rail.classList.toggle('is-hidden', open);
    rail.setAttribute('aria-hidden', open ? 'true' : 'false');
  }

  function openSidebar() {
    const root = $('dexSidebar');
    if (!root) return;
    clearDragStyles();
    root.classList.add('open');
    root.setAttribute('aria-hidden', 'false');
    open = true;
    document.body.classList.add('sidebar-open');
    syncDrawerRail();
    if (typeof global.syncTgBackButton === 'function') global.syncTgBackButton();
  }

  function closeSidebar() {
    const root = $('dexSidebar');
    if (!root) return;
    root.classList.remove('open');
    root.setAttribute('aria-hidden', 'true');
    open = false;
    document.body.classList.remove('sidebar-open');
    clearDragStyles();
    syncDrawerRail();
    if (typeof global.syncTgBackButton === 'function') global.syncTgBackButton();
  }

  function toggleSidebar() {
    if (open) closeSidebar();
    else openSidebar();
  }

  function navAction(action) {
    if (typeof global.closeSearchOverlay === 'function') global.closeSearchOverlay();
    closeSidebar();
    const map = {
      home: 'home',
      watchlist: 'watch',
      alerts: null,
      newpairs: 'new',
      gainers: 'trend',
      scanner: 'scan',
    };
    const nav = map[action];
    if (nav && typeof global.onBottomNav === 'function') {
      global.onBottomNav(nav);
      return;
    }
    if (action === 'alerts') {
      const n = global.SniperTrade?.listPriceAlerts?.()?.length ?? 0;
      if (n > 0) {
        toast(i18n('sidebar.alertsActive', { n }));
      } else {
        toast(i18n('sidebar.alertsNone'));
      }
      if (typeof global.switchDetailTab === 'function' && document.documentElement.classList.contains('detail-mode')) {
        global.switchDetailTab('txns');
        global.SniperTrade?.openPriceAlertModal?.();
      }
      return;
    }
    toast(i18n('toast.soon'));
  }

  function pickChain(id) {
    const c = CHAINS.find((x) => x.id === id);
    if (!c) return;
    if (!c.live) {
      toast(i18n('sidebar.chainSoon', { chain: c.label }));
    }
    if (typeof global.closeSearchOverlay === 'function') global.closeSearchOverlay();
    $('sidebarSearchInput')?.blur();
    saveChain(id);
    closeSidebar();
  }

  function bindDrawer() {
    const handle = $('sidebarDrawerHandle');
    const root = $('dexSidebar');
    if (!handle || !root) return;

    const OPEN_RATIO = 0.34;
    const TAP_SLOP = 10;
    const EDGE_PX = 22;
    let tracking = false;
    let originX = 0;
    let dragPx = 0;
    let edgeTracking = false;
    let edgeStartY = 0;

    function finishOpenDrag(px) {
      tracking = false;
      edgeTracking = false;
      handle.classList.remove('is-dragging');
      const w = panelWidth();
      if (px >= w * OPEN_RATIO) openSidebar();
      else closeSidebar();
    }

    handle.addEventListener('pointerdown', (e) => {
      if (open) return;
      tracking = true;
      originX = e.clientX;
      dragPx = 0;
      handle.classList.add('is-dragging');
      handle.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    handle.addEventListener('pointermove', (e) => {
      if (!tracking) return;
      dragPx = setSidebarDrag(e.clientX - originX);
    });

    handle.addEventListener('pointerup', (e) => {
      if (!tracking) return;
      if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
      const moved = Math.abs(e.clientX - originX);
      if (moved < TAP_SLOP) {
        tracking = false;
        handle.classList.remove('is-dragging');
        openSidebar();
        return;
      }
      finishOpenDrag(dragPx);
    });

    handle.addEventListener('pointercancel', () => {
      if (!tracking) return;
      finishOpenDrag(dragPx);
    });

    document.addEventListener(
      'touchstart',
      (e) => {
        if (open || e.touches.length !== 1) return;
        const t = e.touches[0];
        if (t.clientX > EDGE_PX) return;
        edgeTracking = true;
        originX = t.clientX;
        edgeStartY = t.clientY;
        dragPx = 0;
      },
      { passive: true },
    );

    document.addEventListener(
      'touchmove',
      (e) => {
        if (!edgeTracking || open) return;
        const t = e.touches[0];
        const dx = t.clientX - originX;
        const dy = Math.abs(t.clientY - edgeStartY);
        if (dx < 8) return;
        if (dy > dx * 1.15) {
          edgeTracking = false;
          clearDragStyles();
          return;
        }
        dragPx = setSidebarDrag(dx);
        if (dx > 10) e.preventDefault();
      },
      { passive: false },
    );

    document.addEventListener('touchend', (e) => {
      if (!edgeTracking) return;
      const x = e.changedTouches[0]?.clientX ?? originX;
      const dx = x - originX;
      edgeTracking = false;
      if (dx < TAP_SLOP) return;
      finishOpenDrag(dragPx);
    });
  }

  function bindPanelCloseDrag() {
    const root = $('dexSidebar');
    const panel = root?.querySelector('.dex-sidebar-panel');
    if (!panel) return;

    const CLOSE_RATIO = 0.34;
    const TAP_SLOP = 10;
    let closing = false;
    let originX = 0;
    let originY = 0;
    let dragPx = 0;

    function finishCloseDrag(px) {
      closing = false;
      const w = panelWidth();
      if (px <= w * (1 - CLOSE_RATIO)) closeSidebar();
      else openSidebar();
    }

    panel.addEventListener(
      'pointerdown',
      (e) => {
        if (!open) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        closing = true;
        originX = e.clientX;
        originY = e.clientY;
        dragPx = panelWidth();
        panel.setPointerCapture(e.pointerId);
      },
      { passive: true },
    );

    panel.addEventListener('pointermove', (e) => {
      if (!closing || !open) return;
      const dx = e.clientX - originX;
      const dy = Math.abs(e.clientY - originY);
      if (Math.abs(dx) < 6 && dy < 6) return;
      if (dy > Math.abs(dx) * 1.15) {
        closing = false;
        clearDragStyles();
        if (panel.hasPointerCapture(e.pointerId)) panel.releasePointerCapture(e.pointerId);
        return;
      }
      if (dx > 0) return;
      dragPx = setSidebarDrag(Math.max(0, panelWidth() + dx));
      if (Math.abs(dx) > 8) e.preventDefault();
    });

    panel.addEventListener('pointerup', (e) => {
      if (!closing) return;
      if (panel.hasPointerCapture(e.pointerId)) panel.releasePointerCapture(e.pointerId);
      const dx = e.clientX - originX;
      if (Math.abs(dx) < TAP_SLOP) {
        closing = false;
        clearDragStyles();
        return;
      }
      finishCloseDrag(dragPx);
    });

    panel.addEventListener('pointercancel', () => {
      if (!closing) return;
      finishCloseDrag(dragPx);
    });
  }

  function bind() {
    loadChain();
    syncChainUi();
    syncDrawerRail();
    bindChainIcons();
    bindSocialIcons();
    bindDrawer();
    bindPanelCloseDrag();

    $('btnSidebarOpen')?.addEventListener('click', (e) => {
      e.preventDefault();
      toggleSidebar();
    });
    $('btnSidebarClose')?.addEventListener('click', closeSidebar);
    $('dexSidebarBackdrop')?.addEventListener('click', closeSidebar);

    $('sidebarSearchInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSidebar();
    });

    document.querySelectorAll('.dex-sidebar-link[data-sidebar-nav]').forEach((btn) => {
      btn.addEventListener('click', () => navAction(btn.dataset.sidebarNav));
    });

    document.querySelectorAll('.dex-sidebar-chain[data-chain]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        pickChain(btn.dataset.chain);
      });
    });

    /* Giriş / çıkış — sidebar-account.js */

    document.querySelectorAll('.dex-sidebar-social[data-social]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const key = a.dataset.social;
        const url = SOCIAL[key];
        if (!url) return;
        e.preventDefault();
        closeSidebar();
        if (global.Telegram?.WebApp?.openLink) global.Telegram.WebApp.openLink(url);
        else window.open(url, '_blank', 'noopener,noreferrer');
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && open) closeSidebar();
    });
  }

  global.closeDexSidebar = closeSidebar;
  global.getActiveChain = () => activeChain;

  global.SniperSidebar = {
    open: openSidebar,
    close: closeSidebar,
    toggle: toggleSidebar,
    getChain: () => activeChain,
    setChain: saveChain,
    onChainIconError,
    CHAINS,
    CHAIN_ICONS,
    SOCIAL_ICONS,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
