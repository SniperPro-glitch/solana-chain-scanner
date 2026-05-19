/**
 * Ana sayfa feed — app.js yüklenmese bile liste doldurur.
 */
(function (g) {
  const FEED_URL = '/api/feed?tab=trending&limit=24&dex=all&chain=solana';
  let inflight = null;

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[c]);
  }

  function showHomeShell() {
    document.getElementById('loading')?.classList.add('hidden');
    document.getElementById('error')?.classList.add('hidden');
    document.getElementById('scanner-home')?.classList.remove('hidden');
  }

  function renderFallback(items) {
    const list = document.getElementById('homeTokenList');
    if (!list || !items?.length) return false;
    list.innerHTML = items
      .map((it, i) => {
        const sym = esc(it.symbol || '?');
        return (
          `<article class="token-row" data-mint="${esc(it.mint)}">` +
          `<span class="tr-rank">${i + 1}</span>` +
          `<div class="tr-token"><span class="tr-avatar">${sym.slice(0, 2)}</span>` +
          `<div class="tr-meta"><div class="tr-name">${sym}</div>` +
          `<div class="tr-sub">${esc(it.pairLabel || '')}</div></div></div>` +
          `<span class="tr-price">${esc(it.priceUsdFmt || '—')}</span>` +
          `<span class="tr-pct">—</span><span class="tr-pct">—</span>` +
          `<span class="tr-vol">${esc(it.volume24hFmt || '—')}</span>` +
          `<span class="tr-liq">${esc(it.liquidityUsdFmt || '—')}</span>` +
          `<span class="tr-risk-col"><span class="risk-badge mid">SCAN</span></span></article>`
        );
      })
      .join('');
    return true;
  }

  async function pullFeed() {
    if (inflight) return inflight;
    showHomeShell();
    const loadingEl = document.getElementById('feedLoading');
    const list = document.getElementById('homeTokenList');
    loadingEl?.classList.remove('hidden');
    list?.classList.add('dimmed');

    inflight = (async () => {
      try {
        const res = await fetch(FEED_URL, { cache: 'no-store', credentials: 'same-origin' });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.message || 'feed_failed');
        if (typeof g.ingestFeedResponse === 'function') {
          g.ingestFeedResponse(body, '');
          return body;
        }
        renderFallback(body.items || []);
        return body;
      } catch (e) {
        console.error('[boot-feed]', e);
        return null;
      } finally {
        loadingEl?.classList.add('hidden');
        list?.classList.remove('dimmed');
        inflight = null;
      }
    })();
    return inflight;
  }

  function bootIfEmpty() {
    const list = document.getElementById('homeTokenList');
    if (!list || list.querySelector('.token-row')) return;
    void pullFeed();
  }

  g.bootHomeFeed = pullFeed;
  g.bootHomeFeedIfEmpty = bootIfEmpty;

  showHomeShell();
  void pullFeed();
  window.addEventListener('load', () => {
    setTimeout(bootIfEmpty, 500);
    setTimeout(bootIfEmpty, 2200);
  });
})(typeof globalThis !== 'undefined' ? globalThis : window);
