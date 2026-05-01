const CACHE_NAME = "rankora-v1";
const STATIC_ASSETS = [
  "/",
  "/static/css/style.css",
  "/static/js/exam.js",
  "/static/manifest.json"
];

// Install: cache static assets
self.addEventListener("install", function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Fetch: network first, fallback to cache for API; cache first for static
self.addEventListener("fetch", function(event) {
  var url = new URL(event.request.url);

  // API calls: network first, no cache
  if (url.pathname.startsWith("/questions") ||
      url.pathname.startsWith("/submit") ||
      url.pathname.startsWith("/mca-mock") ||
      url.pathname.startsWith("/daily") ||
      url.pathname.startsWith("/important") ||
      url.pathname.startsWith("/pyq") ||
      url.pathname.startsWith("/practice-day") ||
      url.pathname.startsWith("/stats") ||
      url.pathname.startsWith("/study-data")) {
    event.respondWith(
      fetch(event.request).catch(function() {
        return new Response(JSON.stringify([]), {
          headers: {"Content-Type": "application/json"}
        });
      })
    );
    return;
  }

  // Static assets: cache first
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
    })
  );
});
