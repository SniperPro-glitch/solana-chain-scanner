'use strict';
const fs = require('fs');
const path = require('path');

const out = path.join(__dirname, '../public/admin/add-token-page.fragment.html');
const d = 'div';

const html = `
    <!-- TOKEN EKLE (tam sayfa) -->
    <${d} class="page" id="page-add-token">
      <nav class="add-token-crumb" aria-label="Breadcrumb">
        <a href="#" class="add-token-crumb-link" data-goto="feed">Token Feed</a>
        <span class="add-token-crumb-sep">/</span>
        <span>Yeni Token Ekle</span>
      </nav>

      <${d} class="add-token-layout">
        <${d} class="add-token-main">
          <section class="card add-token-section">
            <h3 class="add-token-section-title">Blockchain Ağı Seç</h3>
            <${d} class="chain-pick-grid" role="group" aria-label="Blockchain">
              <button type="button" class="chain-pick active" data-chain="solana" aria-pressed="true">
                <span class="chain-pick-ico">◎</span>
                <span class="chain-pick-name">Solana</span>
              </button>
              <button type="button" class="chain-pick disabled" data-chain="ton" disabled title="Yakında">
                <span class="chain-pick-ico">💎</span>
                <span class="chain-pick-name">TON</span>
              </button>
              <button type="button" class="chain-pick disabled" data-chain="bsc" disabled title="Yakında">
                <span class="chain-pick-ico">⬡</span>
                <span class="chain-pick-name">BSC</span>
                <span class="chain-pick-sub">BNB Chain</span>
              </button>
              <button type="button" class="chain-pick disabled" data-chain="eth" disabled title="Yakında">
                <span class="chain-pick-ico">◇</span>
                <span class="chain-pick-name">Ethereum</span>
                <span class="chain-pick-sub">ETH</span>
              </button>
            </${d}>
          </section>

          <section class="card add-token-section">
            <h3 class="add-token-section-title">Token Bilgileri</h3>
            <${d} class="grid-2">
              <label class="input-group">
                <${d} class="input-label">CONTRACT ADRESİ <span class="req">*</span></${d}>
                <input class="input" type="text" id="addTokenContract" placeholder="Mint veya pump/dex linki" autocomplete="off" />
              </label>
              <label class="input-group">
                <${d} class="input-label">TOKEN SEMBOLÜ</${d}>
                <input class="input" type="text" id="addTokenSymbol" placeholder="ör: PIGEON" />
              </label>
              <label class="input-group">
                <${d} class="input-label">TOKEN ADI</${d}>
                <input class="input" type="text" id="addTokenName" placeholder="ör: Pigeon Finance" />
              </label>
              <label class="input-group">
                <${d} class="input-label">BORSA / DEX</${d}>
                <select class="input" id="addTokenDex">
                  <option value="">Otomatik (DexScreener)</option>
                  <option value="pumpfun">Pump.fun</option>
                  <option value="raydium">Raydium</option>
                  <option value="orca">Orca</option>
                  <option value="meteora">Meteora</option>
                </select>
              </label>
            </${d}>
          </section>

          <section class="card add-token-section">
            <h3 class="add-token-section-title">Token Logosu</h3>
            <${d} class="grid-2 add-token-logo-row">
              <label class="input-group">
                <${d} class="input-label">LOGO URL</${d}>
                <input class="input" type="url" id="addTokenLogoUrl" placeholder="https://cdn... veya IPFS linki" />
                <p class="input-hint">CDN, IPFS veya doğrudan görsel linki</p>
              </label>
              <${d} class="add-token-logo-preview-wrap">
                <${d} class="input-label">ÖNİZLEME</${d}>
                <${d} class="add-token-logo-preview" id="addTokenLogoPreview">
                  <${d} class="add-token-logo-avatar" id="addTokenLogoAvatar">?</${d}>
                  <${d} class="add-token-logo-meta">
                    <${d} class="add-token-logo-sym" id="addTokenPreviewSym">SEMBOL</${d}>
                    <${d} class="add-token-logo-name" id="addTokenPreviewName">Token Adı</${d}>
                  </${d}>
                </${d}>
                <label class="btn btn-ghost btn-sm add-token-upload-btn">
                  <input type="file" id="addTokenLogoFile" accept="image/*" hidden />
                  Dosya Yükle
                </label>
              </${d}>
            </${d}>
          </section>

          <section class="card add-token-section">
            <h3 class="add-token-section-title">DexScreener &amp; Havuz Bilgileri</h3>
            <label class="input-group">
              <${d} class="input-label">DEXSCREENER LİNKİ</${d}>
              <${d} class="input-with-btn">
                <input class="input" type="url" id="addTokenDexUrl" placeholder="https://dexscreener.com/solana/..." />
                <button type="button" class="btn btn-ghost btn-sm" id="addTokenDexOpen">Aç</button>
              </${d}>
              <p class="input-hint">Canlı grafik mini app içinde bu link üzerinden yüklenecek</p>
            </label>
            <label class="input-group">
              <${d} class="input-label">HAVUZ / PAIR ADRESİ</${d}>
              <input class="input" type="text" id="addTokenPool" placeholder="Pair veya pool adresi (isteğe bağlı)" />
            </label>
            <button type="button" class="btn btn-ghost btn-sm" id="addTokenFetchPreview" style="margin-top:4px">↻ Dex’ten önizleme al</button>
          </section>
        </${d}>

        <aside class="add-token-side">
          <section class="card add-token-section">
            <h3 class="add-token-section-title">Token Özeti</h3>
            <${d} class="add-token-summary" id="addTokenSummary">
              <${d} class="add-token-summary-top">
                <${d} class="add-token-logo-avatar lg" id="addTokenSummaryAvatar">?</${d}>
                <${d}>
                  <${d} class="add-token-summary-name" id="addTokenSummaryName">Token adı girilmedi</${d}>
                  <span class="chain-badge">◎ Solana</span>
                </${d}>
              </${d}>
              <dl class="add-token-summary-list">
                <${d}><dt>Borsa</dt><dd id="addTokenSumDex">—</dd></${d}>
                <${d}><dt>DexScreener</dt><dd id="addTokenSumDexUrl">—</dd></${d}>
                <${d}><dt>Havuz Türü</dt><dd>AMM</dd></${d}>
                <${d}><dt>Risk</dt><dd id="addTokenSumRisk">—</dd></${d}>
              </dl>
            </${d}>
          </section>

          <section class="card add-token-section">
            <h3 class="add-token-section-title">Yayın Ayarları</h3>
            <${d} class="publish-toggle-row">
              <${d}><${d} class="publish-toggle-title">Hemen Yayınla</${d}><${d} class="publish-toggle-sub">Eklenir eklenmez feed'de görünür</${d}></${d}>
              <label class="toggle"><input type="checkbox" id="addTokenPublishNow" checked /><span class="toggle-slider"></span></label>
            </${d}>
            <${d} class="publish-toggle-row">
              <${d}><${d} class="publish-toggle-title">Kanal Bildirimi</${d}><${d} class="publish-toggle-sub">Telegram kanalına duyuru gönder (yakında)</${d}></${d}>
              <label class="toggle"><input type="checkbox" id="addTokenNotify" disabled /><span class="toggle-slider"></span></label>
            </${d}>
            <${d} class="publish-toggle-row">
              <${d}><${d} class="publish-toggle-title">Pinned Token</${d}><${d} class="publish-toggle-sub">Feed'in en üstünde sabitle (yakında)</${d}></${d}>
              <label class="toggle"><input type="checkbox" id="addTokenPin" disabled /><span class="toggle-slider"></span></label>
            </${d}>
          </section>

          <button type="button" class="btn btn-primary btn-md add-token-submit-btn" id="addTokenSubmit">✓ Token Ekle</button>
          <button type="button" class="btn btn-ghost btn-md add-token-cancel-btn" id="addTokenCancel">İptal</button>
          <p id="addTokenStatus" class="banner-admin-status" role="status"></p>

          <${d} class="add-token-warn card">
            <${d} class="add-token-warn-title">Dikkat</${d}>
            <p>Contract adresi ve havuz bilgileri eklendikten sonra risk analizi otomatik çalışır. Yüksek riskli tokenler sarı uyarı ile işaretlenir.</p>
          </${d}>
        </aside>
      </${d}>
    </${d}>
`;

fs.writeFileSync(out, html.replace(/\n/g, '\r\n'), 'utf8');
console.log('Wrote', out);
