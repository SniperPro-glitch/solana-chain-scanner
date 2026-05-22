const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'public/admin/index.html');
const layoutPath = path.join(root, 'public/admin/support-page-layout.html');

let html = fs.readFileSync(indexPath, 'utf8');
const layout = fs.readFileSync(layoutPath, 'utf8').trimEnd();
const start = html.indexOf('  <!-- ========== CANLI DESTEK ========== -->');
const endMarker = '  </div><!-- /page-support -->';
const end = html.indexOf(endMarker, start);
if (start < 0 || end < 0) {
  console.error('markers not found', start, end);
  process.exit(1);
}
html = html.slice(0, start) + layout + '\n\n\n' + html.slice(end + endMarker.length);
if (!html.includes('admin-support-page.css')) {
  html = html.replace(
    '<link rel="stylesheet" href="admin-shell.css?v=10" />',
    '<link rel="stylesheet" href="admin-shell.css?v=10" />\n<link rel="stylesheet" href="admin-support-page.css?v=1" />',
  );
}
fs.writeFileSync(indexPath, html);
console.log('OK: page-support replaced');
