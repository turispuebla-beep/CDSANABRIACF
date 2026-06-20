/**
 * Puente admin: preinscripciones torneo F7 ↔ competiciones (sanabria_competitions).
 */
(function (global) {
  'use strict';

  const TORNEO_CAT_LABELS = {
    prebenjamin: 'Prebenjamín (Chupetines)',
    benjamin: 'Benjamín',
    alevin: 'Alevín',
    infantil: 'Infantil',
    cadete: 'Cadete',
    juvenil: 'Juvenil',
    senior: 'Senior',
    aficionado: 'Senior'
  };

  const REMINDER_API = '/.netlify/functions/send-torneo-plantilla-reminder';

  function escapeHtml(v) {
    return String(v || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getSiteBase() {
    if (global.location && global.location.origin && global.location.protocol !== 'file:') {
      return String(global.location.origin).replace(/\/$/, '');
    }
    return 'https://www.cdsanabriacf.com';
  }

  function categoryLabel(id) {
    const key = String(id || '').trim().toLowerCase();
    return TORNEO_CAT_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1);
  }

  function rowCategoryLabels(row) {
    if (Array.isArray(row.categoryLabels) && row.categoryLabels.length) {
      return row.categoryLabels.slice();
    }
    const ids = Array.isArray(row.categories) ? row.categories : [];
    return ids.map(categoryLabel).filter(Boolean);
  }

  function rowCategoryIds(row) {
    return (Array.isArray(row.categories) ? row.categories : [])
      .map(function (c) {
        return String(c || '').trim().toLowerCase();
      })
      .filter(Boolean);
  }

  function isActiveRow(row) {
    const st = String(row.status || 'preinscripcion_enviada').trim().toLowerCase();
    return st !== 'descartada' && st !== 'eliminada' && st !== 'cancelada';
  }

  function findGroups(rows, contactEmail, responsibleCode) {
    const email = String(contactEmail || '')
      .trim()
      .toLowerCase();
    const rc = String(responsibleCode || '').trim().toUpperCase();
    return (rows || []).filter(function (r) {
      if (!isActiveRow(r)) return false;
      if (email && String(r.contactEmail || '').trim().toLowerCase() !== email) return false;
      if (rc) {
        const rowRc = String(r.responsibleCode || '').trim().toUpperCase();
        if (rowRc && rowRc !== rc) return false;
      }
      return true;
    });
  }

  function getCompetitions() {
    try {
      return JSON.parse(global.localStorage.getItem('clubCompetitions') || '[]');
    } catch (_) {
      return [];
    }
  }

  function saveCompetitionsLocal(list) {
    global.localStorage.setItem('clubCompetitions', JSON.stringify(list || []));
    try {
      global.dispatchEvent(new CustomEvent('competitionsUpdated'));
    } catch (_) {}
  }

  function fichasSubmittedCount(row) {
    const fichas = Array.isArray(row.fichas) ? row.fichas : [];
    return fichas.filter(function (f) {
      return String(f.status || '') === 'enviada';
    }).length;
  }

  function buildGuestTeamFromPreinscripcion(row, catId, catLabel, multiCat) {
    const importKey = String(row.id || row.localId) + '::' + catId;
    const baseName = String(row.teamName || 'Equipo').trim();
    const name = multiCat ? baseName + ' (' + catLabel + ')' : baseName;
    const roster = fichasToCompetitionRoster(row);
    const docsPending = roster.filter(function (p) {
      return p.documentsPending;
    }).length;
    return {
      id: 'GUEST_TORNEO_' + importKey.replace(/[^a-zA-Z0-9:_-]/g, '_'),
      name: name,
      category: catLabel,
      crest: '',
      roster: roster,
      torneoRosterCount: roster.length,
      torneoDocumentsPending: docsPending,
      isGuestTeam: true,
      coachContact: {
        name: row.contactName || '',
        email: row.contactEmail || '',
        phone: row.contactPhone || '',
        source: 'torneo_preinscripcion',
        coachName:
          row.coach && row.coach.name
            ? [row.coach.name, row.coach.surname].filter(Boolean).join(' ')
            : ''
      },
      torneoPreinscripcionId: row.id || row.localId || '',
      torneoImportKey: importKey,
      torneoAccessCode: row.accessCode || '',
      torneoResponsibleCode: row.responsibleCode || '',
      torneoTown: row.town || '',
      torneoPlantillaStatus: row.plantillaStatus || 'pendiente'
    };
  }

  function fichasToCompetitionRoster(row) {
    const fichas = Array.isArray(row.fichas) ? row.fichas : [];
    return fichas
      .filter(function (f) {
        return String(f.status || '') === 'enviada' && f.data;
      })
      .sort(function (a, b) {
        const ai = a.slotIndex != null ? a.slotIndex : 999;
        const bi = b.slotIndex != null ? b.slotIndex : 999;
        return ai - bi;
      })
      .map(function (f, idx) {
        const d = f.data || {};
        return {
          id: 'TORNEO_' + String(f.id || idx).replace(/[^a-zA-Z0-9_-]/g, '_'),
          name: [d.name, d.surname].filter(Boolean).join(' '),
          firstName: d.name || '',
          surname: d.surname || '',
          dni: d.dni || '',
          birthDate: d.birthDate || '',
          email: d.email || '',
          phone: d.phone || '',
          isMinor: !!d.isMinor,
          guardianName: [d.guardianName, d.guardianSurname].filter(Boolean).join(' '),
          guardianDni: d.guardianDni || '',
          guardianPhone: d.guardianPhone || '',
          guardianEmail: d.guardianEmail || '',
          documentsPending: f.documentsPending !== false && !(d.documents && d.documents.length),
          torneoFichaId: f.id || ''
        };
      });
  }

  function expandPreinscripcionesToGuestTeams(rows) {
    const teams = [];
    rows.forEach(function (row) {
      const catIds = rowCategoryIds(row);
      if (!catIds.length) return;
      const multi = catIds.length > 1;
      catIds.forEach(function (catId) {
        teams.push(buildGuestTeamFromPreinscripcion(row, catId, categoryLabel(catId), multi));
      });
    });
    return teams;
  }

  function mergeCompetitionCategories(competition, guestTeams) {
    const cats = Array.isArray(competition.categories) ? competition.categories.slice() : [];
    const seen = new Set(
      cats.map(function (c) {
        return String(c || '').trim().toLowerCase();
      })
    );
    guestTeams.forEach(function (t) {
      const label = String(t.category || '').trim();
      const key = label.toLowerCase();
      if (!label || seen.has(key)) return;
      seen.add(key);
      cats.push(label);
    });
    competition.categories = cats;
    if (!competition.category && cats.length === 1) {
      competition.category = cats[0];
    }
  }

  async function persistCompetition(competition) {
    competition.updatedAt = new Date().toISOString();
    if (typeof global.persistRecordToFirebase === 'function') {
      await global.persistRecordToFirebase('clubCompetitions', 'competitions', competition);
    } else if (typeof global.updateDocument === 'function' && competition.id) {
      await global.updateDocument('competitions', competition.id, competition);
    }
    const list = getCompetitions();
    const ix = list.findIndex(function (c) {
      return String(c.id) === String(competition.id);
    });
    if (ix >= 0) {
      list[ix] = competition;
    } else {
      list.push(competition);
    }
    saveCompetitionsLocal(list);
  }

  function ensureImportModal() {
    let modal = global.document.getElementById('torneoImportCompModal');
    if (modal) return modal;
    modal = global.document.createElement('div');
    modal.id = 'torneoImportCompModal';
    modal.style.cssText =
      'display:none;position:fixed;inset:0;z-index:10060;background:rgba(15,23,42,0.55);padding:16px;overflow:auto;';
    modal.innerHTML =
      '<div style="max-width:520px;margin:24px auto;background:#fff;border-radius:14px;padding:20px 22px;box-shadow:0 20px 50px rgba(0,0,0,.2);">' +
      '<h2 style="margin:0 0 12px;color:#1e3a8a;font-size:1.1rem;">Importar inscritos a competición</h2>' +
      '<p style="margin:0 0 14px;color:#64748b;font-size:0.88rem;line-height:1.45;">Los equipos se añaden como <strong>invitados</strong> (GUEST). Si una preinscripción tiene varias categorías, se crea un equipo por categoría.</p>' +
      '<label style="display:block;font-weight:600;margin:0 0 6px;color:#334155;">Competición destino</label>' +
      '<select id="torneoImportCompSelect" style="width:100%;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;margin:0 0 12px;"></select>' +
      '<label style="display:flex;align-items:center;gap:8px;margin:0 0 8px;font-size:0.88rem;color:#475569;cursor:pointer;">' +
      '<input type="checkbox" id="torneoImportSkipExisting" checked> Si ya están importados, <strong>actualizar plantilla</strong> desde Firebase (no duplicar equipos)</label>' +
      '<p id="torneoImportCompSummary" style="margin:0 0 16px;font-size:0.85rem;color:#475569;"></p>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
      '<button type="button" id="torneoImportCompConfirm" class="btn btn-success" style="flex:1;">Importar</button>' +
      '<button type="button" id="torneoImportCompCancel" class="btn btn-secondary" style="flex:1;">Cancelar</button>' +
      '</div></div>';
    global.document.body.appendChild(modal);
    modal.addEventListener('click', function (ev) {
      if (ev.target === modal) closeImportTorneoModal();
    });
    modal.querySelector('#torneoImportCompCancel').addEventListener('click', closeImportTorneoModal);
    modal.querySelector('#torneoImportCompConfirm').addEventListener('click', confirmImportTorneoModal);
    return modal;
  }

  var importState = null;

  function closeImportTorneoModal() {
    const modal = global.document.getElementById('torneoImportCompModal');
    if (modal) modal.style.display = 'none';
    importState = null;
  }

  function openImportTorneoModal(opts) {
    opts = opts || {};
    const rows = (global.__torneoPreinscripcionesCache || []).filter(isActiveRow);
    let subset = rows;
    if (opts.contactEmail) {
      subset = findGroups(rows, opts.contactEmail, opts.responsibleCode);
    }
    if (!subset.length) {
      alert('No hay preinscripciones activas para importar.');
      return;
    }
    const comps = getCompetitions().filter(function (c) {
      return c && c.id;
    });
    if (!comps.length) {
      alert(
        'No hay competiciones en el panel. Crea una competición tipo Torneo (Fútbol 7) en «Lista de Competiciones» y vuelve a intentarlo.'
      );
      return;
    }
    importState = { rows: subset };
    const modal = ensureImportModal();
    const sel = modal.querySelector('#torneoImportCompSelect');
    sel.innerHTML = comps
      .map(function (c) {
        const label =
          (c.name || c.title || 'Competición') +
          ' (' +
          (c.status || '—') +
          ', ' +
          (Array.isArray(c.categories) ? c.categories.length : 0) +
          ' cat.)';
        return (
          '<option value="' +
          escapeHtml(String(c.id)) +
          '">' +
          escapeHtml(label) +
          '</option>'
        );
      })
      .join('');
    const guestPreview = expandPreinscripcionesToGuestTeams(subset);
    modal.querySelector('#torneoImportCompSummary').textContent =
      'Se importarán hasta ' +
      guestPreview.length +
      ' equipo(s) invitado(s) de ' +
      subset.length +
      ' preinscripción(es).';
    modal.style.display = 'block';
  }

  async function confirmImportTorneoModal() {
    if (!importState || !importState.rows || !importState.rows.length) return;
    const modal = global.document.getElementById('torneoImportCompModal');
    const compId = modal.querySelector('#torneoImportCompSelect').value;
    const skipExisting = modal.querySelector('#torneoImportSkipExisting').checked;
    const comps = getCompetitions();
    const ix = comps.findIndex(function (c) {
      return String(c.id) === String(compId);
    });
    if (ix < 0) {
      alert('Competición no encontrada.');
      return;
    }
    const competition = Object.assign({}, comps[ix]);
    const teams = Array.isArray(competition.teams) ? competition.teams.slice() : [];
    const existingKeys = new Set(
      teams
        .map(function (t) {
          return String(t.torneoImportKey || t.torneoPreinscripcionId || '');
        })
        .filter(Boolean)
    );
    const toAdd = expandPreinscripcionesToGuestTeams(importState.rows);
    let added = 0;
    let skipped = 0;
    let updated = 0;
    toAdd.forEach(function (guest) {
      const key = String(guest.torneoImportKey || guest.torneoPreinscripcionId || '');
      const existingIx = teams.findIndex(function (t) {
        return key && String(t.torneoImportKey || '') === key;
      });
      if (existingIx >= 0) {
        if (skipExisting) {
          teams[existingIx] = Object.assign({}, teams[existingIx], {
            roster: guest.roster,
            torneoRosterCount: guest.torneoRosterCount,
            torneoDocumentsPending: guest.torneoDocumentsPending,
            coachContact: guest.coachContact,
            torneoPlantillaStatus: guest.torneoPlantillaStatus,
            torneoAccessCode: guest.torneoAccessCode,
            updatedAt: new Date().toISOString()
          });
          updated++;
          return;
        }
        skipped++;
        return;
      }
      if (teams.some(function (t) {
        return String(t.id) === String(guest.id);
      })) {
        skipped++;
        return;
      }
      teams.push(guest);
      if (key) existingKeys.add(key);
      added++;
    });
    if (!added && !updated) {
      alert(
        skipped
          ? 'No se añadió ningún equipo (ya estaban importados).'
          : 'No hay equipos que importar.'
      );
      return;
    }
    competition.teams = teams;
    mergeCompetitionCategories(competition, toAdd);
    try {
      await persistCompetition(competition);
      closeImportTorneoModal();
      if (typeof global.loadCompetitions === 'function') {
        global.loadCompetitions();
      }
      alert(
        '✅ Importados ' +
          added +
          ' equipo(s) invitado(s)' +
          (updated ? ', actualizados ' + updated + ' (plantilla)' : '') +
          ' en «' +
          (competition.name || competition.title || 'Competición') +
          '».' +
          (skipped ? '\nOmitidos: ' + skipped : '') +
          '\n\nAbre 👥 Equipos en esa competición para revisar plantillas y generar el cuadro.'
      );
    } catch (err) {
      alert('❌ Error al guardar: ' + (err && err.message ? err.message : String(err)));
    }
  }

  function buildPanelUrl(groupRows) {
    const base = getSiteBase();
    const row = groupRows[0] || {};
    const code = row.responsibleCode || row.accessCode || '';
    const email = row.contactEmail || '';
    return base + '/torneo-equipo.html?code=' + encodeURIComponent(code) + '&email=' + encodeURIComponent(email);
  }

  function copyTorneoPanelLink(contactEmail, responsibleCode) {
    const rows = findGroups(global.__torneoPreinscripcionesCache || [], contactEmail, responsibleCode);
    if (!rows.length) {
      alert('Grupo no encontrado. Actualiza el listado.');
      return;
    }
    const url = buildPanelUrl(rows);
    if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
      global.navigator.clipboard
        .writeText(url)
        .then(function () {
          alert('✅ Enlace copiado:\n' + url);
        })
        .catch(function () {
          prompt('Copia este enlace:', url);
        });
    } else {
      prompt('Copia este enlace:', url);
    }
  }

  async function sendTorneoPlantillaReminder(contactEmail, responsibleCode) {
    const rows = findGroups(global.__torneoPreinscripcionesCache || [], contactEmail, responsibleCode);
    if (!rows.length) {
      alert('Grupo no encontrado. Pulsa «Actualizar listado».');
      return;
    }
    const row0 = rows[0];
    const email = String(row0.contactEmail || contactEmail || '').trim().toLowerCase();
    if (!email.includes('@')) {
      alert('Email de contacto no válido.');
      return;
    }
    const teamLines = rows.map(function (r) {
      const cats = rowCategoryLabels(r).join(', ');
      const submitted = fichasSubmittedCount(r);
      const pc = parseInt(r.playerCount, 10) || 0;
      return (
        (r.teamName || 'Equipo') +
        ' · ' +
        (cats || '—') +
        ' · código ' +
        (r.accessCode || '—') +
        ' · plantilla ' +
        (r.plantillaStatus || 'pendiente') +
        ' (' +
        submitted +
        '/' +
        (pc || '?') +
        ' fichas)'
      );
    });
    const msg =
      '¿Enviar recordatorio por correo a ' +
      (row0.contactName || email) +
      '?\n\n' +
      teamLines.join('\n') +
      '\n\nIncluye enlace al panel para invitar jugadores y pagar.';
    if (!global.confirm(msg)) return;

    const payload = {
      contactEmail: email,
      contactName: row0.contactName || '',
      contactPhone: row0.contactPhone || '',
      responsibleCode: row0.responsibleCode || responsibleCode || '',
      panelUrl: buildPanelUrl(rows),
      entries: rows.map(function (r) {
        return {
          teamName: r.teamName,
          accessCode: r.accessCode,
          responsibleCode: r.responsibleCode,
          categories: rowCategoryLabels(r),
          plantillaStatus: r.plantillaStatus || 'pendiente',
          playerCount: r.playerCount,
          fichasSubmitted: fichasSubmittedCount(r)
        };
      })
    };

    try {
      let res;
      if (global.CdsanAdminApiAuth && global.CdsanAdminApiAuth.adminFetch) {
        res = await global.CdsanAdminApiAuth.adminFetch(REMINDER_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        alert('Inicia sesión como administrador en Firebase para enviar correos automáticos.');
        return;
      }
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'No se pudo enviar el correo');
      }
      alert(
        data.sent
          ? '✅ Recordatorio enviado a ' + email
          : '⚠️ No se envió: ' + (data.reason || 'correo no configurado')
      );
    } catch (err) {
      alert('❌ ' + (err.message || err));
    }
  }

  global.openImportTorneoModal = openImportTorneoModal;
  global.closeImportTorneoModal = closeImportTorneoModal;
  global.copyTorneoPanelLink = copyTorneoPanelLink;
  global.sendTorneoPlantillaReminder = sendTorneoPlantillaReminder;
  global.TorneoAdminBridge = {
    getActivePreinscripciones: function () {
      return (global.__torneoPreinscripcionesCache || []).filter(isActiveRow);
    },
    buildGuestTeamsFromRows: expandPreinscripcionesToGuestTeams,
    fichasToCompetitionRoster: fichasToCompetitionRoster,
    categoryLabel: categoryLabel,
    rowCategoryIds: rowCategoryIds,
    rowCategoryLabels: rowCategoryLabels
  };
})(typeof window !== 'undefined' ? window : globalThis);
