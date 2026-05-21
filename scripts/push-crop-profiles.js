const fs = require('fs');
const https = require('https');
const path = require('path');

const file = path.join(__dirname, '..', 'public', 'miniapp', 'dex-crop-profiles.json');
const j = JSON.parse(fs.readFileSync(file, 'utf8'));
const body = JSON.stringify({ version: 1, profiles: j.profiles });

require('dotenv').config();
const cropKey = String(process.env.CROP_PUBLISH_KEY || process.env.MINI_APP_CROP_KEY || '').trim();
const headers = {
  'Content-Type': 'application/json',
  'Content-Length': Buffer.byteLength(body),
};
if (cropKey) headers['x-crop-key'] = cropKey;

const req = https.request(
  {
    hostname: 'solana-chain-scanner-production.up.railway.app',
    path: '/api/crop-profiles',
    method: 'POST',
    headers,
  },
  (res) => {
    let d = '';
    res.on('data', (c) => {
      d += c;
    });
    res.on('end', () => {
      console.log('POST', res.statusCode, d.slice(0, 200));
    });
  },
);
req.on('error', console.error);
req.write(body);
req.end();
