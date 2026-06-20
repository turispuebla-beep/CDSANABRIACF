/**
 * Asistente admin — crear torneo Fútbol 7 2026 con cuadros por categoría, multi-campo y finales en fecha final.
 */
(function (global) {
  'use strict';

  const DEFAULT_DURATIONS =
    'Prebenjamín (Chupetines) | 36 | 10\n' +
    'Benjamín | 36 | 10\n' +
    'Alevín | 40 | 10\n' +
    'Infantil | 40 | 10\n' +
    'Cadete | 45 | 12\n' +
    'Juvenil | 45 | 12\n' +
    'Senior | 45 | 12';

  function escapeHtml(v) {
    return String(v || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function addDaysIso(iso, days) {
    const d = new Date(iso + 'T12:00:00');
    if (Number.isNaN(d.getTime())) return iso;
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function normalizeKey(v) {
    return String(v || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function getBridge() {
    return global.TorneoAdminBridge || null;
  }

  function detectCategoriesFromPreinscripciones() {
    const bridge = getBridge();
    const rows = bridge ? bridge.getActivePreinscripciones() : global.__torneoPreinscripcionesCache || [];
    const seen = {};
    const out = [];
    rows.forEach(function (r) {
      const labels = bridge ? bridge.rowCategoryLabels(r) : [];
      labels.forEach(function (label) {
        const key = normalizeKey(label);
        if (!key || seen[key]) return;
        seen[key] = true;
        out.push(label);
      });
    });
    return out.sort(function (a, b) {
      return String(a).localeCompare(String(b), 'es');
    });
  }

  function buildGuestTeams(importPreinscripciones) {
    if (!importPreinscripciones) return [];
    const bridge = getBridge();
    const rows = bridge ? bridge.getActivePreinscripciones() : [];
    return bridge ? bridge.buildGuestTeamsFromRows(rows) : [];
  }

  function buildFieldList(count, prefix) {
    const n = Math.max(1, Math.min(6, parseInt(count, 10) || 2));
    const pre = String(prefix || 'Campo').trim() || 'Campo';
    const list = [];
    for (let i = 1; i <= n; i++) {
      list.push(pre + ' ' + i);
    }
    return list;
  }

  function buildCategorySlots(categories, fields, startTime) {
    const time = String(startTime || '10:00').trim() || '10:00';
    return categories.map(function (cat, idx) {
      return {
        category: cat,
        field: fields[idx % fields.length] || fields[0] || '',
        time: time
      };
    });
  }

  function readWizardCategorySchedules(modal, categories) {
    const map = {};
    categories.forEach(function (cat) {
      const key = normalizeKey(cat);
      const startEl = modal.querySelector('[data-cat-start="' + key + '"]');
      const endEl = modal.querySelector('[data-cat-end="' + key + '"]');
      const fieldEl = modal.querySelector('[data-cat-field="' + key + '"]');
      map[cat] = {
        startDate: startEl ? startEl.value : '',
        endDate: endEl ? endEl.value : '',
        field: fieldEl ? fieldEl.value : '',
        startTime: modal.querySelector('#twGlobalStartTime')
          ? modal.querySelector('#twGlobalStartTime').value
          : '10:00'
      };
    });
    return map;
  }

  function renderCategoryScheduleRows(categories, globalStart, globalEnd, fields) {
    if (!categories.length) {
      return '<p style="color:#64748b;font-size:0.88rem;">No hay categorías. Importa preinscripciones o añade categorías manualmente abajo.</p>';
    }
    return (
      '<table style="width:100%;border-collapse:collapse;font-size:0.85rem;">' +
      '<thead><tr style="background:#eff6ff;text-align:left;">' +
      '<th style="padding:6px 8px;">Categoría</th>' +
      '<th style="padding:6px 8px;">Inicio</th>' +
      '<th style="padding:6px 8px;">Final (finales)</th>' +
      '<th style="padding:6px 8px;">Campo preferente</th>' +
      '</tr></thead><tbody>' +
      categories
        .map(function (cat) {
          const key = normalizeKey(cat);
          const fieldOpts = fields
            .map(function (f) {
              return (
                '<option value="' +
                escapeHtml(f) +
                '">' +
                escapeHtml(f) +
                '</option>'
              );
            })
            .join('');
          return (
            '<tr>' +
            '<td style="padding:6px 8px;font-weight:600;">' +
            escapeHtml(cat) +
            '</td>' +
            '<td style="padding:6px 8px;"><input type="date" data-cat-start="' +
            escapeHtml(key) +
            '" value="' +
            escapeHtml(globalStart) +
            '" style="width:100%;padding:4px 6px;border:1px solid #cbd5e1;border-radius:6px;"></td>' +
            '<td style="padding:6px 8px;"><input type="date" data-cat-end="' +
            escapeHtml(key) +
            '" value="' +
            escapeHtml(globalEnd) +
            '" style="width:100%;padding:4px 6px;border:1px solid #cbd5e1;border-radius:6px;"></td>' +
            '<td style="padding:6px 8px;"><select data-cat-field="' +
            escapeHtml(key) +
            '" style="width:100%;padding:4px 6px;border:1px solid #cbd5e1;border-radius:6px;">' +
            fieldOpts +
            '</select></td>' +
            '</tr>'
          );
        })
        .join('') +
      '</tbody></table>'
    );
  }

  function ensureWizardModal() {
    let modal = global.document.getElementById('torneoF7WizardModal');
    if (modal) return modal;

    const start = todayIso();
    const end = addDaysIso(start, 2);
    const cats = detectCategoriesFromPreinscripciones();
    const fields = buildFieldList(2, 'Campo');

    modal = global.document.createElement('div');
    modal.id = 'torneoF7WizardModal';
    modal.style.cssText =
      'display:none;position:fixed;inset:0;z-index:10070;background:rgba(15,23,42,0.55);padding:12px;overflow:auto;';
    modal.innerHTML =
      '<div style="max-width:720px;margin:16px auto;background:#fff;border-radius:14px;padding:20px 22px;box-shadow:0 20px 50px rgba(0,0,0,.2);">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px;">' +
      '<div><h2 style="margin:0;color:#1e3a8a;font-size:1.15rem;">🧙 Asistente Torneo Fútbol 7 — 2026</h2>' +
      '<p style="margin:6px 0 0;color:#64748b;font-size:0.88rem;">Cuadro por categoría · varios campos en paralelo · finales en la fecha final de cada categoría.</p></div>' +
      '<button type="button" id="twCloseBtn" style="border:none;background:#f1f5f9;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:1.1rem;">×</button></div>' +
      '<label style="display:block;font-weight:600;margin:0 0 4px;">Nombre competición</label>' +
      '<input type="text" id="twCompName" value="Torneo Fútbol 7 — 2026" style="width:100%;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;margin:0 0 12px;">' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">' +
      '<div><label style="font-weight:600;font-size:0.88rem;">Fecha inicio global</label>' +
      '<input type="date" id="twGlobalStart" value="' +
      start +
      '" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:8px;"></div>' +
      '<div><label style="font-weight:600;font-size:0.88rem;">Fecha fin global</label>' +
      '<input type="date" id="twGlobalEnd" value="' +
      end +
      '" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:8px;"></div></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px;">' +
      '<div><label style="font-weight:600;font-size:0.88rem;">Nº campos</label>' +
      '<input type="number" id="twFieldCount" min="1" max="6" value="2" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:8px;"></div>' +
      '<div><label style="font-weight:600;font-size:0.88rem;">Prefijo campo</label>' +
      '<input type="text" id="twFieldPrefix" value="Campo" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:8px;"></div>' +
      '<div><label style="font-weight:600;font-size:0.88rem;">Primera hora</label>' +
      '<input type="time" id="twGlobalStartTime" value="10:00" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:8px;"></div></div>' +
      '<label style="display:flex;align-items:center;gap:8px;margin:0 0 12px;font-size:0.88rem;cursor:pointer;">' +
      '<input type="checkbox" id="twImportPreinscripciones" checked> Importar equipos de preinscripciones activas</label>' +
      '<label style="display:block;font-weight:600;margin:0 0 6px;">Fechas por categoría</label>' +
      '<div id="twCategorySchedules">' +
      renderCategoryScheduleRows(cats, start, end, fields) +
      '</div>' +
      '<p style="margin:10px 0 0;font-size:0.82rem;color:#64748b;">Categorías extra (una por línea, opcional):</p>' +
      '<textarea id="twExtraCategories" rows="2" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:8px;margin:6px 0 14px;" placeholder="Ej: Prebenjamín (Chupetines)"></textarea>' +
      '<p id="twSummary" style="margin:0 0 14px;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:0.85rem;color:#475569;"></p>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
      '<button type="button" id="twCreateBtn" class="btn btn-success" style="flex:1;">Crear torneo y cuadros</button>' +
      '<button type="button" id="twCancelBtn" class="btn btn-secondary" style="flex:1;">Cancelar</button></div></div>';

    global.document.body.appendChild(modal);

    modal.querySelector('#twCloseBtn').addEventListener('click', closeTorneoF7Wizard);
    modal.querySelector('#twCancelBtn').addEventListener('click', closeTorneoF7Wizard);
    modal.querySelector('#twCreateBtn').addEventListener('click', runTorneoF7Wizard);
    modal.addEventListener('click', function (ev) {
      if (ev.target === modal) closeTorneoF7Wizard();
    });

    ['twGlobalStart', 'twGlobalEnd', 'twFieldCount', 'twFieldPrefix', 'twImportPreinscripciones'].forEach(
      function (id) {
        const el = modal.querySelector('#' + id);
        if (el) el.addEventListener('change', refreshWizardPreview);
        if (el) el.addEventListener('input', refreshWizardPreview);
      }
    );
    modal.querySelector('#twExtraCategories').addEventListener('input', refreshWizardPreview);

    return modal;
  }

  function collectCategories(modal) {
    const fromPre = detectCategoriesFromPreinscripciones();
    const extraRaw = String(modal.querySelector('#twExtraCategories').value || '')
      .split(/\r?\n/)
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
    const seen = {};
    const out = [];
    fromPre.concat(extraRaw).forEach(function (c) {
      const k = normalizeKey(c);
      if (!k || seen[k]) return;
      seen[k] = true;
      out.push(c);
    });
    return out;
  }

  function refreshWizardPreview() {
    const modal = global.document.getElementById('torneoF7WizardModal');
    if (!modal) return;
    const start = modal.querySelector('#twGlobalStart').value || todayIso();
    const end = modal.querySelector('#twGlobalEnd').value || start;
    const fields = buildFieldList(
      modal.querySelector('#twFieldCount').value,
      modal.querySelector('#twFieldPrefix').value
    );
    const cats = collectCategories(modal);
    modal.querySelector('#twCategorySchedules').innerHTML = renderCategoryScheduleRows(
      cats,
      start,
      end,
      fields
    );
    const importOn = modal.querySelector('#twImportPreinscripciones').checked;
    const teams = importOn ? buildGuestTeams(true) : [];
    const byCat = {};
    teams.forEach(function (t) {
      const c = String(t.category || '').trim();
      if (!c) return;
      byCat[c] = (byCat[c] || 0) + 1;
    });
    const summaryEl = modal.querySelector('#twSummary');
    if (summaryEl) {
      summaryEl.textContent =
        'Campos: ' +
        fields.join(', ') +
        ' · Calendario paralelo multi-campo · ' +
        (importOn ? teams.length + ' equipo(s) invitado(s) de preinscripciones' : 'Sin equipos (añádelos después en 👥 Equipos)') +
        (cats.length ? ' · ' + cats.length + ' categoría(s)' : '');
    }
  }

  function openTorneoF7Wizard() {
    if (!global.__torneoPreinscripcionesCache) {
      if (global.confirm('¿Cargar preinscripciones desde Firestore antes de abrir el asistente?')) {
        if (typeof global.loadTorneoPreinscripcionesAdmin === 'function') {
          global.loadTorneoPreinscripcionesAdmin().then(function () {
            openTorneoF7Wizard();
          });
          return;
        }
      }
    }
    if (!global.CdsanCompetitionEngine || !global.CdsanCompetitionEngine.buildPerCategoryTorneoCalendar) {
      alert('El motor de competiciones no está cargado. Recarga el panel de administración.');
      return;
    }
    const modal = ensureWizardModal();
    refreshWizardPreview();
    modal.style.display = 'block';
  }

  function closeTorneoF7Wizard() {
    const modal = global.document.getElementById('torneoF7WizardModal');
    if (modal) modal.style.display = 'none';
  }

  async function runTorneoF7Wizard() {
    const modal = global.document.getElementById('torneoF7WizardModal');
    if (!modal) return;
    const engine = global.CdsanCompetitionEngine;
    if (!engine || !engine.buildPerCategoryTorneoCalendar) {
      alert('Motor de competiciones no disponible.');
      return;
    }

    const name = String(modal.querySelector('#twCompName').value || '').trim();
    const startDate = modal.querySelector('#twGlobalStart').value;
    const endDate = modal.querySelector('#twGlobalEnd').value;
    const fieldCount = modal.querySelector('#twFieldCount').value;
    const fieldPrefix = modal.querySelector('#twFieldPrefix').value;
    const startTime = modal.querySelector('#twGlobalStartTime').value || '10:00';
    const importOn = modal.querySelector('#twImportPreinscripciones').checked;

    if (!name || !startDate || !endDate) {
      alert('Completa nombre y fechas.');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      alert('La fecha fin debe ser posterior o igual al inicio.');
      return;
    }

    const fields = buildFieldList(fieldCount, fieldPrefix);
    const categories = collectCategories(modal);
    if (!categories.length) {
      alert('Indica al menos una categoría (desde preinscripciones o manualmente).');
      return;
    }

    const teams = importOn ? buildGuestTeams(true) : [];
    if (importOn && !teams.length) {
      alert('No hay preinscripciones activas para importar. Desmarca la casilla o actualiza el listado.');
      return;
    }

    const categorySchedules = readWizardCategorySchedules(modal, categories);
    categories.forEach(function (cat) {
      if (!categorySchedules[cat]) categorySchedules[cat] = {};
      if (!categorySchedules[cat].startDate) categorySchedules[cat].startDate = startDate;
      if (!categorySchedules[cat].endDate) categorySchedules[cat].endDate = endDate;
    });

    const teamsByCat = {};
    teams.forEach(function (t) {
      const c = String(t.category || '').trim();
      if (!c) return;
      teamsByCat[c] = (teamsByCat[c] || 0) + 1;
    });
    const tooFew = categories.filter(function (c) {
      return (teamsByCat[c] || 0) < 2;
    });
    if (importOn && tooFew.length) {
      const go = global.confirm(
        'Estas categorías tienen menos de 2 equipos inscritos:\n' +
          tooFew.join(', ') +
          '\n\nNo se generará cuadro para ellas. ¿Continuar?'
      );
      if (!go) return;
    }

    const maxTeams = Math.max(
      8,
      teams.length,
      ...categories.map(function (c) {
        return teamsByCat[c] || 0;
      })
    );

    const competition = {
      id: 'COMP_TORNEO_F7_' + Date.now(),
      appScope: 'cdsanabriacf',
      name: name,
      title: name,
      type: 'torneo',
      formatType: 'futbol_7',
      sportMode: 'futbol',
      footballFormat: '7',
      status: 'activo',
      categories: categories,
      category: categories[0] || '',
      categorySlots: buildCategorySlots(categories, fields, startTime),
      fieldMode: 'multi',
      defaultField: fields[0],
      fieldList: fields,
      fieldListRaw: fields.join('\n'),
      calendarMode: 'parallel_occupancy',
      scheduleDayStartTime: startTime,
      scheduleSlotIntervalMinutes: 90,
      scheduleTurnoverMinutes: 10,
      scheduleMatchDurationMinutes: 0,
      scheduleCategoryDurationsRaw: DEFAULT_DURATIONS,
      scheduleMaxMatchesPerDay: 0,
      scheduleWeekdayDefaultEnd: '21:30',
      scheduleAgeSortMode: 'youngest_first',
      scheduleRuleOverridesRaw: 'Final|youngest_first',
      startDate: startDate,
      endDate: endDate,
      maxTeams: maxTeams,
      description: 'Torneo Fútbol 7 2026 — generado con asistente (cuadro por categoría).',
      rules: 'Eliminatoria por categoría. Finales en la fecha final de cada categoría. Partidos aplazables desde el gestor de partidos.',
      excludeFromOfficialPlayerStats: true,
      teams: teams,
      matches: [],
      phases: [],
      torneoCategorySchedules: categorySchedules,
      torneoWizardVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy:
        (JSON.parse(global.localStorage.getItem('currentAdmin') || '{}').email || 'admin')
    };

    if (teams.length >= 2) {
      const generated = engine.buildPerCategoryTorneoCalendar(competition, categorySchedules);
      competition.matches = generated.matches || [];
      competition.phases = generated.phases || [];
    }

    try {
      const list = JSON.parse(global.localStorage.getItem('clubCompetitions') || '[]');
      list.push(competition);
      global.localStorage.setItem('clubCompetitions', JSON.stringify(list));
      if (typeof global.persistRecordToFirebase === 'function') {
        await global.persistRecordToFirebase('clubCompetitions', 'competitions', competition);
      }
      closeTorneoF7Wizard();
      if (typeof global.loadCompetitionsList === 'function') {
        global.loadCompetitionsList();
      }
      if (typeof global.updateDashboardCounts === 'function') {
        global.updateDashboardCounts();
      }
      alert(
        '✅ Torneo creado: ' +
          name +
          '\n\n' +
          'Equipos: ' +
          teams.length +
          '\nPartidos: ' +
          (competition.matches || []).length +
          '\nCategorías: ' +
          categories.join(', ') +
          '\n\nAbre 👥 Equipos / ⚽ Partidos en la competición para revisar el cuadro y calendario.'
      );
    } catch (err) {
      alert('❌ Error al guardar: ' + (err && err.message ? err.message : String(err)));
    }
  }

  global.openTorneoF7Wizard = openTorneoF7Wizard;
  global.closeTorneoF7Wizard = closeTorneoF7Wizard;
})(typeof window !== 'undefined' ? window : globalThis);
