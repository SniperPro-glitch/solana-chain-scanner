const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, '..', 'public', 'miniapp', 'app.js');
let s = fs.readFileSync(p, 'utf8');
const start = s.indexOf('  function chartsLibReady()');
const end = s.indexOf('  function setChartType(type)');
if (start < 0 || end < 0) throw new Error(`markers not found: ${start} ${end}`);

const insert = `  function applyDexCrop() {
    if (!globalThis.SniperDexCrop) return;
    const run = () => SniperDexCrop.apply();
    if (SniperCropProfile?.apply) SniperCropProfile.apply();
    if (SniperDexCrop.ensureProfilesReady) {
      void SniperDexCrop.ensureProfilesReady().then(run);
      return;
    }
    run();
  }

  function scheduleDexTradesCrop() {
    applyDexCrop();
    [150, 500, 1200, 2500].forEach((ms) => setTimeout(applyDexCrop, ms));
  }

  function dexEmbedUrlFor(poolOrMint, tf, ctype) {
    const ref = String(poolOrMint || chartPoolRef(appData?.market) || '').trim();
    if (!ref) return null;
    const intervals = { '1m': '1', '5m': '5', '15m': '15', '1h': '60', '4h': '240', '1d': '1D' };
    const interval = intervals[String(tf || '15m').toLowerCase()] || '15';
    const type = ctype === 'line' ? 'line' : 'candle';
    const q = new URLSearchParams({
      embed: '1',
      theme: 'dark',
      trades: '0',
      info: '0',
      tabs: '0',
      chartLeftToolbar: '1',
      chartTheme: 'dark',
      chartType: type,
      interval,
    });
    return \`https://dexscreener.com/solana/\${encodeURIComponent(ref)}?\${q}\`;
  }

  function setChartEmbedMode(on) {
    document.querySelector('.chart-terminal')?.classList.toggle('chart-terminal--dex-embed', !!on);
  }

  function showDexEmbedChart(container, m, note, tf) {
    const poolRef = chartPoolRef(m) || tokenMintRef(m);
    const embed = m?.chart?.dexScreenerEmbedUrl || dexEmbedUrlFor(poolRef, tf, chartType);
    const page = m?.chart?.dexScreenerPageUrl || m?.dexScreenerUrl;
    if (embed) {
      setChartEmbedMode(true);
      container.innerHTML = \`<iframe class="dex-embed-chart" src="\${escHtml(embed)}" title="DexScreener canlı grafik" loading="eager" allow="fullscreen" referrerpolicy="no-referrer-when-downgrade"></iframe>\`;
      const chartIfr = container.querySelector('iframe.dex-embed-chart');
      if (note) {
        note.textContent = \`\${(tf || '15m').toUpperCase()} · DexScreener\`;
        note.classList.remove('hidden');
      }
      if (chartIfr) {
        chartIfr.addEventListener('load', scheduleDexTradesCrop);
        scheduleDexTradesCrop();
      }
      return true;
    }
    setChartEmbedMode(false);
    const link = page
      ? \`<a class="dex-chart-link" href="\${escHtml(page)}" target="_blank" rel="noopener">DexScreener'da aç</a>\`
      : '';
    container.innerHTML = \`<div class="empty-chart">Grafik yüklenemedi. \${link}</div>\`;
    return false;
  }

  async function fetchChartCandles(m, tf, opts = {}) {
    const mint = tokenMintRef(m);
    const ref = mint || m?.poolAddress;
    if (!ref) return { candles: [], stats: null, poolAddress: null, priceUsd: null, pair: null };
    const q = new URLSearchParams({ tf });
    if (opts.live) q.set('live', '1');
    const res = await fetch(apiPath(\`/api/dex/chart/\${encodeURIComponent(ref)}?\${q}\`));
    if (!res.ok) return { candles: [], stats: null, poolAddress: null, priceUsd: null, pair: null };
    const body = await res.json();
    return {
      candles: body.candles || [],
      stats: body.stats || null,
      poolAddress: body.poolAddress || null,
      priceUsd: body.priceUsd ?? null,
      pair: body.pair || null,
    };
  }

  function destroyChart() {
    document.documentElement.classList.remove('chart-interacting');
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
      resizeHandler = null;
    }
    if (chartApi) {
      try {
        chartApi.remove();
      } catch {
        /* yoksay */
      }
      chartApi = null;
      candleSeries = null;
      lineSeries = null;
      volumeSeries = null;
    }
  }

  async function renderChart(m) {
    const container = $('priceChart');
    const note = $('chartNote');
    if (!container) return;

    const tf = m?.chart?.timeframe || currentTf;
    const stats = m?.chart?.stats;
    renderChartPeriodChg(stats, tf);

    destroyChart();
    setChartEmbedMode(false);
    container.innerHTML = '';
    if (note) note.classList.remove('hidden');

    if (showDexEmbedChart(container, m, note, tf)) {
      const candles = m?.chart?.candles || [];
      const last = candles[candles.length - 1];
      if (last) updateOhlc(last);
      return;
    }

    if (note) {
      note.textContent = 'DexScreener grafik — pool/mint bekleniyor';
      note.classList.remove('hidden');
    }
    const page = m?.chart?.dexScreenerPageUrl || m?.dexScreenerUrl;
    const link = page
      ? \`<a class="dex-chart-link" href="\${escHtml(page)}" target="_blank" rel="noopener">DexScreener'da aç</a>\`
      : '';
    container.innerHTML = \`<div class="empty-chart">Grafik için DexScreener gerekli. \${link}</div>\`;
  }

`;

fs.writeFileSync(p, s.slice(0, start) + insert + s.slice(end));
console.log('OK: removed', end - start, 'bytes, inserted', insert.length);
