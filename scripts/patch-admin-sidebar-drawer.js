'use strict';
const fs = require('fs');
const path = require('path');
const d = ['d', 'i', 'v'].join('');
const htmlPath = path.join(__dirname, '../public/admin/index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

if (!html.includes('btnSidebarToggle')) {
  const re = /(<div class="topbar">\r?\n)\s*<div>\r?\n\s*<div class="topbar-title"/;
  const repl = `$1    <button type="button" class="sidebar-menu-btn" id="btnSidebarToggle" aria-label="Menüyü aç" aria-expanded="false" aria-controls="adminSidebar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
    </button>
    <${d} class="topbar-titles">
      <${d} class="topbar-title"`;
  if (!re.test(html)) throw new Error('topbar regex miss');
  html = html.replace(re, repl);
  html = html.replace(
    /(<div class="topbar-subtitle" id="topbar-sub">Sistem genel bakış<\/div>)\r?\n\s*<\/div>(\r?\n\s*<div class="topbar-right">)/,
    `$1\n    </${d}>$2`,
  );
}

html = html.replace(/admin-shell\.css\?v=\d+/, 'admin-shell.css?v=6');
html = html.replace(/admin-nav\.js\?v=\d+/, 'admin-nav.js?v=2');
fs.writeFileSync(htmlPath, html, 'utf8');
console.log('btnSidebarToggle:', html.includes('btnSidebarToggle'));
