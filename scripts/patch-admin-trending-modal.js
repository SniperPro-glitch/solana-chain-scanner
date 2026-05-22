const fs = require('fs');
const p = require('path').join(__dirname, '../public/admin/admin-trending.js');
let s = fs.readFileSync(p, 'utf8');
const start = '  async function trendSearch(val) {';
const end = '  function trendFilterNet(el, net) {';
const i = s.indexOf(start);
const j = s.indexOf(end);
if (i < 0 || j < 0) {
  console.error('markers not found', i, j);
  process.exit(1);
}
const block = `  function trendRowsToPickTokens(rows) {
    return (rows || [])
      .filter((r) => !r.hidden)
      .map((r) => ({
        token_id: r.mint,
        sym: r.symbol,
        net: 'SOL',
        dex: r.pair,
        risk: r.risk,
        change: r.change24h,
        inTrend: true,
        trendRank: r.rank,
        trendId: r.id,
      }));
  }

  function renderModalTokenList(query) {
    const q = String(query || '').trim();
    const list = $('trend-token-list');
    if (!list) return;
    if (!q) {
      const tokens = trendRowsToPickTokens(state.trendOnList);
      if (!tokens.length) {
        state.modalListHeader = '';
        list.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-size:12px;">Trend listesi boş. Mint veya sembol arayıp ekleyin.</div>';
        return;
      }
      state.modalListHeader = \`<div class="trend-list-header" style="font-size:10px;font-weight:700;color:var(--green);padding:6px 4px 10px;">Şu an trend listesinde (\${tokens.length})</div>\`;
      renderTrendList(tokens);
      return;
    }
    if (q.length < 2) {
      state.modalListHeader = '';
      list.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-size:12px;">En az 2 karakter (sembol veya mint)</div>';
      return;
    }
    runTokenSearch(q);
  }

  async function runTokenSearch(q) {
    const list = $('trend-token-list');
    if (!list) return;
    state.modalListHeader = '';
    list.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-size:12px;">Aranıyor…</div>';
    try {
      const data = await window.SniperAdminApi(
        \`/api/admin/tokens?search=\${encodeURIComponent(q)}&net=\${encodeURIComponent(state.trendNetFilter)}\`,
      );
      const tokens = data.tokens || [];
      state.modalListHeader = \`<div class="trend-list-header" style="font-size:10px;font-weight:700;color:var(--cyan);padding:6px 4px 10px;">Arama: "\${esc(q)}" (\${tokens.length})</div>\`;
      renderTrendList(tokens);
    } catch (e) {
      list.innerHTML = \`<div style="text-align:center;padding:32px;color:var(--red);font-size:12px;">\${esc(e.message)}</div>\`;
    }
  }

  function trendSearch(val) {
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(() => {
      renderModalTokenList(String(val || '').trim());
    }, 280);
  }

  window.trendSearch = trendSearch;

  function renderTrendList(tokens) {
    const list = $('trend-token-list');
    if (!list) return;
    state.lastModalTokens = tokens || [];
    if (!tokens.length) {
      list.innerHTML = state.modalListHeader
        || '<div style="text-align:center;padding:32px;color:var(--muted);font-size:12px;">Token bulunamadı</div>';
      return;
    }
    const RISK_COLOR = { LOW: 'var(--green)', MED: 'var(--yellow)', HIGH: 'var(--red)' };
    const rowsHtml = tokens.map((t) => {
      const isSel = state.trendSelToken && state.trendSelToken.token_id === t.token_id;
      const rk = String(t.risk || '').split(' ')[0];
      const rc = RISK_COLOR[rk] || 'var(--muted)';
      const trendBadge = t.inTrend
        ? \`<span style="margin-left:6px;font-size:9px;font-weight:700;color:var(--green);border:1px solid rgba(0,255,136,.35);border-radius:4px;padding:1px 5px;">Trend: \${esc(t.trendRank)}</span>\`
        : '';
      const chg = String(t.change || '');
      return \`<div class="trend-pick-row" data-id="\${esc(t.token_id)}" style="display:flex;align-items:center;gap:12px;padding:9px 12px;border-radius:9px;cursor:pointer;border:1px solid \${isSel ? 'rgba(0,255,136,.4)' : 'transparent'};background:\${isSel ? 'rgba(0,255,136,.06)' : 'rgba(255,255,255,.02)'};">
        <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,rgba(0,255,136,.2),rgba(0,229,255,.1));display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--green);">\${esc((t.sym || '?').charAt(0))}</div>
        <div style="flex:1;min-width:0;"><div style="font-size:12px;font-weight:700;">\${esc(t.sym)}\${trendBadge}</div><div style="font-size:10px;color:var(--muted);">◎ \${esc(t.net)} · \${esc(t.dex)}</div></div>
        <div style="text-align:right;"><motion style="font-size:11px;font-weight:700;color:\${chg.startsWith('+') ? 'var(--green)' : 'var(--red)'};">\${esc(t.change)}</div><div style="font-size:10px;color:\${rc};">\${esc(t.risk)}</div></div>
      </div>\`;
    }).join('');
    list.innerHTML = state.modalListHeader + rowsHtml;

    qsa('.trend-pick-row', list).forEach((row) => {
      row.addEventListener('click', () => selectTrendToken(row.dataset.id));
    });
  }

  function selectTrendToken(tokenId) {
    const tokens = state.lastModalTokens || [];
    state.trendSelToken = tokens.find((t) => t.token_id === tokenId) || { token_id: tokenId, sym: tokenId.slice(0, 4) };
    $('trend-selected-area').style.display = 'flex';
    $('trend-sel-avatar').textContent = (state.trendSelToken.sym || '?').charAt(0);
    $('trend-sel-sym').textContent = state.trendSelToken.sym || tokenId.slice(0, 8);
    updateTrendAddBtn(true);
    updateAddBtnLabel();
    renderTrendList(tokens);
  }

`;
s = s.slice(0, i) + block + s.slice(j);
s = s.replace(/<motion\b/g, '<div').replace(/<\/motion>/g, '</div>');
fs.writeFileSync(p, s);
console.log('patched', p);
