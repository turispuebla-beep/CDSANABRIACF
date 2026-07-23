/**

 * Persistencia ropa jugador/a — evita perder kitOrder al sincronizar o actualizar fichas.

 */

(function (global) {

  'use strict';



  const KIT_SNAPSHOT_STORAGE_KEY = 'clubPlayerKitSnapshots';



  const FLAT_KIT_IDS = [

    'train_kit',

    'tracksuit',

    'train_jacket',

    'cazadora',

    'train_shirt',

    'train_shorts',

    'match_shirt',

    'match_shorts'

  ];



  function normalizeDni(value) {

    return String(value || '')

      .trim()

      .toUpperCase()

      .replace(/[\s-]/g, '');

  }



  function playerSeason(record) {

    return String(

      (record && (record.inscriptionSeason || record.temporada || record.season || record.inscription_season)) ||

        ''

    ).trim();

  }



  function playerKitMatchKeys(record) {

    if (!record || typeof record !== 'object') return [];

    const keys = [];

    if (record.id != null && String(record.id).trim()) keys.push('id:' + String(record.id).trim());

    const dni = normalizeDni(record.dni);

    const season = playerSeason(record);

    if (dni && season) keys.push('dni:' + dni + '|' + season);

    if (dni) keys.push('dni:' + dni);

    if (global.ClubPlayerMemberSync && typeof global.ClubPlayerMemberSync.playerIdentityKeys === 'function') {

      global.ClubPlayerMemberSync.playerIdentityKeys(record).forEach(function (k) {

        if (k && keys.indexOf(k) < 0) keys.push(k);

      });

    }

    return keys;

  }



  function buildPlayerLookupMap(list) {

    const map = new Map();

    (Array.isArray(list) ? list : []).forEach(function (p) {

      if (!p) return;

      playerKitMatchKeys(p).forEach(function (k) {

        if (!map.has(k)) map.set(k, p);

      });

    });

    return map;

  }



  function findPlayerInList(list, record) {

    if (!record) return null;

    const map = buildPlayerLookupMap(list);

    const keys = playerKitMatchKeys(record);

    for (let i = 0; i < keys.length; i++) {

      if (map.has(keys[i])) return map.get(keys[i]);

    }

    return null;

  }



  function findPlayerIndexInList(list, record) {

    if (!record) return -1;

    const listArr = Array.isArray(list) ? list : [];

    const byId = record.id != null ? listArr.findIndex(function (p) {

      return p && String(p.id) === String(record.id);

    }) : -1;

    if (byId >= 0) return byId;

    const match = findPlayerInList(listArr, record);

    if (!match || match.id == null) return -1;

    return listArr.findIndex(function (p) {

      return p && String(p.id) === String(match.id);

    });

  }



  function kitItemsFromRecord(record) {

    if (!record || typeof record !== 'object') return [];

    if (Array.isArray(record.kitOrder) && record.kitOrder.length) return record.kitOrder.slice();

    if (record.kit && Array.isArray(record.kit.items) && record.kit.items.length) return record.kit.items.slice();

    const flat = [];

    FLAT_KIT_IDS.forEach(function (id) {

      const size = record['kit_' + id] || (record.kit && record.kit[id]) || '';

      if (!size || !String(size).trim()) return;

      flat.push({ id: id, size: String(size).trim(), label: id });

    });

    return flat;

  }



  function hasKitDetail(record) {

    return kitItemsFromRecord(record).length > 0;

  }



  function kitUpdatedAt(record) {

    if (!record) return 0;

    const t = record.kitOrderUpdatedAt || record.kitUpdatedAt || '';

    const d = t ? new Date(t).getTime() : 0;

    return isNaN(d) ? 0 : d;

  }



  function kitSnapshotKey(record) {

    const dni = normalizeDni(record && record.dni);

    const season = playerSeason(record) || 'all';

    if (dni) return dni + '|' + season;

    if (record && record.id != null) return 'id:' + String(record.id);

    return '';

  }



  function readKitSnapshots() {

    try {

      const raw = JSON.parse(global.localStorage.getItem(KIT_SNAPSHOT_STORAGE_KEY) || '{}');

      return raw && typeof raw === 'object' ? raw : {};

    } catch (_) {

      return {};

    }

  }



  function writeKitSnapshots(map) {

    try {

      global.localStorage.setItem(KIT_SNAPSHOT_STORAGE_KEY, JSON.stringify(map || {}));

    } catch (e) {

      console.warn('writeKitSnapshots:', e);

    }

  }



  function saveKitSnapshot(player) {

    if (!player || !hasKitDetail(player)) return;

    const key = kitSnapshotKey(player);

    if (!key) return;

    const map = readKitSnapshots();

    const prev = map[key];

    const prevTs = prev && prev.kitOrderUpdatedAt ? new Date(prev.kitOrderUpdatedAt).getTime() : 0;

    const nextTs = kitUpdatedAt(player);

    if (prev && prevTs > nextTs) return;

    map[key] = snapshotKitFields(player);

    map[key].playerId = player.id != null ? String(player.id) : '';

    map[key].dni = normalizeDni(player.dni);

    map[key].inscriptionSeason = playerSeason(player);

    writeKitSnapshots(map);

  }



  function applyKitSnapshotsToList(list) {

    const players = Array.isArray(list) ? list.slice() : [];

    const map = readKitSnapshots();

    const keys = Object.keys(map);

    if (!keys.length) return players;

    return players.map(function (p) {

      if (!p) return p;

      let snap = map[kitSnapshotKey(p)];

      if (!snap && p.id != null) snap = map['id:' + String(p.id)];

      if (!snap || !hasKitDetail(snap)) return p;

      const pTs = kitUpdatedAt(p);

      const sTs = kitUpdatedAt(snap);

      if (hasKitDetail(p) && pTs >= sTs) return p;

      return mergePlayerKitFields(p, snap);

    });

  }



  function copyKitFieldsFromSource(target, source) {

    if (!target || !source) return target;

    const out = target;

    const items = kitItemsFromRecord(source);

    if (!items.length) return out;



    out.kitOrder = items.map(function (it) {

      return {

        id: it.id,

        label: it.label || it.garment || it.id,

        size: it.size || it.talla || '',

        price: it.price != null ? Number(it.price) : undefined

      };

    });

    out.kit = Object.assign({}, source.kit && typeof source.kit === 'object' ? source.kit : {}, {

      mode: (source.kit && source.kit.mode) || 'per_garment',

      items: out.kitOrder.slice()

    });

    out.kitOrder.forEach(function (it) {

      if (it.id && it.size) out.kit[it.id] = it.size;

    });

    FLAT_KIT_IDS.forEach(function (id) {

      delete out['kit_' + id];

    });

    out.kitOrder.forEach(function (it) {

      if (it.id && it.size) out['kit_' + it.id] = it.size;

    });



    if (Array.isArray(source.kitItemsPaid) && source.kitItemsPaid.length) {

      out.kitItemsPaid = source.kitItemsPaid.slice();

    }

    if (typeof source.kitPaidEur === 'number') out.kitPaidEur = source.kitPaidEur;

    if (source.kitPaymentStatus != null) out.kitPaymentStatus = source.kitPaymentStatus;

    if (source.kitPaymentMethod != null) out.kitPaymentMethod = source.kitPaymentMethod;

    if (source.kitPaymentValidatedAt != null) out.kitPaymentValidatedAt = source.kitPaymentValidatedAt;

    if (source.kitPaymentValidatedBy != null) out.kitPaymentValidatedBy = source.kitPaymentValidatedBy;

    if (source.kitPendingGateway != null) out.kitPendingGateway = source.kitPendingGateway;

    if (source.kitOrderUpdatedAt) out.kitOrderUpdatedAt = source.kitOrderUpdatedAt;

    if (source.kitOrderUpdatedBy) out.kitOrderUpdatedBy = source.kitOrderUpdatedBy;

    if (source.kitSummary) out.kitSummary = source.kitSummary;



    const cb = Object.assign({}, out.chargeBreakdown || {});

    const srcCb = source.chargeBreakdown || {};

    if (srcCb.kit != null && Number(srcCb.kit) > 0) cb.kit = Number(srcCb.kit);

    else if (out.kitOrder.length) {

      cb.kit =

        Math.round(

          out.kitOrder.reduce(function (a, it) {

            return a + Number(it.price || 0);

          }, 0) * 100

        ) / 100;

    }

    if (cb.socio != null || cb.ficha != null || cb.kit != null) {

      cb.total =

        Math.round((Number(cb.socio || 0) + Number(cb.ficha || 0) + Number(cb.kit || 0)) * 100) / 100;

    }

    out.chargeBreakdown = cb;

    return out;

  }



  /** Fusiona ropa: gana quien tenga detalle; si ambos, el más reciente (kitOrderUpdatedAt). */

  function mergePlayerKitFields(preferred, fallback) {

    if (!preferred || typeof preferred !== 'object') return fallback || preferred;

    if (!fallback || typeof fallback !== 'object') return preferred;

    const a = preferred;

    const b = fallback;

    const aKit = hasKitDetail(a);

    const bKit = hasKitDetail(b);

    if (aKit && !bKit) return copyKitFieldsFromSource(Object.assign({}, a), a);

    if (bKit && !aKit) return copyKitFieldsFromSource(Object.assign({}, a), b);

    if (!aKit && !bKit) return Object.assign({}, b, a);

    const aTs = kitUpdatedAt(a);

    const bTs = kitUpdatedAt(b);

    const kitSource = aTs >= bTs ? a : b;

    return copyKitFieldsFromSource(Object.assign({}, b, a), kitSource);

  }



  function snapshotKitFields(player) {

    if (!player) return {};

    const snap = {};

    if (Array.isArray(player.kitOrder)) snap.kitOrder = player.kitOrder.slice();

    if (player.kit) snap.kit = JSON.parse(JSON.stringify(player.kit));

    if (Array.isArray(player.kitItemsPaid)) snap.kitItemsPaid = player.kitItemsPaid.slice();

    FLAT_KIT_IDS.forEach(function (id) {

      if (player['kit_' + id]) snap['kit_' + id] = player['kit_' + id];

    });

    [

      'kitPaidEur',

      'kitPaymentStatus',

      'kitPaymentMethod',

      'kitPaymentValidatedAt',

      'kitPaymentValidatedBy',

      'kitPendingGateway',

      'kitOrderUpdatedAt',

      'kitOrderUpdatedBy',

      'kitSummary'

    ].forEach(function (k) {

      if (player[k] != null) snap[k] = player[k];

    });

    if (player.chargeBreakdown && player.chargeBreakdown.kit != null) {

      snap.chargeBreakdown = Object.assign({}, player.chargeBreakdown);

    }

    return snap;

  }



  function recordsMatchForKit(a, b) {

    if (!a || !b) return false;

    if (a.id != null && b.id != null && String(a.id) === String(b.id)) return true;

    const keysA = playerKitMatchKeys(a);

    for (let i = 0; i < keysA.length; i++) {

      const keysB = playerKitMatchKeys(b);

      for (let j = 0; j < keysB.length; j++) {

        if (keysA[i] === keysB[j]) return true;

      }

    }

    return false;

  }



  function mergePlayersListPreserveKit(localList, remoteList) {

    const local = Array.isArray(localList) ? localList : [];

    const remote = Array.isArray(remoteList) ? remoteList : [];

    const localMap = buildPlayerLookupMap(local);

    const consumedLocalIds = new Set();



    const merged = remote.map(function (rp) {

      if (!rp) return rp;

      let lp = null;

      const keys = playerKitMatchKeys(rp);

      for (let i = 0; i < keys.length; i++) {

        if (localMap.has(keys[i])) {

          lp = localMap.get(keys[i]);

          break;

        }

      }

      if (lp && lp.id != null) consumedLocalIds.add(String(lp.id));

      return lp ? mergePlayerKitFields(rp, lp) : rp;

    });



    local.forEach(function (lp) {

      if (!lp || lp.id == null) return;

      if (consumedLocalIds.has(String(lp.id))) return;

      const alreadyInMerged = merged.some(function (rp) {

        return recordsMatchForKit(rp, lp);

      });

      const lid = String(lp.id);
      const isTempLocal =
        lid.startsWith('PLAYER_') || lid.startsWith('PENDING_') || lid.startsWith('FRIEND_');

      // Conservar locales con kit o IDs temporales aún no reconciliados en la nube.
      if (!alreadyInMerged && (hasKitDetail(lp) || isTempLocal)) merged.push(lp);

    });



    return applyKitSnapshotsToList(merged);

  }



  global.ClubPlayerKitPersist = {

    KIT_SNAPSHOT_STORAGE_KEY: KIT_SNAPSHOT_STORAGE_KEY,

    kitItemsFromRecord: kitItemsFromRecord,

    hasKitDetail: hasKitDetail,

    mergePlayerKitFields: mergePlayerKitFields,

    copyKitFieldsFromSource: copyKitFieldsFromSource,

    snapshotKitFields: snapshotKitFields,

    saveKitSnapshot: saveKitSnapshot,

    applyKitSnapshotsToList: applyKitSnapshotsToList,

    mergePlayersListPreserveKit: mergePlayersListPreserveKit,

    findPlayerInList: findPlayerInList,

    findPlayerIndexInList: findPlayerIndexInList,

    playerKitMatchKeys: playerKitMatchKeys,

    FLAT_KIT_IDS: FLAT_KIT_IDS

  };

})(typeof window !== 'undefined' ? window : globalThis);


