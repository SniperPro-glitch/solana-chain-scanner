/**
 * Tek referans profilden 5 cihaz (web, app11, app13, app13pm, app16) ölçü üretir.
 * Canonical genişlikler: Apple HIG / Telegram WebApp viewport (portrait CSS px).
 */
const PROFILE_ORDER = ['web', 'app11', 'app13', 'app13pm', 'app16'];

/** Profil → tipik cihaz genişliği (layoutWidth) */
const CANONICAL_WIDTH = {
  web: 1200,
  app11: 414, // iPhone 11, XR, 11 Pro Max
  app13: 390, // iPhone 12 / 12 Pro / 13 / 14 / 15
  app13pm: 428, // iPhone 12–15 Pro Max, Plus
  app16: 440, // iPhone 16 Pro Max (Telegram ~440px; detect >= 429)
};

const DEVICE_HINTS = {
  web: 'Masaüstü tarayıcı / Telegram Desktop',
  app11: 'iPhone 11, XR, 11 Pro Max (~414px)',
  app13: 'iPhone 12, 13, 14, 15 (~390px)',
  app13pm: 'iPhone 12–15 Pro Max (~428px)',
  app16: 'iPhone 16 Pro / Pro Max (~430px)',
};

function round(n) {
  return Math.round(Number(n) || 0);
}

function scalePx(value, ratio, step = 1) {
  const v = Number(value) || 0;
  const scaled = v * ratio;
  if (step <= 1) return round(scaled);
  return round(scaled / step) * step;
}

function scalePct(value, ratio) {
  const v = Number(value) || 0;
  const nudge = Math.round((ratio - 1) * 2);
  return v + nudge;
}

/** Masaüstü miniapp — mobil referansla aynı kadraj, daha kısa kutu. */
function webBlockFromMobile(refBlock) {
  const t = refBlock.trades;
  const c = refBlock.chart;
  return {
    chart: {
      ...c,
      stageH: 356,
      top: 32,
      left: 1,
      width: 104,
      heightExtra: 4,
      brandCrop: 32,
      shiftDown: 0,
    },
    trades: {
      ...t,
      viewH: 302,
      iframeH: t.iframeH || 920,
      iframeTop: -612,
      shiftDown: 0,
      left: 0,
      width: 100,
      maskTop: 0,
      maskFoot: 0,
      maskTopOn: false,
      maskFootOn: false,
    },
    tape: { shiftDown: 0 },
  };
}

function cloneBlock(block) {
  return JSON.parse(JSON.stringify(block));
}

function ratioFor(refWidth, targetId) {
  const tw = CANONICAL_WIDTH[targetId];
  const rw = Math.max(320, Number(refWidth) || CANONICAL_WIDTH.app13);
  return tw / rw;
}

/**
 * Masaüstü: genişlik farkı büyük; yükseklikleri tam lineer ölçekleme (aşırı uzar).
 */
function webRatioFromMobile(refWidth) {
  const rw = Math.max(320, Number(refWidth) || 390);
  const linear = CANONICAL_WIDTH.web / rw;
  return {
    chartH: Math.pow(linear, 0.38),
    chartOffset: Math.pow(linear, 0.42),
    tradesH: Math.pow(linear, 0.4),
    tradesOffset: Math.pow(linear, 0.45),
  };
}

function scaleChart(chart, ratio, webRatios) {
  const r = webRatios ? webRatios.chartH : ratio;
  const ro = webRatios ? webRatios.chartOffset : ratio;
  return {
    ...chart,
    stageH: scalePx(chart.stageH, r, 2),
    top: scalePx(chart.top, ro, 1),
    shiftDown: scalePx(chart.shiftDown, ro, 1),
    brandCrop: scalePx(chart.brandCrop, r, 1),
    heightExtra: scalePx(chart.heightExtra, r, 1),
    left: scalePct(chart.left, ratio),
    width: scalePct(chart.width, ratio),
    clipLeft: scalePx(chart.clipLeft, ratio, 1),
    clipRight: scalePx(chart.clipRight, ratio, 1),
    clipTop: scalePx(chart.clipTop, ratio, 1),
    clipBottom: scalePx(chart.clipBottom, ratio, 1),
  };
}

function scaleTrades(trades, ratio, webRatios) {
  const r = webRatios ? webRatios.tradesH : ratio;
  const ro = webRatios ? webRatios.tradesOffset : ratio;
  return {
    ...trades,
    viewH: scalePx(trades.viewH, r, 2),
    iframeH: scalePx(trades.iframeH, r, 2),
    iframeTop: scalePx(trades.iframeTop, ro, 5),
    shiftDown: scalePx(trades.shiftDown, ro, 1),
    left: scalePct(trades.left, ratio),
    width: scalePct(trades.width, ratio),
    maskTop: scalePx(trades.maskTop, ratio, 1),
    maskFoot: scalePx(trades.maskFoot, ratio, 1),
    maskTopOn: trades.maskTopOn,
    maskFootOn: trades.maskFootOn,
    clipLeft: scalePx(trades.clipLeft, ratio, 1),
    clipRight: scalePx(trades.clipRight, ratio, 1),
    clipTop: scalePx(trades.clipTop, ratio, 1),
    clipBottom: scalePx(trades.clipBottom, ratio, 1),
  };
}

function scaleTape(tape, ratio) {
  if (!tape) return { shiftDown: 0 };
  return {
    ...tape,
    shiftDown: scalePx(tape.shiftDown, ratio, 1),
  };
}

/**
 * @param {string} refProfileId - örn. app13
 * @param {object} refBlock - { chart, trades, tape? }
 * @param {number} [refWidth] - telefondaki gerçek viewport (Telegram viewportWidth)
 * @param {object} [existingProfiles] - isteğe bağlı; hedef yoksa kopyalanır
 */
function scaleFromReference(refProfileId, refBlock, refWidth, existingProfiles = {}) {
  if (!refBlock?.chart || !refBlock?.trades) {
    throw new Error('refBlock.chart ve refBlock.trades gerekli');
  }
  const refId = String(refProfileId || 'app13');
  const rw =
    Number(refWidth) > 0
      ? Number(refWidth)
      : CANONICAL_WIDTH[refId] || CANONICAL_WIDTH.app13;

  const profiles = {};
  PROFILE_ORDER.forEach((targetId) => {
    if (targetId === refId) {
      profiles[targetId] = cloneBlock(refBlock);
      return;
    }
    if (targetId === 'web') {
      profiles[targetId] = webBlockFromMobile(refBlock);
      return;
    }
    const ratio = ratioFor(rw, targetId);
    profiles[targetId] = {
      chart: scaleChart(refBlock.chart, ratio, null),
      trades: scaleTrades(refBlock.trades, ratio, null),
      tape: scaleTape(refBlock.tape, ratio),
    };
  });

  return {
    refProfileId: refId,
    refWidth: rw,
    canonical: { ...CANONICAL_WIDTH },
    hints: { ...DEVICE_HINTS },
    profiles,
    note: `Referans ${refId} @ ${rw}px → 5 profil (ölçeklenmiş)`,
  };
}

module.exports = {
  PROFILE_ORDER,
  CANONICAL_WIDTH,
  DEVICE_HINTS,
  scaleFromReference,
};
