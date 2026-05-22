/**
 * İlk açılışta bir kez expand (sürekli pump kaydırır).
 */
(function () {
  const tg = window.Telegram?.WebApp;
  if (!tg) return;

  function once() {
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

  once();
  if (typeof tg.ready === 'function') {
    try {
      tg.ready(once);
    } catch (_) {
      setTimeout(once, 0);
    }
  }
  setTimeout(once, 250);
})();
