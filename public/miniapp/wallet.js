/** Solana cüzdan — Phantom / Solflare (inject) + Phantom deeplink yedek. */
(function (global) {
  const STORAGE_KEY = 'sniper_wallet_pubkey';
  const STORAGE_NAME = 'sniper_wallet_name';

  function getTg() {
    return global.Telegram?.WebApp;
  }

  function getProvider() {
    const p = global.phantom?.solana || global.solflare || global.solana;
    if (p && typeof p.connect === 'function') return p;
    return null;
  }

  function providerLabel(p) {
    if (p?.isPhantom || global.phantom?.solana === p) return 'Phantom';
    if (global.solflare === p) return 'Solflare';
    return 'Wallet';
  }

  function shortAddr(addr) {
    const a = String(addr || '');
    if (a.length < 12) return a || '—';
    return `${a.slice(0, 4)}…${a.slice(-4)}`;
  }

  function isValidPubkey(s) {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(s || '').trim());
  }

  const state = {
    pubkey: null,
    label: 'Wallet',
    connecting: false,
    listeners: new Set(),
  };

  function emit() {
    state.listeners.forEach((fn) => {
      try { fn({ ...state }); } catch { /* yoksay */ }
    });
  }

  function saveSession(pubkey, label) {
    state.pubkey = pubkey;
    state.label = label || state.label;
    try {
      if (pubkey) {
        sessionStorage.setItem(STORAGE_KEY, pubkey);
        sessionStorage.setItem(STORAGE_NAME, state.label);
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(STORAGE_NAME);
      }
    } catch { /* yoksay */ }
    emit();
  }

  function bindProviderEvents(provider) {
    if (!provider || provider._sniperBound) return;
    provider._sniperBound = true;
    provider.on?.('connect', () => {
      const pk = provider.publicKey?.toString?.();
      if (pk) saveSession(pk, providerLabel(provider));
    });
    provider.on?.('disconnect', () => saveSession(null));
    provider.on?.('accountChanged', (pk) => {
      if (pk) saveSession(pk.toString?.() || String(pk), providerLabel(provider));
      else saveSession(null);
    });
  }

  async function connectInjected() {
    const provider = getProvider();
    if (!provider) return null;
    bindProviderEvents(provider);
    const resp = await provider.connect();
    const pubkey = resp?.publicKey?.toString?.() || provider.publicKey?.toString?.();
    if (!pubkey) throw new Error('Adres alınamadı');
    saveSession(pubkey, providerLabel(provider));
    return pubkey;
  }

  async function connectSilent() {
    const provider = getProvider();
    if (!provider) return null;
    bindProviderEvents(provider);
    try {
      const resp = await provider.connect({ onlyIfTrusted: true });
      const pubkey = resp?.publicKey?.toString?.() || provider.publicKey?.toString?.();
      if (pubkey) saveSession(pubkey, providerLabel(provider));
      return pubkey;
    } catch {
      return null;
    }
  }

  function openPhantomDeeplink() {
    const tg = getTg();
    const appUrl = encodeURIComponent(global.location.origin);
    const redirect = encodeURIComponent(global.location.href.split('#')[0]);
    const url = `https://phantom.app/ul/v1/connect?app_url=${appUrl}&redirect_link=${redirect}&cluster=mainnet-beta`;
    if (tg?.openLink) tg.openLink(url);
    else global.open(url, '_blank', 'noopener');
  }

  async function connect() {
    if (state.connecting) return state.pubkey;
    state.connecting = true;
    emit();
    try {
      const injected = await connectInjected();
      if (injected) return injected;
      openPhantomDeeplink();
      const err = new Error('phantom_deeplink');
      err.code = 'deeplink';
      throw err;
    } finally {
      state.connecting = false;
      emit();
    }
  }

  async function disconnect() {
    const provider = getProvider();
    try {
      await provider?.disconnect?.();
    } catch { /* yoksay */ }
    saveSession(null);
  }

  async function toggle() {
    if (state.pubkey) {
      const tg = getTg();
      if (tg?.showConfirm) {
        return new Promise((resolve) => {
          tg.showConfirm('Cüzdan bağlantısını kes?', (ok) => {
            if (ok) disconnect().then(() => resolve(null));
            else resolve(state.pubkey);
          });
        });
      }
      await disconnect();
      return null;
    }
    return connect();
  }

  function restore() {
    try {
      const pk = sessionStorage.getItem(STORAGE_KEY);
      const name = sessionStorage.getItem(STORAGE_NAME);
      if (pk && isValidPubkey(pk)) {
        state.pubkey = pk;
        state.label = name || 'Wallet';
        emit();
      }
    } catch { /* yoksay */ }
    connectSilent().catch(() => {});
  }

  function onChange(fn) {
    state.listeners.add(fn);
    return () => state.listeners.delete(fn);
  }

  global.SniperWallet = {
    getProvider,
    get pubkey() { return state.pubkey; },
    get label() { return state.label; },
    get connecting() { return state.connecting; },
    shortAddr,
    isValidPubkey,
    connect,
    disconnect,
    toggle,
    restore,
    onChange,
    openPhantomDeeplink,
  };
})(typeof window !== 'undefined' ? window : globalThis);
