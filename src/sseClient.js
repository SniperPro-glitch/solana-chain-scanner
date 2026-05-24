// TonAPI Server-Sent Events bağlantı yöneticisi.
// /v2/sse/accounts/transactions?accounts=<comma>
// - text/event-stream parser
// - heartbeat watchdog (60sn'de mesaj yoksa reconnect)
// - exponential backoff reconnect
// - graceful close

const https = require('https');
const { EventEmitter } = require('events');

const SSE_HOST = 'tonapi.io';
const SSE_PATH = '/v2/sse/accounts/transactions';

const HEARTBEAT_TIMEOUT_MS = 60_000;      // 60sn sessizlik → reconnect
const RECONNECT_BASE_MS = 2_000;
const RECONNECT_MAX_MS = 60_000;

class SseClient extends EventEmitter {
  /**
   * @param {Object} opts
   * @param {string[]} opts.accounts - İzlenecek hesap adresleri
   * @param {string} [opts.token] - TonAPI api key (opsiyonel, free tier'da gerekmez)
   * @param {string} [opts.operations] - 'JettonTransfer,...' filtresi (opsiyonel)
   */
  constructor({ accounts, token, operations } = {}) {
    super();
    if (!Array.isArray(accounts) || accounts.length === 0) {
      throw new Error('SseClient: accounts boş olamaz');
    }
    this.accounts = accounts;
    this.token = token || process.env.TONAPI_KEY || '';
    this.operations = operations || '';
    this.req = null;
    this.res = null;
    this.buffer = '';
    this.lastMessageAt = 0;
    this.reconnectAttempts = 0;
    this.watchdog = null;
    this.closed = false;
  }

  start() {
    this.closed = false;
    this._connect();
  }

  stop() {
    this.closed = true;
    if (this.watchdog) clearInterval(this.watchdog);
    this.watchdog = null;
    if (this.req) {
      try { this.req.destroy(); } catch (_) {}
    }
    this.req = null;
    this.res = null;
  }

  _backoffDelay() {
    const delay = Math.min(
      RECONNECT_MAX_MS,
      RECONNECT_BASE_MS * 2 ** Math.min(this.reconnectAttempts, 5),
    );
    // %25 jitter
    return delay + Math.random() * delay * 0.25;
  }

  _scheduleReconnect(reason) {
    if (this.closed) return;
    const delay = this._backoffDelay();
    this.reconnectAttempts++;
    this.emit('reconnect', { reason, delayMs: Math.round(delay), attempt: this.reconnectAttempts });
    setTimeout(() => {
      if (!this.closed) this._connect();
    }, delay);
  }

  _connect() {
    const params = new URLSearchParams({ accounts: this.accounts.join(',') });
    if (this.operations) params.set('operations', this.operations);
    if (this.token) params.set('token', this.token);
    const path = `${SSE_PATH}?${params.toString()}`;

    const headers = { Accept: 'text/event-stream', 'User-Agent': 'ton-chain-scanner/sse' };

    const req = https.request(
      { host: SSE_HOST, path, method: 'GET', headers, timeout: 0 },
      (res) => {
        if (res.statusCode !== 200) {
          this.emit('error', new Error(`SSE HTTP ${res.statusCode}`));
          res.resume();
          this._scheduleReconnect(`http_${res.statusCode}`);
          return;
        }
        this.reconnectAttempts = 0;
        this.res = res;
        this.lastMessageAt = Date.now();
        this.emit('open', { accounts: this.accounts.length });

        // Heartbeat watchdog
        if (this.watchdog) clearInterval(this.watchdog);
        this.watchdog = setInterval(() => {
          const idle = Date.now() - this.lastMessageAt;
          if (idle > HEARTBEAT_TIMEOUT_MS) {
            this.emit('stale', { idleMs: idle });
            try { res.destroy(); } catch (_) {}
          }
        }, 10_000);

        res.setEncoding('utf8');
        res.on('data', (chunk) => this._onData(chunk));
        res.on('end', () => {
          this.emit('close', { reason: 'end' });
          if (this.watchdog) clearInterval(this.watchdog);
          this._scheduleReconnect('end');
        });
        res.on('error', (err) => {
          this.emit('error', err);
          if (this.watchdog) clearInterval(this.watchdog);
          this._scheduleReconnect(`res_error_${err.code || 'unknown'}`);
        });
      },
    );

    req.on('error', (err) => {
      this.emit('error', err);
      this._scheduleReconnect(`req_error_${err.code || 'unknown'}`);
    });

    req.end();
    this.req = req;
  }

  _onData(chunk) {
    this.lastMessageAt = Date.now();
    this.buffer += chunk;

    // SSE: olaylar \n\n ile ayrılır
    let idx;
    while ((idx = this.buffer.indexOf('\n\n')) !== -1) {
      const block = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + 2);
      this._parseEvent(block);
    }
  }

  _parseEvent(block) {
    let eventName = 'message';
    const dataLines = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim());
      } else if (line === '' || line.startsWith(':')) {
        // boş satır veya yorum
      }
    }
    const rawData = dataLines.join('\n');

    if (eventName === 'heartbeat') {
      this.emit('heartbeat');
      return;
    }

    if (!rawData) return;

    let payload = rawData;
    try {
      payload = JSON.parse(rawData);
    } catch (_) {
      // bazı endpoint'ler düz string yollar — yine de geç
    }

    this.emit('message', { event: eventName, data: payload });
  }
}

module.exports = { SseClient };
