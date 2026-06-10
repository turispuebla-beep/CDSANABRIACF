/**
 * Contabilidad club: saldo A (banco) y B (efectivo), libro en localStorage.
 * Los asientos se pueden editar, borrar y cambiar de caja desde el panel (Firebase sync opcional).
 */
(function (global) {
  var LEDGER_KEY = 'clubAccountingLedger';
  var PRICING_KEY = 'clubMembershipPricing';
  var DEFAULT_PRICING = { cuotaMenor: 10, cuotaMayor: 25, edadMaxMenor: 17, updatedAt: null, updatedBy: null };

  /** Primer cierre de temporada (31/05 por defecto). Ver club-membership-season.js / MEMBERSHIP_* en Netlify. */
  var CUOTA_TEMPORADA_PRIMER_CIERRE_ANIO =
    global.ClubMembershipSeason && global.ClubMembershipSeason.getConfig
      ? global.ClubMembershipSeason.getConfig().firstCloseYear
      : 2027;

  function seasonApi() {
    return global.ClubMembershipSeason || null;
  }

  function finDiaCierreTemporada(anio) {
    if (seasonApi()) return seasonApi().finDiaCierreTemporada(anio);
    return new Date(anio, 4, 31, 23, 59, 59, 999);
  }

  /** Siguiente cierre de temporada (31/05 por defecto) para cuotaVigenteHasta. */
  function getProximaVigenciaCuotaHasta() {
    if (seasonApi()) return seasonApi().getProximaVigenciaCuotaHasta();
    var now = new Date();
    var y = CUOTA_TEMPORADA_PRIMER_CIERRE_ANIO;
    for (var i = 0; i < 25; i++) {
      var d = finDiaCierreTemporada(y);
      if (d >= now) return d;
      y++;
    }
    return finDiaCierreTemporada(CUOTA_TEMPORADA_PRIMER_CIERRE_ANIO);
  }

  /** Año del cierre de temporada usado para calcular menor/mayor cuota (edad en esa fecha). */
  function getCuotaEdadReferenciaAnio() {
    if (seasonApi()) return seasonApi().getCuotaEdadReferenciaAnio();
    var now = new Date();
    var y = CUOTA_TEMPORADA_PRIMER_CIERRE_ANIO;
    while (now > finDiaCierreTemporada(y)) y++;
    return y;
  }

  function parseBirthDate(birth) {
    if (!birth) return null;
    var d = new Date(birth);
    return isNaN(d.getTime()) ? null : d;
  }

  function edadEnFechaReferenciaCierre(birth, anioRef) {
    if (seasonApi()) return seasonApi().edadEnFechaReferenciaCierre(birth, anioRef);
    var ref = new Date(anioRef, 4, 31, 12, 0, 0, 0);
    var b = parseBirthDate(birth);
    if (!b) return NaN;
    var age = ref.getFullYear() - b.getFullYear();
    var m = ref.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && ref.getDate() < b.getDate())) age--;
    return age;
  }

  function edadEnFechaReferencia31Agosto(birth, anioRef) {
    return edadEnFechaReferenciaCierre(birth, anioRef);
  }

  /** Cuota menor/mayor según fecha de nacimiento y reglas del panel, edad al cierre de temporada. */
  function cuotaDesdeFechaNacimiento(birthDateStr) {
    var p = getMembershipPricing();
    var anio = getCuotaEdadReferenciaAnio();
    var edad = edadEnFechaReferenciaCierre(birthDateStr, anio);
    if (edad == null || isNaN(edad)) return p.cuotaMayor;
    return edad <= p.edadMaxMenor ? p.cuotaMenor : p.cuotaMayor;
  }

  function newLedgerId() {
    return String(Date.now()) + String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
  }

  function readLedger() {
    try {
      var raw = localStorage.getItem(LEDGER_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function writeLedger(entries) {
    localStorage.setItem(LEDGER_KEY, JSON.stringify(entries));
  }

  function getBalances() {
    var entries = readLedger();
    var A = 0;
    var B = 0;
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var amt = Number(e.signedAmount || 0);
      if (e.bucket === 'B') B += amt;
      else A += amt;
    }
    return {
      A: Math.round(A * 100) / 100,
      B: Math.round(B * 100) / 100
    };
  }

  function getMembershipPricing() {
    try {
      var raw = localStorage.getItem(PRICING_KEY);
      if (!raw) return Object.assign({}, DEFAULT_PRICING);
      var o = JSON.parse(raw);
      var cuotaMayor = Math.max(
        0,
        Number(o.cuotaMayor != null ? o.cuotaMayor : DEFAULT_PRICING.cuotaMayor)
      );
      if (cuotaMayor === 20 && DEFAULT_PRICING.cuotaMayor === 25) {
        cuotaMayor = 25;
      }
      return {
        cuotaMenor: Math.max(0, Number(o.cuotaMenor != null ? o.cuotaMenor : DEFAULT_PRICING.cuotaMenor)),
        cuotaMayor: cuotaMayor,
        edadMaxMenor: Math.max(0, Math.floor(Number(o.edadMaxMenor != null ? o.edadMaxMenor : DEFAULT_PRICING.edadMaxMenor))),
        updatedAt: o.updatedAt || null,
        updatedBy: o.updatedBy || null
      };
    } catch (err) {
      return Object.assign({}, DEFAULT_PRICING);
    }
  }

  function saveMembershipPricing(data) {
    var p = {
      cuotaMenor: Math.max(0, Number(data.cuotaMenor)),
      cuotaMayor: Math.max(0, Number(data.cuotaMayor)),
      edadMaxMenor: Math.max(0, Math.floor(Number(data.edadMaxMenor))),
      updatedAt: new Date().toISOString(),
      updatedBy: data.updatedBy || 'admin'
    };
    localStorage.setItem(PRICING_KEY, JSON.stringify(p));
    return p;
  }

  function appendEntry(entry) {
    var list = readLedger();
    var signed = Number(entry.signedAmount);
    if (!Number.isFinite(signed) || signed === 0) return null;
    var row = {
      id: entry.id || newLedgerId(),
      createdAt: entry.createdAt || new Date().toISOString(),
      bucket: entry.bucket === 'B' ? 'B' : 'A',
      signedAmount: Math.round(signed * 100) / 100,
      concept: String(entry.concept || '').slice(0, 500),
      category: String(entry.category || 'otro').slice(0, 80),
      refType: entry.refType || null,
      refId: entry.refId != null ? String(entry.refId) : null,
      transferPairId: entry.transferPairId || null,
      appScope: 'cdsanabriacf'
    };
    list.push(row);
    writeLedger(list);
    return row;
  }

  function trySyncLedgerRow(row) {
    if (!row || typeof global.createDocument !== 'function') return Promise.resolve(row);
    return global
      .createDocument('ledger', row)
      .then(function (newId) {
        if (newId && String(newId) !== String(row.id)) {
          var list = readLedger();
          for (var i = 0; i < list.length; i++) {
            if (list[i].id === row.id) {
              list[i] = Object.assign({}, list[i], { id: String(newId) });
              writeLedger(list);
              break;
            }
          }
        }
        return row;
      })
      .catch(function (e) {
        console.warn('ClubAccounting: no se sincronizó asiento en Firebase:', e);
        return row;
      });
  }

  function recordMemberCuotaToBankA(member, amount) {
    var cuota = Number(amount);
    if (!Number.isFinite(cuota) || cuota <= 0) return null;
    var name = [member && member.name, member && member.surname].filter(Boolean).join(' ').trim()
      || [member && member.nombre, member && member.apellidos].filter(Boolean).join(' ').trim()
      || 'Socio';
    return appendEntry({
      bucket: 'A',
      signedAmount: cuota,
      concept: 'Cuota socio validada (banco): ' + name,
      category: 'cuota_socio',
      refType: 'member',
      refId: String((member && member.id) || '')
    });
  }

  /** Asiento de cuota ya registrado para este id de socio (evita duplicados). */
  function findLedgerCuotaSocioByMemberId(memberId) {
    var sid = String(memberId || '');
    if (!sid) return null;
    var list = readLedger();
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.refType === 'member' && String(e.refId || '') === sid && e.category === 'cuota_socio') {
        if (Number(e.signedAmount || 0) > 0) return e;
      }
    }
    return null;
  }

  /**
   * Igual que recordMemberCuotaToBankA pero no crea fila si ya hay cuota_socio positiva para ese socio.
   * @returns {{ skipped: boolean, existing?: object, row?: object|null }}
   */
  function recordMemberCuotaToBankAIfMissing(member, amount) {
    var ex = findLedgerCuotaSocioByMemberId(member && member.id);
    if (ex) return { skipped: true, existing: ex };
    var row = recordMemberCuotaToBankA(member, amount);
    return { skipped: false, row: row };
  }

  function recordEventIncome(bucket, amount, eventId, eventName, participantHint) {
    var a = Number(amount);
    if (!Number.isFinite(a) || a <= 0) return null;
    return appendEntry({
      bucket: bucket === 'B' ? 'B' : 'A',
      signedAmount: a,
      concept: 'Evento "' + (eventName || eventId) + '": ' + (participantHint || 'inscripción'),
      category: 'evento',
      refType: 'event',
      refId: String(eventId || '')
    });
  }

  function recordEventIncomeReversal(bucket, amount, eventId, eventName, participantHint) {
    var a = Number(amount);
    if (!Number.isFinite(a) || a <= 0) return null;
    return appendEntry({
      bucket: bucket === 'B' ? 'B' : 'A',
      signedAmount: -a,
      concept: 'Reversión baja evento "' + (eventName || eventId) + '": ' + (participantHint || ''),
      category: 'evento_reversion',
      refType: 'event',
      refId: String(eventId || '')
    });
  }

  function recordManual(bucket, signedAmount, concept, category) {
    return appendEntry({
      bucket: bucket,
      signedAmount: Number(signedAmount),
      concept: concept,
      category: category || 'manual'
    });
  }

  function recordTransfer(fromBucket, toBucket, amount, note) {
    var a = Number(amount);
    if (!Number.isFinite(a) || a <= 0) return null;
    var fb = fromBucket === 'B' ? 'B' : 'A';
    var tb = toBucket === 'B' ? 'B' : 'A';
    if (fb === tb) return null;
    var pairId = 'XFER_' + newLedgerId();
    appendEntry({
      bucket: fb,
      signedAmount: -a,
      concept: 'Traspaso → ' + tb + (note ? ': ' + note : ''),
      category: 'transferencia',
      transferPairId: pairId
    });
    appendEntry({
      bucket: tb,
      signedAmount: a,
      concept: 'Traspaso desde ' + fb + (note ? ': ' + note : ''),
      category: 'transferencia',
      transferPairId: pairId
    });
    return pairId;
  }

  function ensureDefaultPricing() {
    if (!localStorage.getItem(PRICING_KEY)) {
      saveMembershipPricing({
        cuotaMenor: DEFAULT_PRICING.cuotaMenor,
        cuotaMayor: DEFAULT_PRICING.cuotaMayor,
        edadMaxMenor: DEFAULT_PRICING.edadMaxMenor,
        updatedBy: 'inicial'
      });
    }
  }

  function getEntryById(id) {
    var sid = String(id || '');
    var list = readLedger();
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === sid) return list[i];
    }
    return null;
  }

  function updateEntryById(id, patch) {
    var sid = String(id || '');
    var list = readLedger();
    var ix = -1;
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === sid) {
        ix = i;
        break;
      }
    }
    if (ix < 0) return null;
    var cur = list[ix];
    var next = Object.assign({}, cur, patch);
    next.signedAmount = Math.round(Number(next.signedAmount) * 100) / 100;
    next.bucket = next.bucket === 'B' ? 'B' : 'A';
    next.concept = String(next.concept != null ? next.concept : '').slice(0, 500);
    next.category = String(next.category != null ? next.category : 'otro').slice(0, 80);
    if (patch.createdAt != null) next.createdAt = String(patch.createdAt);
    if (!Number.isFinite(next.signedAmount) || next.signedAmount === 0) return null;
    next.updatedAt = new Date().toISOString();
    list[ix] = next;
    writeLedger(list);
    return next;
  }

  function deleteEntryById(id) {
    var sid = String(id || '');
    var list = readLedger().filter(function (x) {
      return String(x.id) !== sid;
    });
    writeLedger(list);
    return true;
  }

  function toggleEntryBucket(id) {
    var row = getEntryById(id);
    if (!row) return null;
    var nb = row.bucket === 'B' ? 'A' : 'B';
    return updateEntryById(id, { bucket: nb });
  }

  /** desde / hasta: strings 'YYYY-MM-DD' o vacio. */
  function filterLedgerByDateRange(list, desde, hasta) {
    var d0 = desde && String(desde).trim() ? new Date(String(desde).trim() + 'T00:00:00').getTime() : null;
    var d1 = hasta && String(hasta).trim() ? new Date(String(hasta).trim() + 'T23:59:59.999').getTime() : null;
    return list.filter(function (e) {
      var t = new Date(e.createdAt).getTime();
      if (isNaN(t)) return false;
      if (d0 != null && t < d0) return false;
      if (d1 != null && t > d1) return false;
      return true;
    });
  }

  function sortLedgerDesc(list) {
    return list.slice().sort(function (a, b) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  function sortLedgerAsc(list) {
    return list.slice().sort(function (a, b) {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }

  global.ClubAccounting = {
    LEDGER_KEY: LEDGER_KEY,
    PRICING_KEY: PRICING_KEY,
    readLedger: readLedger,
    getBalances: getBalances,
    appendEntry: appendEntry,
    trySyncLedgerRow: trySyncLedgerRow,
    getMembershipPricing: getMembershipPricing,
    saveMembershipPricing: saveMembershipPricing,
    recordMemberCuotaToBankA: recordMemberCuotaToBankA,
    findLedgerCuotaSocioByMemberId: findLedgerCuotaSocioByMemberId,
    recordMemberCuotaToBankAIfMissing: recordMemberCuotaToBankAIfMissing,
    recordEventIncome: recordEventIncome,
    recordEventIncomeReversal: recordEventIncomeReversal,
    recordManual: recordManual,
    recordTransfer: recordTransfer,
    ensureDefaultPricing: ensureDefaultPricing,
    newLedgerId: newLedgerId,
    getEntryById: getEntryById,
    updateEntryById: updateEntryById,
    deleteEntryById: deleteEntryById,
    toggleEntryBucket: toggleEntryBucket,
    filterLedgerByDateRange: filterLedgerByDateRange,
    sortLedgerDesc: sortLedgerDesc,
    sortLedgerAsc: sortLedgerAsc,
    CUOTA_TEMPORADA_PRIMER_CIERRE_ANIO: CUOTA_TEMPORADA_PRIMER_CIERRE_ANIO,
    getProximaVigenciaCuotaHasta: getProximaVigenciaCuotaHasta,
    getCuotaEdadReferenciaAnio: getCuotaEdadReferenciaAnio,
    edadEnFechaReferencia31Agosto: edadEnFechaReferencia31Agosto,
    edadEnFechaReferenciaCierre: edadEnFechaReferenciaCierre,
    cuotaDesdeFechaNacimiento: cuotaDesdeFechaNacimiento
  };
})(typeof window !== 'undefined' ? window : this);
