const CACHE_NAME = 'packet-party-v12';
const CORE_FILES = ['./', './index.html', './styles.css', './app.js', './ambient.js', './questions.json', './explanations.json', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_FILES);
    const deck = await (await cache.match('./questions.json')).json();
    const exhibits = new Set();
    for (const question of deck.questions || []) {
      for (const match of String(question.questionHtml || '').matchAll(/src=["'](exhibits\/[a-z0-9._-]+\.(?:png|jpe?g|gif|webp|svg))["']/gi)) exhibits.add(`./${match[1]}`);
    }
    await Promise.allSettled([...exhibits].map(path => cache.add(path)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('packet-party-') && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    } catch {
      return (await cache.match(request)) || (request.mode === 'navigate' ? await cache.match('./index.html') : undefined) || Response.error();
    }
  })());
});
