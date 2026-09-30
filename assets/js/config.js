/*
 * Zsófi Masszázs – központi adatok.
 * Ezt a fájlt a böngésző ÉS a szerver (server.js) is használja,
 * így a nyitvatartás és a szolgáltatások csak itt módosítandók.
 *
 * Forrás: facebook.com/zsofimasszazstat és zsofimasszazs.hu (nyilvános adatok).
 */
(function (root) {
  var SITE_CONFIG = {
    business: {
      name: 'Zsófi Masszázs',
      owner: 'Kosztolányi Zsófia',
      title: 'Természetgyógyász, reflexológus',
      phoneDisplay: '+36 70 602 8888',
      phoneHref: '+36706028888',
      email: 'markujzsofi@gmail.com',
      address: 'Fő út 126.',
      city: 'Tát',
      zip: '2534',
      facebook: 'https://www.facebook.com/zsofimasszazstat/',
      messenger: 'https://m.me/zsofimasszazstat',
      website: 'https://zsofimasszazs.hu/',
      mapQuery: 'Tát, Fő út 126'
    },

    timeZone: 'Europe/Budapest',

    // Nyitvatartás (csak előzetes bejelentkezéssel). 0 = vasárnap … 6 = szombat.
    openingHours: {
      0: null,
      1: { open: '14:00', close: '19:00' },
      2: { open: '09:00', close: '14:00' },
      3: { open: '09:00', close: '14:00' },
      4: { open: '08:00', close: '13:00' },
      5: { open: '09:00', close: '14:00' },
      6: null
    },

    booking: {
      slotStepMinutes: 30,      // kezdési időpontok rácsa
      daysAhead: 60,            // ennyi napra előre lehet foglalni
      minNoticeMinutes: 120,    // legalább ennyivel előre kell foglalni
      apiBase: '/api'
    },

    // price: null esetén „ár egyeztetés alapján” jelenik meg.
    services: [
      {
        id: 'masszazs',
        name: 'Aromaterápiás relaxáló masszázs',
        short: 'Masszázs',
        duration: 60,
        price: null,
        description: 'Nyugodt, csendes környezetben, meleg, fűtött szobában, halk hangulatzene mellett – természetes alapanyagú, illatos masszázsolajokkal. Oldja a feszültséget, felfrissít és ellazít.'
      },
      {
        id: 'talpreflexologia',
        name: 'Talpreflexológia',
        short: 'Talpreflexológia',
        duration: 60,
        price: null,
        description: 'A talp reflexzónáinak és pontjainak különböző erősségű nyomásával támogatja a szervezet öngyógyító folyamatait, harmóniát teremt, csökkentheti a szorongást és a feszültséget. Az első alkalommal részletes állapotfelmérés: kikérdezés és a talpzónák átvizsgálása.'
      },
      {
        id: 'fulakupunktura',
        name: 'Fülakupunktúra',
        short: 'Fülakupunktúra',
        duration: 30,
        price: null,
        description: 'A fülkagyló reflexpontjainak célzott ingerlése – a test „kicsinyített térképén” keresztül támogatja a szervezet egyensúlyát. Önállóan vagy a talpreflexológia kiegészítéseként is kérhető.'
      },
      {
        id: 'ews-freq',
        name: 'EWS FREQ® kezelés',
        short: 'EWS FREQ®',
        duration: 30,
        price: null,
        description: 'Fájdalommentes, mellékhatás nélküli frekvenciás kezelés, amely a környezeti terhelések, méreganyagok és elektronikus eszközök okozta rezgésbeli egyensúlyvesztés optimalizálását célozza.',
        note: 'Nem alkalmazható pacemakerrel élőknél, 10 év alatti gyermekeknél és várandósság idején.'
      },
      {
        id: 'ews-analizis',
        name: 'EWS energetikai kockázatelemzés',
        short: 'EWS elemzés',
        duration: 30,
        price: null,
        description: 'Kevesebb mint egy perc alatt kb. 32 területen ad képet a szervezet pillanatnyi energetikai állapotáról, kiemelve a legnagyobb energetikai kockázatot jelentő területeket.',
        note: 'A felmérés tájékoztató jellegű, nem minősül orvosi diagnózisnak.'
      },
      {
        id: 'bach',
        name: 'Bach-virágterápia',
        short: 'Bach-virág',
        duration: 60,
        price: null,
        description: 'Személyre szabott, beszélgetésen alapuló konzultáció, amelynek során az aktuális érzelmi állapothoz illő virágeszencia-keveréket állítjuk össze.'
      }
    ]
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SITE_CONFIG;
  } else {
    root.SITE_CONFIG = SITE_CONFIG;
  }
})(typeof window !== 'undefined' ? window : globalThis);
