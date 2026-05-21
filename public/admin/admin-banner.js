/**
 * Admin panel — Mini App promo banner (bilgisayar / tablet / telefon).
 */
(function () {
  const API = '/api/admin/promo-banner';
  const VARIANTS = ['desktop', 'tablet', 'mobile'];
  const SPECS = (typeof window !== 'undefined' && window.SniperBannerSpecs) || {
    desktop: { width: 1920, height: 154, maxWidth: '100%', ratioW: 1200, ratioH: 96, label: 'Web tam ekran' },
    tablet: { width: 768, height: 80, maxWidth: 768, label: 'Tablet' },
    mobile: { width: 414, height: 64, maxWidth: 414, label: 'Telefon' },
  };

  function buildLabels() {
    const out = {};
    for (const key of VARIANTS) {
      const s = SPECS[key];
      const isWeb = key === 'desktop';
      const size = isWeb ? `${s.width}×${s.height}` : `${s.width}×${s.height}`;
      const aspect = isWeb ? `${s.ratioW || 1200} / ${s.ratioH || 96}` : `${s.width} / ${s.height}`;
      out[key] = {
        upload: `📤 ${s.label} görseli seç`,
        change: '🔄 Görseli değiştir',
        size: isWeb ? '12.5:1 (Full HD 1920×154)' : size,
        hint: isWeb
          ? `Tam ekran — Canva Full HD: ${s.width}×${s.height} px. Formül: genişlik ÷ 12,5 = yükseklik. F12: [banner ölçü]`
          : `Bire bir ${size} px`,
        previewMaxW: isWeb ? '100%' : `${s.maxWidth}px`,
        aspect,
        fit: key === 'mobile' ? 'contain' : 'fill',
      };
    }
    return out;
  }

  const LABELS = buildLabels();

  let activeVariant = 'desktop';
  let draft = {
    link: '',
    enabled: true,
    variants: {
      desktop: { posX: 50, imageBase64: null, previewUrl: null },
      tablet: { posX: 50, imageBase64: null, previewUrl: null },
      mobile: { posX: 50, imageBase64: null, previewUrl: null },
    },
  };

  const $ = (id) => document.getElementById(id);

  function slot(key) {
    return draft.variants[key];
  }

  function setStatus(msg, isErr) {
    const el = $('adminBannerStatus');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('err', !!isErr);
  }

  function syncUi() {
    const s = slot(activeVariant);
    const pos = $('adminBannerPos');
    const posVal = $('adminBannerPosVal');
    const label = $('adminBannerUploadLabel');
    const labelText = label?.querySelector('.banner-studio-upload-text');
    const link = $('adminBannerLink');
    const enabled = $('adminBannerEnabled');
    const stage = $('adminBannerStage');
    const slotEl = $('adminBannerSlot');
    const hint = $('adminBannerSizeHint');
    const spec = LABELS[activeVariant];
    if (pos) pos.value = String(s.posX);
    if (posVal) posVal.textContent = `${Math.round(s.posX)}%`;
    if (stage) stage.dataset.bannerVariant = activeVariant;
    if (hint && spec) hint.textContent = spec.hint;
    if (stage && spec) {
      stage.style.setProperty('--banner-aspect', spec.aspect);
      stage.style.setProperty('--banner-preview-max', spec.previewMaxW);
      stage.style.setProperty('--banner-fit', spec.fit);
    }
    if (link) link.value = draft.link || '';
    if (enabled) enabled.checked = draft.enabled !== false;
    document.querySelectorAll('#page-banner .banner-variant-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.variant === activeVariant);
      const sz = btn.querySelector('.banner-tab-size');
      const key = btn.dataset.variant;
      if (sz && LABELS[key]) sz.textContent = LABELS[key].size;
    });
    const url = s.previewUrl || '';
    const hasPreview = !!url;
    if (slotEl) slotEl.classList.toggle('has-preview', hasPreview);
    if (labelText && spec) {
      labelText.textContent = hasPreview ? spec.change : spec.upload;
    }
    const prev = $('adminBannerPreview');
    if (prev) {
      if (url) prev.src = url;
      else prev.removeAttribute('src');
      prev.style.objectPosition = `${Math.round(s.posX)}% center`;
    }
  }

  function applyServer(cfg, live) {
    draft.link = cfg?.link || '';
    draft.enabled = cfg?.enabled !== false;
    if (cfg?.variants) {
      for (const key of VARIANTS) {
        const v = cfg.variants[key];
        if (v?.imageUrl) {
          slot(key).previewUrl = v.imageUrl;
          slot(key).posX = v.posX ?? 50;
          slot(key).imageBase64 = null;
        }
      }
    } else if (live?.variants) {
      for (const key of VARIANTS) {
        const v = live.variants[key];
        if (v?.imageUrl) {
          slot(key).previewUrl = v.imageUrl;
          slot(key).posX = v.posX ?? 50;
        }
      }
    }
    syncUi();
  }

  async function load() {
    if (!$('adminBannerRoot')) return;
    setStatus('Yükleniyor…');
    try {
      const data = await window.SniperAdminApi('/api/admin/promo-banner');
      applyServer(data.config, data.live);
      setStatus('');
    } catch (e) {
      setStatus(e.message || 'Yüklenemedi', true);
    }
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  async function onFile(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert(`Max 5 MB — önerilen ${LABELS[activeVariant]?.size || ''}`);
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    const s = slot(activeVariant);
    s.imageBase64 = dataUrl;
    s.previewUrl = dataUrl;
    syncUi();
  }

  function buildPayload() {
    const variants = {};
    for (const key of VARIANTS) {
      const s = slot(key);
      const entry = { posX: Math.round(Number(s.posX) || 50) };
      if (s.imageBase64) entry.imageBase64 = s.imageBase64;
      if (s.imageBase64 || s.previewUrl) variants[key] = entry;
    }
    return {
      enabled: $('adminBannerEnabled')?.checked !== false,
      link: String($('adminBannerLink')?.value || '').trim(),
      variants,
    };
  }

  async function save() {
    setStatus('Kaydediliyor…');
    try {
      const body = await window.SniperAdminApi(API, {
        method: 'POST',
        body: JSON.stringify(buildPayload()),
      });
      applyServer(body.saved, body.live);
      for (const key of VARIANTS) slot(key).imageBase64 = null;
      setStatus('Kaydedildi — Mini App’te görünür.');
    } catch (e) {
      setStatus(e.message || 'Kayıt başarısız', true);
    }
  }

  function setVariant(key) {
    if (!VARIANTS.includes(key)) return;
    activeVariant = key;
    syncUi();
  }

  function bind() {
    if (!$('adminBannerRoot')) return;

    $('adminBannerFile')?.addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      onFile(f).catch((err) => setStatus(err.message, true));
      e.target.value = '';
    });
    $('adminBannerPos')?.addEventListener('input', (e) => {
      slot(activeVariant).posX = Number(e.target.value) || 50;
      syncUi();
    });
    $('adminBannerSave')?.addEventListener('click', () => save());
    $('adminBannerReload')?.addEventListener('click', () => load());
    document.querySelectorAll('#page-banner .banner-variant-tab').forEach((btn) => {
      btn.addEventListener('click', () => setVariant(btn.dataset.variant));
    });

    const orig = window.showPage;
    if (typeof orig === 'function') {
      window.showPage = function (id) {
        orig(id);
        if (id === 'banner') load();
      };
    }

    document.addEventListener('sniper-admin-ready', () => load());
  }

  window.SniperAdminBanner = { load, save };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
