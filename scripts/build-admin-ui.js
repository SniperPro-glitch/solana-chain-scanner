// Desktop mockup → public/admin/index.html + admin-shell.css
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'public', 'admin', 'index.mockup.html');
const outHtml = path.join(__dirname, '..', 'public', 'admin', 'index.html');
const outCss = path.join(__dirname, '..', 'public', 'admin', 'admin-shell.css');

let html = fs.readFileSync(src, 'utf8');
const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
if (!styleMatch) throw new Error('style block missing');

const loginCss = `
.login-gate{min-height:100vh;display:grid;place-items:center;background:var(--bg);padding:24px;}
.login-gate .login-card{width:min(400px,100%);background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:28px;}
.login-gate .login-brand{display:flex;align-items:center;gap:12px;margin-bottom:16px;}
.login-gate .login-hint{font-size:12px;color:var(--muted);margin-bottom:14px;}
.login-gate .login-hint.err{color:var(--red);}
.layout.hidden{display:none!important;}
`;

fs.writeFileSync(outCss, `${styleMatch[1].trim()}\n${loginCss}`);

html = html.replace(/<style>[\s\S]*?<\/style>/, '<link rel="stylesheet" href="admin-shell.css?v=1" />');

const login = `<div id="loginGate" class="login-gate">
  <div class="login-card">
    <div class="login-brand">
      <div class="brand-logo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg></div>
      <div><strong style="font-size:18px">SNIPER</strong><div style="font-size:11px;color:#758096;letter-spacing:1px">ADMIN PANEL</div></div>
    </div>
    <p class="login-hint" id="loginHint">Kullanıcı adı ve şifre</p>
    <label class="input-group"><div class="input-label">Kullanıcı adı</div><input class="input" id="loginUser" autocomplete="username" /></label>
    <label class="input-group"><div class="input-label">Şifre</div><input class="input" id="loginPass" type="password" autocomplete="current-password" /></label>
    <button type="button" class="btn btn-primary btn-md" id="btnLogin" style="width:100%;margin-top:10px">Giriş yap</button>
  </div>
</div>`;

html = html.replace('<body>', `<body>${login}`);
html = html.replace('<div class="layout">', '<div class="layout hidden" id="appLayout">');

html = html.replace(
  '</script>\n</body>',
  '</script>\n<script src="admin-live.js?v=1"></script>\n</body>',
);

fs.writeFileSync(outHtml, html);
console.log('OK:', outHtml);
