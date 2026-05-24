/** Admin + mini app — web tam ekran oran 12.5:1 */
(function (g) {
  const RATIO_W = 1200;
  const RATIO_H = 96;
  const aspect = RATIO_W / RATIO_H;
  const h = (w) => Math.round(w / aspect);

  g.SniperBannerSpecs = {
    desktop: {
      width: 1920,
      height: h(1920),
      maxWidth: '100%',
      ratioW: RATIO_W,
      ratioH: RATIO_H,
      label: 'Web tam ekran',
    },
    tablet: { width: 768, height: 80, maxWidth: 768, label: 'Tablet' },
    mobile: { width: 414, height: 64, maxWidth: 414, label: 'Telefon' },
  };
  g.SniperBannerHeightForWidth = h;
})(typeof window !== 'undefined' ? window : globalThis);
