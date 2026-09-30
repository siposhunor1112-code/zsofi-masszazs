'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'zsofi-'));
process.env.ADMIN_PASSWORD = 'titok';

const config = require('../assets/js/config.js');
const S = require('../assets/js/schedule.js');
const server = require('../server.js');

let base;

test.before(() => new Promise((resolve) => {
  server.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); });
}));
test.after(() => new Promise((resolve) => server.close(resolve)));

// A következő olyan nap, amikor a megadott időpont nyitvatartáson belül van.
function nextOpenDay(time, duration) {
  const now = S.nowIn(config.timeZone);
  for (let i = 1; i < 30; i++) {
    const d = S.addDays(now.date, i);
    if (S.slotsForDay(config, d, duration, [], now).some((s) => s.time === time && s.available)) return d;
  }
  throw new Error('nincs nyitott nap');
}

const post = (body) => fetch(`${base}/api/bookings`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
});

test('slotsForDay: hétvégén zárva, a nyitvatartáson belül maradnak az időpontok', () => {
  const now = { date: '2026-01-01', minutes: 0 };
  assert.deepStrictEqual(S.slotsForDay(config, '2026-10-03', 60, [], now), []); // szombat
  const mon = S.slotsForDay(config, '2026-10-05', 60, [], now); // hétfő 14–19
  assert.strictEqual(mon[0].time, '14:00');
  assert.strictEqual(mon[mon.length - 1].time, '18:00');
  const busy = [{ date: '2026-10-05', start: '15:00', end: '16:00' }];
  const withBusy = S.slotsForDay(config, '2026-10-05', 60, busy, now);
  assert.strictEqual(withBusy.find((s) => s.time === '14:30').reason, 'booked');
  assert.strictEqual(withBusy.find((s) => s.time === '14:00').available, true);
  assert.strictEqual(withBusy.find((s) => s.time === '16:00').available, true);
});

test('foglalás, ütközés és foglalt időpont megjelenése', async () => {
  const service = config.services.find((s) => s.duration === 60);
  const date = nextOpenDay('10:00', 60);
  const body = { serviceId: service.id, date, time: '10:00', name: 'Teszt Elek', phone: '+36 30 123 4567', consent: true };

  const r1 = await post(body);
  assert.strictEqual(r1.status, 201);

  const r2 = await post(Object.assign({}, body, { time: '10:30' }));
  assert.strictEqual(r2.status, 409, 'átfedő foglalás elutasítva');

  const av = await (await fetch(`${base}/api/availability`)).json();
  const slot = av.busy.find((b) => b.date === date);
  assert.deepStrictEqual(slot, { date, start: '10:00', end: '11:00' });
  assert.ok(!JSON.stringify(av).includes('Teszt'), 'személyes adat nem szivároghat ki');
});

test('érvénytelen kérések elutasítása', async () => {
  const date = nextOpenDay('12:00', 30);
  const ok = { serviceId: 'fulakupunktura', date, time: '12:00', name: 'Anna', phone: '+36301234567', consent: true };
  assert.strictEqual((await post(Object.assign({}, ok, { consent: false }))).status, 400);
  assert.strictEqual((await post(Object.assign({}, ok, { time: '20:00' }))).status, 409);
  assert.strictEqual((await post(Object.assign({}, ok, { date: '2020-01-06' }))).status, 409);
  assert.strictEqual((await post(Object.assign({}, ok, { serviceId: 'nincs' }))).status, 400);
});

test('admin: jelszó, letiltás, lemondás', async () => {
  assert.strictEqual((await fetch(`${base}/api/admin/data`)).status, 401);
  const auth = { Authorization: 'Bearer titok', 'Content-Type': 'application/json' };

  const date = nextOpenDay('11:00', 30);
  const blk = await fetch(`${base}/api/admin/blocks`, { method: 'POST', headers: auth, body: JSON.stringify({ date }) });
  assert.strictEqual(blk.status, 201);
  const r = await post({ serviceId: 'fulakupunktura', date, time: '11:00', name: 'Béla', phone: '+36301234567', consent: true });
  assert.strictEqual(r.status, 409, 'letiltott napra nem lehet foglalni');

  const data = await (await fetch(`${base}/api/admin/data`, { headers: auth })).json();
  const booking = data.bookings[0];
  const del = await fetch(`${base}/api/admin/bookings/${booking.id}`, { method: 'DELETE', headers: auth });
  assert.strictEqual(del.status, 200);
  const av = await (await fetch(`${base}/api/availability`)).json();
  assert.ok(!av.busy.some((b) => b.date === booking.date && b.start === booking.start), 'lemondott időpont újra szabad');
});

test('statikus fájlok: csak a publikus útvonalak', async () => {
  assert.strictEqual((await fetch(`${base}/`)).status, 200);
  assert.strictEqual((await fetch(`${base}/server.js`)).status, 404);
  assert.strictEqual((await fetch(`${base}/data/bookings.json`)).status, 404);
  assert.strictEqual((await fetch(`${base}/assets/../server.js`)).status, 404);
});
