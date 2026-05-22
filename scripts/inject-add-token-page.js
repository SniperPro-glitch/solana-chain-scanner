'use strict';
const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '../public/admin/index.html');
const fragPath = path.join(__dirname, '../public/admin/add-token-page.fragment.html');
const t = ['d', 'i', 'v'].join('');

let html = fs.readFileSync(indexPath, 'utf8');
const frag = fs.readFileSync(fragPath, 'utf8');
const trendMarker = '    <!-- ══════════ TREND AYARLARI ══════════ -->';

if (html.includes('id="page-add-token"')) {
  const re = new RegExp(
    '<!-- TOKEN EKLE[\\s\\S]*?id="page-add-token"[\\s\\S]*?</' + t + '>\\s*\\n\\s*\\n\\s*' + trendMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  );
  html = html.replace(re, frag.trim() + '\n\n\n' + trendMarker);
  console.log('Replaced page-add-token');
} else {
  const idx = html.indexOf(trendMarker);
  if (idx < 0) throw new Error('trend marker not found');
  const insertAt = idx;
  html = html.slice(0, insertAt) + frag.trim() + '\n\n\n    ' + html.slice(insertAt);
  console.log('Injected page-add-token');
}

if (!html.includes("'add-token'")) {
  html = html.replace(
    "feed:        { title: 'Token Feed',             sub: 'Feedteki tokenler' },",
    "feed:        { title: 'Token Feed',             sub: 'Feedteki tokenler' },\n  'add-token': { title: '+ Token Ekle',           sub: 'Yeni token feed listesine ekle' },",
  );
}

const modalRe = /\n<div id="adminFeedModal"[\s\S]*?<\/div>\n\n<script src="admin-live/;
if (modalRe.test(html)) {
  html = html.replace(modalRe, '\n\n<script src="admin-live');
  console.log('Removed adminFeedModal');
}

html = html.replace(/admin-feed\.js\?v=\d+/, 'admin-feed.js?v=2');
html = html.replace(/admin-shell\.css\?v=\d+/, 'admin-shell.css?v=4');

fs.writeFileSync(indexPath, html, 'utf8');
console.log('Done');
