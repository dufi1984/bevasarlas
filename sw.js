// Service Worker for Bevásárló Lista PWA & Web Push Notifications
const CACHE_NAME = 'bevasarlas-pwa-v15';
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
let currentRoom = null;

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

// Fetch handler: Network First, fallback to cache – CSAK saját origin asset-ekre
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  // Külső API hívásokat (Gist, Cloudflare Worker) NEM cache-eljük
  if (url.origin !== self.location.origin) return;

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
    currentRoom = event.data.room || null;
  }
});

// Push notification received
self.addEventListener('push', event => {
  const iconUrl = new URL('icon-192.png', self.location.href).href;

  let notifyPromise;
  if (event && event.data) {
    try {
      const data = event.data.json();
      notifyPromise = Promise.resolve({
        title: data.title || 'Bevásárló lista',
        message: data.message || 'A lista frissült!'
      });
    } catch (e) {
      // Ha a JSON parse nem sikerül, próbáljuk szövegként
      const text = event.data ? event.data.text() : 'A lista frissült!';
      notifyPromise = Promise.resolve({ title: 'Bevásárló lista', message: text });
    }
  } else if (currentRoom) {
    // Üres push: lekérjük a legutóbbi értesítés szövegét a Workerből
    notifyPromise = fetch(`${WORKER_URL}/notification?room=${encodeURIComponent(currentRoom)}`)
      .then(r => r.ok ? r.json() : { title: 'Bevásárló lista', message: 'A lista frissült!' })
      .then(d => ({
        title: d.title || 'Bevásárló lista',
        message: d.message || 'A lista frissült!'
      }))
      .catch(() => ({ title: 'Bevásárló lista', message: 'A lista frissült!' }));
  } else {
    // Nincs room beállítva – generikus értesítés
    notifyPromise = Promise.resolve({ title: 'Bevásárló lista', message: 'A lista frissült!' });
  }

  event.waitUntil(
    notifyPromise.then(({ title, message }) => {
      return self.registration.showNotification(title, {
        body: message,
        icon: iconUrl,
        badge: iconUrl,
        data: { url: self.location.href }
      });
    }).catch(() => {
      return self.registration.showNotification('Bevásárló lista', {
        body: 'A lista frissült!',
        icon: iconUrl
      });
    })
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
