// CineTier service worker — офлайн дэмжлэг.
// Гараар бичсэн (next-pwa/workbox биш): Next 16-д Turbopack нь build-ийн анхдагч
// bundler бөгөөд webpack config тарьдаг PWA plugin-ууд build-ийг fail болгодог.

const VERSION = "v1";
const SHELL_CACHE = `cinetier-shell-${VERSION}`;
const STATIC_CACHE = `cinetier-static-${VERSION}`;
const IMAGE_CACHE = `cinetier-images-${VERSION}`;
const CURRENT_CACHES = [SHELL_CACHE, STATIC_CACHE, IMAGE_CACHE];

const SHELL_URLS = ["/", "/manifest.webmanifest", "/icons/icon-192.png"];

// Poster/cover зургийн эх сурвалжууд — src/app/api/image-proxy/route.ts-ийн
// ALLOWED_HOSTS-той нийцүүлэв. Supabase нь env-ээс ирдэг тул хэвээр нь тааруулна.
const MEDIA_HOSTS = new Set([
  "image.tmdb.org",
  "s4.anilist.co",
  "covers.openlibrary.org",
  "upload.wikimedia.org",
]);

const IMAGE_CACHE_MAX_ENTRIES = 150;

function isMediaHost(url) {
  return MEDIA_HOSTS.has(url.hostname) || url.hostname.endsWith(".supabase.co");
}

/**
 * Cross-origin зургууд <img>-ээр no-cors горимд татагддаг тул хариу нь opaque
 * (status === 0) ирнэ — response.ok шалгавал БҮГД хаягдаж, poster офлайнд
 * ажиллахаа болино. Opaque-г тусад нь зөвшөөрөх ёстой.
 */
function isCacheable(response) {
  return Boolean(response) && (response.ok || response.type === "opaque");
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // Нэг URL амжилтгүй болоод бүх install унахаас сэргийлж тус тусад нь
      .then((cache) =>
        Promise.allSettled(SHELL_URLS.map((url) => cache.add(url))),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !CURRENT_CACHES.includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  // Cache API нь оруулсан дарааллаа хадгалдаг — хамгийн хуучныг эхэнд нь хасна
  for (let i = 0; i < keys.length - maxEntries; i++) {
    await cache.delete(keys[i]);
  }
}

// Navigation: сүлжээг эхэнд, амжилтгүй бол кэшнээс (яг хуудас → эс бөгөөс "/")
async function handleNavigate(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (
      (await cache.match(request)) ||
      (await cache.match("/")) ||
      new Response("Офлайн байна.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    );
  }
}

// /_next/static/**: хэш агуулсан, өөрчлөгддөггүй → cache-first
async function handleStatic(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (isCacheable(response)) cache.put(request, response.clone());
  return response;
}

// Poster/cover зургууд: stale-while-revalidate (opaque хариуг ч кэшлэнэ)
async function handleImage(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (isCacheable(response)) {
        cache.put(request, response.clone()).then(() => {
          trimCache(IMAGE_CACHE, IMAGE_CACHE_MAX_ENTRIES);
        });
      }
      return response;
    })
    .catch(() => cached);

  return cached || network;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Мутациуд (POST/PUT/DELETE) — огт хөндөхгүй
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigate(request));
    return;
  }

  // Гадаад зургийн CDN-үүд
  if (url.origin !== self.location.origin) {
    if (isMediaHost(url)) event.respondWith(handleImage(request));
    return;
  }

  // ── Эндээс доош: same-origin ──

  if (url.pathname.startsWith("/api/")) {
    // Зургийн proxy кэшлэгдэнэ; хайлт болон tierlist өгөгдөл нь ХЭЗЭЭ Ч кэшлэгдэхгүй
    // (эс бөгөөс хуучирсан хайлтын үр дүн / tier list харагдана)
    if (url.pathname.startsWith("/api/image-proxy")) {
      event.respondWith(handleImage(request));
    }
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(handleStatic(request));
    return;
  }

  if (request.destination === "image" || url.pathname.startsWith("/_next/image")) {
    event.respondWith(handleImage(request));
    return;
  }

  if (url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest") {
    event.respondWith(handleStatic(request));
  }
});
