/**
 * 📱 SERVICE WORKER MULTIPLATAFORMA - CDSANABRIACF
 * Compatible con iOS, Android, HarmonyOS y notificaciones push
 */

const CACHE_NAME = 'cdsanabriacf-v20260605-0752';
const STATIC_CACHE = 'cdsanabriacf-v20260605-0752-static';
const DYNAMIC_CACHE = 'cdsanabriacf-v20260605-0752-dynamic';

// Archivos críticos para cache (solo rutas que existen en el despliegue)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/admin-panel.html',
  '/js/firebase-config.js',
  '/js/site-update-mode.js',
  '/js/admin-session.js',
  '/js/club-contact-defaults.js',
  '/js/torneo-preinscripcion.js',
  '/js/player-application.js',
  '/js/protocol-guard.js',
  '/js/notification-system.js',
  '/js/club-accounting.js',
  '/js/support-mode.js',
  '/js/permissionmanager.js',
  '/manifest.json',
  '/assets/escudo-cdsanabriacf.png',
  '/assets/escudo-192.png',
  '/assets/torneo-futbol-7-2026.jpeg'
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
      self.clients.claim()
    ])
  );
});

// Permite activar inmediatamente una nueva version del SW.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
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
    if (path === '/manifest.json' || path === '/sw.js') return true;
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

// 📱 Notificaciones Push para iOS
self.addEventListener('push', (event) => {
  console.log('🔔 Push recibido:', event);
  
  let notificationData = {};
  
  try {
    if (event.data) {
      notificationData = event.data.json();
    }
  } catch (error) {
    console.error('❌ Error parseando push data:', error);
    notificationData = {
      title: 'CDSANABRIACF',
      body: 'Nueva notificación del club',
      icon: '/assets/escudo-192.png'
    };
  }
  
  const options = {
    body: notificationData.body || 'Nueva notificación',
    icon: notificationData.icon || '/assets/escudo-192.png',
    badge: '/assets/escudo-192.png',
    tag: notificationData.tag || 'cdsanabriacf-notification',
    data: notificationData.data || {},
    actions: [
      {
        action: 'open',
        title: 'Abrir',
        icon: '/assets/escudo-192.png'
      },
      {
        action: 'close',
        title: 'Cerrar',
        icon: '/assets/escudo-192.png'
      }
    ],
    vibrate: [200, 100, 200],
    requireInteraction: notificationData.urgent || false,
    silent: false,
    renotify: true,
    timestamp: Date.now()
  };
  
  event.waitUntil(
    self.registration.showNotification(
      notificationData.title || 'CDSANABRIACF',
      options
    )
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
  if (notificationData.url) {
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

// 📡 Message desde la aplicación
self.addEventListener('message', (event) => {
  console.log('📨 Mensaje recibido:', event.data);
  
  const { type, payload } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CACHE_UPDATE':
      updateCache(payload);
      break;
      
    case 'NOTIFICATION_PERMISSION':
      handleNotificationPermission();
      break;
      
    default:
      console.log('❓ Tipo de mensaje no reconocido:', type);
  }
});

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
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
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
  return STATIC_ASSETS.some(asset => url.pathname.endsWith(asset)) ||
         url.pathname.includes('/css/') ||
         url.pathname.includes('/js/') ||
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

