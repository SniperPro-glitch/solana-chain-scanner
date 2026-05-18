// USD format — hacim/mcap vs meme fiyat (0.0006$ gibi).

function fmtUsd(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const x = Number(n);
  if (x === 0) return '$0';
  if (x < 0.0001) return `$${x.toExponential(2)}`;
  if (x < 1) return `$${x.toFixed(6)}`;
  if (x < 1_000) return `$${x.toFixed(2)}`;
  if (x < 1_000_000) return `$${(x / 1_000).toFixed(2)}K`;
  if (x < 1_000_000_000) return `$${(x / 1_000_000).toFixed(2)}M`;
  return `$${(x / 1_000_000_000).toFixed(2)}B`;
}

/** Token fiyatı — asla $0.00 yuvarlama */
function fmtPriceUsd(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const x = Number(n);
  if (x === 0) return '$0';
  if (x < 0.0000001) return `$${x.toExponential(2)}`;
  if (x < 0.0001) return `$${x.toFixed(8).replace(/\.?0+$/, '')}`;
  if (x < 0.01) return `$${x.toFixed(6).replace(/\.?0+$/, '')}`;
  if (x < 1) return `$${x.toFixed(4)}`;
  if (x < 1000) return `$${x.toFixed(2)}`;
  return fmtUsd(x);
}

function fmtPct(n) {
  if (n == null || Number.isNaN(n)) return '—';
  const x = Number(n);
  const sign = x > 0 ? '+' : '';
  return `${sign}${x.toFixed(2)}%`;
}

module.exports = { fmtUsd, fmtPriceUsd, fmtPct };
