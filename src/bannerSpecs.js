/**
 * Promo banner ölçüleri.
 * Web (tarayıcı): tam ekran genişlik — sabit oran 12.5:1 (1200:96).
 */
const BANNER_RATIO_W = 1200;
const BANNER_RATIO_H = 96;
const BANNER_ASPECT = BANNER_RATIO_W / BANNER_RATIO_H; // 12.5

function heightForWidth(w) {
  return Math.round(Number(w) / BANNER_ASPECT);
}

function sizeForViewportWidth(viewportWidth) {
  const w = Math.max(320, Math.round(Number(viewportWidth) || BANNER_RATIO_W));
  return { width: w, height: heightForWidth(w) };
}

/** Yaygın masaüstü referansları (Canva canvas) */
const WEB_REFERENCE_SIZES = [
  { label: 'Full HD', width: 1920, height: heightForWidth(1920) },
  { label: 'WXGA+', width: 1600, height: heightForWidth(1600) },
  { label: 'QHD', width: 2560, height: heightForWidth(2560) },
];

const BANNER_SPECS = {
  desktop: {
    key: 'desktop',
    label: 'Web (tam ekran)',
    ratioW: BANNER_RATIO_W,
    ratioH: BANNER_RATIO_H,
    aspect: `${BANNER_RATIO_W} / ${BANNER_RATIO_H}`,
    /** Örnek FHD canvas */
    width: 1920,
    height: heightForWidth(1920),
    maxWidth: '100%',
  },
  tablet: {
    key: 'tablet',
    width: 768,
    height: 96,
    maxWidth: 768,
    label: 'Tablet',
  },
  mobile: {
    key: 'mobile',
    width: 414,
    height: 88,
    maxWidth: 414,
    label: 'Telegram / App',
  },
};

function sizeLabel(spec) {
  return `${spec.width}×${spec.height}`;
}

function hintText(spec) {
  if (spec.key === 'desktop') {
    const fhd = WEB_REFERENCE_SIZES[0];
    return `Web tam ekran — oran ${BANNER_RATIO_W}:${BANNER_RATIO_H} (÷12.5). Örnek: ${fhd.width}×${fhd.height} px (Full HD). Formül: genişlik ÷ 12,5 = yükseklik.`;
  }
  return `Bire bir ${sizeLabel(spec)} px (2x: ${spec.width * 2}×${spec.height * 2})`;
}

module.exports = {
  BANNER_SPECS,
  BANNER_RATIO_W,
  BANNER_RATIO_H,
  BANNER_ASPECT,
  WEB_REFERENCE_SIZES,
  heightForWidth,
  sizeForViewportWidth,
  sizeLabel,
  hintText,
};
