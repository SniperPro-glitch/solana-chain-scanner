'use strict';
const fs = require('fs');
const path = require('path');
const d = ['d', 'i', 'v'].join('');

const html = `
    <!-- TREND AYARLARI -->
    <${d} class="page" id="page-trending">
      <${d} class="trend-weight-sum" id="trendWeightSum">Ağırlık toplamı: 100%</${d}>
      <${d} class="grid-2">
        <section class="card trend-card">
          <h3 class="card-title">Algoritma Ağırlıkları</h3>
          <p class="trend-hint">Trend listesi bu yüzdelerle skorlanır (toplam 100 olmalı).</p>
          <label class="trend-slider-row">
            <span class="trend-slider-label">Hacim (VOL)</span>
            <input type="range" id="trendWVolume" min="0" max="100" value="40" />
            <span class="trend-slider-val" id="trendWVolumeVal">40%</span>
          </label>
          <label class="trend-slider-row">
            <span class="trend-slider-label">İşlem (TXN)</span>
            <input type="range" id="trendWTxns" min="0" max="100" value="30" />
            <span class="trend-slider-val" id="trendWTxnsVal">30%</span>
          </label>
          <label class="trend-slider-row">
            <span class="trend-slider-label">Likidite</span>
            <input type="range" id="trendWLiquidity" min="0" max="100" value="20" />
            <span class="trend-slider-val" id="trendWLiquidityVal">20%</span>
          </label>
          <label class="trend-slider-row">
            <span class="trend-slider-label">Fiyat değişimi</span>
            <input type="range" id="trendWPrice" min="0" max="100" value="10" />
            <span class="trend-slider-val" id="trendWPriceVal">10%</span>
          </label>
        </section>
        <section class="card trend-card">
          <h3 class="card-title">Varsayılan Görünüm</h3>
          <label class="input-group">
            <${d} class="input-label">Varsayılan timeframe</${d}>
            <select class="input" id="trendTimeframe">
              <option value="5m">5m</option>
              <option value="1h">1h</option>
              <option value="6h">6h</option>
              <option value="24h" selected>24h</option>
            </select>
          </label>
          <label class="input-group">
            <${d} class="input-label">DEX filtresi</${d}>
            <select class="input" id="trendDex">
              <option value="all">Tümü</option>
              <option value="pumpfun">Pump.fun</option>
              <option value="raydium">Raydium</option>
              <option value="orca">Orca</option>
            </select>
          </label>
          <label class="input-group">
            <${d} class="input-label">Sıralama</${d}>
            <select class="input" id="trendSort">
              <option value="top">Top (skor)</option>
              <option value="gainers">Gainers</option>
              <option value="new">Yeni</option>
            </select>
          </label>
          <label class="input-group">
            <${d} class="input-label">Sayfa başına token</${d}>
            <input class="input" type="number" id="trendPageSize" min="5" max="100" value="20" />
          </label>
        </section>
      </${d}>
      <section class="card trend-card">
        <h3 class="card-title">Trending band (Mini App üst şerit)</h3>
        <${d} class="publish-toggle-row">
          <${d}><${d} class="publish-toggle-title">Trending band açık</${d}><${d} class="publish-toggle-sub">Ana sayfada kaydırmalı chip listesi</${d}></${d}>
          <label class="toggle"><input type="checkbox" id="trendTickerEnabled" checked /><span class="toggle-slider"></span></label>
        </${d}>
        <label class="input-group">
          <${d} class="input-label">Şeritte max token</${d}>
          <input class="input" type="number" id="trendTickerLimit" min="4" max="24" value="14" />
        </label>
        <label class="input-group">
          <${d} class="input-label">Min. 24s hacim (USD)</${d}>
          <input class="input" type="number" id="trendMinVolume" min="0" step="100" value="0" />
        </label>
        <${d} class="trend-ticker-preview" id="trendTickerPreview">
          <span class="trend-ticker-empty">Önizleme yükleniyor…</span>
        </${d}>
      </section>
      <section class="card trend-card">
        <h3 class="card-title">Feed önizleme (ilk 8)</h3>
        <${d} class="tbl-wrap">
          <table class="tbl" id="trendFeedPreviewTbl">
            <thead><tr><th>#</th><th>Token</th><th>Hacim</th><th>24h%</th></tr></thead>
            <tbody><tr><td colspan="4" style="color:var(--muted)">—</td></tr></tbody>
          </table>
        </${d}>
      </section>
      <p id="trendStatus" class="banner-admin-status" role="status"></p>
      <${d} style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="btn btn-primary btn-md" id="trendSave">Kaydet</button>
        <button type="button" class="btn btn-ghost btn-md" id="trendReload">Yenile</button>
      </${d}>
    </${d}>
`;

const out = path.join(__dirname, '../public/admin/trend-page.fragment.html');
fs.writeFileSync(out, html.trim() + '\n', 'utf8');
console.log('wrote', out);
