// Service worker: makes the game work offline while making sure players get updates.
//
// The site's own files are fetched network-first, so a deploy shows up on the next
// page load with no version bump needed. The cache is only a fallback for when the
// player is offline or the network is very slow.
//
// Bump CACHE_NAME only when you change the PRECACHE list below.
const CACHE_NAME = 'wavelength-game-cache-v7';
const NETWORK_TIMEOUT_MS = 4000;

const PRECACHE = [
  './',
  './index.html',
  './style.css?v=7',
  './script.js?v=7',
  './clues.json',
  './privacy.html',
  './terms.html',
  './about.html',
  './changelog.html',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.5.1/dist/confetti.browser.min.js',
  'https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700;800&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // cache: 'reload' skips the browser's HTTP cache so we store the newest copies.
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' }))))
      // Take over right away instead of waiting for every open tab to close.
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  if (new URL(request.url).origin === self.location.origin) {
    event.respondWith(networkFirst(event));
  } else {
    // Third-party files (fonts, confetti) have fixed, versioned URLs, so cache-first is safe.
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
  }
});

// Try the network; save good responses for offline use. Fall back to the cache if the
// network fails, or if it takes longer than NETWORK_TIMEOUT_MS and we have a cached copy.
function networkFirst(event) {
  const { request } = event;
  let saved = Promise.resolve();

  const network = fetch(request).then((response) => {
    if (response.ok) {
      const copy = response.clone();
      saved = caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
    }
    return response;
  });
  event.waitUntil(network.then(() => saved).catch(() => {}));

  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (response) => {
      if (!done) {
        done = true;
        resolve(response);
      }
    };

    const timer = setTimeout(() => {
      caches.match(request).then((cached) => cached && finish(cached));
    }, NETWORK_TIMEOUT_MS);

    network
      .then((response) => {
        clearTimeout(timer);
        finish(response);
      })
      .catch((err) => {
        clearTimeout(timer);
        caches.match(request).then((cached) => {
          if (cached) finish(cached);
          else if (!done) {
            done = true;
            reject(err);
          }
        });
      });
  });
}
