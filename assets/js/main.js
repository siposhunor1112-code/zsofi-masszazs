(function () {
  'use strict';

  var C = window.SITE_CONFIG;
  var S = window.Schedule;
  var DAY_NAMES = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat'];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  window.formatPrice = function (service) {
    return service.price ? service.price.toLocaleString('hu-HU') + ' Ft' : 'Ár egyeztetés szerint';
  };

  /* Navigáció */
  var header = document.querySelector('.site-header');
  var nav = document.getElementById('nav');
  var toggle = document.getElementById('navToggle');

  function setNav(open) {
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Menü bezárása' : 'Menü megnyitása');
  }
  toggle.addEventListener('click', function () { setNav(!nav.classList.contains('open')); });
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) setNav(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setNav(false); });

  function onScroll() { header.classList.toggle('scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* Kezelések */
  var grid = document.getElementById('serviceGrid');
  grid.innerHTML = C.services.map(function (s, i) {
    return '<article class="service-card reveal">' +
      '<span class="service-index">' + String(i + 1).padStart(2, '0') + '</span>' +
      '<h3>' + esc(s.name) + '</h3>' +
      '<p>' + esc(s.description) + '</p>' +
      (s.note ? '<p class="service-note">' + esc(s.note) + '</p>' : '') +
      '<div class="service-meta">' +
        '<span>' + s.duration + ' perc · ' + esc(window.formatPrice(s)) + '</span>' +
        '<button type="button" class="service-book" data-service="' + esc(s.id) + '">Foglalás</button>' +
      '</div>' +
    '</article>';
  }).join('');

  grid.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-service]');
    if (!btn) return;
    document.dispatchEvent(new CustomEvent('booking:select-service', { detail: btn.dataset.service }));
    document.getElementById('foglalas').scrollIntoView({ behavior: 'smooth' });
  });

  /* Nyitvatartás */
  var today = S.weekday(S.nowIn(C.timeZone).date);
  var order = [1, 2, 3, 4, 5, 6, 0];
  document.getElementById('hoursTable').innerHTML = order.map(function (d) {
    var h = C.openingHours[d];
    var cls = (h ? '' : 'closed') + (d === today ? ' is-today' : '');
    return '<tr class="' + cls.trim() + '"><td>' + DAY_NAMES[d] + '</td><td>' +
      (h ? h.open.replace(/^0/, '') + ' – ' + h.close : 'Zárva') + '</td></tr>';
  }).join('');

  /* Egyéb */
  document.getElementById('year').textContent = new Date().getFullYear();

  document.addEventListener('click', function (e) {
    var opener = e.target.closest('[data-open]');
    if (!opener) return;
    var dlg = document.getElementById(opener.dataset.open);
    if (dlg && dlg.showModal) dlg.showModal();
  });

  /* Megjelenési animáció */
  var els = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    els.forEach(function (el) { io.observe(el); });
  } else {
    els.forEach(function (el) { el.classList.add('in'); });
  }
})();
