// Birdeye trades — sunucu WebSocket köprüsü (x-api-key header, istemciye key sızdırmaz).

const { WebSocketServer, WebSocket } = require('ws');
const {
  getApiKey,
  buildTradesSubscribeMessage,
  normalizeBirdeyeTrade,
  BIRDEYE_WS_RELAY_PATH,
} = require('./birdeyeApi');

const WS_PATH = BIRDEYE_WS_RELAY_PATH;

function birdeyeUpstreamUrl() {
  const key = getApiKey();
  return `wss://public-api.birdeye.so/socket/solana?x-api-key=${encodeURIComponent(key)}`;
}

function birdeyeUpstreamHeaders() {
  const key = getApiKey();
  return {
    Origin: 'ws://public-api.birdeye.so',
    'Sec-WebSocket-Origin': 'ws://public-api.birdeye.so',
    'x-api-key': key,
    'x-chain': 'solana',
  };
}

function attachBirdeyeTradesWs(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    let pathname = '';
    try {
      pathname = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`).pathname;
    } catch {
      return;
    }
    if (pathname !== WS_PATH) return;

    wss.handleUpgrade(request, socket, head, (clientWs) => {
      const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
      const mint = String(url.searchParams.get('mint') || '').trim();
      bridgeBirdeyeTrades(clientWs, mint);
    });
  });

  return wss;
}

function bridgeBirdeyeTrades(clientWs, mint) {
  const key = getApiKey();
  if (!mint || !key) {
    try {
      clientWs.close(1008, 'birdeye_unconfigured');
    } catch {
      /* yoksay */
    }
    return;
  }

  let upstream = null;
  let closed = false;

  function shutdown() {
    if (closed) return;
    closed = true;
    try {
      upstream?.removeAllListeners?.();
      if (upstream?.readyState === WebSocket.OPEN) upstream.close();
    } catch {
      /* yoksay */
    }
    try {
      if (clientWs.readyState === WebSocket.OPEN) clientWs.close();
    } catch {
      /* yoksay */
    }
  }

  try {
    upstream = new WebSocket(birdeyeUpstreamUrl(), 'echo-protocol', {
      headers: birdeyeUpstreamHeaders(),
    });
  } catch (e) {
    console.warn('[birdeye-ws] upstream connect:', e.message);
    shutdown();
    return;
  }

  upstream.on('open', () => {
    try {
      upstream.send(JSON.stringify(buildTradesSubscribeMessage(mint)));
    } catch (e) {
      console.warn('[birdeye-ws] subscribe:', e.message);
    }
  });

  upstream.on('message', (raw) => {
    if (clientWs.readyState !== WebSocket.OPEN) return;
    try {
      const text = raw.toString();
      let msg;
      try {
        msg = JSON.parse(text);
      } catch {
        clientWs.send(text);
        return;
      }
      const t = String(msg?.type || '');
      if (t === 'TXS_DATA' || t === 'TRANSACTION_DATA' || t === 'TRANSACTION_EVENT') {
        const trade = normalizeBirdeyeTrade(msg.data, mint);
        if (trade) {
          clientWs.send(JSON.stringify({ type: 'SNIPER_TRADE', trade }));
          return;
        }
      }
      clientWs.send(text);
    } catch {
      /* yoksay */
    }
  });

  upstream.on('ping', () => {
    try {
      upstream.pong();
    } catch {
      /* yoksay */
    }
  });

  upstream.on('error', (e) => {
    console.warn('[birdeye-ws] upstream:', e.message);
  });

  upstream.on('close', () => {
    shutdown();
  });

  clientWs.on('message', () => {
    /* istemci → upstream: gerek yok */
  });

  clientWs.on('close', () => shutdown());
  clientWs.on('error', () => shutdown());
}

module.exports = {
  WS_PATH,
  attachBirdeyeTradesWs,
};
