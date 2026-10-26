// Klar Schiff – Service Worker: Offline-Nutzung und Push-Nachrichten.
const CACHE = 'klar-schiff-v3';
const SHELL = ['./', './index.html', './styles.css', './app.js', './plan.js', './catalog.js', './config.js',
  './vendor/supabase.js', './manifest.webmanifest', './icons/icon-180.png', './icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Erst das Netz fragen (damit Updates sofort ankommen), offline aus dem Speicher laden.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== self.location.origin && !font) return;
  e.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([fetch(req), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))]);
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') { const shell = await cache.match('./index.html'); if (shell) return shell; }
    throw err;
  }
}

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil((async () => {
    await self.registration.showNotification(d.title || 'Klar Schiff', {
      body: d.body || '', tag: d.tag || undefined, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
      data: { url: d.url || './' }
    });
    try {
      if (typeof d.badge === 'number' && self.navigator.setAppBadge) {
        d.badge > 0 ? await self.navigator.setAppBadge(d.badge) : await self.navigator.clearAppBadge();
      }
    } catch (_) {}
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow(e.notification.data?.url || './');
  }));
});
