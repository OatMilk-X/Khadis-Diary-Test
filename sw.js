/* Khadi's Diary service worker: offline app shell.
   Bump VERSION whenever you deploy a new index.html. */
const VERSION = 'v5.2.0';
// The test copy (any address other than the live one) keeps its own caches, so it never touches the live app's.
const TEST = !(self.location.hostname === 'oatmilk-x.github.io' && /^\/khadi-s-diary\//i.test(self.location.pathname));
const PREFIX = TEST ? 'kdtest-' : 'khadis-diary-';
const CACHE = PREFIX + VERSION;
const SHELL = ['./', './index.html', './manifest.webmanifest', './manifest-test.webmanifest', './icon-192.png', './icon-512.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, u.startsWith('http') ? { mode: 'cors' } : { mode: 'same-origin', cache: 'reload' })).catch(() => {})))));
  // No skipWaiting here: the new version waits until the app's update banner is tapped.
});
self.addEventListener('message', e => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.includes('/beta/')) return;   // the beta has its own service worker
  // Pages: network first, fall back to cache (so updates show up, but it works offline)
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); return r; }).catch(() => caches.match('./index.html')));
    return;
  }
  // Static shell + pinned CDN library: cache first
  if (url.origin === location.origin || ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; })));
  }
  // everything else (Supabase API, Open-Meteo, Gemini) goes straight to the network
});
