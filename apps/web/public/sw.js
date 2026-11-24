/* Push notifications, and an offline copy of the field page. Nothing private is cached. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('push', (e) => {
  const d = e.data ? e.data.json() : {};
  e.waitUntil(self.registration.showNotification(d.title || 'New message', { body: d.body || '', icon: '/icon.svg' }));
});
self.addEventListener('notificationclick', (e) => { e.notification.close(); e.waitUntil(self.clients.openWindow('/')); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  const shell = /^\/[a-z]{2}\/field$/.test(u.pathname) || u.pathname.startsWith('/_next/static/');
  if (!shell) return;
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const c = r.clone(); caches.open('field-v1').then((x) => x.put(e.request, c)); } return r; }).catch(() => caches.match(e.request).then((r) => r || Response.error())));
});
