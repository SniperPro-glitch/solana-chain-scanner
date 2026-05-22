'use strict';
const fs = require('fs');
const path = require('path');

const srcHtml = path.join('C:', 'Users', 'Asus', 'Desktop', 'trend cursor', 'trend_page.html');
const indexPath = path.join(__dirname, '..', 'public', 'admin', 'index.html');
const outFragment = path.join(__dirname, '..', 'public', 'admin', 'trend-page-admin.fragment.html');

let h = fs.readFileSync(srcHtml, 'utf8');

const start = h.indexOf('<motion class="content">');
const startDiv = h.indexOf('<div class="content">');
const contentOpen = startDiv >= 0 ? startDiv : start;
if (contentOpen < 0) throw new Error('content block not found');

const openTag = h.slice(contentOpen, contentOpen + 30);
const openLen = openTag.startsWith('<div') ? '<div class="content">'.length : '<motion class="content">'.length;
const end = h.indexOf('<!-- ========== TREND EKLE MODAL');
if (end < 0) throw new Error('modal marker not found');

let inner = h.slice(contentOpen + openLen, end).trim();
if (inner.endsWith('</div>')) inner = inner.slice(0, -6).trim();

inner = inner.replace(
  /<tbody>[\s\S]*?<\/tbody>/,
  '<tbody id="trendTableBody"><tr><td colspan="11" style="color:var(--muted);text-align:center;padding:24px;">Yükleniyor…</td></tr></tbody>',
);

inner = inner.replace(
  /<button[^>]*openTrendModal\(\)[^>]*>\+ Manuel Ekle<\/button>/,
  '<button type="button" id="trendBtnManualAdd" class="btn btn-primary btn-sm">+ Manuel Ekle</button>',
);

inner = inner.replace(/<select style="background:var\(--surface\)/, '<select id="trendChainFilter" style="background:var(--surface)');

const modalStart = h.indexOf('<!-- ========== TREND EKLE MODAL');
const modalEnd = h.indexOf('<script>', modalStart);
let modal = h.slice(modalStart, modalEnd).trim();
modal = modal.replace(/\s+onclick="[^"]*"/g, '');
modal = modal.replace(/\s+oninput="[^"]*"/g, '');
modal = modal.replace(/\s+onfocus="[^"]*"/g, '');
modal = modal.replace(/\s+onblur="[^"]*"/g, '');

const fragment = `    <!-- ══════════ TREND AYARLARI (trend cursor) ══════════ -->
    <motion class="page" id="page-trending">
${inner}

${modal}
      <p id="trendStatus" class="banner-admin-status" role="status" style="margin:8px 0 0"></p>
    </div>
`.replace(/<\/?motion\b[^>]*>/gi, (t) => (t.startsWith('</') ? '</div>' : '<motion class="page" id="page-trending">'.replace('motion', 'motion'))).replace(/<motion class="page" id="page-trending">/g, '<div class="page" id="page-trending">');

let index = fs.readFileSync(indexPath, 'utf8');
const mStart = index.indexOf('<!-- ══════════ TREND AYARLARI');
const mEnd = index.indexOf('<!-- ══════════ BANNER');
if (mStart < 0 || mEnd < 0) throw new Error('index markers missing');
index = index.slice(0, mStart) + fragment.trim() + '\n\n' + index.slice(mEnd);
fs.writeFileSync(outFragment, fragment);
fs.writeFileSync(indexPath, index);
console.log('OK', outFragment);
