'use strict';
const fs = require('fs');
const path = require('path');

const adminDir = path.join(__dirname, '..', 'public', 'admin');
const out = path.join(adminDir, 'index.html');
const d = 'di' + 'v';

function read(name) {
  return fs.readFileSync(path.join(adminDir, name), 'utf8').trim();
}

function replaceBlock(html, startMarker, endMarker, block) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`markers not found: ${startMarker} → ${endMarker}`);
  }
  return html.slice(0, start) + block + '\n\n' + html.slice(end);
}

const LOGIN = [
  `<${d} id="loginGate" class="login-gate">`,
  `  <${d} class="login-card">`,
  `    <${d} class="login-brand">`,
  `      <${d} class="brand-logo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg></${d}>`,
  `      <${d}><strong style="font-size:18px">SNIPER</strong><${d} style="font-size:11px;color:#758096;letter-spacing:1px">ADMIN PANEL</${d}></${d}>`,
  `    </${d}>`,
  '    <p class="login-hint" id="loginHint">Kullanıcı adı ve şifre</p>',
  `    <label class="input-group"><${d} class="input-label">Kullanıcı adı</${d}><input class="input" id="loginUser" autocomplete="username" /></label>`,
  `    <label class="input-group"><${d} class="input-label">Şifre</${d}><input class="input" id="loginPass" type="password" autocomplete="current-password" /></label>`,
  '    <button type="button" class="btn btn-primary btn-md" id="btnLogin" style="width:100%;margin-top:10px">Giriş yap</button>',
  `  </${d}>`,
  `</${d}>`,
].join('\n');

let html = fs.readFileSync(path.join(adminDir, 'index.mockup.html'), 'utf8');
html = html.replace(/<style>[\s\S]*?<\/style>/, '<link rel="stylesheet" href="admin-shell.css?v=9" />');
html = html.replace('<body>', `<body>${LOGIN}`);
html = html.replace(`<${d} class="layout">`, `<${d} class="layout hidden" id="appLayout">`);

html = html.replace(
  `<${d} class="layout hidden" id="appLayout">`,
  `<${d} class="layout hidden" id="appLayout">\n<button type="button" class="sidebar-backdrop" id="sidebarBackdrop" aria-hidden="true" tabindex="-1"></button>`,
);

html = html.replace('<aside class="sidebar">', '<aside class="sidebar" id="adminSidebar">');
html = html.replace("showPage('settings')\" style=\"display:none;\"", "showPage('settings')\"");
html = html.replace(
  '<button class="btn btn-primary btn-sm">+ Token Ekle</button>',
  '<button type="button" class="btn btn-primary btn-sm" id="btnAdminFeedAdd">+ Token Ekle</button>',
);

html = replaceBlock(
  html,
  '<!-- ══════════ TREND AYARLARI ══════════ -->',
  '<!-- ══════════ BANNER STÜDYOSU ══════════ -->',
  read('trend-page-mockup.fragment.html'),
);
html = replaceBlock(
  html,
  '<!-- ══════════ BANNER STÜDYOSU ══════════ -->',
  '<!-- ══════════ MİNİ APP AYARLARI ══════════ -->',
  read('banner-page.fragment.html'),
);
html = replaceBlock(
  html,
  '<!-- ══════════ AYARLAR (Genel) ══════════ -->',
  '<!-- ══════════ GÜVENLİK ══════════ -->',
  read('settings-page.fragment.html'),
);

const addToken = read('add-token-page.fragment.html');
const trendMarker = '<!-- ══════════ TREND AYARLARI (mockup) ══════════ -->';
const pos = html.indexOf(trendMarker);
if (pos < 0) throw new Error('trend marker missing');
html = `${html.slice(0, pos)}\n${addToken}\n\n${html.slice(pos)}`;

if (!html.includes('btnSidebarToggle')) {
  html = html.replace(
    /(<div class="topbar">\r?\n)\s*<div>\r?\n\s*<div class="topbar-title"/,
    `$1    <button type="button" class="sidebar-menu-btn" id="btnSidebarToggle" aria-label="Menüyü aç" aria-expanded="false" aria-controls="adminSidebar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
    </button>
    <div class="topbar-titles">
      <div class="topbar-title"`,
  );
  html = html.replace(
    /(<div class="topbar-subtitle" id="topbar-sub">[^<]*<\/div>)\r?\n\s*<\/div>(\r?\n\s*<div class="topbar-right">)/,
    `$1\n    </div>$2`,
  );
}

html = html.replace(
  /feed:\s*\{ title: 'Token Feed',[^}]+\},/,
  "feed:        { title: 'Token Feed',             sub: 'Feedteki tokenler' },\n  'add-token': { title: '+ Token Ekle',           sub: 'Yeni token feed listesine ekle' },",
);
html = html.replace(
  /banner:\s*\{ title: 'Banner Stüdyosu',[^}]+\},/,
  "banner:      { title: 'Mini App Banner',        sub: 'Bilgisayar · tablet · telefon görselleri' },",
);

html = html.replace(
  '</script>\n</body>',
  `</script>
<script src="admin-nav.js?v=2"></script>
<script src="admin-live.js?v=4"></script>
<script src="admin-banner.js?v=1"></script>
<script src="admin-settings.js?v=1"></script>
<script src="admin-trending.js?v=3"></script>
<script src="admin-feed.js?v=3"></script>
</body>`,
);

fs.writeFileSync(out, html, 'utf8');
const checks = [
  'adminSidebar', 'loginGate', 'trendWVolume', 'settingsUsername', 'adminBannerRoot', 'page-add-token', 'page-dashboard',
];
for (const k of checks) console.log(html.includes(k) ? '✓' : '✗', k);
console.log('lines', html.split('\n').length);
