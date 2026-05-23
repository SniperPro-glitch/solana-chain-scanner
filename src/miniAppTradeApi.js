/** Mini App — Jupiter swap proxy + cüzdan bakiye (CORS bypass). */

const axios = require('axios');

const JUP_QUOTE = 'https://quote-api.jup.ag/v6/quote';
const JUP_SWAP = 'https://quote-api.jup.ag/v6/swap';
const RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

const http = axios.create({
  timeout: 28_000,
  headers: { Accept: 'application/json', 'User-Agent': 'solana-chain-scanner/miniapp-trade' },
});

async function jupiterQuote(params) {
  const { data } = await http.get(JUP_QUOTE, { params });
  return data;
}

async function jupiterSwap(body) {
  const { data } = await http.post(JUP_SWAP, body, {
    headers: { 'Content-Type': 'application/json' },
  });
  return data;
}

async function solBalance(pubkey) {
  const { data } = await http.post(RPC, {
    jsonrpc: '2.0',
    id: 1,
    method: 'getBalance',
    params: [pubkey],
  });
  const lamports = data?.result?.value;
  if (lamports == null) throw new Error('Bakiye okunamadı');
  return { lamports, sol: lamports / 1e9 };
}

async function splTokenBalance(pubkey, mint) {
  const { data } = await http.post(RPC, {
    jsonrpc: '2.0',
    id: 1,
    method: 'getTokenAccountsByOwner',
    params: [pubkey, { mint }, { encoding: 'jsonParsed' }],
  });
  const accounts = data?.result?.value || [];
  let total = 0n;
  let decimals = 6;
  for (const acc of accounts) {
    const info = acc?.account?.data?.parsed?.info;
    const ta = info?.tokenAmount;
    if (!ta) continue;
    if (ta.decimals != null) decimals = Number(ta.decimals);
    try {
      total += BigInt(String(ta.amount || '0'));
    } catch {
      /* yoksay */
    }
  }
  const ui = Number(total) / 10 ** decimals;
  return {
    mint,
    amount: total.toString(),
    uiAmount: ui,
    decimals,
  };
}

async function tokenDecimals(mint) {
  try {
    const { data } = await http.get(`https://lite-api.jup.ag/tokens/v2/search?query=${mint}`, { timeout: 12_000 });
    const hit = Array.isArray(data) ? data.find((t) => t.id === mint) : null;
    if (hit?.decimals != null) return { decimals: Number(hit.decimals) };
  } catch {
    /* yedek */
  }
  try {
    const { data } = await http.get(`https://tokens.jup.ag/token/${mint}`, { timeout: 10_000 });
    if (data?.decimals != null) return { decimals: Number(data.decimals) };
  } catch {
    /* yoksay */
  }
  return { decimals: 6 };
}

/**
 * @returns {boolean} istek işlendiyse true
 */
async function handleTradeApi(req, res, url, { sendJson, readBody }) {
  if (url.pathname === '/api/jupiter/quote' && req.method === 'GET') {
    try {
      const inputMint = url.searchParams.get('inputMint');
      const outputMint = url.searchParams.get('outputMint');
      const amount = url.searchParams.get('amount');
      const slippageBps = url.searchParams.get('slippageBps') || '100';
      if (!inputMint || !outputMint || !amount) {
        sendJson(res, 400, { error: 'missing_params' });
        return true;
      }
      const data = await jupiterQuote({ inputMint, outputMint, amount, slippageBps });
      sendJson(res, 200, data);
    } catch (e) {
      const msg = e.response?.data?.error || e.message;
      sendJson(res, 502, { error: 'jupiter_quote_failed', message: String(msg) });
    }
    return true;
  }

  if (url.pathname === '/api/jupiter/swap' && req.method === 'POST') {
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw.toString('utf8') || '{}');
      const data = await jupiterSwap(body);
      sendJson(res, 200, data);
    } catch (e) {
      const msg = e.response?.data?.error || e.message;
      sendJson(res, 502, { error: 'jupiter_swap_failed', message: String(msg) });
    }
    return true;
  }

  if (url.pathname === '/api/wallet/balance' && req.method === 'GET') {
    const pk = url.searchParams.get('pubkey');
    if (!pk) {
      sendJson(res, 400, { error: 'missing_pubkey' });
      return true;
    }
    try {
      const bal = await solBalance(pk);
      sendJson(res, 200, bal);
    } catch (e) {
      sendJson(res, 502, { error: 'balance_failed', message: e.message });
    }
    return true;
  }

  if (url.pathname === '/api/wallet/token-balance' && req.method === 'GET') {
    const pk = url.searchParams.get('pubkey');
    const mint = url.searchParams.get('mint');
    if (!pk || !mint) {
      sendJson(res, 400, { error: 'missing_params' });
      return true;
    }
    try {
      const bal = await splTokenBalance(pk, mint);
      sendJson(res, 200, bal);
    } catch (e) {
      sendJson(res, 502, { error: 'token_balance_failed', message: e.message });
    }
    return true;
  }

  if (url.pathname === '/api/token/decimals' && req.method === 'GET') {
    const mint = url.searchParams.get('mint');
    if (!mint) {
      sendJson(res, 400, { error: 'missing_mint' });
      return true;
    }
    try {
      const data = await tokenDecimals(mint);
      sendJson(res, 200, data);
    } catch (e) {
      sendJson(res, 502, { error: 'decimals_failed', message: e.message });
    }
    return true;
  }

  return false;
}

module.exports = { handleTradeApi };
