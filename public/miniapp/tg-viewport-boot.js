/**
 * Telegram açılışında hemen expand (yarım sheet kalmasın).
 * telegram-viewport.js ile birlikte çalışır.
 */
(function () {
  const tg = window.Telegram?.WebApp;
  if (!tg) return;

  function pump() {
    try {
      if (typeof tg.expand === 'function') tg.expand();
    } catch (_) {
      /* yoksay */
    }
    try {
      if (typeof tg.requestViewport === 'function') tg.requestViewport({ height: 10000 });
    } catch (_) {
      /* yoksay */
    }
  }

  pump();
  if (typeof tg.ready === 'function') {
    try {
      tg.ready(pump);
    } catch (_) {
      setTimeout(pump, 0);
    }
  }

  let n = 0;
  const tick = setInterval(() => {
    n += 1;
    pump();
    if (tg.isExpanded || n >= 30) clearInterval(tick);
  }, 100);
})();
