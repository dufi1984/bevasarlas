// Service Worker for Bevásárló Lista PWA & Web Push Notifications
const CACHE_NAME = 'bevasarlas-pwa-v3';
const WORKER_URL = 'https://bevasarlas-notify.tamas-duffek.workers.dev';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png'
];

// Current room (updated via postMessage from app.js)
let currentRoom = 'otthon';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch handler: Network First, fallback to cache
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Message from app.js: update current room
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SET_ROOM') {
    currentRoom = event.data.room || 'otthon';
  }
});

// Push notification received
self.addEventListener('push', event => {
  const room = currentRoom || 'otthon';

  event.waitUntil(
    fetch(`${WORKER_URL}/notification?room=${encodeURIComponent(room)}`)
      .then(r => r.ok ? r.json() : { message: 'A lista frissült!' })
      .then(data => {
        const message = data.message || 'A lista frissült!';
        return self.registration.showNotification('🛒 Bevásárló lista', {
          body: message,
          icon: './icon-192.png',
          badge: './icon-192.png',
          vibrate: [100, 50, 100],
          data: { url: './' }
        });
      })
      .catch(() =>
        self.registration.showNotification('🛒 Bevásárló lista', {
          body: 'A lista frissült!',
          icon: './icon-192.png'
        })
      )
  );
});

// Notification click: open the app
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('./');
    })
  );
});
