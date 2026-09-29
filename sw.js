// FORGE service worker — lets the app open with no signal at the gym.
// App files: network-first (so updates land), falling back to the cache when offline
// or when the network takes longer than a few seconds. Google Fonts: cache-first.
const CACHE = 'forge-v2';
const NET_TIMEOUT = 3000;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', './index.html'])));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

const store = (req, res) => {
  if (res && (res.ok || res.type === 'opaque')) {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(req, copy));
  }
  return res;
};

const fromCache = req =>
  caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html'));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    e.respondWith(new Promise(resolve => {
      let done = false;
      const fallback = () => { if (!done) { done = true; resolve(fromCache(req)); } };
      const timer = setTimeout(fallback, NET_TIMEOUT);
      fetch(req).then(res => {
        clearTimeout(timer);
        store(url.origin + url.pathname, res);   // one entry per file, ignoring ?cache-busters
        if (!done) { done = true; resolve(res); }
      }).catch(() => { clearTimeout(timer); fallback(); });
    }));
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => store(req, res))));
  }
});
