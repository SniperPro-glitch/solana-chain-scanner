/**
 * Banner stüdyosu — yükle, sağ/sol kaydır, kaydet (⚙ veya ?banner=1).
 */
(function (global) {
  const API = '/api/promo-banner';
  const KEY = 'sniperBannerStudioKey';

  let draft = { posX: 50, link: '', imageBase64: null, previewUrl: null };

  function $(id) {
    return document.getElementById(id);
  }

  function getPublishKey() {
    try {
      return sessionStorage.getItem(KEY) || localStorage.getItem(KEY) || '';
    } catch {
      return '';
    }
  }

  function setPublishKey(k) {
    try {
      sessionStorage.setItem(KEY, k);
      localStorage.setItem(KEY, k);
    } catch {
      /* yoksay */
    }
  }

  function applyPreview() {
    const img = $('promoBannerImg');
    const wrap = $('promoBanner');
    if (!img) return;
    const px = Math.round(Number(draft.posX) || 50);
    img.style.objectPosition = `${px}% center`;
    if (draft.previewUrl) {
      img.src = draft.previewUrl;
      wrap?.classList.remove('hidden');
    }
  }

  function syncControls() {
    const range = $('bannerPosRange');
    const val = $('bannerPosVal');
    const link = $('bannerLinkInput');
    if (range) range.value = String(draft.posX);
    if (val) val.textContent = `${Math.round(draft.posX)}%`;
    if (link) link.value = draft.link || '';
    const prev = $('bannerStudioPreview');
    if (prev && draft.previewUrl) {
      prev.src = draft.previewUrl;
      prev.style.objectPosition = `${Math.round(draft.posX)}% center`;
    }
  }

  async function loadServer() {
    const res = await fetch(API, { cache: 'no-store' });
    if (!res.ok) return;
    const cfg = await res.json();
    if (cfg.posX != null) draft.posX = cfg.posX;
    if (cfg.link) draft.link = cfg.link;
    if (cfg.enabled && cfg.imageUrl) {
      draft.previewUrl = cfg.imageUrl;
      draft.imageBase64 = null;
    }
    syncControls();
    applyPreview();
  }

  function openPanel() {
    const panel = $('bannerStudio');
    if (!panel) return;
    panel.classList.remove('hidden');
    panel.setAttribute('aria-hidden', 'false');
    loadServer().catch(() => {});
    syncControls();
  }

  function closePanel() {
    const panel = $('bannerStudio');
    if (!panel) return;
    panel.classList.add('hidden');
    panel.setAttribute('aria-hidden', 'true');
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  async function onFilePick(file) {
    if (!file) return;
    if (file.size > 2.5 * 1024 * 1024) {
      alert('Max 2.5 MB — 780×144 PNG/GIF önerilir.');
      return;
    }
    draft.imageBase64 = await readFileAsDataUrl(file);
    draft.previewUrl = draft.imageBase64;
    syncControls();
    applyPreview();
  }

  async function save() {
    const key = getPublishKey();
    const body = {
      posX: Number($('bannerPosRange')?.value || draft.posX) || 50,
      link: String($('bannerLinkInput')?.value || '').trim(),
      enabled: true,
    };
    if (draft.imageBase64) body.imageBase64 = draft.imageBase64;

    const headers = { 'Content-Type': 'application/json' };
    if (key) headers['X-Crop-Key'] = key;

    const res = await fetch(API, { method: 'POST', headers, body: JSON.stringify(body) });
    if (res.status === 403) {
      const entered = prompt('Banner kayıt anahtarı (Railway CROP_PUBLISH_KEY):', key || '');
      if (entered) {
        setPublishKey(entered.trim());
        return save();
      }
      alert('Anahtar gerekli veya yetkisiz.');
      return;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.message || err.error || 'Kaydedilemedi');
      return;
    }
    draft.imageBase64 = null;
    const data = await res.json();
    if (data.saved?.imageUrl) {
      draft.previewUrl = data.saved.imageUrl + (data.saved.updatedAt
        ? `?v=${encodeURIComponent(data.saved.updatedAt)}`
        : '');
    }
    alert('Banner kaydedildi.');
    closePanel();
    if (typeof global.reloadHomeFeed === 'function') global.reloadHomeFeed();
    else location.reload();
  }

  function bind() {
    $('btnSettings')?.addEventListener('click', openPanel);
    $('btnBannerStudioClose')?.addEventListener('click', closePanel);
    $('bannerStudioBackdrop')?.addEventListener('click', closePanel);
    $('bannerFileInput')?.addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      onFilePick(f).catch((err) => alert(err.message || String(err)));
    });
    $('bannerPosRange')?.addEventListener('input', (e) => {
      draft.posX = Number(e.target.value) || 50;
      syncControls();
      applyPreview();
    });
    $('btnBannerSave')?.addEventListener('click', () => save().catch((e) => alert(e.message)));
    $('promoBanner')?.addEventListener('dblclick', (e) => {
      e.preventDefault();
      openPanel();
    });

    if (/[?&]banner=1/.test(location.search) || location.hash.includes('banner=1')) {
      setTimeout(openPanel, 400);
    }
  }

  global.SniperBannerStudio = { open: openPanel, close: closePanel, applyPos: applyPreview };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})(typeof window !== 'undefined' ? window : global);
