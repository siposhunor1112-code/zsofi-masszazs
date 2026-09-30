/*
 * Zsófi Masszázs – kiszolgáló és időpontfoglalási API.
 * Függőségek nélkül fut: `node server.js`
 *
 * Környezeti változók:
 *   PORT            – port (alapértelmezés: 3000)
 *   ADMIN_PASSWORD  – jelszó az /admin.html felülethez (kötelező az admin funkciókhoz)
 *   DATA_DIR        – az adatfájl mappája (alapértelmezés: ./data)
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const config = require('./assets/js/config.js');
const Schedule = require('./assets/js/schedule.js');

const PORT = parseInt(process.env.PORT || '3000', 10);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'bookings.json');

const PUBLIC_PATHS = ['/index.html', '/admin.html', '/assets/', '/favicon.svg', '/robots.txt'];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2'
};

/* ---------- Adattárolás ---------- */

function loadData() {
  try {
    const d = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return { bookings: d.bookings || [], blocks: d.blocks || [] };
  } catch (e) {
    if (e.code !== 'ENOENT') console.error('Adatfájl olvasási hiba:', e.message);
    return { bookings: [], blocks: [] };
  }
}

let db = loadData();

function saveData() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

function busyList() {
  return db.bookings
    .filter((b) => b.status !== 'cancelled')
    .map((b) => ({ date: b.date, start: b.start, end: b.end }))
    .concat(db.blocks.map((b) => ({ date: b.date, start: b.start, end: b.end })));
}

/* ---------- Segédfüggvények ---------- */

function send(res, status, body, headers) {
  const isObj = typeof body === 'object';
  res.writeHead(status, Object.assign({
    'Content-Type': isObj ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store'
  }, headers || {}));
  res.end(isObj ? JSON.stringify(body) : body);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('too_large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch (e) { reject(new Error('bad_json')); }
    });
    req.on('error', reject);
  });
}

function clean(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function isAdmin(req) {
  if (!ADMIN_PASSWORD) return false;
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  const a = crypto.createHash('sha256').update(token).digest();
  const b = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}

// Egyszerű, IP-alapú korlátozás a foglalási végpontra.
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 60 * 60 * 1000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 10;
}

/* ---------- API ---------- */

async function handleApi(req, res, url) {
  const route = url.pathname.replace(/^\/api/, '');

  // Foglalt sávok (személyes adatok nélkül).
  if (req.method === 'GET' && route === '/availability') {
    const now = Schedule.nowIn(config.timeZone);
    const to = Schedule.addDays(now.date, config.booking.daysAhead);
    const busy = busyList().filter((b) => b.date >= now.date && b.date <= to);
    return send(res, 200, { today: now.date, busy });
  }

  if (req.method === 'POST' && route === '/bookings') {
    const ip = req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : req.socket.remoteAddress;
    if (rateLimited(ip)) return send(res, 429, { error: 'Túl sok próbálkozás. Kérjük, próbálja később, vagy hívjon telefonon.' });

    let body;
    try { body = await readBody(req, 10 * 1024); }
    catch (e) { return send(res, 400, { error: 'Érvénytelen kérés.' }); }

    if (body.website) return send(res, 201, { ok: true }); // honeypot

    const service = config.services.find((s) => s.id === body.serviceId);
    const date = clean(body.date, 10);
    const time = clean(body.time, 5);
    const name = clean(body.name, 80);
    const phone = clean(body.phone, 30);
    const email = clean(body.email, 120);
    const note = clean(body.note, 500);

    if (!service) return send(res, 400, { error: 'Kérjük, válasszon szolgáltatást.' });
    if (!Schedule.isValidDate(date) || !/^\d{2}:\d{2}$/.test(time)) return send(res, 400, { error: 'Érvénytelen időpont.' });
    if (name.length < 2) return send(res, 400, { error: 'Kérjük, adja meg a nevét.' });
    if (!/^[+0-9 ()/-]{7,}$/.test(phone)) return send(res, 400, { error: 'Kérjük, adjon meg érvényes telefonszámot.' });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(res, 400, { error: 'Az e-mail cím formátuma hibás.' });
    if (!body.consent) return send(res, 400, { error: 'A foglaláshoz el kell fogadni az adatkezelési tájékoztatót.' });

    // A Node egyszálú, és innentől nincs await – az ellenőrzés és a mentés atomi.
    if (!Schedule.isBookable(config, date, time, service.duration, busyList())) {
      return send(res, 409, { error: 'Ez az időpont időközben foglalttá vált. Kérjük, válasszon másikat.' });
    }

    const booking = {
      id: crypto.randomUUID(),
      serviceId: service.id,
      serviceName: service.name,
      date,
      start: time,
      end: Schedule.toHHMM(Schedule.toMin(time) + service.duration),
      name, phone, email, note,
      status: 'confirmed',
      createdAt: new Date().toISOString()
    };
    db.bookings.push(booking);
    saveData();
    console.log(`Új foglalás: ${booking.date} ${booking.start} – ${booking.serviceName} – ${booking.name}`);
    return send(res, 201, { ok: true, booking: { id: booking.id, date, start: booking.start, end: booking.end, serviceName: service.name } });
  }

  /* --- Admin --- */
  if (route.startsWith('/admin/')) {
    if (!ADMIN_PASSWORD) return send(res, 503, { error: 'Az admin felület nincs beállítva (ADMIN_PASSWORD).' });
    if (!isAdmin(req)) return send(res, 401, { error: 'Hibás jelszó.' });

    if (req.method === 'GET' && route === '/admin/data') {
      return send(res, 200, db);
    }

    let m = route.match(/^\/admin\/bookings\/([\w-]+)$/);
    if (m && req.method === 'DELETE') {
      const b = db.bookings.find((x) => x.id === m[1]);
      if (!b) return send(res, 404, { error: 'Nem található.' });
      b.status = 'cancelled';
      b.cancelledAt = new Date().toISOString();
      saveData();
      return send(res, 200, { ok: true });
    }

    if (req.method === 'POST' && route === '/admin/blocks') {
      let body;
      try { body = await readBody(req, 4 * 1024); }
      catch (e) { return send(res, 400, { error: 'Érvénytelen kérés.' }); }
      const date = clean(body.date, 10);
      if (!Schedule.isValidDate(date)) return send(res, 400, { error: 'Érvénytelen dátum.' });
      let start = clean(body.start, 5) || '00:00';
      let end = clean(body.end, 5) || '23:59';
      if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) || start >= end) {
        return send(res, 400, { error: 'Érvénytelen idősáv.' });
      }
      const block = { id: crypto.randomUUID(), date, start, end, reason: clean(body.reason, 120) };
      db.blocks.push(block);
      saveData();
      return send(res, 201, { ok: true, block });
    }

    m = route.match(/^\/admin\/blocks\/([\w-]+)$/);
    if (m && req.method === 'DELETE') {
      const before = db.blocks.length;
      db.blocks = db.blocks.filter((x) => x.id !== m[1]);
      if (db.blocks.length === before) return send(res, 404, { error: 'Nem található.' });
      saveData();
      return send(res, 200, { ok: true });
    }
  }

  return send(res, 404, { error: 'Nem található.' });
}

/* ---------- Statikus fájlok ---------- */

function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  if (!PUBLIC_PATHS.some((allowed) => allowed.endsWith('/') ? p.startsWith(allowed) : p === allowed)) {
    return send(res, 404, 'Nem található');
  }
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT + path.sep)) return send(res, 403, 'Tiltott');
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Nem található');
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff'
    });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url).catch((e) => {
      console.error(e);
      send(res, 500, { error: 'Szerverhiba. Kérjük, hívjon telefonon.' });
    });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Nem engedélyezett');
  serveStatic(req, res, url);
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Zsófi Masszázs fut: http://localhost:${PORT}`);
    if (!ADMIN_PASSWORD) console.log('Figyelem: ADMIN_PASSWORD nincs beállítva, az admin felület ki van kapcsolva.');
  });
}

module.exports = server;
