/**
 * 📱 SERVICE WORKER MULTIPLATAFORMA - CDSANABRIACF
 * Compatible con iOS, Android, HarmonyOS y notificaciones push
 */

/* Firebase Messaging en segundo plano (PWA cerrada o en background) */
importScripts('https://www.gstatic.com/firebasejs/10.12.3/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.3/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBlCY7mDrT7edTo79Gy4aVJbWPnFDevbro',
  authDomain: 'cdsanabriacf2026.firebaseapp.com',
  projectId: 'cdsanabriacf2026',
  storageBucket: 'cdsanabriacf2026.firebasestorage.app',
  messagingSenderId: '452462278881',
  appId: '1:452462278881:web:51a6452bd360265de4dfa0'
});

const fcmMessaging = firebase.messaging();

function buildClubPushOptions(payload) {
  const data = payload.data || {};
  const title = (payload.notification && payload.notification.title) || data.title || 'CD Sanabria CF';
  const body = (payload.notification && payload.notification.body) || data.body || 'Nueva notificación del club';
  const notifId = data.notifId || data.tag || '';
  const urgent = data.urgent === '1' || data.urgent === true;
  const icon = data.icon || '/assets/escudo-192.png';

  return {
    title: title,
    options: {
      body: body,
      icon: icon.startsWith('http') ? icon : self.location.origin + (icon.startsWith('/') ? icon : '/' + icon),
      badge: self.location.origin + '/assets/escudo-192.png',
      tag: data.tag || notifId || 'cdsanabriacf-notification',
      data: Object.assign({}, data, {
        title: title,
        body: body,
        notifId: notifId,
        url: data.url || (notifId ? '/?notif=' + encodeURIComponent(notifId) : '/')
      }),
      vibrate: [200, 100, 200],
      requireInteraction: urgent,
      renotify: true,
      silent: false,
      timestamp: Date.now()
    }
  };
}

fcmMessaging.onBackgroundMessage(function (payload) {
  const built = buildClubPushOptions(payload || {});
  return self.registration.showNotification(built.title, built.options).then(function () {
    return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clients) {
      clients.forEach(function (client) {
        client.postMessage({
          type: 'CLUB_PUSH_RECEIVED',
          payload: {
            title: built.title,
            body: built.options.body,
            notifId: built.options.data.notifId,
            tag: built.options.tag,
            urgent: built.options.data.urgent
          }
        });
      });
    });
  });
});

const CACHE_NAME = 'cdsanabriacf-v20260820-1256';
const STATIC_CACHE = 'cdsanabriacf-v20260820-1256-static';
const DYNAMIC_CACHE = 'cdsanabriacf-v20260820-1256-dynamic';

// No precachear HTML (/): iOS y Huawei se quedan con la portada vieja.
const STATIC_ASSETS = [
  '/manifest.json',
  '/assets/escudo-cdsanabriacf.png',
  '/assets/escudo-192.png',
  '/assets/torneo-1.jpg',
  '/assets/torneo-2.jpg',
  '/assets/bases-torneo.jpg',
  '/assets/escudos-senior/bar-mirador.png',
  '/assets/escudos-senior/montelueno.png',
  '/assets/escudos-senior/la-tosta-sanabresa.png',
  '/assets/escudos-senior/caparrota.png',
  '/assets/escudos-senior/jopos-de-sanabria.png',
  '/assets/escudos-senior/sikariones-ecotera-a.png',
  '/assets/escudos-senior/sikariones-ecotera-b.png',
  '/assets/escudos-senior/car-rosinos.png',
  '/assets/escudos-senior/olek-fc.png',
  '/assets/escudos-senior/san-francisco-castellanos.png'
];

// URLs dinámicas para cache
const DYNAMIC_URLS = [
  '/api/',
  'https://fonts.googleapis.com/',
  'https://fonts.gstatic.com/'
];

// 🚀 Instalación del Service Worker con sincronización en tiempo real
self.addEventListener('install', (event) => {
  console.log('📱 Service Worker iOS: Instalando con sincronización en tiempo real...');
  
  event.waitUntil(
    Promise.all([
      // Cache estático
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('📦 Cacheando archivos estáticos...');
        return Promise.all(
          STATIC_ASSETS.map((url) =>
            cache.add(url).catch((err) => console.warn('⚠️ No cacheado (omitido):', url, err && err.message))
          )
        );
      }),
      
      // Forzar activación inmediata
      self.skipWaiting(),
      
      // Inicializar sincronización en tiempo real
      initializeRealTimeSync()
    ])
  );
});

// 🔄 Activación del Service Worker
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker iOS: Activando...');
  
  event.waitUntil(
    Promise.all([
      // Limpiar caches antiguos
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && 
                cacheName !== DYNAMIC_CACHE && 
                cacheName !== CACHE_NAME) {
              console.log('🗑️ Eliminando cache antiguo:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Tomar control inmediato
      self.clients.claim().then(function () {
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clients) {
          clients.forEach(function (client) {
            client.postMessage({ type: 'SW_UPDATED' });
          });
        });
      })
    ])
  );
});

// Permite activar inmediatamente una nueva version del SW.
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (event.data.type === 'PURGE_CACHES') {
    event.waitUntil(
      caches.keys().then(function (keys) {
        return Promise.all(keys.map(function (k) { return caches.delete(k); }));
      })
    );
    return;
  }
  const { type, payload } = event.data;
  switch (type) {
    case 'CACHE_UPDATE':
      updateCache(payload);
      break;
    case 'NOTIFICATION_PERMISSION':
      handleNotificationPermission();
      break;
    default:
      break;
  }
});

// Rutas donde conviene red primero (HTML/JS críticos: evita SW sirviendo código viejo)
function shouldNetworkFirst(request) {
  if (request.method !== 'GET') return false;
  try {
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return false;
    const path = url.pathname || '/';
    if (request.mode === 'navigate') return true;
    if (path === '/' || path === '/index.html' || path === '/admin-panel.html') return true;
    if (path.endsWith('.js') || path.endsWith('.css') || path.endsWith('.html')) return true;
    if (path === '/manifest.json' || path === '/sw.js' || path === '/deploy-version.json') return true;
    if (path === '/js/firebase-config.js' || path === '/js/notification-system.js') return true;
  } catch (_) {}
  return false;
}

// 🌐 Interceptar peticiones de red
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  try {
    const u = new URL(request.url);
    if (u.origin === self.location.origin) {
      const path = u.pathname || '/';
      if (path === '/deploy-version.json' || path === '/sw.js') {
        event.respondWith(fetch(request, { cache: 'no-store' }));
        return;
      }
    }
  } catch (_) {}

  // Firebase Storage / streaming: sin interceptar (evita fallos con Range)
  try {
    const u = new URL(request.url);
    if (
      u.hostname === 'firebasestorage.googleapis.com' ||
      u.hostname.endsWith('.firebasestorage.app') ||
      u.hostname === 'storage.googleapis.com'
    ) {
      event.respondWith(fetch(request));
      return;
    }
  } catch (_) {}

  if (shouldNetworkFirst(request)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Estrategia de cache según el tipo de recurso
  if (isStaticAsset(request)) {
    // Cache First para recursos estáticos
    event.respondWith(cacheFirst(request));
  } else if (isAPIRequest(request)) {
    // Network First para APIs
    event.respondWith(networkFirst(request));
  } else if (isDynamicContent(request)) {
    // Stale While Revalidate para contenido dinámico
    event.respondWith(staleWhileRevalidate(request));
  } else {
    // Cache First por defecto
    event.respondWith(cacheFirst(request));
  }
});

// 📱 Notificaciones Push (respaldo si no pasan por Firebase Messaging)
self.addEventListener('push', (event) => {
  event.waitUntil(
    (async function () {
      let notificationData = {
        title: 'CD Sanabria CF',
        body: 'Nueva notificación del club',
        icon: '/assets/escudo-192.png'
      };

      if (event.data) {
        try {
          const raw = event.data.json();
          notificationData = {
            title: raw.notification?.title || raw.title || raw.data?.title || notificationData.title,
            body: raw.notification?.body || raw.body || raw.data?.body || notificationData.body,
            icon: raw.notification?.icon || raw.icon || raw.data?.icon || notificationData.icon,
            tag: raw.tag || raw.data?.tag,
            urgent: raw.urgent || raw.data?.urgent === '1',
            data: raw.data || raw
          };
        } catch (error) {
          console.error('❌ Error parseando push data:', error);
        }
      }

      const built = buildClubPushOptions({
        notification: { title: notificationData.title, body: notificationData.body },
        data: notificationData.data || notificationData
      });

      await self.registration.showNotification(built.title, built.options);
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      clients.forEach(function (client) {
        client.postMessage({
          type: 'CLUB_PUSH_RECEIVED',
          payload: {
            title: built.title,
            body: built.options.body,
            notifId: built.options.data.notifId,
            tag: built.options.tag,
            urgent: built.options.data.urgent
          }
        });
      });
    })()
  );
});

// 🔔 Click en notificaciones
self.addEventListener('notificationclick', (event) => {
  console.log('👆 Click en notificación:', event);
  
  event.notification.close();
  
  const action = event.action;
  const notificationData = event.notification.data || {};
  
  if (action === 'close') {
    return;
  }
  
  // Determinar URL de destino
  let targetUrl = '/';
  if (notificationData.notifId) {
    targetUrl = '/?notif=' + encodeURIComponent(notificationData.notifId);
  } else if (notificationData.url) {
    targetUrl = notificationData.url;
  } else if (action === 'open') {
    targetUrl = '/';
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Si hay una ventana abierta, enfocarla
        for (const client of clientList) {
          if (client.url.includes(self.location.origin)) {
            client.focus();
            client.navigate(targetUrl);
            return;
          }
        }
        
        // Si no hay ventana abierta, abrir una nueva
        return clients.openWindow(targetUrl);
      })
  );
});

// 🔄 Sincronización en background
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(performBackgroundSync());
  }
});

// 📡 Message desde la aplicación (SKIP_WAITING se maneja arriba)

// 🔧 FUNCIONES DE CACHE

// Cache First - Para recursos estáticos
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    
    // Cachear respuesta si es exitosa
    if (networkResponse.status === 200) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('❌ Error en cacheFirst:', error);
    return new Response('Offline', { status: 503 });
  }
}

// Network First - Para APIs
async function networkFirst(request) {
  try {
    let networkResponse;
    try {
      const reqUrl = new URL(request.url);
      const sameOrigin = reqUrl.origin === self.location.origin;
      // Para archivos del propio sitio fuerza red fresca al abrir (evita quedarse con build antiguo).
      networkResponse = sameOrigin
        ? await fetch(request, { cache: 'no-store' })
        : await fetch(request);
    } catch (_) {
      networkResponse = await fetch(request);
    }
    
    // Cachear respuesta exitosa
    if (networkResponse.status === 200) {
      try {
        const p = new URL(request.url).pathname;
        const skipCache =
          p === '/deploy-version.json' ||
          p === '/sw.js' ||
          p === '/index.html' ||
          p === '/' ||
          p.endsWith('.html') ||
          p.endsWith('.js') ||
          p.endsWith('.css') ||
          p.endsWith('.json');
        if (!skipCache) {
          const cache = await caches.open(DYNAMIC_CACHE);
          cache.put(request, networkResponse.clone());
        }
      } catch (_) {}
    }
    
    return networkResponse;
  } catch (error) {
    console.error('❌ Red no disponible, usando cache:', error);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return new Response(JSON.stringify({
      error: 'No hay conexión y no hay datos en cache',
      offline: true
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Stale While Revalidate - Para contenido dinámico
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => cachedResponse);
  
  return cachedResponse || fetchPromise;
}

// 🔍 FUNCIONES DE IDENTIFICACIÓN

function isStaticAsset(request) {
  const url = new URL(request.url);
  return STATIC_ASSETS.some(asset => url.pathname === asset || (asset !== '/' && url.pathname.endsWith(asset))) ||
         url.pathname.includes('/css/') ||
         url.pathname.includes('/images/') ||
         url.pathname.includes('/fonts/');
}

function isAPIRequest(request) {
  const url = new URL(request.url);
  return url.hostname.includes('firestore.googleapis.com') ||
         url.hostname.includes('firebaseio.com') ||
         url.hostname.includes('googleapis.com');
}

function isDynamicContent(request) {
  const url = new URL(request.url);
  return DYNAMIC_URLS.some(dynamicUrl => url.href.startsWith(dynamicUrl));
}

// 🔄 FUNCIONES DE SINCRONIZACIÓN

async function performBackgroundSync() {
  try {
    console.log('🔄 Realizando sincronización en background...');
    
    // Aquí iría la lógica de sincronización con el servidor
    // Por ahora simulamos el proceso
    
    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timestamp: Date.now() })
    });
    
    if (response.ok) {
      console.log('✅ Sincronización completada');
    } else {
      throw new Error('Error en sincronización');
    }
    
  } catch (error) {
    console.error('❌ Error en background sync:', error);
    // Reintentará automáticamente más tarde
  }
}

// 📦 Actualizar cache
async function updateCache(urls) {
  try {
    const cache = await caches.open(STATIC_CACHE);
    await cache.addAll(urls);
    console.log('✅ Cache actualizado:', urls.length, 'archivos');
  } catch (error) {
    console.error('❌ Error actualizando cache:', error);
  }
}

// 🔔 Manejar permisos de notificaciones
async function handleNotificationPermission() {
  try {
    const permission = await self.registration.showNotification('Test', {
      body: 'Probando notificaciones',
      tag: 'test',
      silent: true
    });
    
    console.log('✅ Permisos de notificación OK');
  } catch (error) {
    console.error('❌ Error con permisos de notificación:', error);
  }
}

// 📱 Detección específica de iOS
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

// 🎯 Optimizaciones específicas para iOS
if (isIOS()) {
  console.log('📱 Optimizaciones para iOS activadas');
  
  // Configuraciones específicas para iOS
  const iosConfig = {
    cacheSizeLimit: 50 * 1024 * 1024, // 50MB para iOS
    notificationTimeout: 10000, // 10 segundos
    syncInterval: 60000 // 1 minuto
  };
  
  // Aplicar configuraciones iOS
  self.iosConfig = iosConfig;
}

// 🔄 FUNCIÓN DE SINCRONIZACIÓN EN TIEMPO REAL
async function initializeRealTimeSync() {
  console.log('🔄 Inicializando sincronización en tiempo real...');
  
  // Configurar intervalos de sincronización
  setInterval(async () => {
    try {
      await performRealTimeSync();
    } catch (error) {
      console.error('❌ Error en sincronización en tiempo real:', error);
    }
  }, 5000); // Sincronizar cada 5 segundos
  
  console.log('✅ Sincronización en tiempo real activada');
}

async function performRealTimeSync() {
  try {
    // Sincronizar datos con Firebase
    const syncData = {
      timestamp: Date.now(),
      source: 'service-worker',
      type: 'real-time-sync'
    };
    
    // Enviar datos de sincronización
    await fetch('/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sync-Source': 'service-worker'
      },
      body: JSON.stringify(syncData)
    });
    
    console.log('🔄 Sincronización en tiempo real completada');
  } catch (error) {
    console.error('❌ Error en sincronización en tiempo real:', error);
  }
}

console.log('📱 Service Worker iOS cargado y listo - PWA compatible con iPhone/iPad y sincronización en tiempo real');

