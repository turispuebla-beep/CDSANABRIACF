/**
 * Panel admin — preinscripciones torneo (Firestore) + alta en competiciones.
 */
(function (global) {
  'use strict';

  const CATEGORY_TO_COMPETITION = {
    prebenjamin: 'Prebenjamín',
    benjamin: 'Benjamín',
    alevin: 'Alevín',
    infantil: 'Infantil',
    cadete: 'Cadete',
    juvenil: 'Juvenil',
    senior: 'Aficionado',
    aficionado: 'Aficionado'
  };

  function escapeHtml(v) {
    return String(v || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      const d = typeof iso === 'object' && iso.toDate ? iso.toDate() : new Date(iso);
      if (Number.isNaN(d.getTime())) return String(iso);
      return d.toLocaleString('es-ES');
    } catch (_) {
      return String(iso);
    }
  }

  function generateAccessCodeForRow(row) {
    const year = new Date().getFullYear();
    const suffix = String(row.id || row.localId || '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(-4)
      .padStart(4, '0');
    return 'TP-' + year + '-' + suffix;
  }

  async function ensureAccessCodes(rows) {
    if (!global.updateDocument) return rows;
    const out = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.accessCode || !row.id) {
        out.push(row);
        continue;
      }
      const accessCode = generateAccessCodeForRow(row);
      try {
        await global.updateDocument('torneo_preinscripciones', row.id, {
          accessCode: accessCode,
          panelEnabled: row.panelEnabled !== false,
          updatedAt: new Date().toISOString()
        });
        out.push(Object.assign({}, row, { accessCode: accessCode }));
      } catch (e) {
        console.warn('[AdminTorneoPreinscripciones] accessCode:', e);
        out.push(row);
      }
    }
    return out;
  }

  function listTargets() {
    return [
      {
        listId: 'torneoPreinscripcionesAdminList',
        countId: 'torneoPreinscripcionesAdminCount'
      },
      {
        listId: 'torneoPreinscripcionesCompList',
        countId: 'torneoPreinscripcionesCompCount'
      }
    ].filter(function (t) {
      return global.document && global.document.getElementById(t.listId);
    });
  }

  function renderRows(rows) {
    const targets = listTargets();
    if (!targets.length) return;

    const sorted = rows.slice().sort(function (a, b) {
      const ta = new Date(a.createdAt || 0).getTime();
      const tb = new Date(b.createdAt || 0).getTime();
      return tb - ta;
    });

    const tableHtml =
      !sorted.length
        ? '<p style="color:#64748b;margin:0;">No hay preinscripciones en Firestore todavía.</p>'
        : '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:0.9rem;">' +
          '<thead><tr style="background:#eff6ff;text-align:left;">' +
          '<th style="padding:8px;border-bottom:1px solid #bfdbfe;">Fecha</th>' +
          '<th style="padding:8px;border-bottom:1px solid #bfdbfe;">Equipo</th>' +
          '<th style="padding:8px;border-bottom:1px solid #bfdbfe;">Código</th>' +
          '<th style="padding:8px;border-bottom:1px solid #bfdbfe;">Categorías</th>' +
          '<th style="padding:8px;border-bottom:1px solid #bfdbfe;">Contacto</th>' +
          '<th style="padding:8px;border-bottom:1px solid #bfdbfe;">Tel.</th>' +
          '<th style="padding:8px;border-bottom:1px solid #bfdbfe;">Jug.</th>' +
          '<th style="padding:8px;border-bottom:1px solid #bfdbfe;">Plantilla</th>' +
          '<th style="padding:8px;border-bottom:1px solid #bfdbfe;">Acciones</th>' +
          '</tr></thead><tbody>' +
          sorted
            .map(function (r) {
              const rowId = r.id || r.localId || '';
              const cats = Array.isArray(r.categoryLabels)
                ? r.categoryLabels.join(', ')
                : Array.isArray(r.categories)
                  ? r.categories.join(', ')
                  : String(r.categories || '—');
              const linked = r.competitionTeamId ? ' · en competición' : '';
              const accessCode = r.accessCode ? String(r.accessCode) : '';
              return (
                '<tr style="border-bottom:1px solid #e2e8f0;">' +
                '<td style="padding:8px;white-space:nowrap;">' +
                escapeHtml(formatDate(r.createdAt)) +
                '</td>' +
                '<td style="padding:8px;"><strong>' +
                escapeHtml(r.teamName) +
                '</strong><br><span style="color:#64748b;font-size:0.82rem;">' +
                escapeHtml(r.town || '') +
                linked +
                '</span></td>' +
                '<td style="padding:8px;font-family:ui-monospace,monospace;font-size:0.82rem;">' +
                (accessCode
                  ? '<span title="Código responsable">' +
                    escapeHtml(accessCode) +
                    '</span>'
                  : '<span style="color:#94a3b8;">—</span>') +
                '</td>' +
                '<td style="padding:8px;">' +
                escapeHtml(cats) +
                '</td>' +
                '<td style="padding:8px;">' +
                escapeHtml(r.contactName) +
                '<br><a href="mailto:' +
                escapeHtml(r.contactEmail) +
                '">' +
                escapeHtml(r.contactEmail) +
                '</a></td>' +
                '<td style="padding:8px;">' +
                escapeHtml(r.contactPhone) +
                '</td>' +
                '<td style="padding:8px;">' +
                escapeHtml(r.playerCount) +
                '</td>' +
                '<td style="padding:8px;font-size:0.82rem;">' +
                escapeHtml(r.plantillaStatus || 'pendiente') +
                (r.fichas && r.fichas.length
                  ? '<br><span style="color:#64748b;">' +
                    escapeHtml(
                      String(
                        r.fichas.filter(function (f) {
                          return String(f.status || '') === 'enviada';
                        }).length
                      ) +
                        '/' +
                        String(r.playerCount || r.fichas.length)
                    ) +
                    ' fichas</span>'
                  : '') +
                '</td>' +
                '<td style="padding:8px;white-space:nowrap;">' +
                (r.competitionTeamId
                  ? '<span style="color:#059669;font-size:0.82rem;">✅ En cuadro</span>'
                  : '<button type="button" class="btn" style="padding:4px 8px;font-size:0.78rem;background:#1e3a8a;color:#fff;border:none;border-radius:4px;cursor:pointer;" onclick="addTorneoPreinscripcionToCompetition(\'' +
                    escapeHtml(String(rowId)).replace(/'/g, "\\'") +
                    '\')">🏆 Añadir a competición</button>') +
                '</td>' +
                '</tr>'
              );
            })
            .join('') +
          '</tbody></table></div>';

    targets.forEach(function (t) {
      const listEl = global.document.getElementById(t.listId);
      const countEl = global.document.getElementById(t.countId);
      if (countEl) countEl.textContent = String(sorted.length);
      if (listEl) listEl.innerHTML = tableHtml;
    });
  }

  function pickCompetitionCategory(preinscripcion) {
    const labels = Array.isArray(preinscripcion.categoryLabels) ? preinscripcion.categoryLabels : [];
    if (labels.length) return labels[0];
    const ids = Array.isArray(preinscripcion.categories) ? preinscripcion.categories : [];
    const first = ids[0] ? String(ids[0]).toLowerCase() : '';
    return CATEGORY_TO_COMPETITION[first] || first || 'Aficionado';
  }

  function addTorneoPreinscripcionToCompetition(preinscripcionId) {
    const rows = global.__torneoPreinscripcionesCache || [];
    const row = rows.find(function (r) {
      return String(r.id) === String(preinscripcionId) || String(r.localId) === String(preinscripcionId);
    });
    if (!row) {
      alert('❌ Preinscripción no encontrada. Pulsa «Actualizar listado».');
      return;
    }

    const competitions = JSON.parse(global.localStorage.getItem('clubCompetitions') || '[]');
    const torneos = competitions.filter(function (c) {
      return String(c.type || '').toLowerCase() === 'torneo';
    });
    const pool = torneos.length ? torneos : competitions;
    if (!pool.length) {
      alert('ℹ️ No hay competiciones creadas. Crea un torneo en esta pestaña y vuelve a intentarlo.');
      return;
    }

    const lines = pool.map(function (c, i) {
      const teams = Array.isArray(c.teams) ? c.teams.length : 0;
      return i + 1 + '. ' + (c.name || c.title || 'Competición') + ' (' + teams + '/' + (c.maxTeams || '?') + ' equipos)';
    });
    const pick = prompt(
      '¿A qué competición quieres añadir el equipo «' +
        (row.teamName || '') +
        '»?\n\n' +
        lines.join('\n') +
        '\n\nEscribe el número (1-' +
        pool.length +
        '):',
      '1'
    );
    if (pick === null) return;
    const ix = parseInt(String(pick).trim(), 10) - 1;
    if (!Number.isFinite(ix) || ix < 0 || ix >= pool.length) {
      alert('Selección no válida.');
      return;
    }

    const competition = pool[ix];
    const compIx = competitions.findIndex(function (c) {
      return String(c.id) === String(competition.id);
    });
    if (compIx < 0) {
      alert('❌ Competición no encontrada.');
      return;
    }

    const teams = Array.isArray(competitions[compIx].teams) ? competitions[compIx].teams.slice() : [];
    const maxTeams = Number(competitions[compIx].maxTeams || 0);
    if (maxTeams > 0 && teams.length >= maxTeams) {
      alert('❌ La competición ya tiene el máximo de equipos (' + maxTeams + ').');
      return;
    }

    const category = pickCompetitionCategory(row);
    const guestId = 'GUEST_TP_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    teams.push({
      id: guestId,
      name: row.teamName,
      category: category,
      isGuestTeam: true,
      coachContact: {
        name: row.contactName || '',
        email: row.contactEmail || '',
        phone: row.contactPhone || '',
        source: 'torneo_preinscripcion',
        preinscripcionId: row.id || row.localId || ''
      },
      roster: [],
      crest: ''
    });

    competitions[compIx].teams = teams;
    competitions[compIx].updatedAt = new Date().toISOString();
    global.localStorage.setItem('clubCompetitions', JSON.stringify(competitions));

    if (typeof global.syncCompetitionToFirebase === 'function') {
      try {
        global.syncCompetitionToFirebase(competitions[compIx]);
      } catch (e) {
        console.warn('Sync competición:', e);
      }
    } else if (typeof global.updateDocument === 'function' && competitions[compIx].id) {
      global.updateDocument('competitions', competitions[compIx].id, competitions[compIx]).catch(function (e) {
        console.warn('Sync competición:', e);
      });
    }

    if (global.updateDocument && row.id) {
      global
        .updateDocument('torneo_preinscripciones', row.id, {
          competitionId: competitions[compIx].id,
          competitionTeamId: guestId,
          linkedAt: new Date().toISOString()
        })
        .catch(function (e) {
          console.warn('Marcar preinscripción enlazada:', e);
        });
    }

    row.competitionId = competitions[compIx].id;
    row.competitionTeamId = guestId;
    global.__torneoPreinscripcionesCache = rows;
    renderRows(rows);

    if (typeof global.loadCompetitionsList === 'function') global.loadCompetitionsList();
    alert(
      '✅ Equipo «' +
        (row.teamName || '') +
        '» añadido a «' +
        (competitions[compIx].name || 'competición') +
        '» como equipo invitado.\n\nCategoría asignada: ' +
        category
    );
  }

  async function loadTorneoPreinscripcionesAdmin() {
    const targets = listTargets();
    targets.forEach(function (t) {
      const listEl = global.document.getElementById(t.listId);
      if (listEl) listEl.innerHTML = '<p style="color:#64748b;margin:0;">Cargando preinscripciones…</p>';
    });
    try {
      if (!global.getDocuments) {
        global.__torneoPreinscripcionesCache = [];
        renderRows([]);
        return;
      }
      const rows = await global.getDocuments('torneo_preinscripciones');
      const withCodes = await ensureAccessCodes(Array.isArray(rows) ? rows : []);
      global.__torneoPreinscripcionesCache = withCodes;
      renderRows(global.__torneoPreinscripcionesCache);
    } catch (err) {
      console.warn('[AdminTorneoPreinscripciones]', err);
      targets.forEach(function (t) {
        const listEl = global.document.getElementById(t.listId);
        if (listEl) {
          listEl.innerHTML =
            '<p style="color:#b91c1c;margin:0;">Error al cargar: ' + escapeHtml(err.message || err) + '</p>';
        }
      });
    }
  }

  global.loadTorneoPreinscripcionesAdmin = loadTorneoPreinscripcionesAdmin;
  global.addTorneoPreinscripcionToCompetition = addTorneoPreinscripcionToCompetition;
})(typeof window !== 'undefined' ? window : globalThis);
