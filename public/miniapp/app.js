(function () {
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    document.documentElement.style.setProperty('--bg', tg.themeParams.bg_color || '#0e1117');
    document.documentElement.style.setProperty('--text', tg.themeParams.text_color || '#e6edf3');
  }

  const $ = (id) => document.getElementById(id);

  function reportIdFromUrl() {
    const hash = (location.hash || '').replace(/^#/, '');
    const params = new URLSearchParams(hash.includes('=') ? hash : `r=${hash}`);
    return params.get('r') || new URLSearchParams(location.search).get('r');
  }

  function scoreColor(score) {
    if (score < 50) return 'var(--bad)';
    if (score < 70) return 'var(--warn)';
    return 'var(--good)';
  }

  function levelClass(level) {
    if (level === 'red' || level === 'critical') return 'bad';
    if (level === 'yellow') return 'warn';
    return 'good';
  }

  function addPanel(title, lines, emptyText) {
    if (!lines || !lines.length) return null;
    const details = document.createElement('details');
    details.className = 'panel';
    details.open = title.includes('Öne') || title.includes('Key');
    const summary = document.createElement('summary');
    summary.textContent = title;
    const body = document.createElement('div');
    body.className = 'panel-body';
    const ul = document.createElement('ul');
    for (const line of lines) {
      const li = document.createElement('li');
      if (typeof line === 'object') {
        li.textContent = line.text;
        if (line.level) li.className = line.level;
      } else {
        li.textContent = line;
      }
      ul.appendChild(li);
    }
    body.appendChild(ul);
    details.appendChild(summary);
    details.appendChild(body);
    return details;
  }

  function render(data) {
    $('loading').classList.add('hidden');
    $('app').classList.remove('hidden');

    $('symbol').textContent = `$${data.symbol}`;
    $('levelBadge').textContent = `${data.levelLabel} kart`;

    const score = data.trust?.score ?? 0;
    $('trustScore').textContent = String(score);
    $('trustLabel').textContent = data.lang === 'tr' ? 'güven' : 'trust';
    $('trustTier').textContent = data.trust?.tier || '—';
    $('trustVerdict').textContent = data.trust?.verdict || '';

    const ring = $('trustRing');
    ring.style.setProperty('--pct', String(score));
    ring.style.setProperty('--ring-color', scoreColor(score));

    const grid = $('summaryGrid');
    grid.innerHTML = '';
    const cells = [
      ['Likidite', `${data.summary?.liquidityUsd} · ${data.summary?.liquidityWord}`],
      ['Yaş', data.summary?.age || '—'],
      ['Fiyat', data.summary?.price || '—'],
      ['24s', data.summary?.change24h || '—'],
    ];
    for (const [label, val] of cells) {
      const cell = document.createElement('div');
      cell.className = 'summary-cell';
      cell.innerHTML = `<span>${label}</span><strong>${val}</strong>`;
      grid.appendChild(cell);
    }

    const sections = $('sections');
    sections.innerHTML = '';

    const titles = {
      tr: {
        highlights: 'Öne çıkanlar',
        signals: 'Tüm testler',
        onchain: 'On-chain',
        contract: 'Kontrat güvenliği',
        links: 'Linkler',
      },
      en: {
        highlights: 'Key findings',
        signals: 'All checks',
        onchain: 'On-chain',
        contract: 'Contract security',
        links: 'Links',
      },
    };
    const T = titles[data.lang] || titles.en;

    const panels = [
      addPanel(T.highlights, data.highlights),
      data.rugcheck ? addPanel('RugCheck', [data.rugcheck]) : null,
      addPanel(T.signals, data.signals),
      addPanel(T.onchain, data.onchain),
      addPanel(T.contract, data.contract),
      addPanel(T.links, data.links),
    ].filter(Boolean);

    for (const p of panels) sections.appendChild(p);
  }

  async function main() {
    const id = reportIdFromUrl();
    if (!id) {
      $('loading').classList.add('hidden');
      $('error').classList.remove('hidden');
      $('error').textContent = 'Geçersiz rapor bağlantısı.';
      return;
    }
    try {
      const res = await fetch(`/api/report/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error('not_found');
      const data = await res.json();
      render(data);
    } catch (e) {
      $('loading').classList.add('hidden');
      $('error').classList.remove('hidden');
    }
  }

  main();
})();
