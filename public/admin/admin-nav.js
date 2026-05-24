/**
 * Sol menü: bölüm akordeonu + mobil/tablet sol çekmece (drawer).
 * Masaüstünde menü sürekli açık; dar ekranda sol kenar tutamacı ile açılır.
 */
(function () {
  const t = ['d', 'i', 'v'].join('');
  const MQ = '(max-width: 960px)';

  function initNavAccordion() {
    document.querySelectorAll('.sidebar-nav .nav-section').forEach((section) => {
      if (section.dataset.navReady === '1') return;
      const label = section.querySelector(':scope > .nav-section-label');
      if (!label) return;

      const items = [...section.querySelectorAll(':scope > .nav-item')];
      if (!items.length) return;

      const title = label.textContent.trim();
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'nav-section-toggle';
      const chevron = document.createElement('span');
      chevron.className = 'nav-section-chevron';
      chevron.setAttribute('aria-hidden', 'true');
      btn.append(document.createTextNode(title), chevron);

      const body = document.createElement(t);
      body.className = 'nav-section-body';
      items.forEach((el) => body.appendChild(el));

      label.remove();
      section.insertBefore(btn, section.firstChild);
      section.appendChild(body);

      const startOpen = title !== 'Ayarlar';
      if (!startOpen) section.classList.add('collapsed');
      btn.setAttribute('aria-expanded', startOpen ? 'true' : 'false');

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        section.classList.toggle('collapsed');
        btn.setAttribute('aria-expanded', section.classList.contains('collapsed') ? 'false' : 'true');
      });

      items.forEach((el) => {
        el.addEventListener('click', () => {
          section.classList.remove('collapsed');
          btn.setAttribute('aria-expanded', 'true');
        });
      });

      section.dataset.navReady = '1';
    });
  }

  function initSidebarDrawer() {
    const layout = document.getElementById('appLayout');
    const openBtn = document.getElementById('btnSidebarDrawer');
    const closeBtn = document.getElementById('btnSidebarClose');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (!layout || !openBtn || openBtn.dataset.drawerReady === '1') return;

    const mq = window.matchMedia(MQ);

    function isMobile() {
      return mq.matches;
    }

    function isOpen() {
      return layout.classList.contains('sidebar-open');
    }

    function setOpen(open) {
      if (!isMobile()) {
        layout.classList.remove('sidebar-open', 'sidebar-collapsed');
        document.body.classList.remove('sidebar-drawer-open');
        if (backdrop) backdrop.setAttribute('aria-hidden', 'true');
        openBtn.setAttribute('aria-expanded', 'true');
        openBtn.setAttribute('aria-label', 'Menü');
        return;
      }

      layout.classList.toggle('sidebar-open', open);
      layout.classList.remove('sidebar-collapsed');
      document.body.classList.toggle('sidebar-drawer-open', open);
      openBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      openBtn.setAttribute('aria-label', open ? 'Menüyü kapat' : 'Menüyü aç');
      if (backdrop) backdrop.setAttribute('aria-hidden', open ? 'false' : 'true');
    }

    function closeSidebar() {
      setOpen(false);
    }

    window.SniperAdminSidebar = { close: closeSidebar, setOpen, isOpen };

    openBtn.addEventListener('click', () => {
      if (!isMobile()) return;
      setOpen(!isOpen());
    });

    closeBtn?.addEventListener('click', closeSidebar);
    backdrop?.addEventListener('click', closeSidebar);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isMobile() && isOpen()) closeSidebar();
    });

    document.querySelectorAll('.sidebar .nav-item').forEach((el) => {
      el.addEventListener('click', () => {
        if (isMobile()) closeSidebar();
      });
    });

    mq.addEventListener('change', () => {
      layout.classList.remove('sidebar-open', 'sidebar-collapsed');
      document.body.classList.remove('sidebar-drawer-open');
      if (backdrop) backdrop.setAttribute('aria-hidden', 'true');
      setOpen(false);
    });

    setOpen(false);
    openBtn.dataset.drawerReady = '1';

    const origShow = window.showPage;
    if (typeof origShow === 'function' && !window.__adminShowPagePatched) {
      window.showPage = function (id) {
        origShow(id);
        if (isMobile()) closeSidebar();
      };
      window.__adminShowPagePatched = true;
    }
  }

  function boot() {
    initNavAccordion();
    initSidebarDrawer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  document.addEventListener('sniper-admin-ready', boot);
})();
