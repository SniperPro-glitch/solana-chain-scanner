/**
 * Trade terminal — cüzdan bağlantısı (Phantom / Solflare) + Jupiter swap imzası cüzdanda.
 */
(function (global) {
  const WSOL = 'So11111111111111111111111111111111111111112';
  const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  const RPC = 'https://api.mainnet-beta.solana.com';

  const state = {
    data: null,
    side: 'buy',
    amount: '1',
    pct: 25,
    slippageBps: 100,
    priorityFee: 0.0005,
    mevProtect: true,
    swapping: false,
    solBalance: null,
    tokenDecimals: 6,
    quote: null,
    pendingAction: null,
    status: 'Hazır',
    refPriceNative: null,
    refPriceUsd: null,
    solUsd: 0,
    solUsdAt: 0,
    equivSeq: 0,
  };

  let equivJupTimer = null;

  function api(p) {
    if (typeof global.apiPath === 'function') return global.apiPath(p);
    return p;
  }

  let web3Promise = null;

  function $(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtUsdShort(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return '—';
    if (x >= 1e9) return `$${(x / 1e9).toFixed(2)}B`;
    if (x >= 1e6) return `$${(x / 1e6).toFixed(2)}M`;
    if (x >= 1e3) return `$${(x / 1e3).toFixed(1)}K`;
    if (x >= 1) return `$${x.toFixed(2)}`;
    if (x >= 0.0001) return `$${x.toFixed(6).replace(/\.?0+$/, '')}`;
    return `$${x.toExponential(2)}`;
  }

  function fmtCompact(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return '—';
    if (x >= 1e6) return `${(x / 1e6).toFixed(2)}M`;
    if (x >= 1e3) return `${(x / 1e3).toFixed(1)}K`;
    return x.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
  }

  function fmtPct(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return '—';
    const sign = x > 0 ? '+' : '';
    return `${sign}${x.toFixed(1)}%`;
  }

  function fmtTokenQty4(n) {
    const x = Number(n);
    if (!Number.isFinite(x) || x <= 0) return '0.0000';
    if (x >= 1e9) return `${(x / 1e9).toFixed(4)}B`;
    if (x >= 1e6) return `${(x / 1e6).toFixed(4)}M`;
    if (x >= 1e3) return `${(x / 1e3).toFixed(4)}K`;
    if (x < 0.0001) return x.toPrecision(4);
    return x.toLocaleString('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  }

  function tokenSymLabel() {
    const bare = String(symbol() || 'TOKEN').trim().replace(/^\$/, '');
    return `$${bare}`;
  }

  function isSolQuote(sym) {
    const q = String(sym || 'SOL').toUpperCase();
    return q === 'SOL' || q === 'WSOL';
  }

  /** 1 token kaç SOL — havuz quote’una göre (SOL çifti veya USD üzerinden). */
  function solPerTokenFromMarket(m) {
    if (!m) return null;
    if (Number.isFinite(state.refPriceNative) && state.refPriceNative > 0) {
      return state.refPriceNative;
    }
    const pxNat = Number(m.priceNative);
    const pxUsd = Number(m.priceUsd);
    const quote = m.quoteSymbol || 'SOL';
    if (isSolQuote(quote) && pxNat > 0) return pxNat;
    const solUsd = Number(state.solUsd);
    if (pxUsd > 0 && solUsd > 0) return pxUsd / solUsd;
    return null;
  }

  async function refreshSolUsd(market) {
    const m = market || state.data?.market;
    if (!m) return state.solUsd;
    const now = Date.now();
    if (state.solUsd > 0 && now - state.solUsdAt < 45_000) return state.solUsd;

    const pxNat = Number(m.priceNative);
    const pxUsd = Number(m.priceUsd);
    if (isSolQuote(m.quoteSymbol) && pxNat > 0 && pxUsd > 0) {
      state.solUsd = pxUsd / pxNat;
      state.solUsdAt = now;
      return state.solUsd;
    }

    try {
      const res = await fetch(
        `${api('/api/jupiter/quote')}?${new URLSearchParams({
          inputMint: WSOL,
          outputMint: USDC,
          amount: String(1e9),
          slippageBps: '50',
        })}`,
      );
      if (res.ok) {
        const j = await res.json();
        const out = Number(j.outAmount);
        if (out > 0) {
          state.solUsd = out / 1e6;
          state.solUsdAt = now;
          return state.solUsd;
        }
      }
    } catch {
      /* yedek */
    }
    return state.solUsd;
  }

  function setEquivText(text, hidden) {
    const el = $('tradeAmountEquiv');
    if (!el) return;
    if (hidden) {
      el.textContent = '';
      el.classList.add('hidden');
      return;
    }
    el.textContent = text;
    el.classList.remove('hidden');
  }

  async function updateAmountEquiv() {
    const amt = Number(state.amount);
    const m = state.data?.market || {};
    const seq = ++state.equivSeq;

    if (!Number.isFinite(amt) || amt <= 0) {
      if (equivJupTimer) clearTimeout(equivJupTimer);
      setEquivText('', true);
      return;
    }

    await refreshSolUsd(m);
    if (seq !== state.equivSeq) return;

    const solPer = solPerTokenFromMarket(m);
    const sym = tokenSymLabel();

    if (state.side === 'buy') {
      if (!solPer || solPer <= 0) {
        setEquivText('Canlı fiyat bekleniyor…', false);
        return;
      }
      const rough = amt / solPer;
      setEquivText(`≈ ${fmtTokenQty4(rough)} adet ${sym}`, false);

      const tokenMint = mint();
      if (!tokenMint) return;
      if (equivJupTimer) clearTimeout(equivJupTimer);
      equivJupTimer = setTimeout(async () => {
        if (seq !== state.equivSeq || state.side !== 'buy') return;
        try {
          const amountRaw = Math.floor(amt * 1e9);
          if (amountRaw < 1) return;
          const q = await fetchJupiterQuote(WSOL, tokenMint, amountRaw);
          if (seq !== state.equivSeq) return;
          const out = Number(q.outAmount);
          const dec = state.tokenDecimals || (await fetchTokenDecimals(tokenMint)) || 6;
          state.tokenDecimals = dec;
          if (out > 0) {
            setEquivText(`≈ ${fmtTokenQty4(out / 10 ** dec)} adet ${sym}`, false);
          }
        } catch {
          /* piyasa fiyatı tahmini kalır */
        }
      }, 420);
      return;
    }

    if (!solPer || solPer <= 0) {
      setEquivText('', true);
      return;
    }
    const solOut = amt * solPer;
    setEquivText(
      `≈ ${solOut.toLocaleString('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} SOL karşılığı`,
      false,
    );
  }

  function toast(msg) {
    if (typeof global.showToast === 'function') global.showToast(msg);
    else console.log('[trade]', msg);
  }

  function mint() {
    return state.data?.address || state.data?.market?.address || '';
  }

  function symbol() {
    return state.data?.market?.symbol || state.data?.symbol || 'TOKEN';
  }

  function loadWeb3() {
    if (global.solanaWeb3) return Promise.resolve(global.solanaWeb3);
    if (web3Promise) return web3Promise;
    web3Promise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/@solana/web3.js@1.95.8/lib/index.iife.min.js';
      s.async = true;
      s.onload = () => resolve(global.solanaWeb3);
      s.onerror = () => reject(new Error('Web3 yüklenemedi'));
      document.head.appendChild(s);
    });
    return web3Promise;
  }

  function setStatus(text) {
    state.status = text;
    const el = $('tradeStatusLine');
    if (el) el.textContent = text;
  }

  async function fetchSolBalance(pubkey) {
    if (!pubkey) return null;
    try {
      const res = await fetch(api(`/api/wallet/balance?pubkey=${encodeURIComponent(pubkey)}`));
      if (!res.ok) return null;
      const j = await res.json();
      return j.sol != null ? Number(j.sol) : null;
    } catch {
      return null;
    }
  }

  async function fetchTokenDecimals(tokenMint) {
    if (!tokenMint) return 6;
    try {
      const res = await fetch(api(`/api/token/decimals?mint=${encodeURIComponent(tokenMint)}`));
      if (!res.ok) return 6;
      const j = await res.json();
      return Number(j.decimals) || 6;
    } catch {
      return 6;
    }
  }

  async function fetchTokenBalance(pubkey, tokenMint) {
    if (!pubkey || !tokenMint) return null;
    try {
      const res = await fetch(
        api(`/api/wallet/token-balance?pubkey=${encodeURIComponent(pubkey)}&mint=${encodeURIComponent(tokenMint)}`),
      );
      if (!res.ok) return null;
      const j = await res.json();
      if (j.error) return null;
      return j;
    } catch {
      return null;
    }
  }

  const ALERTS_KEY = 'sniper_price_alerts_v1';
  let alertDir = 'above';

  function loadPriceAlerts() {
    try {
      const raw = localStorage.getItem(ALERTS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  function savePriceAlerts(list) {
    try {
      localStorage.setItem(ALERTS_KEY, JSON.stringify(list));
    } catch {
      /* yoksay */
    }
  }

  function listPriceAlerts(mintFilter) {
    const all = loadPriceAlerts().filter((a) => !a.triggered);
    if (!mintFilter) return all;
    return all.filter((a) => a.mint === mintFilter);
  }

  function removePriceAlert(id) {
    savePriceAlerts(loadPriceAlerts().filter((a) => a.id !== id));
    renderAlertList();
  }

  function shortMint(addr) {
    const a = String(addr || '');
    if (a.length < 12) return a || '—';
    return `${a.slice(0, 4)}…${a.slice(-4)}`;
  }

  function renderAlertList() {
    const ul = $('tradeAlertList');
    if (!ul) return;
    const tokenMint = mint();
    const rows = listPriceAlerts(tokenMint);
    if (!rows.length) {
      ul.innerHTML = '<li class="trade-alert-empty">Henüz alarm yok — yukarıdan hedef belirleyin</li>';
      return;
    }
    ul.innerHTML = rows
      .map((a) => {
        const isBelow = a.direction === 'below';
        const dirLbl = isBelow ? 'Düşüş' : 'Yükseliş';
        const dirIco = isBelow ? '↓' : '↑';
        return `<li class="trade-alert-item">
          <div class="trade-alert-item-main">
            <span class="trade-alert-item-dir ${isBelow ? 'down' : 'up'}" aria-hidden="true">${dirIco}</span>
            <div class="trade-alert-item-body">
              <strong>$${Number(a.targetUsd).toFixed(6)}</strong>
              <span>${dirLbl} · ${esc(a.symbol || symbol())}</span>
            </div>
          </div>
          <button type="button" class="trade-alert-rm" data-alert-id="${escHtml(a.id)}">Kaldır</button>
        </li>`;
      })
      .join('');
    ul.querySelectorAll('.trade-alert-rm').forEach((btn) => {
      btn.addEventListener('click', () => removePriceAlert(btn.dataset.alertId));
    });
  }

  function openPriceAlertModal() {
    const m = state.data?.market || {};
    const px = Number(m.priceUsd);
    const sym = tokenSymLabel();
    const tokenMint = mint();
    const symEl = $('tradeAlertTokenSym');
    if (symEl) symEl.textContent = sym;
    const mintEl = $('tradeAlertTokenMint');
    if (mintEl) mintEl.textContent = tokenMint ? shortMint(tokenMint) : '—';
    const subEl = $('tradeAlertSub');
    if (subEl) {
      subEl.textContent = Number.isFinite(px) && px > 0
        ? 'USD · anlık piyasa fiyatı'
        : 'Fiyat yüklenince alarm tetiklenir';
    }
    const nowEl = $('tradeAlertNow');
    if (nowEl) nowEl.textContent = Number.isFinite(px) ? fmtUsdShort(px) : '—';
    const inp = $('tradeAlertTarget');
    if (inp && Number.isFinite(px) && px > 0) inp.value = px >= 1 ? px.toFixed(4) : px.toFixed(8).replace(/\.?0+$/, '');
    alertDir = 'above';
    $('tradeAlertDirAbove')?.classList.add('active');
    $('tradeAlertDirBelow')?.classList.remove('active');
    renderAlertList();
    $('tradeAlertModal')?.classList.remove('hidden');
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }

  function closePriceAlertModal() {
    $('tradeAlertModal')?.classList.add('hidden');
  }

  function savePriceAlertFromModal() {
    const tokenMint = mint();
    if (!tokenMint) {
      toast('Token mint yok');
      return;
    }
    const target = Number(String($('tradeAlertTarget')?.value || '').replace(',', '.'));
    if (!Number.isFinite(target) || target <= 0) {
      toast('Geçerli hedef fiyat girin');
      return;
    }
    const m = state.data?.market || {};
    const alert = {
      id: `${tokenMint}-${Date.now()}`,
      mint: tokenMint,
      symbol: symbol(),
      targetUsd: target,
      direction: alertDir === 'below' ? 'below' : 'above',
      createdAt: Date.now(),
      triggered: false,
    };
    const list = loadPriceAlerts();
    list.push(alert);
    savePriceAlerts(list);
    toast(`Alarm aktif · ${tokenSymLabel()} hedef $${target.toFixed(6)}`);
    renderAlertList();
    closePriceAlertModal();
  }

  function checkPriceAlerts(market) {
    const tokenMint = mint();
    const px = Number(market?.priceUsd);
    if (!tokenMint || !Number.isFinite(px) || px <= 0) return;
    let list = loadPriceAlerts();
    let changed = false;
    for (const a of list) {
      if (a.triggered || a.mint !== tokenMint) continue;
      const hit = a.direction === 'below' ? px <= a.targetUsd : px >= a.targetUsd;
      if (!hit) continue;
      a.triggered = true;
      changed = true;
      const dirLbl = a.direction === 'below' ? 'hedefin altına indi' : 'hedefin üstüne çıktı';
      const msg = `${tokenSymLabel()} ${fmtUsdShort(px)} — ${dirLbl} ($${Number(a.targetUsd).toFixed(6)})`;
      toast(msg);
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('Sniper fiyat alarmı', { body: msg, tag: a.id });
        }
      } catch {
        /* yoksay */
      }
    }
    if (changed) savePriceAlerts(list);
  }

  async function closePosition() {
    const w = global.SniperWallet;
    const tokenMint = mint();
    if (!tokenMint) {
      toast('Token mint yok');
      return;
    }
    if (!w?.pubkey) {
      state.pendingAction = 'close';
      openWalletModal();
      return;
    }
    setStatus('Bakiye okunuyor…');
    const bal = await fetchTokenBalance(w.pubkey, tokenMint);
    const ui = Number(bal?.uiAmount);
    if (!bal || !Number.isFinite(ui) || ui <= 0) {
      toast('Cüzdanda bu token yok');
      setStatus('Hazır');
      return;
    }
    const dec = Number(bal.decimals) || state.tokenDecimals || 6;
    state.tokenDecimals = dec;
    state.side = 'sell';
    state.amount = ui >= 1 ? ui.toFixed(4).replace(/\.?0+$/, '') : ui.toPrecision(6);
    const inp = $('tradeAmountInput');
    if (inp) inp.value = state.amount;
    updateSideUi();
    setStatus(`Tümünü sat · ${fmtTokenQty4(ui)} ${symbol()}`);
    toast(`Cüzdandaki tüm ${tokenSymLabel()} satılıyor…`);
    void executeSwap();
  }

  function buildOrderBook(priceNative, priceUsd) {
    const px = Number(priceNative) || Number(priceUsd) || 0.000042;
    const asks = [];
    const bids = [];
    for (let i = 6; i >= 1; i -= 1) {
      const mult = 1 + i * 0.00035;
      asks.push({ px: px * mult, sz: (Math.random() * 900 + 100).toFixed(0) });
    }
    for (let i = 1; i <= 6; i += 1) {
      const mult = 1 - i * 0.00035;
      bids.push({ px: px * mult, sz: (Math.random() * 900 + 100).toFixed(0) });
    }
    return { asks, bids, mid: px };
  }

  function renderOrderBook(book) {
    const el = $('tradeBookRows');
    if (!el) return;
    const m = state.data?.market || {};
    const priceUsd = Number(m.priceUsd) || book.mid;
    const asksHtml = book.asks
      .map(
        (r) =>
          `<button type="button" class="trade-book-row ask" data-side="buy" data-px="${r.px}" title="Bu fiyattan al">
            <span class="trade-book-px">${r.px.toFixed(6)}</span><span>${r.sz}</span>
          </button>`,
      )
      .join('');
    const bidsHtml = book.bids
      .map(
        (r) =>
          `<button type="button" class="trade-book-row bid" data-side="sell" data-px="${r.px}" title="Bu fiyattan sat">
            <span class="trade-book-px">${r.px.toFixed(6)}</span><span>${r.sz}</span>
          </button>`,
      )
      .join('');
    const isBuy = state.side !== 'sell';
    const midSide = isBuy ? 'buy' : 'sell';
    const midHint = isBuy ? 'canlı fiyat · al' : 'canlı fiyat · sat';
    const midTitle = isBuy ? 'Bu fiyattan alım' : 'Bu fiyattan satış';
    el.innerHTML = `${asksHtml}
      <button type="button" class="trade-book-mid ${midSide}" data-side="${midSide}" data-px="${book.mid}" title="${midTitle}">
        <span class="trade-book-mid-px">${book.mid.toFixed(6)}</span>
        <span class="trade-book-mid-usd">≈ ${fmtUsdShort(priceUsd)}</span>
        <span class="trade-book-mid-hint">${midHint}</span>
      </button>
      ${bidsHtml}`;
  }

  function syncTradeModeStatus() {
    const w = global.SniperWallet;
    if (state.side === 'sell') {
      if (state.refPriceNative != null) {
        setStatus(`● Canlı SAT · ${state.refPriceNative.toFixed(6)} SOL`);
      } else if (w?.pubkey) {
        setStatus(`● Canlı SAT · ${w.shortAddr(w.pubkey)}`);
      } else {
        setStatus('● Canlı SAT — token miktarı girin');
      }
      return;
    }
    if (state.refPriceNative != null) {
      setStatus(`● Canlı AL · ${state.refPriceNative.toFixed(6)} SOL`);
    } else if (w?.pubkey) {
      setStatus(`● Canlı AL · ${w.shortAddr(w.pubkey)}`);
    } else {
      setStatus('● Canlı AL — SOL miktarı girin');
    }
  }

  function updateRefPriceBanner() {
    const el = $('tradeRefPrice');
    if (!el) return;
    const px = state.refPriceNative;
    const usd = state.refPriceUsd;
    if (!Number.isFinite(px) && !Number.isFinite(usd)) {
      el.classList.add('hidden');
      el.textContent = '';
      return;
    }
    el.classList.remove('hidden');
    const sol = Number.isFinite(px) ? `${px.toFixed(6)} SOL` : '—';
    const u = Number.isFinite(usd) ? fmtUsdShort(usd) : '';
    const lbl = state.side === 'sell' ? 'Satış' : 'Alım';
    el.innerHTML = `${lbl} fiyatı: <strong>${sol}</strong>${u ? ` <span>(${u})</span>` : ''} · piyasa emri`;
  }

  function focusBuyPanel() {
    const panel = document.querySelector('.trade-form-panel');
    panel?.classList.add('trade-form-panel--buy-focus');
    setTimeout(() => panel?.classList.remove('trade-form-panel--buy-focus'), 1400);
    const inp = $('tradeAmountInput');
    if (inp) {
      inp.focus();
      inp.select?.();
    }
    const scrollEl = document.querySelector('.detail-body');
    if (scrollEl && panel) {
      const top = panel.getBoundingClientRect().top + scrollEl.scrollTop - 72;
      scrollEl.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
  }

  function openBuyAtPrice(opts = {}) {
    mountHtml();
    if (opts.data) state.data = opts.data;
    const m = state.data?.market || {};
    const pxNat = Number(opts.priceNative ?? m.priceNative);
    const pxUsd = Number(opts.priceUsd ?? m.priceUsd);
    state.side = 'buy';
    state.refPriceNative = Number.isFinite(pxNat) ? pxNat : null;
    state.refPriceUsd = Number.isFinite(pxUsd) ? pxUsd : null;
    if (typeof global.switchDetailTab === 'function') global.switchDetailTab('txns');
    updateSideUi();
    updateRefPriceBanner();
    const book = buildOrderBook(state.refPriceNative || m.priceNative, state.refPriceUsd || m.priceUsd);
    renderOrderBook(book);
    updateHeader();
    setStatus(`Alım · ${state.refPriceNative != null ? state.refPriceNative.toFixed(6) : '—'} SOL`);
    focusBuyPanel();
  }

  function openSellAtPrice(opts = {}) {
    mountHtml();
    if (opts.data) state.data = opts.data;
    const m = state.data?.market || {};
    const pxNat = Number(opts.priceNative ?? m.priceNative);
    const pxUsd = Number(opts.priceUsd ?? m.priceUsd);
    state.side = 'sell';
    state.refPriceNative = Number.isFinite(pxNat) ? pxNat : null;
    state.refPriceUsd = Number.isFinite(pxUsd) ? pxUsd : null;
    if (typeof global.switchDetailTab === 'function') global.switchDetailTab('txns');
    updateSideUi();
    updateRefPriceBanner();
    const book = buildOrderBook(state.refPriceNative || m.priceNative, state.refPriceUsd || m.priceUsd);
    renderOrderBook(book);
    updateHeader();
    setStatus(`Satış · ${state.refPriceNative != null ? state.refPriceNative.toFixed(6) : '—'} SOL`);
    focusBuyPanel();
  }

  function tickLive(market) {
    if (!market) return;
    if (state.data?.market) Object.assign(state.data.market, market);
    const m = state.data?.market || market;
    void refreshSolUsd(m);
    checkPriceAlerts(m);
    updateHeader();
    updateStats();
    renderOrderBook(buildOrderBook(m.priceNative, m.priceUsd));
    updateSideUi({ refreshBook: false });
  }

  function renderRecentTrades() {
    const body = $('tradeRecentBody');
    if (!body) return;
    const m = state.data?.market || {};
    const buys = Number(m.buys24h) || 0;
    const sells = Number(m.sells24h) || 0;
    const px = Number(m.priceNative) || 0.000042;
    const rows = [];
    const times = ['şimdi', '3sn', '8sn', '14sn', '22sn', '31sn', '45sn'];
    for (let i = 0; i < 7; i += 1) {
      const isBuy = i === 0 ? buys > sells : Math.random() > 0.45;
      const sol = (Math.random() * 4 + 0.1).toFixed(2);
      const tok = (Number(sol) / px).toFixed(0);
      const whale = isBuy && i === 0 && buys > 50;
      rows.push(`<tr class="${whale ? 'whale' : isBuy ? 'buy' : 'sell'}">
        <td>${whale ? 'BALİNA AL' : isBuy ? 'AL' : 'SAT'}</td>
        <td>${sol}</td>
        <td>${fmtCompact(tok)}</td>
        <td>${px.toFixed(6)}</td>
        <td>${times[i] || `${i * 5}sn`}</td>
      </tr>`);
    }
    body.innerHTML = rows.join('');
  }

  function updateStats() {
    const m = state.data?.market || {};
    const set = (id, val) => {
      const el = $(id);
      if (el) el.textContent = val;
    };
    set('tradeStatMcap', m.marketCapUsdFmt || fmtUsdShort(m.marketCapUsd));
    set('tradeStatLiq', m.liquidityUsdFmt || fmtUsdShort(m.liquidityUsd));
    set('tradeStatVol', m.volume24hFmt || fmtUsdShort(m.volume24h));
    const holders = state.data?.market?.holdersCount ?? state.data?.holdersCount;
    set('tradeStatHolders', holders != null ? fmtCompact(holders) : '—');
  }

  function updateHeader() {
    const m = state.data?.market || {};
    const sym = symbol();
    const pair = m.pairLabel || `${sym} / SOL`;
    const chg = m.priceChange24h;
    const chgEl = $('tradePriceChg');
    const priceEl = $('tradePriceUsd');
    const pairEl = $('tradePairName');
    if (pairEl) pairEl.textContent = pair;
    if (priceEl) {
      priceEl.textContent = m.priceUsdFmt || fmtUsdShort(m.priceUsd);
    }
    if (chgEl) {
      chgEl.textContent = fmtPct(chg);
      chgEl.className = `trade-price-chg ${Number(chg) > 0 ? 'up' : Number(chg) < 0 ? 'down' : ''}`;
    }
    const venue = $('tradeVenueLabel');
    if (venue) {
      const dex = String(m.dex || state.data?.dex || 'DEX').replace(/_/g, ' ');
      venue.textContent = dex;
    }
  }

  function updateBalanceUi() {
    const w = global.SniperWallet;
    const row = $('tradeBalanceRow');
    if (!row) return;
    if (w?.pubkey) {
      const bal = state.solBalance != null ? state.solBalance.toFixed(2) : '…';
      row.innerHTML = `<span>BAKİYE: <strong>${bal} SOL</strong></span>
        <button type="button" class="trade-balance-connect" id="tradeWalletChip">${esc(w.shortAddr(w.pubkey))}</button>`;
      $('tradeWalletChip')?.addEventListener('click', () => openWalletModal());
    } else {
      row.innerHTML = `<span>Cüzdan bağlı değil</span>
        <button type="button" class="trade-balance-connect" id="tradeConnectInline">Bağla</button>`;
      $('tradeConnectInline')?.addEventListener('click', () => openWalletModal());
    }
  }

  function updateSideUi(opts = {}) {
    const buyTab = $('tradeTabBuy');
    const sellTab = $('tradeTabSell');
    const submit = $('tradeSubmit');
    const unit = $('tradeAmountUnit');
    const quickSol = document.querySelector('.trade-quick-sol');
    const panel = document.querySelector('.trade-form-panel');
    const terminal = $('tradeTerminal');
    const isBuy = state.side !== 'sell';

    if (buyTab) buyTab.className = `trade-side-tab buy${isBuy ? ' active' : ''}`;
    if (sellTab) sellTab.className = `trade-side-tab sell${!isBuy ? ' active' : ''}`;
    if (unit) unit.textContent = isBuy ? 'SOL' : symbol();
    if (quickSol) quickSol.classList.toggle('hidden', !isBuy);
    if (panel) {
      panel.classList.toggle('trade-mode-buy', isBuy);
      panel.classList.toggle('trade-mode-sell', !isBuy);
    }
    if (terminal) {
      terminal.classList.toggle('trade-mode-buy', isBuy);
      terminal.classList.toggle('trade-mode-sell', !isBuy);
    }
    if (submit) {
      submit.className = `trade-submit ${isBuy ? 'buy' : 'sell'}`;
      submit.textContent = isBuy ? 'Şimdi al' : 'Şimdi sat';
    }
    syncTradeModeStatus();
    updateRefPriceBanner();
    updateEstimate();
    if (opts.refreshBook !== false) {
      const m = state.data?.market;
      if (m) renderOrderBook(buildOrderBook(m.priceNative, m.priceUsd));
    }
  }

  async function updateEstimate() {
    await updateAmountEquiv();
    const el = $('tradeEstimate');
    if (!el) return;
    const amt = Number(state.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      el.textContent = '';
      el.classList.add('hidden');
      return;
    }
    const m = state.data?.market || {};
    const px = Number(m.priceUsd) || 0;
    const pxNat = Number(m.priceNative) || 0;
    if (state.side === 'buy') {
      const solPer = solPerTokenFromMarket(m);
      const solUsd = state.solUsd > 0 ? state.solUsd : pxNat > 0 && px > 0 ? px / pxNat : 0;
      const spendUsd = solUsd > 0 ? amt * solUsd : solPer > 0 && px > 0 ? (amt / solPer) * px : 0;
      if (spendUsd > 0) {
        el.textContent = `≈ ${fmtUsdShort(spendUsd)}`;
        el.classList.remove('hidden');
      } else {
        el.textContent = '';
        el.classList.add('hidden');
      }
      return;
    }
    const solPer = solPerTokenFromMarket(m);
    const usd = px > 0 ? amt * px : solPer > 0 && state.solUsd > 0 ? amt * solPer * state.solUsd : 0;
    if (usd > 0) {
      el.innerHTML = `≈ <strong>${fmtUsdShort(usd)}</strong>`;
      el.classList.remove('hidden');
    } else {
      el.textContent = '';
      el.classList.add('hidden');
    }
  }

  function openWalletModal() {
    $('tradeWalletModal')?.classList.remove('hidden');
  }

  function closeWalletModal() {
    $('tradeWalletModal')?.classList.add('hidden');
    state.pendingAction = null;
  }

  async function ensureWallet() {
    const w = global.SniperWallet;
    if (w?.pubkey) return w.pubkey;
    openWalletModal();
    return null;
  }

  async function connectWallet(which) {
    const w = global.SniperWallet;
    if (!w?.connectWith) {
      await w?.connect?.();
      return;
    }
    try {
      await w.connectWith(which);
      closeWalletModal();
      toast(`${which === 'solflare' ? 'Solflare' : 'Phantom'} bağlandı`);
      state.solBalance = await fetchSolBalance(w.pubkey);
      updateBalanceUi();
      if (state.pendingAction === 'swap') {
        state.pendingAction = null;
        void executeSwap();
      } else if (state.pendingAction === 'close') {
        state.pendingAction = null;
        void closePosition();
      }
    } catch (e) {
      toast(e?.message || 'Bağlantı başarısız');
    }
  }

  async function fetchJupiterQuote(inputMint, outputMint, amountRaw) {
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount: String(Math.floor(amountRaw)),
      slippageBps: String(state.slippageBps),
    });
    const res = await fetch(`${api('/api/jupiter/quote')}?${params}`);
    if (!res.ok) throw new Error('Fiyat alınamadı');
    const q = await res.json();
    if (q.error) throw new Error(q.error);
    return q;
  }

  async function executeSwap() {
    if (state.swapping) return;
    const w = global.SniperWallet;
    const pk = w?.pubkey;
    const tokenMint = mint();
    if (!pk) {
      state.pendingAction = 'swap';
      openWalletModal();
      return;
    }
    if (!tokenMint) {
      toast('Token mint yok');
      return;
    }

    const provider = w.getActiveProvider?.() || w.getProvider?.();
    if (!provider?.signAndSendTransaction && !provider?.signTransaction) {
      toast('Cüzdan swap imzasını desteklemiyor');
      return;
    }

    const amt = Number(state.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast('Geçerli miktar girin');
      return;
    }

    state.swapping = true;
    const btn = $('tradeSubmit');
    if (btn) btn.disabled = true;
    setStatus('Fiyat alınıyor…');

    try {
      const web3 = await loadWeb3();
      let inputMint;
      let outputMint;
      let amountRaw;

      if (state.side === 'buy') {
        inputMint = WSOL;
        outputMint = tokenMint;
        amountRaw = Math.floor(amt * 1e9);
      } else {
        inputMint = tokenMint;
        outputMint = WSOL;
        const decimals = state.tokenDecimals || (await fetchTokenDecimals(tokenMint));
        state.tokenDecimals = decimals;
        amountRaw = Math.floor(amt * 10 ** decimals);
      }

      if (amountRaw < 1) throw new Error('Miktar çok küçük');

      const quote = await fetchJupiterQuote(inputMint, outputMint, amountRaw);
      setStatus('İşlem hazırlanıyor…');
      const swapRes = await fetch(api('/api/jupiter/swap'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: pk,
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: Math.floor(state.priorityFee * 1e9),
        }),
      });
      const swapJson = await swapRes.json();
      if (swapJson.error) throw new Error(swapJson.error);

      const buf = Uint8Array.from(atob(swapJson.swapTransaction), (c) => c.charCodeAt(0));
      const tx = web3.VersionedTransaction.deserialize(buf);
      let sig;
      if (typeof provider.signAndSendTransaction === 'function') {
        const sent = await provider.signAndSendTransaction(tx, {
          skipPreflight: false,
          maxRetries: 2,
        });
        sig = sent?.signature || sent;
      } else {
        const signed = await provider.signTransaction(tx);
        const conn = new web3.Connection(RPC, 'confirmed');
        sig = await conn.sendRawTransaction(signed.serialize(), {
          skipPreflight: false,
          maxRetries: 2,
        });
      }
      setStatus('Cüzdanda onaylayın…');
      toast(`İşlem gönderildi · ${w.shortAddr(sig)}`);
      setStatus('Başarılı · canlı');
      state.solBalance = await fetchSolBalance(pk);
      updateBalanceUi();
    } catch (e) {
      const msg = String(e?.message || e);
      if (/reject|cancel/i.test(msg)) {
        toast('İşlem cüzdanda iptal edildi');
        setStatus('İptal');
      } else {
        toast(msg.slice(0, 120));
        setStatus('Hata');
      }
    } finally {
      state.swapping = false;
      if (btn) btn.disabled = false;
    }
  }

  function quickTrade(side) {
    state.side = side === 'sell' ? 'sell' : 'buy';
    updateSideUi();
    void executeSwap();
  }

  function applyPctToAmount() {
    const bal = state.solBalance;
    if (bal == null || state.side !== 'buy') return;
    const pct = state.pct / 100;
    const reserve = 0.01;
    const use = Math.max(0, (bal - reserve) * pct);
    state.amount = use > 0 ? use.toFixed(4).replace(/\.?0+$/, '') : '0';
    const inp = $('tradeAmountInput');
    if (inp) inp.value = state.amount;
    updateEstimate();
  }

  function bindUi() {
    if (global.__sniperTradeBound) return;
    global.__sniperTradeBound = true;

    $('tradeTabBuy')?.addEventListener('click', (ev) => {
      ev.preventDefault();
      state.side = 'buy';
      state.refPriceNative = null;
      state.refPriceUsd = null;
      const inp = $('tradeAmountInput');
      if (inp && (!inp.value || inp.value === '0')) inp.value = state.amount || '1';
      updateSideUi();
    });
    $('tradeTabSell')?.addEventListener('click', (ev) => {
      ev.preventDefault();
      state.side = 'sell';
      state.refPriceNative = null;
      state.refPriceUsd = null;
      const inp = $('tradeAmountInput');
      if (inp) inp.value = '';
      updateSideUi();
    });

    $('tradeBookRows')?.addEventListener('click', (ev) => {
      const row = ev.target.closest('[data-px][data-side]');
      if (!row) return;
      const px = Number(row.dataset.px);
      if (!Number.isFinite(px)) return;
      if (row.dataset.side === 'sell') openSellAtPrice({ priceNative: px, data: state.data });
      else openBuyAtPrice({ priceNative: px, data: state.data });
    });

    $('tradeAmountInput')?.addEventListener('input', (ev) => {
      state.amount = ev.target.value;
      updateEstimate();
    });

    $('tradePctRange')?.addEventListener('input', (ev) => {
      state.pct = Number(ev.target.value);
      applyPctToAmount();
    });

    document.querySelectorAll('.trade-quick-sol button').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.trade-quick-sol button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.amount = btn.dataset.sol || '1';
        const inp = $('tradeAmountInput');
        if (inp) inp.value = state.amount;
        updateEstimate();
      });
    });

    $('tradeSubmit')?.addEventListener('click', () => void executeSwap());

    $('tradeMevToggle')?.addEventListener('click', () => {
      state.mevProtect = !state.mevProtect;
      $('tradeMevToggle')?.classList.toggle('on', state.mevProtect);
    });
    $('tradeMevToggle')?.classList.add('on');

    $('tradeSlippageEdit')?.addEventListener('click', () => {
      const v = global.prompt?.('Slippage %', String(state.slippageBps / 100));
      if (v == null) return;
      const n = Number(v);
      if (Number.isFinite(n) && n > 0 && n < 50) {
        state.slippageBps = Math.round(n * 100);
        const el = $('tradeSlippageVal');
        if (el) el.textContent = `${(state.slippageBps / 100).toFixed(1)}%`;
      }
    });

    $('tradePriorityEdit')?.addEventListener('click', () => {
      const v = global.prompt?.('Priority fee (SOL)', String(state.priorityFee));
      if (v == null) return;
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) {
        state.priorityFee = n;
        const el = $('tradePriorityVal');
        if (el) el.textContent = `${n} SOL`;
      }
    });

    $('tradeWalletBackdrop')?.addEventListener('click', closeWalletModal);
    $('tradeWalletClose')?.addEventListener('click', closeWalletModal);
    $('tradeWalletPhantom')?.addEventListener('click', () => void connectWallet('phantom'));
    $('tradeWalletSolflare')?.addEventListener('click', () => void connectWallet('solflare'));

    $('tradeAlertBackdrop')?.addEventListener('click', closePriceAlertModal);
    $('tradeAlertClose')?.addEventListener('click', closePriceAlertModal);
    $('tradeAlertSave')?.addEventListener('click', savePriceAlertFromModal);
    $('tradeAlertDirAbove')?.addEventListener('click', () => {
      alertDir = 'above';
      $('tradeAlertDirAbove')?.classList.add('active');
      $('tradeAlertDirBelow')?.classList.remove('active');
    });
    $('tradeAlertDirBelow')?.addEventListener('click', () => {
      alertDir = 'below';
      $('tradeAlertDirBelow')?.classList.add('active');
      $('tradeAlertDirAbove')?.classList.remove('active');
    });

    document.querySelectorAll('.trade-quick-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.action;
        if (act === 'buy') {
          state.side = 'buy';
          updateSideUi();
          void executeSwap();
        } else if (act === 'sell') {
          state.side = 'sell';
          updateSideUi();
          void executeSwap();
        } else if (act === 'close') {
          void closePosition();
        } else if (act === 'alert') {
          openPriceAlertModal();
        }
      });
    });

    $('tradeRecentAll')?.addEventListener('click', () => {
      if (typeof global.switchDetailTab === 'function') global.switchDetailTab('chart');
    });

    global.SniperWallet?.onChange?.(() => {
      const w = global.SniperWallet;
      if (w?.pubkey) {
        void fetchSolBalance(w.pubkey).then((b) => {
          state.solBalance = b;
          updateBalanceUi();
        });
      } else {
        state.solBalance = null;
        updateBalanceUi();
      }
    });
  }

  function render(data) {
    if (!data) return;
    state.data = data;
    ensureAmountEquivEl();
    upgradeQuickBarIfNeeded();
    bindUi();

    const m = data.market || {};
    void refreshSolUsd(m).then(() => updateEstimate());
    const book = buildOrderBook(m.priceNative, m.priceUsd);
    renderOrderBook(book);
    renderRecentTrades();
    updateStats();
    updateHeader();
    updateSideUi();
    updateRefPriceBanner();

    const w = global.SniperWallet;
    const tokenMint = mint();
    void fetchTokenDecimals(tokenMint).then((d) => {
      state.tokenDecimals = d;
    });
    if (w?.pubkey) {
      void fetchSolBalance(w.pubkey).then((b) => {
        state.solBalance = b;
        updateBalanceUi();
        syncTradeModeStatus();
      });
    } else {
      updateBalanceUi();
    }
    syncTradeModeStatus();

    const bar = $('tradeBar');
    if (bar) bar.classList.add('trade-bar--terminal');
  }

  function upgradeQuickBarIfNeeded() {
    if (document.querySelector('.trade-quick-btn.sell-all')) return;
    const oldBar = document.querySelector('#tradeTerminal .trade-quick-bar');
    if (!oldBar) return;
    const wrap = document.createElement('div');
    wrap.className = 'trade-quick-wrap';
    wrap.innerHTML = `<p class="trade-quick-caption">Hızlı işlemler</p>
        <nav class="trade-quick-bar" aria-label="Hızlı işlemler">
          <button type="button" class="trade-quick-btn buy" data-action="buy" title="Girilen miktarda al">
            <span class="tqb-ico">⚡</span>
            <span class="tqb-lbl">Hızlı al</span>
          </button>
          <button type="button" class="trade-quick-btn sell" data-action="sell" title="Girilen miktarda sat">
            <span class="tqb-ico">↓</span>
            <span class="tqb-lbl">Hızlı sat</span>
          </button>
          <button type="button" class="trade-quick-btn sell-all" data-action="close" title="Cüzdandaki bu tokenin tamamını SOL'a çevir">
            <span class="tqb-ico">⤓</span>
            <span class="tqb-lbl">Tümünü sat</span>
            <span class="tqb-sub">Cüzdan bakiyesi</span>
          </button>
          <button type="button" class="trade-quick-btn alert" data-action="alert" title="Hedef fiyatta bildirim">
            <span class="tqb-ico">🔔</span>
            <span class="tqb-lbl">Alarm</span>
            <span class="tqb-sub">Fiyat hedefi</span>
          </button>
        </nav>`;
    oldBar.replaceWith(wrap);
    global.__sniperTradeBound = false;
    bindUi();
  }

  function ensureAmountEquivEl() {
    const field = document.querySelector('.trade-form-panel .trade-field');
    if (!field || $('tradeAmountEquiv')) return;
    const p = document.createElement('p');
    p.className = 'trade-amount-equiv hidden';
    p.id = 'tradeAmountEquiv';
    p.setAttribute('aria-live', 'polite');
    field.querySelector('.trade-amount-row')?.insertAdjacentElement('afterend', p);
  }

  function mountHtml() {
    const root = $('panel-trade');
    if (!root || root.dataset.tradeMounted) return;
    root.dataset.tradeMounted = '1';
    root.innerHTML = `<div class="trade-terminal" id="tradeTerminal">
      <header class="trade-head glass">
        <div class="trade-head-top">
          <div>
            <div class="trade-pair-line">
              <h2 class="trade-pair-name" id="tradePairName">— / SOL</h2>
              <span class="trade-pair-verified" title="Liste">✓</span>
            </div>
            <div class="trade-venue"><span id="tradeVenueLabel">DEX</span> · <span class="trade-venue-live">● Canlı</span></div>
            <p class="trade-status-line" id="tradeStatusLine">Hazır</p>
          </div>
          <div class="trade-price-block">
            <span class="trade-price-usd" id="tradePriceUsd">—</span>
            <span class="trade-price-chg" id="tradePriceChg">—</span>
          </div>
        </div>
        <div class="trade-stats">
          <div class="trade-stat"><span class="trade-stat-lbl">MCAP</span><span class="trade-stat-val" id="tradeStatMcap">—</span></div>
          <div class="trade-stat"><span class="trade-stat-lbl">Likidite</span><span class="trade-stat-val" id="tradeStatLiq">— <span class="lock-ico">🔒</span></span></div>
          <div class="trade-stat"><span class="trade-stat-lbl">Hacim 24s</span><span class="trade-stat-val" id="tradeStatVol">—</span></div>
          <div class="trade-stat"><span class="trade-stat-lbl">Holder</span><span class="trade-stat-val" id="tradeStatHolders">—</span></div>
        </div>
      </header>
      <div class="trade-main">
        <div class="trade-book">
          <div class="trade-book-head"><span>Fiyat (SOL)</span><span>Adet</span></div>
          <div class="trade-book-rows" id="tradeBookRows"></div>
        </div>
        <div class="trade-form-panel">
          <div class="trade-side-tabs">
            <button type="button" class="trade-side-tab buy active" id="tradeTabBuy">AL</button>
            <button type="button" class="trade-side-tab sell" id="tradeTabSell">SAT</button>
          </div>
          <div class="trade-balance-row" id="tradeBalanceRow"></div>
          <div class="trade-field">
            <span class="trade-field-lbl">Miktar</span>
            <div class="trade-amount-row">
              <input type="text" inputmode="decimal" class="trade-amount-input" id="tradeAmountInput" value="1" autocomplete="off" />
              <span class="trade-amount-unit" id="tradeAmountUnit">SOL</span>
            </div>
            <p class="trade-amount-equiv hidden" id="tradeAmountEquiv" aria-live="polite"></p>
          </div>
          <div class="trade-pct-slider">
            <input type="range" id="tradePctRange" min="0" max="100" step="25" value="25" />
            <div class="trade-pct-marks"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>
          </div>
          <p class="trade-ref-price hidden" id="tradeRefPrice" aria-live="polite"></p>
          <p class="trade-estimate" id="tradeEstimate">—</p>
          <div class="trade-quick-sol">
            <button type="button" data-sol="0.1">0.1 SOL</button>
            <button type="button" data-sol="0.5">0.5 SOL</button>
            <button type="button" data-sol="1" class="active">1 SOL</button>
            <button type="button" data-sol="2">2 SOL</button>
            <button type="button" data-sol="5">5 SOL</button>
          </div>
          <div class="trade-settings">
            <div class="trade-setting-row">
              <span>Slippage <button type="button" class="trade-setting-edit" id="tradeSlippageEdit">✎</button></span>
              <strong id="tradeSlippageVal">1.0%</strong>
            </div>
            <div class="trade-setting-row">
              <span>Priority fee <button type="button" class="trade-setting-edit" id="tradePriorityEdit">✎</button></span>
              <strong id="tradePriorityVal">0.0005 SOL</strong>
            </div>
            <div class="trade-setting-row">
              <span>MEV koruması</span>
              <button type="button" class="trade-toggle on" id="tradeMevToggle" aria-pressed="true"></button>
            </div>
          </div>
          <button type="button" class="trade-submit buy" id="tradeSubmit">Şimdi al</button>
        </div>
      </div>
      <section class="trade-recent">
        <div class="trade-recent-head">
          <h3>Son işlemler</h3>
          <button type="button" class="trade-recent-all" id="tradeRecentAll">Tümü ›</button>
        </div>
        <table class="trade-recent-table">
          <thead><tr><th>Tip</th><th>SOL</th><th>Token</th><th>Fiyat</th><th>Zaman</th></tr></thead>
          <tbody id="tradeRecentBody"></tbody>
        </table>
      </section>
      <div class="trade-quick-wrap">
        <p class="trade-quick-caption">Hızlı işlemler</p>
        <nav class="trade-quick-bar" aria-label="Hızlı işlemler">
          <button type="button" class="trade-quick-btn buy" data-action="buy" title="Girilen miktarda al">
            <span class="tqb-ico">⚡</span>
            <span class="tqb-lbl">Hızlı al</span>
          </button>
          <button type="button" class="trade-quick-btn sell" data-action="sell" title="Girilen miktarda sat">
            <span class="tqb-ico">↓</span>
            <span class="tqb-lbl">Hızlı sat</span>
          </button>
          <button type="button" class="trade-quick-btn sell-all" data-action="close" title="Cüzdandaki bu tokenin tamamını SOL'a çevir">
            <span class="tqb-ico">⤓</span>
            <span class="tqb-lbl">Tümünü sat</span>
            <span class="tqb-sub">Cüzdan bakiyesi</span>
          </button>
          <button type="button" class="trade-quick-btn alert" data-action="alert" title="Hedef fiyatta bildirim">
            <span class="tqb-ico">🔔</span>
            <span class="tqb-lbl">Alarm</span>
            <span class="tqb-sub">Fiyat hedefi</span>
          </button>
        </nav>
      </div>
    </div>`;
  }

  function init() {
    mountHtml();
    bindUi();
  }

  global.SniperTrade = {
    init,
    render,
    tickLive,
    openWalletModal,
    openBuyAtPrice,
    openSellAtPrice,
    executeSwap,
    quickTrade,
    closePosition,
    openPriceAlertModal,
    listPriceAlerts,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
