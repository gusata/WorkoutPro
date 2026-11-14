// Bump VERSION when the caching strategy changes; hashed build assets never need it.
const VERSION = 'v4'
const STATIC_CACHE = `workoutpro-static-${VERSION}`
const PAGE_CACHE = `workoutpro-pages-${VERSION}`
const KEEP = new Set([STATIC_CACHE, PAGE_CACHE])

// trailingSlash: true in next.config, so pages live at "/route/".
const APP_SHELL = ['/dashboard/', '/workouts/', '/stats/', '/achievements/', '/profile/', '/settings/', '/photos/', '/recap/', '/health/', '/sleep/', '/cardio/', '/exercises/library/', '/manifest.webmanifest', '/icons/icon-192.png']
const OFFLINE_FALLBACK = '/dashboard/'
const NAVIGATION_TIMEOUT_MS = 3500
const MAX_STATIC_ENTRIES = 150

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PAGE_CACHE)
      // One failing URL must not abort the whole install.
      .then((cache) => Promise.all(APP_SHELL.map((url) => cache.add(url).catch(() => undefined))))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => !KEEP.has(key)).map((key) => caches.delete(key)))
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable()
    await self.clients.claim()
  })())
})

function isImmutableAsset(url) {
  return url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || /\.(woff2?|ttf)$/.test(url.pathname)
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  if (keys.length <= maxEntries) return
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)))
}

// Content-hashed files: serve from cache instantly, fetch only once.
async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE)
    await cache.put(request, response.clone())
    trimCache(STATIC_CACHE, MAX_STATIC_ENTRIES)
  }
  return response
}

// HTML: prefer fresh, but never leave the user staring at a slow gym connection.
async function networkFirstPage(event) {
  const cache = await caches.open(PAGE_CACHE)
  const network = (async () => {
    const preloaded = await event.preloadResponse
    const response = preloaded || await fetch(event.request)
    if (response.ok) await cache.put(event.request, response.clone())
    return response
  })()

  const timeout = new Promise((resolve) => setTimeout(resolve, NAVIGATION_TIMEOUT_MS))
  const winner = await Promise.race([network.catch(() => undefined), timeout])
  if (winner) return winner

  // Detail pages use ?id=..., which the cached shell ignores (client-side routing reads it).
  const cached = await cache.match(event.request, { ignoreSearch: true })
  if (cached) {
    event.waitUntil(network.catch(() => undefined))
    return cached
  }
  try {
    return await network
  } catch {
    return (await cache.match(OFFLINE_FALLBACK)) || Response.error()
  }
}

// Everything else same-origin: answer from cache, refresh in the background.
async function staleWhileRevalidate(event) {
  const cache = await caches.open(PAGE_CACHE)
  const cached = await cache.match(event.request)
  const network = fetch(event.request)
    .then((response) => {
      if (response.ok) cache.put(event.request, response.clone())
      return response
    })
    .catch(() => undefined)
  if (cached) {
    event.waitUntil(network)
    return cached
  }
  return (await network) || Response.error()
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (isImmutableAsset(url)) {
    event.respondWith(cacheFirst(request))
  } else if (url.searchParams.has('_rsc') || request.headers.get('RSC')) {
    // Router payloads must match the current build; fall back to cache only when offline.
    event.respondWith(fetch(request).catch(async () => (await caches.match(request)) || Response.error()))
  } else if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(event))
  } else {
    event.respondWith(staleWhileRevalidate(event))
  }
})

self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title || 'WorkoutPro', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [200, 100, 200],
    })
  )
})
