// JackGames service worker: the installed web app works offline after one visit.
// scripts/buildAll.py runs scripts/precacheServiceWorker.py, which writes the hashed build
// files and a content-based version into dist/sw.js. Each deploy therefore installs a
// fresh cache with the whole app, and the previous deploy's cache is deleted.
const buildVersion = "dev";
const precacheFiles = [];

const cacheName = `gameLibrary-${buildVersion}`;
const fontHosts = new Set(["fonts.googleapis.com", "fonts.gstatic.com"]);
// Hosts often send `Vary: Origin`; a module script request carries an Origin header that the
// precache request did not, so a Vary-respecting match would miss and the app would go blank offline.
const matchOptions = { ignoreVary: true };

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(cacheName)
      // cache: "reload" skips the HTTP cache so a new deploy never precaches stale files.
      .then((cache) => cache.addAll(["./", ...precacheFiles].map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("gameLibrary-") && key !== cacheName).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// The page sends its web-font stylesheet URLs (loaded before this worker controlled it).
// Each stylesheet is cached along with the Latin font files it references.
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "cacheUrls" || !Array.isArray(data.urls)) {
    return;
  }
  const fontUrls = data.urls.filter((url) => {
    try {
      return fontHosts.has(new URL(url).hostname);
    } catch {
      return false;
    }
  });
  event.waitUntil(caches.open(cacheName).then((cache) => Promise.all(fontUrls.map((url) => cacheFontUrl(cache, url)))));
});

const latinFontFace = /\/\*\s*latin\s*\*\/\s*@font-face\s*{[^}]*?url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g;

async function cacheFontUrl(cache, url) {
  try {
    const response = await cacheResponse(cache, new Request(url, { mode: "cors" }));
    if (new URL(url).hostname !== "fonts.googleapis.com" || !response.ok) {
      return;
    }
    const css = await response.clone().text();
    const fileUrls = [...css.matchAll(latinFontFace)].map((match) => match[1]);
    await Promise.all(fileUrls.map((fileUrl) => cacheResponse(cache, new Request(fileUrl, { mode: "cors" }))));
  } catch {
    // Offline fonts are best-effort; the app falls back to system fonts.
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== self.location.origin && !fontHosts.has(url.hostname)) {
    return;
  }
  // Live server endpoints (online rooms, health) must never come from the cache.
  if (url.origin === self.location.origin && (url.pathname.startsWith("/api/") || url.pathname.startsWith("/ws/"))) {
    return;
  }
  event.respondWith(request.mode === "navigate" ? networkFirst(request) : cacheFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await cache.match(request, { ...matchOptions, ignoreSearch: true })) || (await cache.match("./", matchOptions)) || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, matchOptions);
  if (cached) {
    return cached;
  }
  return cacheResponse(cache, request);
}

async function cacheResponse(cache, request) {
  try {
    const response = await fetch(request);
    if (response.ok || response.type === "opaque") {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request, matchOptions);
    if (cached) {
      return cached;
    }
    throw error;
  }
}
