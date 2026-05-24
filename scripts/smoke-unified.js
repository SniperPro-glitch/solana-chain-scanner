#!/usr/bin/env node
// Birleşik bot modül kontrolü (polling başlatmaz).

require('dotenv').config();

const chains = require('../src/chains');
const ids = Object.keys(chains.CHAINS);
console.log('[smoke] chains:', ids.join(', '));
for (const id of ids) {
  const c = chains.getChain(id);
  if (!c.scanNewTokens || !c.auditToken) throw new Error(`chain ${id} eksik arayüz`);
}
require('../src/poolDiscovery');
require('../src/chainRuntime');
require('../src/scanRunner');
console.log('[smoke] modüller OK');

const t = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
if (!t) {
  console.log('[smoke] BOT_TOKEN yok — getMe atlandı');
  process.exit(0);
}

const axios = require('axios');
axios.get(`https://api.telegram.org/bot${t}/getMe`)
  .then((r) => {
    const u = r.data?.result;
    if (!u) throw new Error(JSON.stringify(r.data));
    console.log(`[smoke] getMe OK @${u.username} (${u.id})`);
  })
  .catch((e) => {
    console.error('[smoke] getMe FAIL:', e.response?.data?.description || e.message);
    process.exit(1);
  });
