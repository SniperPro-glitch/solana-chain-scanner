'use strict';
const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '../public/admin/index.html');
const fragPath = path.join(__dirname, '../public/admin/trend-page.fragment.html');

let html = fs.readFileSync(indexPath, 'utf8');
const frag = fs.readFileSync(fragPath, 'utf8').trim();

const re = /<!-- ══════════ TREND AYARLARI ══════════ -->[\s\S]*?<div class="page" id="page-trending">[\s\S]*?<\/motion>\s*\n\s*\n\s*<!-- ══════════ BANNER/;
const re2 = /<!-- ══════════ TREND AYARLARI ══════════ -->[\s\S]*?<div class="page" id="page-trending">[\s\S]*?<\/div>\s*\n\s*\n\s*<!-- ══════════ BANNER/;

const bannerMarker = '<!-- ══════════ BANNER (Mini App)';
const start = html.indexOf('<!-- ══════════ TREND AYARLARI');
const end = html.indexOf(bannerMarker, start);
if (start < 0 || end < 0) throw new Error('markers not found');

html = html.slice(0, start) + frag + '\n\n\n    ' + html.slice(end);

if (!html.includes('admin-trending.js')) {
  html = html.replace(
    '<script src="admin-feed.js',
    '<script src="admin-trending.js?v=1"></script>\n<script src="admin-feed.js',
  );
}
html = html.replace(/admin-shell\.css\?v=\d+/, 'admin-shell.css?v=7');

fs.writeFileSync(indexPath, html, 'utf8');
console.log('injected trend page');
