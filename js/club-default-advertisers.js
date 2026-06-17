/**
 * Colaboradores / anunciantes por defecto del club (assets/anunciantes).
 * Se fusionan en localStorage clubAdvertisements si aún no existen.
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'clubAdvertisements';
  const SEED_VERSION = '2026-anunciantes-v1';

  const DEFAULT_ADVERTISERS = [
    {
      id: 'AD_SEED_AYUNTAMIENTO_PUEBLA',
      title: 'Ayuntamiento de Puebla de Sanabria',
      company: 'Ayuntamiento de Puebla de Sanabria',
      description: 'Turismo, cultura y servicios municipales en Puebla de Sanabria.',
      url: 'https://www.pueblasanabria.com/',
      category: 'servicios',
      position: 1,
      status: 'active',
      type: 'carrusel',
      mediaKind: 'image',
      mediaName: 'ayuntamiento-puebla.jpg',
      image: 'assets/anunciantes/ayuntamiento-puebla.jpg',
      mediaData: 'assets/anunciantes/ayuntamiento-puebla.jpg'
    },
    {
      id: 'AD_SEED_BEBIDAS_MORAN',
      title: 'Almacén de Bebidas Morán',
      company: 'Bebidas Morán',
      description: 'Distribución y almacén de bebidas en la comarca.',
      url: 'https://www.facebook.com/almacende.bebidasmoran/',
      category: 'comercio',
      position: 2,
      status: 'active',
      type: 'carrusel',
      mediaKind: 'image',
      mediaName: 'moran.jpg',
      image: 'assets/anunciantes/moran.jpg',
      mediaData: 'assets/anunciantes/moran.jpg'
    },
    {
      id: 'AD_SEED_TALLERES_MAESTRE',
      title: 'Talleres Maestre',
      company: 'Talleres Maestre',
      description: 'Taller mecánico en Puebla de Sanabria — Euro Repar.',
      url: 'https://talleresmaestre.es/',
      category: 'servicios',
      position: 3,
      status: 'active',
      type: 'carrusel',
      mediaKind: 'image',
      mediaName: 'maestre.jpg',
      image: 'assets/anunciantes/MAESTRE.JPG',
      mediaData: 'assets/anunciantes/MAESTRE.JPG'
    },
    {
      id: 'AD_SEED_CASA_MARIBONA',
      title: 'Casa Maribona',
      company: 'Hotel Restaurante Casa Maribona',
      description: 'Hotel y restaurante en El Puente de Sanabria.',
      url: 'https://casamaribonagela.com/',
      category: 'comercio',
      position: 4,
      status: 'active',
      type: 'carrusel',
      mediaKind: 'image',
      mediaName: 'maribona.png',
      image: 'assets/anunciantes/maribona.png',
      mediaData: 'assets/anunciantes/maribona.png'
    },
    {
      id: 'AD_SEED_PINTU',
      title: 'Pintu',
      company: 'Pintu',
      description: 'Colaborador del CD Sanabria CF.',
      url: '',
      category: 'comercio',
      position: 5,
      status: 'active',
      type: 'carrusel',
      mediaKind: 'image',
      mediaName: 'pintu.jpg',
      image: 'assets/anunciantes/PINTU.jpg',
      mediaData: 'assets/anunciantes/PINTU.jpg'
    }
  ];

  function cloneSeed(ad) {
    return Object.assign({}, ad);
  }

  function ensureDefaultAdvertisers() {
    let list = [];
    try {
      list = JSON.parse(global.localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(list)) list = [];
    } catch (_) {
      list = [];
    }

    let changed = false;
    DEFAULT_ADVERTISERS.forEach(function (seed) {
      const ix = list.findIndex(function (a) {
        return a && a.id === seed.id;
      });
      if (ix < 0) {
        list.push(
          Object.assign(cloneSeed(seed), {
            startDate: '',
            endDate: '',
            bookLayout: 'single',
            bookAutoplayMs: 5000,
            createdAt: new Date().toISOString(),
            views: 0,
            clicks: 0,
            seedVersion: SEED_VERSION
          })
        );
        changed = true;
        return;
      }
      const cur = list[ix];
      const patch = {
        title: seed.title,
        company: seed.company,
        description: seed.description,
        url: seed.url,
        status: 'active',
        type: seed.type,
        mediaKind: seed.mediaKind,
        mediaName: seed.mediaName,
        image: seed.image,
        mediaData: seed.mediaData,
        position: seed.position,
        seedVersion: SEED_VERSION
      };
      const needsPatch = Object.keys(patch).some(function (k) {
        return cur[k] !== patch[k];
      });
      if (needsPatch) {
        list[ix] = Object.assign({}, cur, patch);
        changed = true;
      }
    });

    if (changed) {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      try {
        global.dispatchEvent(new CustomEvent('clubAdvertisementsUpdated'));
      } catch (_) {}
    }
    return list;
  }

  global.ClubDefaultAdvertisers = {
    STORAGE_KEY: STORAGE_KEY,
    DEFAULT_ADVERTISERS: DEFAULT_ADVERTISERS,
    ensureDefaultAdvertisers: ensureDefaultAdvertisers
  };
})(typeof window !== 'undefined' ? window : globalThis);
