/**
 * Exportación jugadores/as — columnas configurables (Excel, Word, PDF)
 */
(function (global) {
  'use strict';

  const GARMENT_LABELS = {
    match_shirt: 'Camiseta partido',
    match_shorts: 'Pantalón corto partido',
    tracksuit: 'Chándal',
    train_kit: 'Ropa de entreno',
    train_shirt: 'Camiseta entreno',
    train_shorts: 'Pantalón entreno',
    train_jacket: 'Chubasquero',
    cazadora: 'Cazadora'
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
    senior: 'Senior / Aficionado',
    aficionado: 'Senior / Aficionado'
  };

  function categoryLabel(cat) {
    const k = String(cat || '').toLowerCase();
    if (global.ClubPlayerMemberSync && global.ClubPlayerMemberSync.normalizeCategoryId) {
      const canon = global.ClubPlayerMemberSync.normalizeCategoryId(k);
      return CATEGORY_LABELS[canon] || CATEGORY_LABELS[k] || cat || '';
    }
    return CATEGORY_LABELS[k] || cat || '';
  }

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

  function consentYesNo(flag, acceptedAt) {
    if (flag === true || flag === 'true' || flag === 1) return 'Sí';
    if (acceptedAt) return 'Sí';
    if (flag === false || flag === 'false' || flag === 0) return 'No';
    return 'No';
  }

  function buildConsentNotifyFields(p) {
    const reg = p || {};
    return [
      {
        label: 'Normas inscripción CD Sanabria CF',
        value: consentYesNo(reg.clubRulesAccepted, reg.clubRulesAcceptedAt)
      },
      {
        label: 'Consent. jugador/a CD Sanabria CF',
        value: yesNo(reg.playerConsent) || 'No'
      },
      {
        label: 'Consent. fotos y vídeos del club',
        value: yesNo(reg.photoConsent) || 'No'
      },
      {
        label: 'Autorización categoría superior',
        value: consentYesNo(reg.categorySuperiorConsent, reg.categorySuperiorConsentAt)
      }
    ];
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
    if (ins === 'pending_cash') return 'Pendiente efectivo';
    if (ins === 'pending_tpv') return 'Pendiente TPV';
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
    if (player.kit && Array.isArray(player.kit.items) && player.kit.items.length) return player.kit.items;
    const flat = [];
    const flatIds = ['train_kit', 'tracksuit', 'train_jacket', 'cazadora', 'train_shirt', 'train_shorts'];
    flatIds.forEach(function (id) {
      const size =
        (player.kit && player.kit[id]) ||
        player['kit_' + id] ||
        '';
      if (!size || !String(size).trim()) return;
      flat.push({ id: id, size: String(size).trim(), label: GARMENT_LABELS[id] || id });
    });
    return flat;
  }

  function garmentLabel(it) {
    if (!it) return 'Prenda';
    return String(it.label || GARMENT_LABELS[it.id] || it.garment || it.prenda || it.id || 'Prenda').trim();
  }

  function garmentSize(it) {
    return String((it && (it.size || it.talla)) || '—').trim() || '—';
  }

  function formatKitSummary(player) {
    const items = getKitItems(player);
    if (!items.length) return '';
    return items
      .map(function (it) {
        const price =
          it.price != null && Number(it.price) > 0 ? ' — ' + Number(it.price).toFixed(2) + ' €' : '';
        return garmentLabel(it) + ': talla ' + garmentSize(it) + price;
      })
      .join(' | ');
  }

  /** Una línea por prenda (panel admin, alertas). */
  function formatKitDetailLines(player) {
    const items = getKitItems(player);
    if (!items.length) return 'Sin pedido de ropa registrado';
    return items
      .map(function (it) {
        const price =
          it.price != null && Number(it.price) > 0 ? ' — ' + Number(it.price).toFixed(2) + ' €' : '';
        return '• ' + garmentLabel(it) + ': talla ' + garmentSize(it) + price;
      })
      .join('\n');
  }

  function composeGuardianAddressFromReg(reg) {
    const r = reg || {};
    if (r.guardianAddress) return r.guardianAddress;
    if (global.PlayerInscription && global.PlayerInscription.composeAddress) {
      return (
        global.PlayerInscription.composeAddress({
          domicilio: r.guardianDomicilio,
          localidad: r.guardianLocalidad,
          provincia: r.guardianProvincia
        }) || '—'
      );
    }
    return [r.guardianDomicilio, r.guardianLocalidad, r.guardianProvincia].filter(Boolean).join(', ') || '—';
  }

  /** Campos completos para correos de inscripción (club y jugador/a). */
  function buildInscriptionNotifyFields(reg, opts) {
    const extra = opts && typeof opts === 'object' ? opts : {};
    const cb = (reg && reg.chargeBreakdown) || {};
    const base = [
      { label: 'ID ficha', value: reg.id || '—' },
      { label: 'Nombre', value: reg.name || reg.nombre || '—' },
      { label: 'Apellidos', value: reg.surname || reg.apellidos || '—' },
      { label: 'DNI', value: reg.dni || '—' },
      { label: 'Nº socio vinculado', value: reg.numeroSocio || reg.memberNumber || '—' },
      { label: 'Temporada', value: reg.inscriptionSeason || reg.temporada || '—' },
      { label: 'Categoría', value: reg.category || reg.categoria || '—' },
      { label: 'Fecha nacimiento', value: reg.birthDate || reg.fechaNacimiento || '—' },
      { label: 'Domicilio', value: reg.domicilio || reg.address || '—' },
      { label: 'Localidad', value: reg.localidad || '—' },
      { label: 'Provincia', value: reg.provincia || '—' },
      { label: 'Teléfono', value: reg.phone || reg.telefono || '—' },
      { label: 'Email', value: reg.email || '—' },
      { label: 'Posición', value: reg.position || reg.posicion || '—' },
      { label: 'Grupo sanguíneo', value: reg.bloodGroup || '—' },
      { label: 'Lesiones', value: reg.injuries || '—' },
      { label: 'Alergias / enfermedad', value: reg.allergyIllness || '—' },
      { label: 'Observaciones', value: reg.observations || '—' },
      {
        label: 'Peso (kg)',
        value: reg.weightKg != null && reg.weightKg !== '' ? reg.weightKg : '—'
      },
      {
        label: 'Altura (cm)',
        value: reg.heightCm != null && reg.heightCm !== '' ? reg.heightCm : '—'
      },
      { label: 'Cuota ficha (€)', value: cb.ficha != null ? cb.ficha : reg.fichaFee },
      { label: 'Cuota socio (€)', value: cb.socio != null ? cb.socio : reg.socioFee },
      { label: 'Total inscripción (€)', value: cb.total != null ? cb.total : reg.totalCharge }
    ];
    const kitFields = buildKitNotifyFields(reg);
    const tutorIdx = base.length;
    base.splice.apply(base, [tutorIdx, 0].concat(kitFields));
    base.push(
      { label: 'Tutor/a', value: reg.guardianName || '—' },
      { label: 'DNI tutor/a', value: reg.guardianDNI || reg.guardianDni || '—' },
      { label: 'Teléfono tutor/a', value: reg.guardianPhone || '—' },
      { label: 'Email tutor/a', value: reg.guardianEmail || '—' },
      { label: 'Domicilio tutor/a', value: composeGuardianAddressFromReg(reg) }
    );
    base.push.apply(base, buildConsentNotifyFields(reg));
    if (extra.orderId) base.push({ label: 'Pedido pasarela', value: extra.orderId });
    if (extra.paid) base.push({ label: 'Estado', value: 'Pagado / activo' });
    if (extra.includeClubAccount) {
      base.push({ label: 'Cuenta club', value: 'CAJA RURAL ES12 3085 0034 8222 5127 9226' });
    }
    return base;
  }

  /** Campos para correo al club (resumen + una fila por prenda/talla). */
  function buildKitNotifyFields(playerOrReg) {
    const items = getKitItems(playerOrReg);
    const cb = (playerOrReg && playerOrReg.chargeBreakdown) || {};
    const fields = [
      { label: 'Pedido ropa (resumen)', value: items.length ? formatKitSummary(playerOrReg) : '—' }
    ];
    items.forEach(function (it) {
      const price =
        it.price != null && Number(it.price) > 0 ? ' — ' + Number(it.price).toFixed(2) + ' €' : '';
      fields.push({
        label: garmentLabel(it),
        value: 'Talla ' + garmentSize(it) + price
      });
    });
    if (cb.kit != null && Number(cb.kit) > 0) {
      fields.push({ label: 'Subtotal ropa (€)', value: Number(cb.kit).toFixed(2) });
    }
    return fields;
  }

  function kitSizeFor(player, garmentId) {
    const items = getKitItems(player);
    const it = items.find(function (x) {
      return x.id === garmentId;
    });
    if (it && it.size) return it.size;
    if (garmentId === 'train_kit') {
      const shirt = items.find(function (x) {
        return x.id === 'train_shirt';
      });
      if (shirt && shirt.size) return shirt.size;
      const shorts = items.find(function (x) {
        return x.id === 'train_shorts';
      });
      if (shorts && shorts.size) return shorts.size;
    }
    return '';
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
    const cat =
      global.ClubPlayerMemberSync && global.ClubPlayerMemberSync.resolvePlayerCategoryId
        ? global.ClubPlayerMemberSync.resolvePlayerCategoryId(p)
        : p.category || p.categoria || '';
    return {
      nombre: p.name || p.nombre || '',
      apellidos: p.surname || p.apellidos || '',
      dni: exportDniValue(p),
      temporada: p.inscriptionSeason || p.temporada || '',
      email: p.email || '',
      telefono: p.phone || p.telefono || '',
      direccion:
        (global.PlayerInscription && global.PlayerInscription.composeAddress
          ? global.PlayerInscription.composeAddress(p)
          : '') ||
        p.address ||
        p.direccion ||
        '',
      domicilio: p.domicilio || '',
      localidad: p.localidad || p.town || '',
      provincia: p.provincia || p.province || '',
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
      kit_train_kit: kitSizeFor(p, 'train_kit'),
      kit_train_jacket: kitSizeFor(p, 'train_jacket'),
      kit_cazadora: kitSizeFor(p, 'cazadora'),
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
      consent_normas: consentYesNo(p.clubRulesAccepted, p.clubRulesAcceptedAt),
      consent_jugador: yesNo(p.playerConsent) || 'No',
      consent_imagen: yesNo(p.photoConsent) || 'No',
      consent_categoria_superior: consentYesNo(p.categorySuperiorConsent, p.categorySuperiorConsentAt),
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
    if (global.ClubPlayerMemberSync && global.ClubPlayerMemberSync.ensurePlayerCategoryFields) {
      items = items.map(function (p) {
        return global.ClubPlayerMemberSync.ensurePlayerCategoryFields(Object.assign({}, p));
      });
    }
    if (o.category && o.category !== 'all') {
      if (global.ClubPlayerMemberSync && global.ClubPlayerMemberSync.playerMatchesCategoryFilter) {
        items = items.filter(function (p) {
          return global.ClubPlayerMemberSync.playerMatchesCategoryFilter(p, o.category);
        });
      } else {
        items = items.filter(function (p) {
          return String(p.category || p.categoria || '') === o.category;
        });
      }
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
          return (
            !paid &&
            (ins === 'pending_payment' ||
              ins === 'pending_transfer' ||
              ins === 'pending_cash' ||
              ins === 'pending_tpv' ||
              p.status === 'pending_validation')
          );
        }
        return true;
      });
    }
    return items;
  }

  function comparePlayersByName(a, b) {
    const na = normalizePlayerSortName(a);
    const nb = normalizePlayerSortName(b);
    return na.localeCompare(nb, 'es', { sensitivity: 'base' });
  }

  function normalizePlayerSortName(p) {
    return (
      String(p.surname || p.apellidos || '') +
      ' ' +
      String(p.name || p.nombre || '')
    )
      .trim()
      .toLowerCase();
  }

  function categorySortIndex(catId) {
    const order = ['prebenjamin', 'benjamin', 'alevin', 'infantil', 'cadete', 'juvenil', 'senior'];
    const canon =
      global.ClubPlayerMemberSync && global.ClubPlayerMemberSync.normalizeCategoryId
        ? global.ClubPlayerMemberSync.normalizeCategoryId(catId)
        : String(catId || '').toLowerCase();
    const ix = order.indexOf(canon);
    return ix >= 0 ? ix : 99;
  }

  function sortPlayersForExport(players) {
    return (Array.isArray(players) ? players.slice() : []).sort(function (a, b) {
      const catA =
        global.ClubPlayerMemberSync && global.ClubPlayerMemberSync.resolvePlayerCategoryId
          ? global.ClubPlayerMemberSync.resolvePlayerCategoryId(a)
          : a.category || a.categoria || '';
      const catB =
        global.ClubPlayerMemberSync && global.ClubPlayerMemberSync.resolvePlayerCategoryId
          ? global.ClubPlayerMemberSync.resolvePlayerCategoryId(b)
          : b.category || b.categoria || '';
      const diff = categorySortIndex(catA) - categorySortIndex(catB);
      if (diff) return diff;
      return comparePlayersByName(a, b);
    });
  }

  function collectExportGroups(opts) {
    const exportSettings = global.ClubPlayerExportConfig ? global.ClubPlayerExportConfig.read() : null;
    let players = [];
    try {
      players = JSON.parse(global.localStorage.getItem('clubPlayers') || '[]');
    } catch (_) {}
    let filtered = filterPlayers(players, opts);
    if (global.ClubPlayerMemberSync && global.ClubPlayerMemberSync.removeCrossSeasonDuplicates) {
      filtered = global.ClubPlayerMemberSync.removeCrossSeasonDuplicates(filtered).players;
    }
    filtered = sortPlayersForExport(filtered);

    const groupByCategory = !opts || !opts.category || opts.category === 'all';
    if (!groupByCategory) {
      return [
        {
          label: null,
          rows: filtered.map(function (p) {
            return mapPlayerExportRow(p, exportSettings);
          })
        }
      ];
    }

    if (!global.ClubPlayerMemberSync || !global.ClubPlayerMemberSync.groupPlayersByCategory) {
      return [
        {
          label: null,
          rows: filtered.map(function (p) {
            return mapPlayerExportRow(p, exportSettings);
          })
        }
      ];
    }

    const grouped = global.ClubPlayerMemberSync.groupPlayersByCategory(filtered);
    const categories = grouped.categories;
    const groups = [];
    Object.keys(categories).forEach(function (catId) {
      const catPlayers = grouped.grouped[catId] || [];
      if (!catPlayers.length) return;
      catPlayers.sort(comparePlayersByName);
      groups.push({
        label: categories[catId],
        rows: catPlayers.map(function (p) {
          return mapPlayerExportRow(p, exportSettings);
        })
      });
    });
    if (grouped.grouped._other && grouped.grouped._other.length) {
      grouped.grouped._other.sort(comparePlayersByName);
      groups.push({
        label: 'Otras categorías',
        rows: grouped.grouped._other.map(function (p) {
          return mapPlayerExportRow(p, exportSettings);
        })
      });
    }
    return groups.length
      ? groups
      : [
          {
            label: null,
            rows: []
          }
        ];
  }

  function collectExportRows(opts) {
    const groups = collectExportGroups(opts);
    const rows = [];
    groups.forEach(function (g) {
      rows.push.apply(rows, g.rows);
    });
    return rows;
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
    collectExportGroups: collectExportGroups,
    sortPlayersForExport: sortPlayersForExport,
    refreshSeasonSelect: refreshSeasonSelect,
    isMinorPlayer: isMinorPlayer,
    getKitItems: getKitItems,
    formatKitSummary: formatKitSummary,
    formatKitDetailLines: formatKitDetailLines,
    buildKitNotifyFields: buildKitNotifyFields,
    buildInscriptionNotifyFields: buildInscriptionNotifyFields,
    buildConsentNotifyFields: buildConsentNotifyFields,
    consentYesNo: consentYesNo,
    garmentLabel: garmentLabel
  };

  document.addEventListener('DOMContentLoaded', function () {
    refreshSeasonSelect('exportPlayerSeason');
    refreshSeasonSelect('jugadoresExportSeason');
  });
})(typeof window !== 'undefined' ? window : globalThis);
