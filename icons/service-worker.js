const CACHE_NOME = 'latec-ficr-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(chaves =>
      Promise.all(chaves.filter(k => k !== CACHE_NOME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Cache simples "network-first": tenta a rede, cai pro cache se offline
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(resposta => {
        const copia = resposta.clone();
        caches.open(CACHE_NOME).then(cache => cache.put(event.request, copia));
        return resposta;
      })
      .catch(() => caches.match(event.request))
  );
});

// ===== Push notification (precisa de VAPID keys + Edge Function pra funcionar de ponta a ponta) =====
self.addEventListener('push', (event) => {
  const dados = event.data ? event.data.json() : { titulo: 'LATec FICR', corpo: 'Nova notificação' };

  event.waitUntil(
    self.registration.showNotification(dados.titulo || 'LATec FICR', {
      body: dados.corpo || '',
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/dashboard.html'));
});