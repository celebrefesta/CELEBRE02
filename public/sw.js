// Celebre Service Worker - PWA & Offline Support
const CACHE_NAME = 'celebre-cache-v4';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.ico',
  '/LOGO_CELEBRE.png'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Ativação e limpeza de caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptação de requisições com estratégia Network-First resiliente
self.addEventListener('fetch', (event) => {
  if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') {
    return; // Deixa o Vite rodar livremente em localhost sem cache
  }

  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http://') && !event.request.url.startsWith('https://')) return;

  const url = new URL(event.request.url);

  // Ignorar APIs externas, Firebase, Google, Mercado Pago, etc.
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api') ||
    url.origin.includes('googleapis.com') ||
    url.origin.includes('firebaseio.com') ||
    url.origin.includes('google.com') ||
    url.origin.includes('gstatic.com') ||
    url.origin.includes('mercadopago.com')
  ) {
    return;
  }

  // Para navegações SPA (ex: /agenda, /dashboard, /locacoes, /clientes, etc.)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match('/index.html').then((cached) => {
            if (cached) return cached;
            return caches.match('/').then((rootCached) => {
              if (rootCached) return rootCached;
              return new Response(
                '<!DOCTYPE html><html><head><title>Celebre - Offline</title><meta charset="utf-8"/></head><body style="font-family:sans-serif;text-align:center;padding:40px;"><h2>Modo Offline</h2><p>Você está sem conexão com a internet. Reconecte-se para continuar.</p></body></html>',
                { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
              );
            });
          });
        })
    );
    return;
  }

  // Para recursos estáticos (CSS, JS, Imagens, Fontes)
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        const contentType = networkResponse.headers.get('content-type') || '';
        // Evita gravar páginas HTML (ex: 404 rewrite) como se fossem scripts JS/CSS
        const isAsset = url.pathname.startsWith('/assets/');
        if (isAsset && contentType.includes('text/html')) {
          return new Response(null, { status: 404, statusText: 'Asset not found' });
        }

        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        return new Response(null, { status: 404, statusText: 'Resource not found in cache' });
      })
  );
});
