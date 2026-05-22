const fs = require('fs');
const p = 'public/miniapp/index.html';
let s = fs.readFileSync(p, 'utf8');

const replacement = [
  '        <div class="feed-tf-dropdown" id="feedTfDropdown">',
  '          <button type="button" class="feed-tf-trigger" id="feedTfTrigger" aria-expanded="false" aria-haspopup="listbox" aria-controls="feedTfMenu">',
  '            <svg class="feed-tf-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  '            <span class="feed-tf-trigger-label" id="feedTfTriggerLabel">Last 24 hours</span>',
  '            <svg class="feed-tf-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  '          </button>',
  '          <div class="feed-tf-menu hidden" id="feedTfMenu" role="listbox" aria-label="Zaman dilimi">',
  '            <button type="button" class="feed-tf-option" role="option" data-tf="5m"><span class="feed-tf-check" aria-hidden="true">✓</span>Last 5 minutes</button>',
  '            <button type="button" class="feed-tf-option" role="option" data-tf="1h"><span class="feed-tf-check" aria-hidden="true">✓</span>Last hour</button>',
  '            <button type="button" class="feed-tf-option" role="option" data-tf="6h"><span class="feed-tf-check" aria-hidden="true">✓</span>Last 6 hours</button>',
  '            <button type="button" class="feed-tf-option active" role="option" data-tf="24h"><span class="feed-tf-check" aria-hidden="true">✓</span>Last 24 hours</button>',
  '          </div>',
  '        </div>',
].join('\n');

const re = /        <div class="feed-tf-group"[\s\S]*?        <\/div>\n/;
if (!re.test(s)) {
  console.error('block not found');
  process.exit(1);
}
s = s.replace(re, `${replacement}\n`);
fs.writeFileSync(p, s);
console.log('ok');
