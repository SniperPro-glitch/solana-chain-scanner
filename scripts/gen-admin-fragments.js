'use strict';
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'public', 'admin');
const d = 'motion'.replace('motion', 'div');

function el(tag, attrs, inner) {
  const a = attrs ? ' ' + attrs : '';
  return `<${tag}${a}>${inner || ''}</${tag}>`;
}

const settings = [
  '    <!-- ══════════ AYARLAR (admin_06) ══════════ -->',
  `    <${d} class="page" id="page-settings">`,
  `      <${d} class="grid-2">`,
  `        <${d} class="card">`,
  `          <${d} class="card-title">Admin Hesabı</${d}>`,
  `          <${d} class="input-group"><${d} class="input-label">KULLANICI ADI</${d}><input class="input" type="text" id="settingsUsername" autocomplete="username" /></${d}>`,
  `          <${d} class="input-group"><${d} class="input-label">MEVCUT ŞİFRE</${d}><input class="input" type="password" id="settingsCurrentPass" autocomplete="current-password" /></${d}>`,
  `          <${d} class="input-group"><${d} class="input-label">YENİ ŞİFRE</${d}><input class="input" type="password" id="settingsNewPass" autocomplete="new-password" /></${d}>`,
  '          <p id="settingsPassStatus" class="banner-admin-status" role="status"></p>',
  '          <button type="button" class="btn btn-primary btn-md" id="settingsChangePass">Şifreyi Güncelle</button>',
  `        </${d}>`,
  `        <${d} class="card">`,
  `          <${d} class="card-title">Genel Ayarlar</${d}>`,
  `          <${d} class="input-group"><${d} class="input-label">SİTE BAŞLIĞI</${d}><input class="input" type="text" id="settingsSiteTitle" /></${d}>`,
  `          <${d} class="input-group"><${d} class="input-label">VARSAYILAN DİL</${d}><input class="input" type="text" id="settingsLang" placeholder="tr / en" /></${d}>`,
  `          <${d} class="input-group"><${d} class="input-label">FEED YENİLEME (SN)</${d}><input class="input" type="number" id="settingsFeedRefresh" min="5" /></${d}>`,
  `          <${d} style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">`,
  '            <span style="font-size:12px;color:var(--muted);">Bakım Modu</span>',
  '            <label class="toggle"><input type="checkbox" id="settingsMaintenance" /><span class="toggle-slider"></span></label>',
  `          </${d}>`,
  '          <p id="settingsStatus" class="banner-admin-status" role="status"></p>',
  '          <button type="button" class="btn btn-primary btn-md" id="settingsSave">Kaydet</button>',
  `        </${d}>`,
  `      </${d}>`,
  `    </${d}>`,
].join('\n');

const trend = [
  '    <!-- ══════════ TREND AYARLARI (mockup) ══════════ -->',
  `    <${d} class="page" id="page-trending">`,
  `      <${d} class="grid-2">`,
  `        <${d} class="card">`,
  `          <${d} class="card-title">Algoritma Ağırlıkları</${d}>`,
  `          <${d} class="input-group"><${d} class="input-label">Hacim (VOL) Ağırlığı %</${d}><input class="input" type="number" id="trendWVolume" value="40" min="0" max="100" /></${d}>`,
  `          <${d} class="input-group"><${d} class="input-label">İşlem Sayısı (TXN) %</${d}><input class="input" type="number" id="trendWTxns" value="30" min="0" max="100" /></${d}>`,
  `          <${d} class="input-group"><${d} class="input-label">Holder Sayısı %</${d}><input class="input" type="number" id="trendWHolders" value="20" min="0" max="100" /></${d}>`,
  `          <${d} class="input-group"><${d} class="input-label">Fiyat Değişimi %</${d}><input class="input" type="number" id="trendWPrice" value="10" min="0" max="100" /></${d}>`,
  '          <button type="button" class="btn btn-primary btn-md trend-save-btn">Kaydet</button>',
  `        </${d}>`,
  `        <${d} class="card">`,
  `          <${d} class="card-title">Varsayılan Görünüm</${d}>`,
  `          <${d} class="input-group"><${d} class="input-label">Varsayılan Timeframe</${d}><input class="input" type="text" id="trendTimeframe" value="24h" placeholder="5m / 1h / 6h / 24h" /></${d}>`,
  `          <${d} class="input-group"><${d} class="input-label">Varsayılan DEX Filtresi</${d}><input class="input" type="text" id="trendDex" value="all" placeholder="all / pumpfun / raydium" /></${d}>`,
  `          <${d} class="input-group"><${d} class="input-label">Varsayılan Sıralama</${d}><input class="input" type="text" id="trendSort" value="top" placeholder="top / gainers / new" /></${d}>`,
  `          <${d} class="input-group"><${d} class="input-label">Sayfa başına token</${d}><input class="input" type="number" id="trendPageSize" value="20" min="5" max="100" /></${d}>`,
  '          <button type="button" class="btn btn-primary btn-md trend-save-btn">Kaydet</button>',
  `        </${d}>`,
  `      </${d}>`,
  '      <p id="trendStatus" class="banner-admin-status" role="status" style="margin-top:12px"></p>',
  `    </${d}>`,
].join('\n');

const banner = [
  '    <!-- ══════════ BANNER (Mini App) ══════════ -->',
  `    <${d} class="page" id="page-banner">`,
  `      <${d} class="card" id="adminBannerRoot">`,
  `        <${d} class="section-hdr" style="margin-bottom:12px">`,
  `          <${d} class="card-title" style="margin:0">Mini App Banner</${d}>`,
  `          <${d} style="display:flex;align-items:center;gap:10px">`,
  '            <span style="font-size:11px;color:var(--muted)">Yayında</span>',
  '            <label class="toggle"><input type="checkbox" id="adminBannerEnabled" checked /><span class="toggle-slider"></span></label>',
  `          </${d}>`,
  `        </${d}>`,
  '        <p class="banner-admin-hint">Bilgisayar, tablet ve telefon için ayrı görsel. Yönetim yalnızca bu admin panelinden yapılır.</p>',
  `        <${d} class="banner-variant-tabs">`,
  '          <button type="button" class="banner-variant-tab active" data-variant="desktop">Bilgisayar<span class="banner-tab-size">1200×144</span></button>',
  '          <button type="button" class="banner-variant-tab" data-variant="tablet">Tablet<span class="banner-tab-size">768×120</span></button>',
  '          <button type="button" class="banner-variant-tab" data-variant="mobile">Telefon<span class="banner-tab-size">390×96</span></button>',
  `        </${d}>`,
  `        <${d} class="admin-banner-preview-wrap card" style="padding:0;overflow:hidden;margin-bottom:14px">`,
  '          <img id="adminBannerPreview" class="admin-banner-preview-img" alt="" />',
  `        </${d}>`,
  '        <label class="banner-studio-upload" id="adminBannerUploadLabel">📤 Bilgisayar görseli seç',
  '          <input type="file" id="adminBannerFile" accept="image/png,image/jpeg,image/webp,image/gif" />',
  '        </label>',
  `        <${d} class="banner-studio-row" style="margin-top:14px">`,
  '          <span>Kırpma (yatay)</span>',
  '          <input type="range" id="adminBannerPos" min="0" max="100" value="50" />',
  '          <span class="banner-pos-val" id="adminBannerPosVal">50%</span>',
  `        </${d}>`,
  '        <label class="input-group" style="margin-top:14px">',
  `          <${d} class="input-label">Tıklanınca açılacak link</${d}>`,
  '          <input class="input" type="url" id="adminBannerLink" placeholder="https://" />',
  '        </label>',
  '        <p id="adminBannerStatus" class="banner-admin-status" role="status"></p>',
  `        <${d} style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">`,
  '          <button type="button" class="btn btn-primary btn-md" id="adminBannerSave">Kaydet</button>',
  '          <button type="button" class="btn btn-ghost btn-md" id="adminBannerReload">Yenile</button>',
  `        </${d}>`,
  `      </${d}>`,
  `    </${d}>`,
].join('\n');

fs.writeFileSync(path.join(dir, 'settings-page.fragment.html'), settings);
fs.writeFileSync(path.join(dir, 'trend-page-mockup.fragment.html'), trend);
fs.writeFileSync(path.join(dir, 'banner-page.fragment.html'), banner);
console.log('ok', d);
