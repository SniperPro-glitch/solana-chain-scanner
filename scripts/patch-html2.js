const fs = require('fs');
const p = require('path').join(__dirname, '..', 'public', 'miniapp', 'index.html');
let h = fs.readFileSync(p, 'utf8');

h = h.replace(
  `<div class="search-row">
      <div class="search-box">
        <span class="search-ico">⌕</span>
        <input type="text" placeholder="Search token, pair or contract…" disabled />
      </div>
      <button type="button" class="btn-filter" aria-label="Filtre">☰</button>
    </motion>`,
  `<div class="search-row">
      <div class="search-box">
        <span class="search-ico">⌕</span>
        <input type="text" placeholder="Search token, pair or contract" disabled />
        <button type="button" class="search-filter" aria-label="Filtre">☰</button>
      </div>
    </div>`.replace(/motion/g, 'div'),
);

h = h.replace(
  `<div class="token-table-wrap">
      <div class="token-thead">
        <span>#</span><span>TOKEN / PAIR</span><span>PRICE</span><span>1H</span><span>24H</span><span>RISK</span>
      </div>
      <div class="feed-loading hidden" id="feedLoading">Liste yükleniyor…</div>
      <div class="token-list" id="homeTokenList"></div>
    </div>`,
  `<motion class="token-table-scroll">
      <div class="token-table-inner">
        <div class="token-thead">
          <span>#</span><span>TOKEN / PAIR</span><span>PRICE</span><span>1H %</span><span>24H %</span><span>VOL 24H</span><span>LIQUIDITY</span><span>RISK</span>
        </div>
        <div class="feed-loading hidden" id="feedLoading">Liste yükleniyor…</div>
        <div class="token-list" id="homeTokenList"></div>
      </div>
    </div>`.split('motion').join('motion').replace(/motion/g, 'div'),
);

h = h.replace(/\n        <div class="chain-scroll">/, '\n    <div class="chain-scroll">');

fs.writeFileSync(p, h);
console.log('html2 ok', h.includes('token-table-scroll'));
