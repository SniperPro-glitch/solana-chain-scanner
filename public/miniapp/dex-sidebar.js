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
    { id: 'ton', label: 'TON', live: true, dotClass: 'ton', short: 'TON', fallback: 'T' },
    { id: 'bsc', label: 'BSC', live: true, dotClass: 'bsc', short: 'BSC', fallback: 'B' },
    { id: 'eth', label: 'Ethereum', live: true, dotClass: 'eth', short: 'ETH', fallback: 'Ξ' },
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

  function toast(msg) {
    if (typeof global.showToast === 'function') global.showToast(msg);
  }

  function syncChainUi() {
    const chain = CHAINS.find((c) => c.id === activeChain) || CHAINS[0];
    document.querySelectorAll('.dex-sidebar-chain[data-chain]').forEach((btn) => {
      const on = btn.dataset.chain === activeChain;
      btn.classList.toggle('active', on);
    });
    const pill = $('headerChainPill');
    if (pill) pill.textContent = chain.short;
    const meta = $('feedMetaText');
    if (meta && !meta.dataset.lockChain) {
      const live = chain.live ? 'live' : 'soon';
      const src = chain.id === 'solana' ? 'bot + arama' : 'DexScreener';
      meta.textContent = `◎ ${chain.label} · ${src}`;
    }
  }

  function openSidebar() {
    const root = $('dexSidebar');
    if (!root) return;
    root.classList.add('open');
    root.setAttribute('aria-hidden', 'false');
    open = true;
    document.body.classList.add('sidebar-open');
    setTimeout(() => {
      if (typeof global.openSearchOverlay === 'function') {
        global.openSearchOverlay($('sidebarSearchInput')?.value || '');
      } else {
        $('sidebarSearchInput')?.focus({ preventScroll: true });
      }
    }, 280);
  }

  function closeSidebar() {
    const root = $('dexSidebar');
    if (!root) return;
    root.classList.remove('open');
    root.setAttribute('aria-hidden', 'true');
    open = false;
    document.body.classList.remove('sidebar-open');
  }

  function toggleSidebar() {
    if (open) closeSidebar();
    else openSidebar();
  }

  function navAction(action) {
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
      toast('Alerts — yakında');
      return;
    }
    toast('Yakında');
  }

  function pickChain(id) {
    const c = CHAINS.find((x) => x.id === id);
    if (!c) return;
    saveChain(id);
    closeSidebar();
    if (typeof global.fetchFeedForChain === 'function') {
      global.fetchFeedForChain(id);
    }
  }

  function bind() {
    loadChain();
    syncChainUi();
    bindChainIcons();
    bindSocialIcons();

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
      btn.addEventListener('click', () => pickChain(btn.dataset.chain));
    });

    $('sidebarSignIn')?.addEventListener('click', () => {
      closeSidebar();
      $('btnConnect')?.click();
    });

    $('sidebarSettings')?.addEventListener('click', () => {
      closeSidebar();
      $('btnSettings')?.click();
    });

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
})(typeof window !== 'undefined' ? window : global);
