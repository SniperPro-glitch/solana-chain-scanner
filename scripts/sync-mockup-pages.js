'use strict';
const fs = require('fs');
const path = require('path');
const d = ['d', 'i', 'v'].join('');

const indexPath = path.join(__dirname, '../public/admin/index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const trendPage = [
  '    <!-- ══════════ TREND AYARLARI (mockup) ══════════ -->',
  `    <${d} class="page" id="page-trending">`,
  `      <${d} class="grid-2">`,
  `        <${d} class="card">`,
  `          <${d} class="card-title">Algoritma Ağırlıkları</${d}>`,
  `          <${d} class="input-group"><${d} class="input-label">Hacim (VOL) Ağırlığı %</${d}><input class="input" type="number" id="trendWVolume" value="40" min="0" max="100" /></${d}>`,
  `          <${d} class="input-group"><${d} class="input-label">İşlem Sayısı (TXN) %</${d}><input class="input" type="number" id="trendWTxns" value="30" min="0" max="100" /></${d}>`,
  `          <${d} class="input-group"><${d} class="input-label">Holder Sayısı %</${d}><input class="input" type="number" id="trendWHolders" value="20" min="0" max="100" /></${d}>`,
  `          <${d} class="input-group"><${d} class="input-label">Fiyat Değişimi %</${d}><input class="input" type="number" id="trendWPrice" value="10" min="0" max="100" /></${d}>`,
  '          <p id="trendStatus" class="banner-admin-status" role="status"></p>',
  '          <button type="button" class="btn btn-primary btn-md" id="trendSave">Kaydet</button>',
  `        </${d}>`,
  `        <${d} class="card">`,
  `          <${d} class="card-title">Varsayılan Görünüm</${d}>`,
  `          <${d} class="input-group"><${d} class="input-label">Varsayılan Timeframe</${d}><input class="input" type="text" id="trendTimeframe" value="24h" placeholder="5m / 1h / 6h / 24h" /></${d}>`,
  `          <${d} class="input-group"><${d} class="input-label">Varsayılan DEX Filtresi</${d}><input class="input" type="text" id="trendDex" value="all" placeholder="all / pumpfun / raydium" /></${d}>`,
  `          <${d} class="input-group"><${d} class="input-label">Varsayılan Sıralama</${d}><input class="input" type="text" id="trendSort" value="top" placeholder="top / gainers / new" /></${d}>`,
  `          <${d} class="input-group"><${d} class="input-label">Sayfa başına token</${d}><input class="input" type="number" id="trendPageSize" value="20" min="5" max="100" /></${d}>`,
  `        </${d}>`,
  `      </${d}>`,
  `    </${d}>`,
].join('\n');

const settingsPage = [
  '    <!-- ══════════ AYARLAR (mockup admin_06) ══════════ -->',
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

html = html.replace(
  /<!--[^]*?TREND AYARLARI[^]*?-->\s*<div class="page" id="page-trending">[\s\S]*?<\/motion>\s*\n\s*\n\s*<!-- ══════════ BANNER/,
  trendPage + '\n\n\n    <!-- ══════════ BANNER',
);
html = html.replace(/<\/motion>/g, '</div>');

html = html.replace(
  /<!--[^]*?AYARLAR[^]*?-->\s*<div class="page" id="page-settings">[\s\S]*?<\/div>\s*\n\s*\n\s*<!-- ══════════ GÜVENLİK/,
  settingsPage + '\n\n\n    <!-- ══════════ GÜVENLİK',
);

html = html.replace(
  /<a class="nav-item" onclick="showPage\('settings'\)" style="display:none;">/,
  "<a class=\"nav-item\" onclick=\"showPage('settings')\">",
);

if (!html.includes('admin-settings.js')) {
  html = html.replace(
    '<script src="admin-trending.js',
    '<script src="admin-settings.js?v=1"></script>\n<script src="admin-trending.js',
  );
}
html = html.replace(/admin-trending\.js\?v=\d+/, 'admin-trending.js?v=2');
html = html.replace(/admin-shell\.css\?v=\d+/, 'admin-shell.css?v=8');

fs.writeFileSync(indexPath, html, 'utf8');
console.log('ok', html.includes('settingsUsername'), html.includes('trendWHolders'));
