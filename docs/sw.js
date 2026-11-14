// Çevrimdışı çalışma: uygulama dosyaları önbelleğe alınır.
// Önce ağ denenir (yeni sürüm gelsin), ağ yoksa önbellekten açılır.
const SURUM = 'choreo-20261114031606';
const DOSYALAR = ['./', './index.html', './manifest.webmanifest', './simgeler/simge-180.png', './simgeler/simge-192.png', './simgeler/simge-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SURUM).then((c) => c.addAll(DOSYALAR)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((anahtarlar) => Promise.all(anahtarlar.filter((k) => k !== SURUM).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  const kaydet = (yanit) => { const kopya = yanit.clone(); caches.open(SURUM).then((c) => c.put(e.request, kopya)); return yanit; };
  if (u.origin === self.location.origin) {
    e.respondWith(
      fetch(e.request).then(kaydet).catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
    );
  } else if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') {
    // yazı tipleri: önce önbellek
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then(kaydet)));
  }
});
