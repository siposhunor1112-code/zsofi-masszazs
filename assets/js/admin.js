(function () {
  'use strict';

  var C = window.SITE_CONFIG;
  var S = window.Schedule;
  var API = C.booking.apiBase;
  var KEY = 'zsofi-admin';
  var token = '';
  var data = { bookings: [], blocks: [] };

  try { token = sessionStorage.getItem(KEY) || ''; } catch (e) { /* privát mód */ }

  var $ = function (id) { return document.getElementById(id); };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtDay(str) {
    var p = str.split('-');
    return new Intl.DateTimeFormat('hu-HU', { month: 'long', day: 'numeric', weekday: 'long', timeZone: 'UTC' })
      .format(new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12)));
  }

  function api(method, path, body) {
    return fetch(API + path, {
      method: method,
      headers: Object.assign({ Authorization: 'Bearer ' + token }, body ? { 'Content-Type': 'application/json' } : {}),
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var err = new Error(j.error || 'Hiba (' + r.status + ')'); err.status = r.status; throw err; }
        return j;
      });
    });
  }

  function showLogin(msg) {
    $('loginForm').hidden = false;
    $('dashboard').hidden = true;
    $('logout').hidden = true;
    $('loginError').textContent = msg || '';
  }

  function load() {
    return api('GET', '/admin/data').then(function (d) {
      data = d;
      $('loginForm').hidden = true;
      $('dashboard').hidden = false;
      $('logout').hidden = false;
      render();
    }).catch(function (e) {
      if (e.status === 401) { try { sessionStorage.removeItem(KEY); } catch (x) {} }
      showLogin(token ? e.message : '');
    });
  }

  function render() {
    var today = S.nowIn(C.timeZone).date;
    var showPast = $('showPast').checked;
    var list = data.bookings
      .filter(function (b) { return showPast || (b.date >= today && b.status !== 'cancelled'); })
      .sort(function (a, b) { return (a.date + a.start).localeCompare(b.date + b.start); });

    if (!list.length) {
      $('bookingList').innerHTML = '<p class="empty">Nincs megjeleníthető foglalás.</p>';
    } else {
      var groups = {};
      list.forEach(function (b) { (groups[b.date] = groups[b.date] || []).push(b); });
      $('bookingList').innerHTML = Object.keys(groups).map(function (day) {
        return '<div class="day-group"><h3>' + esc(fmtDay(day)) + (day === today ? ' · ma' : '') + '</h3>' +
          groups[day].map(function (b) {
            var cancelled = b.status === 'cancelled';
            return '<div class="row' + (cancelled ? ' cancelled' : '') + '">' +
              '<span class="row-time">' + esc(b.start) + ' – ' + esc(b.end) + '</span>' +
              '<div class="row-main"><strong>' + esc(b.name) + (cancelled ? '<span class="tag">lemondva</span>' : '') + '</strong>' +
              '<span>' + esc(b.serviceName) + '</span>' +
              '<span><a href="tel:' + esc(b.phone.replace(/[^+0-9]/g, '')) + '">' + esc(b.phone) + '</a>' +
              (b.email ? ' · <a href="mailto:' + esc(b.email) + '">' + esc(b.email) + '</a>' : '') + '</span>' +
              (b.note ? '<span>„' + esc(b.note) + '”</span>' : '') + '</div>' +
              (cancelled ? '<span></span>' : '<button class="btn-danger" data-cancel="' + esc(b.id) + '">Lemondás</button>') +
              '</div>';
          }).join('') + '</div>';
      }).join('');
    }

    var blocks = data.blocks
      .filter(function (b) { return b.date >= today; })
      .sort(function (a, b) { return (a.date + a.start).localeCompare(b.date + b.start); });
    $('blockList').innerHTML = blocks.length ? blocks.map(function (b) {
      var whole = b.start === '00:00' && b.end === '23:59';
      return '<div class="row"><span class="row-time">' + (whole ? 'Egész nap' : esc(b.start) + ' – ' + esc(b.end)) + '</span>' +
        '<div class="row-main"><strong>' + esc(fmtDay(b.date)) + '</strong>' + (b.reason ? '<span>' + esc(b.reason) + '</span>' : '') + '</div>' +
        '<button class="btn-danger" data-unblock="' + esc(b.id) + '">Feloldás</button></div>';
    }).join('') : '<p class="empty">Nincs letiltott időpont.</p>';
  }

  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    token = e.target.elements.password.value;
    try { sessionStorage.setItem(KEY, token); } catch (x) {}
    load();
  });

  $('logout').addEventListener('click', function () {
    token = '';
    try { sessionStorage.removeItem(KEY); } catch (x) {}
    showLogin();
  });

  $('showPast').addEventListener('change', render);

  document.addEventListener('click', function (e) {
    var c = e.target.closest('[data-cancel]');
    if (c && confirm('Biztosan lemondja ezt a foglalást? Az időpont újra szabad lesz.')) {
      api('DELETE', '/admin/bookings/' + c.dataset.cancel).then(load).catch(function (err) { alert(err.message); });
    }
    var u = e.target.closest('[data-unblock]');
    if (u) api('DELETE', '/admin/blocks/' + u.dataset.unblock).then(load).catch(function (err) { alert(err.message); });
  });

  $('blockForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target.elements;
    $('blockError').textContent = '';
    api('POST', '/admin/blocks', {
      date: f.date.value, start: f.start.value, end: f.end.value, reason: f.reason.value
    }).then(function () { e.target.reset(); load(); })
      .catch(function (err) { $('blockError').textContent = err.message; });
  });

  if (token) load(); else showLogin();
})();
