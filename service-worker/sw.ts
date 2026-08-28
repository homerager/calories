/// <reference lib="webworker" />
/// <reference types="vite-plugin-pwa/client" />

declare let self: ServiceWorkerGlobalScope

// injectManifest підставляє список асетів. Precache робимо в activate і з
// проковтнутими помилками — інакше install на iOS зависає/падає, і
// pushManager кидає "Getting push subscription requires a service worker".
const PRECACHE_URLS = (self.__WB_MANIFEST || []).map((entry) =>
  typeof entry === 'string' ? entry : entry.url,
)

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim()
      try {
        const cache = await caches.open('calories-precache-v1')
        await Promise.all(PRECACHE_URLS.map((url) => cache.add(url).catch(() => undefined)))
      } catch {
        // Офлайн-кеш не обовʼязковий для push.
      }
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') void self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return
  event.respondWith(
    (async () => {
      try {
        return await fetch(event.request)
      } catch {
        const cached =
          (await caches.match('/offline.html')) ?? (await caches.match('/offline'))
        if (cached) return cached
        const fallback = await caches.match(event.request)
        if (fallback) return fallback
        return new Response(
          '<!DOCTYPE html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Calories — офлайн</title></head><body><h1>Немає зʼєднання</h1><p>Calories зараз офлайн. Перевірте мережу й оновіть сторінку.</p></body></html>',
          {
            status: 503,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          },
        )
      }
    })(),
  )
})

self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; url?: string } = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'Нагадування', body: event.data ? event.data.text() : '' }
  }

  const title = data.title || 'Нагадування'
  const options: NotificationOptions = {
    body: data.body || '',
    icon: '/icons/pwa-192x192.png',
    badge: '/icons/pwa-192x192.png',
    data: { url: data.url || '/' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url =
    event.notification.data && event.notification.data.url ? event.notification.data.url : '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          const windowClient = client as WindowClient
          if (windowClient.url.includes(url)) return windowClient.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    }),
  )
})
