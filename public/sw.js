const CACHE = 'canalcup-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  const url = e.request.url
  // Ne jamais cacher les appels API, Supabase ou auth
  if (
    url.includes('/api/') ||
    url.includes('supabase.co') ||
    url.includes('googleapis.com') ||
    url.includes('qrserver.com') ||
    url.includes('/auth/')
  ) return

  e.respondWith(
    fetch(e.request)
      .then(r => {
        const clone = r.clone()
        caches.open(CACHE).then(c => c.put(e.request, clone))
        return r
      })
      .catch(() => caches.match(e.request))
  )
})

self.addEventListener('push', e => {
  const data = e.data?.json() ?? {}
  const title = data.title ?? 'Canal Cup'
  e.waitUntil(
    self.registration.showNotification(title, {
      body: data.body ?? 'Nouvelle notification',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag ?? 'canal-cup',
      data: { url: data.url ?? '/' },
      vibrate: [100, 50, 100],
    })
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url ?? '/'
  e.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        for (const client of clients) {
          if (client.url === url && 'focus' in client) return client.focus()
        }
        return self.clients.openWindow(url)
      })
  )
})
