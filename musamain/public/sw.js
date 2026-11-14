/* ============================================================
   Musalingo — Service Worker (v35)
   - Caches the app shell for offline use
   - Network-first for HTML (with 3s timeout)
   - Cache-first for static assets
   - Never caches API calls (/api/*)
   - Falls back to /offline.html when a page isn't cached
   ============================================================ */

const CACHE_VERSION = 'musalingo-v36';  // Update this to force a new cache

const APP_SHELL = [
    '/',
    '/index.html',
    '/started.html',
    '/signin.html',
    '/dashboard.html',
    '/catalog.html',
    '/course.html',
    '/sections.html',
    '/lesson.html',
    '/guidebook.html',
    '/quest.html',
    '/shop.html',
    '/profile.html',
    '/settings.html',
    '/streak.html',
    '/friends.html',
    '/offline.html',
    '/matches.html',
    '/privacy-policy.html',
    '/terms-of-service.html',
    '/course.js',
    '/audience.js',
    '/course-curriculum.js',
    '/sections.js',
    '/lesson.js',              // ← REMOVED ?v=26
    '/questions.js',
    '/matches.js',             // ← REMOVED ?v=23
    '/sounds.js',
    '/theme.js',
    '/styles.css',
    '/bloat.js',
    '/firebase.js',
    '/pwa.js',
    '/quest.js',
    '/forms.html',
    '/practice.html',
    '/settings.json',
    '/manifest.json',
    '/chessboard.css',
    '/chessboard.js',
    '/coming-soon.html',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/icon-maskable-192.png',
    '/icons/icon-maskable-512.png',
    '/icons/logo.png',
    // NEW: missing files that lesson.js depends on
    '/subscriptions.js',
    '/vendor/chess/chess.js',
];

// ---------- INSTALL ----------
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) => {
            return Promise.all(
                APP_SHELL.map((url) =>
                    cache.add(new Request(url, { cache: 'reload' })).catch((err) => {
                        console.warn('[sw] Could not cache:', url, err);
                    })
                )
            );
        }).then(() => self.skipWaiting())
    );
});

// ---------- ACTIVATE ----------
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys
                    .filter((key) => key !== CACHE_VERSION)
                    .map((key) => {
                        console.log('[sw] Deleting old cache:', key);
                        return caches.delete(key);
                    })
            ))
            .then(() => self.clients.claim())
    );
});

// ---------- FETCH ----------
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    if (request.method !== 'GET') return;
    if (url.origin !== self.location.origin) return;

    // Never cache API calls — always go to network
    if (url.pathname.toLowerCase().startsWith('/api/')) {
        return;
    }

    // ---------- HTML ----------
    const isHtml = request.mode === 'navigate'
        || (request.headers.get('accept') || '').includes('text/html');

    if (isHtml) {
        const networkPromise = fetch(request).then((response) => {
            if (response.ok) {
                const clone = response.clone();
                caches.open(CACHE_VERSION)
                    .then((cache) => cache.put(request, clone))
                    .catch(() => { });
            }
            return response;
        });

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('SW: Network timeout')), 3000)
        );

        event.respondWith(
            Promise.race([networkPromise, timeoutPromise])
                .catch(() => {
                    return caches.match(request).then((cached) => {
                        if (cached) return cached;
                        return caches.match('/offline.html');
                    });
                })
        );
        return;
    }

    // ---------- Static assets ----------
    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) return cached;

            return fetch(request)
                .then((response) => {
                    if (response && response.status === 200 && response.type === 'basic') {
                        const clone = response.clone();
                        caches.open(CACHE_VERSION)
                            .then((cache) => cache.put(request, clone))
                            .catch(() => { });
                    }
                    return response;
                })
                .catch((err) => {
                    console.warn('[sw] Fetch failed for:', request.url, err);

                    if (request.destination === 'image') {
                        return new Response('', {
                            status: 200,
                            headers: { 'Content-Type': 'image/png' }
                        });
                    }

                    throw err;
                });
        })
    );
});

// ---------- MESSAGE ----------
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});