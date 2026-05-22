/**
 * Masaüstü SUPPORT/index.html → admin support-page-layout.html
 */
const fs = require('fs');
const path = require('path');

const supportPath = path.join('C:', 'Users', 'Asus', 'Desktop', 'SUPPORT', 'index.html');
const outPath = path.join(__dirname, '../public/admin/support-page-layout.html');

let src = fs.readFileSync(supportPath, 'utf8');
const start = src.indexOf('  <!-- ========== CANLI DESTEK ========== -->');
const end = src.indexOf('  </div><!-- /page-support -->', start);
if (start < 0 || end < 0) throw new Error('page-support not found in SUPPORT');

let block = src.slice(start, end + '  </div><!-- /page-support -->'.length);

// Demo ticket kartlarını kaldır — liste JS ile dolar
block = block.replace(
  /<div id="support-ticket-list"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*\n\s*<!-- MIDDLE/,
  '<div id="support-ticket-list" style="overflow-y:auto;flex:1;padding:8px;"></div>\n      </div>\n\n      <!-- MIDDLE',
);

// Demo mesajları kaldır
block = block.replace(
  /<div id="supMessages"[^>]*>[\s\S]*?<\/div>\s*<div class="sup-compose"/,
  '<div id="supMessages" style="flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:12px;"></div>\n          <div class="sup-compose"',
);
block = block.replace(
  /<div style="flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:12px;">[\s\S]*?<\/div>\s*\n\s*<!-- Input Area -->/,
  '<div id="supMessages" style="flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:12px;"></div>\n\n        <!-- Input Area -->',
);

// Hook IDs — arama, sekmeler, sayaçlar
block = block.replace(
  /<input type="text" placeholder="Kullanıcı veya mesaj ara\.\.\."[^>]*>/,
  '<input type="text" id="supSearch" placeholder="Kullanıcı veya mesaj ara..." style="width:100%;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 12px 8px 32px;color:var(--text);font-size:12px;font-family:\'Inter\',sans-serif;outline:none;">',
);

block = block.replace(
  /<span style="width:6px;height:6px[^>]*><\/span> 12 Aktif/,
  '<span style="width:6px;height:6px;border-radius:50%;background:var(--green);display:inline-block;animation:spulse 1.5s infinite;"></span> <span id="supActiveCount">0</span> Aktif',
);

// Tabs → buttons with ids
block = block.replace(
  /<!-- Tabs -->[\s\S]*?<!-- Ticket List -->/,
  `<!-- Tabs -->
        <div id="supTabs" style="display:flex;border-bottom:1px solid var(--border);flex-shrink:0;">
          <button type="button" class="sup-tab-btn active" data-tab="open" style="flex:1;text-align:center;padding:9px 4px;font-size:11px;font-weight:600;color:var(--green);border:none;border-bottom:2px solid var(--green);background:transparent;cursor:pointer;font-family:inherit;">Açık <span id="supCountOpen" style="background:rgba(0,255,136,0.15);color:var(--green);border-radius:10px;padding:1px 6px;font-size:10px;">0</span></button>
          <button type="button" class="sup-tab-btn" data-tab="waiting" style="flex:1;text-align:center;padding:9px 4px;font-size:11px;font-weight:600;color:var(--muted);border:none;border-bottom:2px solid transparent;background:transparent;cursor:pointer;font-family:inherit;">Bekleyen <span id="supCountWaiting" style="background:var(--surface2);border-radius:10px;padding:1px 6px;font-size:10px;">0</span></button>
          <button type="button" class="sup-tab-btn" data-tab="resolved" style="flex:1;text-align:center;padding:9px 4px;font-size:11px;font-weight:600;color:var(--muted);border:none;border-bottom:2px solid transparent;background:transparent;cursor:pointer;font-family:inherit;">Çözüldü <span id="supCountResolved" style="background:var(--surface2);border-radius:10px;padding:1px 6px;font-size:10px;">0</span></button>
        </div>

        <!-- Ticket List -->`,
);

// Chat area hooks
block = block.replace(/CT\n            <span style="position:absolute;bottom:0;right:0;width:10px/, '—\n            <span id="supChatOnlineDot" style="position:absolute;bottom:0;right:0;width:10px');
block = block.replace(
  /<div style="width:40px;height:40px;border-radius:50%;background:rgba\(0,255,136,0\.12\)[^>]*>[\s\S]*?<\/div>\s*<div style="flex:1;">\s*<div style="font-size:14px;font-weight:700[^>]*>[\s\S]*?<\/div>\s*<div style="font-size:11px;color:var\(--muted\);margin-top:1px;">[^<]*<\/div>/,
  `<div id="supChatAvatar" style="width:40px;height:40px;border-radius:50%;background:rgba(0,255,136,0.12);color:var(--green);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;flex-shrink:0;position:relative;">—
            <span id="supChatOnlineDot" style="position:absolute;bottom:0;right:0;width:10px;height:10px;border-radius:50%;background:var(--green);border:2px solid var(--bg2);"></span>
          </div>
          <div style="flex:1;">
            <div id="supChatTitle" style="font-size:14px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:8px;flex-wrap:wrap;">Konuşma seçin</div>
            <div id="supChatSub" style="font-size:11px;color:var(--muted);margin-top:1px;">—</div>`,
);

block = block.replace(
  /<div style="font-size:11px;color:var\(--muted\);line-height:1\.5;">Kullanıcı token tarama[^<]*<\/div>/,
  '<div id="supAiSummary" style="font-size:11px;color:var(--muted);line-height:1.5;">—</div>',
);
block = block.replace(
  /<div style="margin:12px 20px;background:linear-gradient/,
  '<div id="supAiBox" style="margin:12px 20px;background:linear-gradient',
);

// Compose
block = block.replace(
  /<textarea placeholder="Mesajınızı yazın\.\.\." rows="3"[^>]*><\/textarea>/,
  '<textarea id="supReplyInput" placeholder="Mesajınızı yazın..." rows="3" style="width:100%;background:transparent;border:none;outline:none;color:var(--text);font-size:12px;font-family:\'Inter\',sans-serif;resize:none;line-height:1.6;"></textarea>',
);
block = block.replace(
  /<button style="display:flex;align-items:center;gap:8px;background:var\(--green\);[^>]*>Gönder ➤<\/button>/,
  '<button type="button" id="supSendBtn" style="display:flex;align-items:center;gap:8px;background:var(--green);color:#000;border:none;border-radius:8px;padding:8px 18px;font-size:12px;font-weight:700;cursor:pointer;font-family:\'Inter\',sans-serif;">Gönder ➤</button>',
);

// Compose tabs
block = block.replace(
  /<div style="padding:9px 16px;font-size:11px;font-weight:600;color:var\(--green\);border-bottom:2px solid var\(--green\);cursor:pointer;">Yanıtla<\/div>/,
  '<button type="button" class="sup-compose-tab active" data-compose="reply" style="padding:9px 16px;font-size:11px;font-weight:600;color:var(--green);border:none;border-bottom:2px solid var(--green);background:transparent;cursor:pointer;font-family:inherit;">Yanıtla</button>',
);
block = block.replace(
  /<div style="padding:9px 16px;font-size:11px;font-weight:600;color:var\(--muted\);border-bottom:2px solid transparent;cursor:pointer;">İç Not<\/div>/,
  '<button type="button" class="sup-compose-tab" data-compose="note" style="padding:9px 16px;font-size:11px;font-weight:600;color:var(--muted);border:none;border-bottom:2px solid transparent;background:transparent;cursor:pointer;font-family:inherit;">İç Not</button>',
);

// Right panel hooks
block = block.replace(
  /<div style="width:56px;height:56px;border-radius:50%;background:rgba\(0,255,136,0\.1\)[^>]*>CT<\/div>/,
  '<div id="supPanelAvatar" style="width:56px;height:56px;border-radius:50%;background:rgba(0,255,136,0.1);color:var(--green);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;margin:0 auto 10px;border:2px solid rgba(0,255,136,0.25);">—</div>',
);
block = block.replace(
  /<div style="font-size:14px;font-weight:700;color:var\(--text\);margin-bottom:4px;">@CryptoHunter<\/div>/,
  '<div id="supPanelName" style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:4px;">—</div>',
);
block = block.replace(
  /<div style="font-size:11px;color:var\(--muted\);">Telegram ID: 123456789<\/div>/,
  '<div id="supPanelTg" style="font-size:11px;color:var(--muted);">—</div>',
);
block = block.replace(
  /<div style="display:flex;justify-content:center;gap:5px;margin-top:8px;flex-wrap:wrap;">[\s\S]*?<\/div>\s*<\/div>\s*\n\n        <!-- User Info -->/,
  '<div id="supPanelTags" style="display:flex;justify-content:center;gap:5px;margin-top:8px;flex-wrap:wrap;"></div>\n        </div>\n\n        <!-- User Info -->',
);

// User info → dynamic container
block = block.replace(
  /<!-- User Info -->[\s\S]*?<!-- Ticket Details -->/,
  `<!-- User Info -->
        <div style="padding:14px 16px;border-bottom:1px solid var(--border);">
          <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.7px;margin-bottom:10px;">👤 Kullanıcı Bilgileri</div>
          <div id="supUserKv"></div>
        </div>

        <!-- Ticket Details -->`,
);

// Selects
block = block.replace(
  /<select style="width:100%;background:var\(--surface\);border:1px solid var\(--border\);border-radius:7px;padding:6px 10px;color:var\(--text\);font-family:'Inter',sans-serif;font-size:11px;outline:none;"><option>Token Data Issue<\/option>/,
  '<select id="supSelCategory" style="width:100%;background:var(--surface);border:1px solid var(--border);border-radius:7px;padding:6px 10px;color:var(--text);font-family:\'Inter\',sans-serif;font-size:11px;outline:none;"><option value="general">Genel</option><option value="technical">Teknik</option><option value="token">Token Data Issue</option>',
);
block = block.replace(
  /<select style="width:100%;[^>]*><option>🔴 Yüksek<\/option>/,
  '<select id="supSelPriority" style="width:100%;background:var(--surface);border:1px solid var(--border);border-radius:7px;padding:6px 10px;color:var(--text);font-family:\'Inter\',sans-serif;font-size:11px;outline:none;"><option value="high">🔴 Yüksek</option><option value="normal">🟡 Orta</option><option value="low">🟢 Düşük</option></select></div>\n          <div style="margin-bottom:8px;"><div style="font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Durum</div><select id="supSelStatus" style="width:100%;background:var(--surface);border:1px solid var(--border);border-radius:7px;padding:6px 10px;color:var(--text);font-family:\'Inter\',sans-serif;font-size:11px;outline:none;"><option value="open">🟢 Açık</option><option value="waiting">⏳ Bekliyor</option><option value="active">💬 Aktif</option><option value="resolved">✅ Çözüldü</option><option value="closed">✕ Kapalı</option></select></div>\n          <div style="display:flex;justify-content:space-between;padding:5px 0;"><span style="font-size:11px;color:var(--muted);">Oluşturulma</span><span id="supTicketCreated" style="font-size:11px;font-weight:600;color:var(--text);font-family:\'JetBrains Mono\',monospace;">—</span></div>\n        </div>\n\n        <!-- User Activity -->\n        <div style="padding:14px 16px;border-bottom:1px solid var(--border);">\n          <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.7px;margin-bottom:10px;">📊 Kullanıcı Aktivitesi</div>\n          <div id="supUserActivity"></div>\n        </div>\n\n        <!-- PLACEHOLDER_REMOVE',
);
// Clean botched replace - do simpler file write instead

fs.writeFileSync(outPath, block);
console.log('Wrote', outPath, block.length);
