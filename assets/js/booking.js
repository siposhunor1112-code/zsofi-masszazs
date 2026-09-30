(function () {
  'use strict';

  var C = window.SITE_CONFIG;
  var S = window.Schedule;
  var B = C.business;
  var API = C.booking.apiBase;

  var state = {
    service: null,
    date: null,
    time: null,
    busy: [],
    online: false,
    loaded: false,
    today: S.nowIn(C.timeZone).date,
    month: null // "YYYY-MM"
  };
  state.lastDay = S.addDays(state.today, C.booking.daysAhead);
  state.month = state.today.slice(0, 7);

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    chips: $('serviceChips'),
    calTitle: $('calTitle'),
    calGrid: $('calGrid'),
    calPrev: $('calPrev'),
    calNext: $('calNext'),
    slots: $('slots'),
    slotDateLabel: $('slotDateLabel'),
    form: $('bookingForm'),
    error: $('formError'),
    submit: $('submitBtn'),
    sumService: $('sumService'),
    sumDuration: $('sumDuration'),
    sumDate: $('sumDate'),
    sumTime: $('sumTime'),
    modeNote: $('modeNote'),
    shell: $('booking'),
    success: $('bookingSuccess'),
    successTitle: $('successTitle'),
    successText: $('successText'),
    calendarLink: $('calendarLink'),
    newBooking: $('newBooking'),
    nextFree: $('nextFree')
  };

  /* ---------- Formázás ---------- */

  function utcDate(str) {
    var p = str.split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12));
  }

  function fmtLong(str) {
    return new Intl.DateTimeFormat('hu-HU', { month: 'long', day: 'numeric', weekday: 'long', timeZone: 'UTC' }).format(utcDate(str));
  }

  function fmtMonth(ym) {
    return new Intl.DateTimeFormat('hu-HU', { year: 'numeric', month: 'long', timeZone: 'UTC' }).format(utcDate(ym + '-01'));
  }

  function fmtRelative(str) {
    if (str === state.today) return 'Ma';
    if (str === S.addDays(state.today, 1)) return 'Holnap';
    var s = fmtLong(str);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function shortTime(t) { return t.replace(/^0/, ''); }

  /* ---------- Szolgáltatás ---------- */

  function minDuration() {
    return Math.min.apply(null, C.services.map(function (s) { return s.duration; }));
  }

  function currentDuration() {
    return state.service ? state.service.duration : minDuration();
  }

  function renderChips() {
    el.chips.innerHTML = C.services.map(function (s) {
      var on = state.service && state.service.id === s.id;
      return '<button type="button" class="chip" role="radio" aria-checked="' + on + '" data-id="' + s.id + '">' +
        s.short + ' <small>' + s.duration + ' perc</small></button>';
    }).join('');
  }

  function selectService(id) {
    var s = C.services.find(function (x) { return x.id === id; });
    if (!s) return;
    state.service = s;
    // Ha a már kiválasztott időpont az új időtartammal nem fér bele, töröljük.
    if (state.time && !S.isBookable(C, state.date, state.time, s.duration, state.busy)) state.time = null;
    renderAll();
  }

  el.chips.addEventListener('click', function (e) {
    var chip = e.target.closest('.chip');
    if (chip) selectService(chip.dataset.id);
  });

  document.addEventListener('booking:select-service', function (e) { selectService(e.detail); });

  /* ---------- Naptár ---------- */

  function dayStatus(dateStr) {
    if (dateStr < state.today || dateStr > state.lastDay) return { cls: 'off', free: 0 };
    var slots = S.slotsForDay(C, dateStr, currentDuration(), state.busy);
    if (!slots.length) return { cls: 'off', free: 0 };
    var free = slots.filter(function (s) { return s.available; }).length;
    if (!free) return { cls: 'off', free: 0 };
    return { cls: free <= 2 ? 'few' : 'free', free: free };
  }

  function renderCalendar() {
    var ym = state.month;
    var first = ym + '-01';
    var offset = (S.weekday(first) + 6) % 7; // hétfővel kezdődő hét
    var html = '';
    for (var i = 0; i < offset; i++) html += '<span class="cal-empty"></span>';

    var d = first;
    while (d.slice(0, 7) === ym) {
      var st = dayStatus(d);
      var day = +d.slice(8);
      var label = fmtLong(d) + (st.cls === 'off' ? ', nem foglalható' : ', ' + st.free + ' szabad időpont');
      html += '<button type="button" class="cal-day ' + st.cls + (d === state.today ? ' today' : '') + '"' +
        ' data-date="' + d + '" aria-pressed="' + (d === state.date) + '" aria-label="' + label + '"' +
        (st.cls === 'off' ? ' disabled' : '') + '>' + day + '</button>';
      d = S.addDays(d, 1);
    }
    el.calGrid.innerHTML = html;
    el.calTitle.textContent = fmtMonth(ym);
    el.calPrev.disabled = ym <= state.today.slice(0, 7);
    el.calNext.disabled = ym >= state.lastDay.slice(0, 7);
  }

  function shiftMonth(n) {
    var p = state.month.split('-');
    var dt = new Date(Date.UTC(+p[0], +p[1] - 1 + n, 1));
    state.month = dt.toISOString().slice(0, 7);
    renderCalendar();
  }

  el.calPrev.addEventListener('click', function () { shiftMonth(-1); });
  el.calNext.addEventListener('click', function () { shiftMonth(1); });

  el.calGrid.addEventListener('click', function (e) {
    var b = e.target.closest('.cal-day');
    if (!b || b.disabled) return;
    state.date = b.dataset.date;
    state.time = null;
    renderAll();
    if (window.matchMedia('(max-width: 860px)').matches) {
      document.querySelector('[data-step="3"]').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  /* ---------- Időpontok ---------- */

  function renderSlots() {
    if (!state.loaded) {
      el.slots.innerHTML = new Array(9).join('<div class="skeleton"></div>');
      return;
    }
    if (!state.date) {
      el.slotDateLabel.textContent = '';
      el.slots.innerHTML = '<p class="muted">Először válasszon napot a naptárban.</p>';
      return;
    }
    el.slotDateLabel.textContent = fmtRelative(state.date);
    var slots = S.slotsForDay(C, state.date, currentDuration(), state.busy);
    if (!slots.length) {
      el.slots.innerHTML = '<p class="muted">Ezen a napon zárva vagyok.</p>';
      return;
    }
    el.slots.innerHTML = slots.map(function (s) {
      var label = s.reason === 'booked' ? 'foglalt' : s.reason === 'past' ? 'nem elérhető' : '';
      return '<button type="button" class="slot" data-time="' + s.time + '"' +
        (s.available ? '' : ' disabled') + ' aria-pressed="' + (s.time === state.time) + '"' +
        ' aria-label="' + s.time + (label ? ', ' + label : ', szabad') + '">' +
        '<span class="t">' + shortTime(s.time) + '</span>' + (label ? '<small>' + label + '</small>' : '') +
        '</button>';
    }).join('');
  }

  el.slots.addEventListener('click', function (e) {
    var b = e.target.closest('.slot');
    if (!b || b.disabled) return;
    state.time = b.dataset.time;
    renderAll();
    if (window.matchMedia('(max-width: 860px)').matches) {
      el.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  /* ---------- Összegzés és lépések ---------- */

  function endTime() {
    return S.toHHMM(S.toMin(state.time) + state.service.duration);
  }

  function renderSummary() {
    el.sumService.textContent = state.service ? state.service.name : '–';
    el.sumDuration.textContent = state.service ? state.service.duration + ' perc' : '–';
    el.sumDate.textContent = state.date ? fmtRelative(state.date) : '–';
    el.sumTime.textContent = state.time && state.service ? shortTime(state.time) + ' – ' + shortTime(endTime()) : '–';
    el.submit.disabled = !(state.service && state.date && state.time);
    el.submit.textContent = state.online ? 'Foglalás véglegesítése' : 'Foglalási kérés küldése';

    var steps = document.querySelectorAll('.b-step');
    var done = [!!state.service, !!state.date, !!state.time, false];
    var unlocked = [true, !!state.service, !!state.service && !!state.date, !!state.time];
    steps.forEach(function (s, i) {
      s.classList.toggle('is-done', done[i]);
      s.classList.toggle('is-locked', !unlocked[i]);
    });
  }

  function renderNextFree() {
    if (!state.loaded) return;
    if (!state.online) { el.nextFree.textContent = 'Egyeztessünk telefonon'; return; }
    for (var i = 0; i <= C.booking.daysAhead; i++) {
      var d = S.addDays(state.today, i);
      var free = S.slotsForDay(C, d, minDuration(), state.busy).find(function (s) { return s.available; });
      if (free) { el.nextFree.textContent = fmtRelative(d).split(',')[0] + ' ' + shortTime(free.time); return; }
    }
    el.nextFree.textContent = 'Hívjon bátran';
  }

  function renderAll() {
    renderChips();
    renderCalendar();
    renderSlots();
    renderSummary();
  }

  /* ---------- Adatok betöltése ---------- */

  function loadAvailability() {
    return fetch(API + '/availability', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        state.online = true;
        state.busy = data.busy || [];
        if (data.today) {
          state.today = data.today;
          state.lastDay = S.addDays(state.today, C.booking.daysAhead);
        }
      })
      .catch(function () {
        // Statikus tárhelyen (pl. GitHub Pages) nincs szerver: a foglalás kérésként megy e-mailben/SMS-ben.
        state.online = false;
        state.busy = [];
        el.modeNote.textContent = 'A kérését Zsófi személyesen igazolja vissza telefonon vagy üzenetben. Lemondás: legalább 24 órával korábban.';
      })
      .then(function () {
        if (!state.loaded && !state.date) {
          // Első betöltéskor az első foglalható napot tartalmazó hónapot mutatjuk.
          for (var i = 0; i <= C.booking.daysAhead; i++) {
            var d = S.addDays(state.today, i);
            if (dayStatus(d).cls !== 'off') { state.month = d.slice(0, 7); break; }
          }
        }
        state.loaded = true;
        if (state.time && state.service && !S.isBookable(C, state.date, state.time, state.service.duration, state.busy)) {
          state.time = null;
          showError('Az Ön által kiválasztott időpontot időközben lefoglalták. Kérjük, válasszon másikat.');
        }
        renderAll();
        renderNextFree();
      });
  }

  // Frissítés, hogy a mások által közben lefoglalt időpontok is látszódjanak.
  setInterval(function () { if (!document.hidden && state.online) loadAvailability(); }, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && state.online) loadAvailability(); });

  /* ---------- Beküldés ---------- */

  function showError(msg) { el.error.textContent = msg || ''; }

  function validate(data) {
    var f = el.form;
    var ok = true;
    [['name', data.name.length >= 2], ['phone', /^[+0-9 ()/-]{7,}$/.test(data.phone)],
     ['email', !data.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)]].forEach(function (p) {
      f.elements[p[0]].setAttribute('aria-invalid', String(!p[1]));
      if (!p[1]) ok = false;
    });
    if (!ok) return 'Kérjük, ellenőrizze a pirossal jelölt mezőket.';
    if (!data.consent) return 'A foglaláshoz kérjük, fogadja el az adatkezelési tájékoztatót.';
    return '';
  }

  function formData() {
    var f = el.form.elements;
    return {
      serviceId: state.service && state.service.id,
      date: state.date,
      time: state.time,
      name: f.name.value.trim(),
      phone: f.phone.value.trim(),
      email: f.email.value.trim(),
      note: f.note.value.trim(),
      website: f.website.value,
      consent: f.consent.checked
    };
  }

  el.form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!(state.service && state.date && state.time)) return;
    var data = formData();
    var err = validate(data);
    showError(err);
    if (err) return;

    if (!state.online) return offlineRequest(data);

    el.submit.disabled = true;
    el.submit.textContent = 'Foglalás folyamatban…';
    fetch(API + '/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
      .then(function (res) {
        if (res.status === 201) return showSuccess(data, true);
        showError(res.body.error || 'Hiba történt. Kérjük, próbálja újra, vagy hívjon telefonon.');
        if (res.status === 409) { state.time = null; loadAvailability(); }
        else renderSummary();
      })
      .catch(function () {
        showError('Nem sikerült kapcsolódni. Kérjük, próbálja újra, vagy hívjon: ' + B.phoneDisplay);
        renderSummary();
      });
  });

  function requestText(d) {
    return 'Kedves Zsófi! Időpontot szeretnék foglalni.\n' +
      'Kezelés: ' + state.service.name + ' (' + state.service.duration + ' perc)\n' +
      'Időpont: ' + fmtLong(d.date) + ', ' + shortTime(d.time) + '\n' +
      'Név: ' + d.name + '\nTelefon: ' + d.phone +
      (d.email ? '\nE-mail: ' + d.email : '') +
      (d.note ? '\nMegjegyzés: ' + d.note : '');
  }

  function offlineRequest(d) {
    var text = requestText(d);
    var smsSep = /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent) ? '&' : '?';
    d.links = {
      sms: 'sms:' + B.phoneHref + smsSep + 'body=' + encodeURIComponent(text),
      mail: 'mailto:' + B.email + '?subject=' + encodeURIComponent('Időpontfoglalás – ' + d.name) + '&body=' + encodeURIComponent(text)
    };
    showSuccess(d, false);
  }

  /* ---------- Siker ---------- */

  // Budapesti helyi idő → UTC ("YYYYMMDDTHHMMSSZ") az .ics fájlhoz.
  function toUtcStamp(dateStr, hhmm) {
    var p = dateStr.split('-');
    var m = S.toMin(hhmm);
    var guess = Date.UTC(+p[0], +p[1] - 1, +p[2], Math.floor(m / 60), m % 60);
    var local = S.nowIn(C.timeZone, new Date(guess));
    var diff = (Date.UTC(+local.date.slice(0, 4), +local.date.slice(5, 7) - 1, +local.date.slice(8, 10)) / 60000 + local.minutes) -
               (Date.UTC(+p[0], +p[1] - 1, +p[2]) / 60000 + m);
    return new Date(guess - diff * 60000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  function icsHref(d) {
    var end = S.toHHMM(S.toMin(d.time) + state.service.duration);
    var ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Zsofi Masszazs//HU', 'BEGIN:VEVENT',
      'UID:' + Date.now() + '@zsofimasszazs.hu',
      'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''),
      'DTSTART:' + toUtcStamp(d.date, d.time),
      'DTEND:' + toUtcStamp(d.date, end),
      'SUMMARY:' + state.service.name + ' – Zsófi Masszázs',
      'LOCATION:' + B.zip + ' ' + B.city + '\\, ' + B.address,
      'DESCRIPTION:Telefon: ' + B.phoneDisplay,
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
    return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
  }

  function showSuccess(d, confirmed) {
    var when = fmtLong(d.date) + ', ' + shortTime(d.time);
    if (confirmed) {
      el.successTitle.textContent = 'Köszönöm, várom szeretettel!';
      el.successText.innerHTML = 'Foglalása rögzítve: <strong>' + state.service.name + '</strong><br>' + when +
        '<br><br>Cím: ' + B.zip + ' ' + B.city + ', ' + B.address + '<br>Ha közbejön valami, kérem, jelezze a <a href="tel:' + B.phoneHref + '">' + B.phoneDisplay + '</a> számon.';
      el.calendarLink.hidden = false;
      el.calendarLink.href = icsHref(d);
    } else {
      el.successTitle.textContent = 'Már csak el kell küldenie';
      el.successText.innerHTML = 'A kérés elkészült: <strong>' + state.service.name + '</strong>, ' + when + '.' +
        '<br>Küldje el SMS-ben vagy e-mailben – Zsófi hamarosan visszaigazolja az időpontot.' +
        '<span class="success-actions">' +
          '<a class="btn btn-primary" href="' + d.links.sms + '">SMS küldése</a>' +
          '<a class="btn btn-ghost" href="' + d.links.mail + '">E-mail küldése</a>' +
        '</span>' +
        'Vagy írjon <a href="' + B.messenger + '" target="_blank" rel="noopener">Messengeren</a>, illetve hívja a <a href="tel:' + B.phoneHref + '">' + B.phoneDisplay + '</a> számot.';
      el.calendarLink.hidden = true;
    }
    el.shell.hidden = true;
    el.success.hidden = false;
    el.success.focus();
    el.success.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  el.newBooking.addEventListener('click', function () {
    el.form.reset();
    state.date = null;
    state.time = null;
    showError('');
    el.success.hidden = true;
    el.shell.hidden = false;
    loadAvailability();
    document.getElementById('foglalas').scrollIntoView({ behavior: 'smooth' });
  });

  el.form.addEventListener('input', function (e) {
    if (e.target.getAttribute('aria-invalid') === 'true') e.target.removeAttribute('aria-invalid');
  });

  /* ---------- Indítás ---------- */
  renderAll();
  loadAvailability();
})();
