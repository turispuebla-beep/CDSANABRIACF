/**
 * Exportación jugadores/as — columnas configurables (Excel, Word, PDF)
 */
(function (global) {
  'use strict';

  const GARMENT_LABELS = {
    match_shirt: 'Camiseta partido',
    match_shorts: 'Pantalón corto partido',
    tracksuit: 'Chándal',
    train_shirt: 'Camiseta entreno',
    train_shorts: 'Pantalón entreno',
    train_jacket: 'Chaqueta / basquera'
  };

  const CATEGORY_LABELS = {
    prebenjamin: 'Prebenjamín',
    prebenajmin: 'Prebenjamín',
    benjamin: 'Benjamín',
    alevin: 'Alevín',
    infantil: 'Infantil',
    cadete: 'Cadete',
    juvenile: 'Juvenil',
    juvenil: 'Juvenil',
    aficionado: 'Aficionado'
  };

  function formatExportDate(value) {
    if (!value) return '';
    try {
      const d = new Date(value);
      return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('es-ES');
    } catch (_) {
      return String(value);
    }
  }

  function formatExportDateTime(value) {
    if (!value) return '';
    try {
      const d = new Date(value);
      return isNaN(d.getTime()) ? String(value) : d.toLocaleString('es-ES');
    } catch (_) {
      return String(value);
    }
  }

  function yesNo(v) {
    return v === true || v === 'true' || v === 1 ? 'Sí' : v === false || v === 'false' || v === 0 ? 'No' : '';
  }

  function categoryLabel(cat) {
    const k = String(cat || '').toLowerCase();
    return CATEGORY_LABELS[k] || cat || '';
  }

  function isMinorPlayer(p) {
    if (p.isMinor === true) return true;
    if (p.age != null && Number(p.age) < 18) return true;
    if (p.edad != null && Number(p.edad) < 18) return true;
    if (global.ClubInscriptionConfig && (p.birthDate || p.fechaNacimiento)) {
      const age = global.ClubInscriptionConfig.calculateAge(p.birthDate || p.fechaNacimiento);
      return age != null && age < 18;
    }
    return false;
  }

  function exportDniValue(p) {
    const dni = String(p.dni || '').trim();
    if (dni) return dni;
    if (isMinorPlayer(p)) return '';
    return '';
  }

  function paymentStatusLabel(p) {
    if (global.PlayerInscription && global.PlayerInscription.getDisplayStatus) {
      return global.PlayerInscription.getDisplayStatus(p).text;
    }
    const ins = String(p.inscriptionStatus || '').toLowerCase();
    if (p.inscriptionPaid || ins === 'paid') return 'Pagado / Activo';
    if (ins === 'pending_transfer') return 'Pendiente transferencia';
    if (ins === 'pending_payment') return 'Pendiente de pago';
    if (p.status === 'active') return 'Activo';
    if (p.status === 'pending_validation') return 'Pendiente validación';
    return p.status || '';
  }

  function paymentMethodLabel(p) {
    const m = String(p.paymentMethod || '').toLowerCase();
    if (!m) return '';
    if (m.indexOf('redsys') >= 0 || m.indexOf('bizum') >= 0) return 'Pasarela (tarjeta/Bizum)';
    if (m.indexOf('transfer') >= 0) return 'Transferencia';
    if (m.indexOf('cash') >= 0) return 'Efectivo';
    if (m === 'free' || m === 'inscripcion_gratis') return 'Gratis (0 €)';
    if (m.indexOf('admin') >= 0) return 'Validado por administración';
    return p.paymentMethod;
  }

  function getKitItems(player) {
    if (Array.isArray(player.kitOrder) && player.kitOrder.length) return player.kitOrder;
    if (player.kit && Array.isArray(player.kit.items)) return player.kit.items;
    return [];
  }

  function formatKitSummary(player) {
    const items = getKitItems(player);
    if (!items.length) return '';
    return items
      .map(function (it) {
        const label = it.label || GARMENT_LABELS[it.id] || it.id || 'Prenda';
        const price =
          it.price != null && Number(it.price) > 0 ? ' — ' + Number(it.price).toFixed(2) + ' €' : '';
        return label + ': talla ' + (it.size || '—') + price;
      })
      .join(' | ');
  }

  function kitSizeFor(player, garmentId) {
    const items = getKitItems(player);
    const it = items.find(function (x) {
      return x.id === garmentId;
    });
    return it && it.size ? it.size : '';
  }

  function clubDorsalValue(p) {
    const n = p.number != null && p.number !== '' ? p.number : p.dorsal;
    return n != null && n !== '' ? String(n) : '';
  }

  function clubLicenseValue(p) {
    return String(p.license || p.licencia || '').trim();
  }

  /** Valores por id de campo (catálogo) */
  function buildFieldValues(p) {
    const cb = p.chargeBreakdown || {};
    const cat = p.category || p.categoria || '';
    return {
      nombre: p.name || p.nombre || '',
      apellidos: p.surname || p.apellidos || '',
      dni: exportDniValue(p),
      temporada: p.inscriptionSeason || p.temporada || '',
      email: p.email || '',
      telefono: p.phone || p.telefono || '',
      direccion: p.address || p.direccion || '',
      fecha_nacimiento: formatExportDate(p.birthDate || p.fechaNacimiento),
      edad: p.age != null ? p.age : p.edad != null ? p.edad : '',
      categoria: categoryLabel(cat),
      posicion: p.position || p.posicion || '',
      dorsal: clubDorsalValue(p),
      licencia: clubLicenseValue(p),
      peso: p.weightKg != null ? p.weightKg : p.peso != null ? p.peso : '',
      altura: p.heightCm != null ? p.heightCm : p.altura != null ? p.altura : '',
      kit_match_shirt: kitSizeFor(p, 'match_shirt'),
      kit_match_shorts: kitSizeFor(p, 'match_shorts'),
      kit_tracksuit: kitSizeFor(p, 'tracksuit'),
      kit_train_shirt: kitSizeFor(p, 'train_shirt'),
      kit_train_shorts: kitSizeFor(p, 'train_shorts'),
      kit_train_jacket: kitSizeFor(p, 'train_jacket'),
      kit_resumen: formatKitSummary(p),
      importe_ropa: cb.kit != null ? Number(cb.kit).toFixed(2) : '',
      importe_ficha: cb.ficha != null ? Number(cb.ficha).toFixed(2) : '',
      importe_socio: cb.socio != null ? Number(cb.socio).toFixed(2) : '',
      importe_total: cb.total != null ? Number(cb.total).toFixed(2) : '',
      incluye_ficha: yesNo(p.payFichaSelected),
      incluye_socio: yesNo(p.paySocioSelected),
      estado_pago: paymentStatusLabel(p),
      metodo_pago: paymentMethodLabel(p),
      fecha_pago: formatExportDateTime(p.paidAt),
      fecha_registro: formatExportDateTime(p.registrationDate),
      tutor_nombre: p.guardianName || '',
      tutor_dni: p.guardianDNI || p.guardianDni || '',
      tutor_telefono: p.guardianPhone || '',
      tutor_email: p.guardianEmail || '',
      tutor_direccion: p.guardianAddress || '',
      consent_jugador: yesNo(p.playerConsent),
      consent_imagen: yesNo(p.photoConsent),
      partidos: p.matches != null ? p.matches : '',
      goles: p.goals != null ? p.goals : '',
      asistencias: p.assists != null ? p.assists : '',
      amarillas: p.yellowCards != null ? p.yellowCards : '',
      rojas: p.redCards != null ? p.redCards : '',
      socio_jugador: yesNo(p.socioJugador),
      es_menor: yesNo(isMinorPlayer(p))
    };
  }

  function getActiveExportColumns(settings) {
    if (global.ClubPlayerExportConfig) {
      return global.ClubPlayerExportConfig.getActiveFields(settings);
    }
    return [{ id: 'nombre', label: 'Nombre' }, { id: 'apellidos', label: 'Apellidos' }, { id: 'dni', label: 'DNI' }];
  }

  function mapPlayerExportRow(p, exportSettings) {
    const columns = getActiveExportColumns(exportSettings);
    const values = buildFieldValues(p);
    const row = {};
    columns.forEach(function (col) {
      row[col.label] = values[col.id] != null ? values[col.id] : '';
    });
    return row;
  }

  function getExportHeaders(exportSettings) {
    return getActiveExportColumns(exportSettings).map(function (c) {
      return c.label;
    });
  }

  function filterPlayers(players, opts) {
    const o = opts || {};
    let items = Array.isArray(players) ? players.slice() : [];
    if (o.category && o.category !== 'all') {
      items = items.filter(function (p) {
        return String(p.category || p.categoria || '') === o.category;
      });
    }
    if (o.season && o.season !== 'all') {
      items = items.filter(function (p) {
        return String(p.inscriptionSeason || p.temporada || '') === o.season;
      });
    }
    if (o.payment && o.payment !== 'all') {
      items = items.filter(function (p) {
        const paid = !!(p.inscriptionPaid || p.paymentStatus === 'paid');
        const ins = String(p.inscriptionStatus || '').toLowerCase();
        if (o.payment === 'paid') return paid || ins === 'paid' || p.status === 'active';
        if (o.payment === 'pending') {
          return !paid && (ins === 'pending_payment' || ins === 'pending_transfer' || p.status === 'pending_validation');
        }
        return true;
      });
    }
    return items;
  }

  function collectExportRows(opts) {
    const exportSettings = global.ClubPlayerExportConfig ? global.ClubPlayerExportConfig.read() : null;
    let players = [];
    try {
      players = JSON.parse(global.localStorage.getItem('clubPlayers') || '[]');
    } catch (_) {}
    return filterPlayers(players, opts).map(function (p) {
      return mapPlayerExportRow(p, exportSettings);
    });
  }

  function refreshSeasonSelect(selectId) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const current = sel.value;
    let players = [];
    try {
      players = JSON.parse(global.localStorage.getItem('clubPlayers') || '[]');
    } catch (_) {}
    const seasons = {};
    players.forEach(function (p) {
      const s = String(p.inscriptionSeason || p.temporada || '').trim();
      if (s) seasons[s] = true;
    });
    if (global.ClubInscriptionConfig) {
      const cfg = global.ClubInscriptionConfig.read();
      if (cfg.season) seasons[cfg.season] = true;
    }
    const list = Object.keys(seasons).sort().reverse();
    sel.innerHTML = '<option value="all">Todas las temporadas</option>';
    list.forEach(function (s) {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      sel.appendChild(opt);
    });
    if (current && (current === 'all' || seasons[current])) sel.value = current;
  }

  global.PlayerExport = {
    mapPlayerExportRow: mapPlayerExportRow,
    getExportHeaders: getExportHeaders,
    buildFieldValues: buildFieldValues,
    filterPlayers: filterPlayers,
    collectExportRows: collectExportRows,
    refreshSeasonSelect: refreshSeasonSelect,
    isMinorPlayer: isMinorPlayer
  };

  document.addEventListener('DOMContentLoaded', function () {
    refreshSeasonSelect('exportPlayerSeason');
    refreshSeasonSelect('jugadoresExportSeason');
  });
})(typeof window !== 'undefined' ? window : globalThis);
