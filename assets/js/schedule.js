/*
 * Közös időpont-logika a böngészőnek és a szervernek.
 * Minden idő Europe/Budapest helyi időben, "YYYY-MM-DD" és "HH:MM" formában.
 */
(function (root) {
  function toMin(hhmm) {
    var p = hhmm.split(':');
    return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
  }

  function toHHMM(min) {
    var h = Math.floor(min / 60);
    var m = min % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  // Aktuális dátum és perc a megadott időzónában.
  function nowIn(timeZone, date) {
    var parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(date || new Date());
    var o = {};
    parts.forEach(function (p) { o[p.type] = p.value; });
    return { date: o.year + '-' + o.month + '-' + o.day, minutes: toMin(o.hour + ':' + o.minute) };
  }

  function parseDate(str) {
    var p = str.split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  }

  function formatDate(d) {
    return d.toISOString().slice(0, 10);
  }

  function addDays(str, n) {
    var d = parseDate(str);
    d.setUTCDate(d.getUTCDate() + n);
    return formatDate(d);
  }

  function weekday(str) {
    return parseDate(str).getUTCDay();
  }

  function isValidDate(str) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
    return formatDate(parseDate(str)) === str;
  }

  function hoursFor(config, dateStr) {
    return config.openingHours[weekday(dateStr)] || null;
  }

  function overlaps(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && bStart < aEnd;
  }

  /*
   * Egy nap összes lehetséges kezdési időpontja az adott szolgáltatáshoz.
   * busy: [{ date, start, end }] – foglalások és tiltott sávok.
   * Visszaad: [{ time, available, reason }]  reason: 'past' | 'booked'
   */
  function slotsForDay(config, dateStr, duration, busy, now) {
    var hours = hoursFor(config, dateStr);
    if (!hours) return [];
    now = now || nowIn(config.timeZone);
    var step = config.booking.slotStepMinutes;
    var open = toMin(hours.open);
    var close = toMin(hours.close);
    var earliest = null;
    if (dateStr === now.date) earliest = now.minutes + config.booking.minNoticeMinutes;
    else if (dateStr < now.date) earliest = Infinity;

    var dayBusy = (busy || []).filter(function (b) { return b.date === dateStr; });
    var out = [];
    for (var t = open; t + duration <= close; t += step) {
      var reason = null;
      if (earliest !== null && t < earliest) reason = 'past';
      else if (dayBusy.some(function (b) { return overlaps(t, t + duration, toMin(b.start), toMin(b.end)); })) reason = 'booked';
      out.push({ time: toHHMM(t), available: !reason, reason: reason });
    }
    return out;
  }

  function isBookable(config, dateStr, time, duration, busy, now) {
    now = now || nowIn(config.timeZone);
    var last = addDays(now.date, config.booking.daysAhead);
    if (!isValidDate(dateStr) || dateStr > last) return false;
    return slotsForDay(config, dateStr, duration, busy, now).some(function (s) {
      return s.time === time && s.available;
    });
  }

  var api = {
    toMin: toMin,
    toHHMM: toHHMM,
    nowIn: nowIn,
    addDays: addDays,
    weekday: weekday,
    isValidDate: isValidDate,
    hoursFor: hoursFor,
    overlaps: overlaps,
    slotsForDay: slotsForDay,
    isBookable: isBookable
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Schedule = api;
})(typeof window !== 'undefined' ? window : globalThis);
