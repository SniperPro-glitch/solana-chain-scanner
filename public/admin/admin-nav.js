/**
 * Sol menü: bölüm akordeonu + mobil/tablet drawer (tüm panel aç/kapa).
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
    const toggle = document.getElementById('btnSidebarToggle');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (!layout || !toggle || toggle.dataset.drawerReady === '1') return;

    const mq = window.matchMedia(MQ);

    function isMobile() {
      return mq.matches;
    }

    function isOpen() {
      return isMobile()
        ? layout.classList.contains('sidebar-open')
        : !layout.classList.contains('sidebar-collapsed');
    }

    function setOpen(open) {
      if (isMobile()) {
        layout.classList.toggle('sidebar-open', open);
        layout.classList.remove('sidebar-collapsed');
      } else {
        layout.classList.toggle('sidebar-collapsed', !open);
        layout.classList.remove('sidebar-open');
      }
      document.body.classList.toggle('sidebar-drawer-open', open && isMobile());
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Menüyü kapat' : 'Menüyü aç');
      if (backdrop) backdrop.setAttribute('aria-hidden', open && isMobile() ? 'false' : 'true');
    }

    function closeSidebar() {
      setOpen(false);
    }

    window.SniperAdminSidebar = { close: closeSidebar, setOpen, isOpen };

    toggle.addEventListener('click', () => {
      setOpen(!isOpen());
    });

    backdrop?.addEventListener('click', closeSidebar);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen()) closeSidebar();
    });

    document.querySelectorAll('.sidebar .nav-item').forEach((el) => {
      el.addEventListener('click', () => {
        closeSidebar();
      });
    });

    mq.addEventListener('change', () => {
      layout.classList.remove('sidebar-open', 'sidebar-collapsed');
      document.body.classList.remove('sidebar-drawer-open');
      if (backdrop) backdrop.setAttribute('aria-hidden', 'true');
      setOpen(!isMobile());
    });

    setOpen(!isMobile());
    toggle.dataset.drawerReady = '1';

    const origShow = window.showPage;
    if (typeof origShow === 'function' && !window.__adminShowPagePatched) {
      window.showPage = function (id) {
        origShow(id);
        if (id === 'support' || isMobile()) closeSidebar();
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
