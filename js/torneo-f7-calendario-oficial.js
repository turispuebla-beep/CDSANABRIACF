/**
 * Calendario oficial Torneo Fútbol 7 Puebla de Sanabria (17–24 ago 2026).
 * Se inyecta en el motor de competiciones existente (sanabria_competitions).
 */
(function (global) {
  'use strict';

  var COMP_ID = 'TORNEO_F7_2026_PINAR';
  var VERSION = '2026-inf-j1-sanabria2-cdi-34-v2';
  var FIELD = 'Campo El Pinar';
  var CATS = ['Alevín', 'Infantil', 'Cadete', 'Sénior'];
  var NAME_HINT = /torneo\s*f[uú]tbol\s*7|f[uú]tbol\s*7\s*[-—]?\s*2026|torneo\s*f7/i;

  var TEAMS = [
    { id: 'F7_ALEVIN_SANABRIA_ROOTS', name: 'Sanabria Roots', category: 'Alevín' },
    { id: 'F7_ALEVIN_SANABRIA_1', name: 'Sanabria 1', category: 'Alevín' },
    { id: 'F7_ALEVIN_ESCUELA_FS', name: 'Escuela Fútbol Sala Sanabria', category: 'Alevín' },
    { id: 'F7_INF_COBREROS', name: 'Cóbreros', category: 'Infantil' },
    { id: 'F7_INF_EL_BRONX', name: 'El Bronx', category: 'Infantil' },
    { id: 'F7_INF_SANABRIA_2', name: 'Sanabria 2', category: 'Infantil' },
    { id: 'F7_INF_CDI', name: 'CDI', category: 'Infantil' },
    { id: 'F7_CAD_ENGRIPADOS', name: 'Los Engripados', category: 'Cadete' },
    { id: 'F7_CAD_SANABRIA_UNITED', name: 'Sanabria United', category: 'Cadete' },
    { id: 'F7_CAD_ESCUDINETA', name: 'La Escudineta', category: 'Cadete' },
    { id: 'F7_SEN_BAR_MIRADOR', name: 'Bar Mirador', category: 'Sénior', group: 'A', crest: 'assets/escudos-senior/bar-mirador.png?v=2' },
    { id: 'F7_SEN_MONTELUENO', name: 'Montelueño', category: 'Sénior', group: 'A', crest: 'assets/escudos-senior/montelueno.png' },
    { id: 'F7_SEN_LA_TOSTA', name: 'La Tosta Sanabresa', category: 'Sénior', group: 'A', crest: 'assets/escudos-senior/la-tosta-sanabresa.png' },
    { id: 'F7_SEN_CAPARROTA', name: 'Caparrota', category: 'Sénior', group: 'A', crest: 'assets/escudos-senior/caparrota.png' },
    { id: 'F7_SEN_JOPOS', name: 'Jopos de Sanabria', category: 'Sénior', group: 'A', crest: 'assets/escudos-senior/jopos-de-sanabria.png' },
    { id: 'F7_SEN_SIKARIONES_A', name: 'Sikariones Ecotera A', category: 'Sénior', group: 'B', crest: 'assets/escudos-senior/sikariones-ecotera-a.png' },
    { id: 'F7_SEN_SIKARIONES_B', name: 'Sikariones Ecotera B', category: 'Sénior', group: 'B', crest: 'assets/escudos-senior/sikariones-ecotera-b.png' },
    { id: 'F7_SEN_CAR_ROSINOS', name: 'C.A.R. Rosinos', category: 'Sénior', group: 'B', crest: 'assets/escudos-senior/car-rosinos.png' },
    { id: 'F7_SEN_OLEK_FC', name: 'Olek FC', category: 'Sénior', group: 'B', crest: 'assets/escudos-senior/olek-fc.png' },
    { id: 'F7_SEN_SAN_FRANCISCO', name: 'San Francisco/Castellanos', category: 'Sénior', group: 'B', crest: 'assets/escudos-senior/san-francisco-castellanos.png' }
  ];

  var FIXTURES = [
    { id: 'F7OFF_ALEV_0817_1700', cat: 'Alevín', date: '2026-08-17', time: '18:00', home: 'Sanabria Roots', away: 'Sanabria 1', round: 1, stage: 'Jornada 1' },
    { id: 'F7OFF_ALEV_0818_1700', cat: 'Alevín', date: '2026-08-18', time: '18:00', home: 'Sanabria 1', away: 'Escuela Fútbol Sala Sanabria', round: 2, stage: 'Jornada 2', homeScore: 6, awayScore: 0 },
    { id: 'F7OFF_ALEV_0819_1700', cat: 'Alevín', date: '2026-08-19', time: '18:00', home: 'Escuela Fútbol Sala Sanabria', away: 'Sanabria Roots', round: 3, stage: 'Jornada 3' },
    { id: 'F7OFF_ALEV_0820_1700', cat: 'Alevín', date: '2026-08-20', time: '18:00', home: 'Sanabria Roots', away: 'Sanabria 1', round: 4, stage: 'Jornada 4' },
    { id: 'F7OFF_ALEV_0821_1700', cat: 'Alevín', date: '2026-08-21', time: '18:00', home: 'Escuela Fútbol Sala Sanabria', away: 'Sanabria 1', round: 5, stage: 'Jornada 5' },
    { id: 'F7OFF_ALEV_0822_1700', cat: 'Alevín', date: '2026-08-22', time: '18:00', home: 'Sanabria Roots', away: 'Escuela Fútbol Sala Sanabria', round: 6, stage: 'Jornada 6' },
    { id: 'F7OFF_ALEV_0823_1700', cat: 'Alevín', date: '2026-08-23', time: '17:00', home: '1º clasificado', away: '2º clasificado', round: 7, stage: 'Final', isFinal: true },

    { id: 'F7OFF_INF_0817_1745', cat: 'Infantil', date: '2026-08-17', time: '18:00', home: 'Cóbreros', away: 'El Bronx', round: 1, stage: 'Jornada 1' },
    { id: 'F7OFF_INF_0817_1830', cat: 'Infantil', date: '2026-08-17', time: '18:45', home: 'Sanabria 2', away: 'CDI', round: 1, stage: 'Jornada 1', homeScore: 3, awayScore: 4 },
    { id: 'F7OFF_INF_0818_1745', cat: 'Infantil', date: '2026-08-18', time: '18:00', home: 'El Bronx', away: 'Sanabria 2', round: 2, stage: 'Jornada 2', homeScore: 0, awayScore: 2 },
    { id: 'F7OFF_INF_0818_1830', cat: 'Infantil', date: '2026-08-18', time: '18:45', home: 'CDI', away: 'Cóbreros', round: 2, stage: 'Jornada 2', homeScore: 4, awayScore: 4 },
    { id: 'F7OFF_INF_0819_1745', cat: 'Infantil', date: '2026-08-19', time: '18:00', home: 'Sanabria 2', away: 'Cóbreros', round: 3, stage: 'Jornada 3' },
    { id: 'F7OFF_INF_0819_1830', cat: 'Infantil', date: '2026-08-19', time: '18:45', home: 'CDI', away: 'El Bronx', round: 3, stage: 'Jornada 3' },
    { id: 'F7OFF_INF_0820_1745', cat: 'Infantil', date: '2026-08-20', time: '18:00', home: 'El Bronx', away: 'Cóbreros', round: 4, stage: 'Jornada 4' },
    { id: 'F7OFF_INF_0820_1830', cat: 'Infantil', date: '2026-08-20', time: '18:45', home: 'CDI', away: 'Sanabria 2', round: 4, stage: 'Jornada 4' },
    { id: 'F7OFF_INF_0821_1745', cat: 'Infantil', date: '2026-08-21', time: '18:00', home: 'Sanabria 2', away: 'El Bronx', round: 5, stage: 'Jornada 5' },
    { id: 'F7OFF_INF_0821_1830', cat: 'Infantil', date: '2026-08-21', time: '18:45', home: 'Cóbreros', away: 'CDI', round: 5, stage: 'Jornada 5' },
    { id: 'F7OFF_INF_0822_1745', cat: 'Infantil', date: '2026-08-22', time: '18:00', home: 'Cóbreros', away: 'Sanabria 2', round: 6, stage: 'Jornada 6' },
    { id: 'F7OFF_INF_0822_1830', cat: 'Infantil', date: '2026-08-22', time: '18:45', home: 'El Bronx', away: 'CDI', round: 6, stage: 'Jornada 6' },
    { id: 'F7OFF_INF_0823_1745', cat: 'Infantil', date: '2026-08-23', time: '18:00', home: '1º clasificado', away: '2º clasificado', round: 7, stage: 'Final', isFinal: true },

    { id: 'F7OFF_CAD_0817_1915', cat: 'Cadete', date: '2026-08-17', time: '19:30', home: 'Los Engripados', away: 'Sanabria United', round: 1, stage: 'Jornada 1' },
    { id: 'F7OFF_CAD_0818_1915', cat: 'Cadete', date: '2026-08-18', time: '19:30', home: 'Sanabria United', away: 'La Escudineta', round: 2, stage: 'Jornada 2', homeScore: 0, awayScore: 4 },
    { id: 'F7OFF_CAD_0819_1915', cat: 'Cadete', date: '2026-08-19', time: '19:30', home: 'La Escudineta', away: 'Los Engripados', round: 3, stage: 'Jornada 3' },
    { id: 'F7OFF_CAD_0820_1915', cat: 'Cadete', date: '2026-08-20', time: '19:30', home: 'Los Engripados', away: 'Sanabria United', round: 4, stage: 'Jornada 4' },
    { id: 'F7OFF_CAD_0821_1915', cat: 'Cadete', date: '2026-08-21', time: '19:30', home: 'Sanabria United', away: 'La Escudineta', round: 5, stage: 'Jornada 5' },
    { id: 'F7OFF_CAD_0822_1915', cat: 'Cadete', date: '2026-08-22', time: '19:30', home: 'Los Engripados', away: 'La Escudineta', round: 6, stage: 'Jornada 6' },
    { id: 'F7OFF_CAD_0823_1830', cat: 'Cadete', date: '2026-08-23', time: '18:30', home: '1º clasificado', away: '2º clasificado', round: 7, stage: 'Final', isFinal: true },

    { id: 'F7OFF_SEN_0817_2000', cat: 'Sénior', group: 'A', date: '2026-08-17', time: '20:15', home: 'Bar Mirador', away: 'Montelueño', round: 1, stage: 'Grupo A · Jornada 1', field: '' },
    { id: 'F7OFF_SEN_0817_2045', cat: 'Sénior', group: 'A', date: '2026-08-17', time: '21:00', home: 'La Tosta Sanabresa', away: 'Caparrota', round: 1, stage: 'Grupo A · Jornada 1', field: '' },
    { id: 'F7OFF_SEN_0817_2130', cat: 'Sénior', group: 'B', date: '2026-08-17', time: '21:45', home: 'San Francisco/Castellanos', away: 'Sikariones Ecotera B', round: 1, stage: 'Grupo B · Jornada 1', field: '' },
    { id: 'F7OFF_SEN_0817_2215', cat: 'Sénior', group: 'B', date: '2026-08-17', time: '22:30', home: 'C.A.R. Rosinos', away: 'Olek FC', round: 1, stage: 'Grupo B · Jornada 1', field: '' },

    { id: 'F7OFF_SEN_0818_2000', cat: 'Sénior', group: 'A', date: '2026-08-18', time: '20:15', home: 'Jopos de Sanabria', away: 'Bar Mirador', round: 2, stage: 'Grupo A · Jornada 2', field: '', homeScore: 1, awayScore: 3 },
    { id: 'F7OFF_SEN_0818_2045', cat: 'Sénior', group: 'A', date: '2026-08-18', time: '21:00', home: 'Montelueño', away: 'La Tosta Sanabresa', round: 2, stage: 'Grupo A · Jornada 2', field: '', homeScore: 6, awayScore: 1 },
    { id: 'F7OFF_SEN_0818_2130', cat: 'Sénior', group: 'B', date: '2026-08-18', time: '21:45', home: 'Sikariones Ecotera B', away: 'C.A.R. Rosinos', round: 2, stage: 'Grupo B · Jornada 2', field: '', homeScore: 3, awayScore: 0 },
    { id: 'F7OFF_SEN_0818_2215', cat: 'Sénior', group: 'B', date: '2026-08-18', time: '22:30', home: 'Sikariones Ecotera A', away: 'San Francisco/Castellanos', round: 2, stage: 'Grupo B · Jornada 2', field: '', homeScore: 0, awayScore: 1 },

    { id: 'F7OFF_SEN_0819_2000', cat: 'Sénior', group: 'A', date: '2026-08-19', time: '20:15', home: 'Caparrota', away: 'Jopos de Sanabria', round: 3, stage: 'Grupo A · Jornada 3', field: '' },
    { id: 'F7OFF_SEN_0819_2045', cat: 'Sénior', group: 'A', date: '2026-08-19', time: '21:00', home: 'Bar Mirador', away: 'La Tosta Sanabresa', round: 3, stage: 'Grupo A · Jornada 3', field: '' },
    { id: 'F7OFF_SEN_0819_2130', cat: 'Sénior', group: 'B', date: '2026-08-19', time: '21:45', home: 'San Francisco/Castellanos', away: 'C.A.R. Rosinos', round: 3, stage: 'Grupo B · Jornada 3', field: '' },
    { id: 'F7OFF_SEN_0819_2215', cat: 'Sénior', group: 'B', date: '2026-08-19', time: '22:30', home: 'Sikariones Ecotera A', away: 'Olek FC', round: 3, stage: 'Grupo B · Jornada 3', field: '' },

    { id: 'F7OFF_SEN_0820_2000', cat: 'Sénior', group: 'A', date: '2026-08-20', time: '20:15', home: 'Montelueño', away: 'Caparrota', round: 4, stage: 'Grupo A · Jornada 4', field: '' },
    { id: 'F7OFF_SEN_0820_2045', cat: 'Sénior', group: 'A', date: '2026-08-20', time: '21:00', home: 'Jopos de Sanabria', away: 'La Tosta Sanabresa', round: 4, stage: 'Grupo A · Jornada 4', field: '' },
    { id: 'F7OFF_SEN_0820_2130', cat: 'Sénior', group: 'B', date: '2026-08-20', time: '21:45', home: 'Olek FC', away: 'Sikariones Ecotera B', round: 4, stage: 'Grupo B · Jornada 4', field: '' },
    { id: 'F7OFF_SEN_0820_2215', cat: 'Sénior', group: 'B', date: '2026-08-20', time: '22:30', home: 'Sikariones Ecotera A', away: 'C.A.R. Rosinos', round: 4, stage: 'Grupo B · Jornada 4', field: '' },

    { id: 'F7OFF_SEN_0821_2000', cat: 'Sénior', group: 'A', date: '2026-08-21', time: '20:15', home: 'Bar Mirador', away: 'Caparrota', round: 5, stage: 'Grupo A · Jornada 5', field: '' },
    { id: 'F7OFF_SEN_0821_2045', cat: 'Sénior', group: 'A', date: '2026-08-21', time: '21:00', home: 'Montelueño', away: 'Jopos de Sanabria', round: 5, stage: 'Grupo A · Jornada 5', field: '' },
    { id: 'F7OFF_SEN_0821_2130', cat: 'Sénior', group: 'B', date: '2026-08-21', time: '21:45', home: 'Olek FC', away: 'San Francisco/Castellanos', round: 5, stage: 'Grupo B · Jornada 5', field: '' },
    { id: 'F7OFF_SEN_0821_2215', cat: 'Sénior', group: 'B', date: '2026-08-21', time: '22:30', home: 'Sikariones Ecotera A', away: 'Sikariones Ecotera B', round: 5, stage: 'Grupo B · Jornada 5', field: '' },

    { id: 'F7OFF_SEN_0822_2000', cat: 'Sénior', date: '2026-08-22', time: '20:15', home: '1º Grupo A', away: '2º Grupo B', round: 6, stage: 'Semifinal 1', field: '', isFinal: true, homeId: 'F7_SENIOR_1A', awayId: 'F7_SENIOR_2B' },
    { id: 'F7OFF_SEN_0822_2100', cat: 'Sénior', date: '2026-08-22', time: '21:15', home: '1º Grupo B', away: '2º Grupo A', round: 6, stage: 'Semifinal 2', field: '', isFinal: true, homeId: 'F7_SENIOR_1B', awayId: 'F7_SENIOR_2A' },
    { id: 'F7OFF_SEN_0823_2000', cat: 'Sénior', date: '2026-08-23', time: '20:15', home: 'Ganador Semifinal 1', away: 'Ganador Semifinal 2', round: 7, stage: 'Final', field: '', isFinal: true, homeId: 'F7_SENIOR_SF1', awayId: 'F7_SENIOR_SF2' }
  ];

  function escapeHtml(v) {
    return String(v || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function normName(v) {
    return String(v || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  function readList() {
    try {
      var list = JSON.parse(global.localStorage.getItem('clubCompetitions') || '[]');
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  function findCompetition(list) {
    var comps = Array.isArray(list) ? list : readList();
    var candidates = comps.filter(function (c) {
      if (!c) return false;
      if (c.id === COMP_ID || c.officialCalendarId === COMP_ID) return true;
      return NAME_HINT.test(String(c.name || c.title || ''));
    });
    if (!candidates.length) return null;
    candidates.sort(function (a, b) {
      function played(comp) {
        return ((comp && comp.matches) || []).filter(function (m) {
          return matchIsPlayed(m);
        }).length;
      }
      return played(b) - played(a);
    });
    return candidates[0];
  }

  function findTeam(teams, name, category) {
    var n = normName(name);
    var cat = normName(category);
    var list = Array.isArray(teams) ? teams : [];
    var exact = list.find(function (t) {
      return normName(t.name) === n && (!cat || normName(t.category) === cat);
    });
    if (exact) return exact;
    return list.find(function (t) {
      return normName(t.name) === n;
    }) || null;
  }

  function ensureTeam(teams, name, category, preferredId, group) {
    var existing = findTeam(teams, name, category);
    if (existing) {
      if (!existing.category && category) existing.category = category;
      if (group && !existing.group) existing.group = group;
      return existing;
    }
    var team = {
      id: preferredId || ('F7_' + String(name).replace(/[^a-zA-Z0-9]+/g, '_')),
      name: name,
      category: category,
      crest: '',
      isGuestTeam: true
    };
    if (group) team.group = group;
    teams.push(team);
    return team;
  }

  function officialMatchIds() {
    return FIXTURES.map(function (f) {
      return f.id;
    });
  }

  function fixtureVenue() {
    return FIELD;
  }

  function stripPavilionName(v) {
    var s = String(v || '');
    if (/varela|pabell[oó]n/i.test(s)) return FIELD;
    return s || FIELD;
  }

  function buildMatch(fx, home, away, competitionId) {
    return {
      id: fx.id,
      competitionId: competitionId,
      round: fx.round,
      stageName: fx.cat + ' · ' + fx.stage,
      categoryHint: fx.cat,
      groupHint: fx.group || '',
      homeTeamId: home.id,
      homeTeamName: home.name,
      awayTeamId: away.id,
      awayTeamName: away.name,
      homeScore: fx.homeScore != null && fx.homeScore !== '' ? fx.homeScore : null,
      awayScore: fx.awayScore != null && fx.awayScore !== '' ? fx.awayScore : null,
      status: fx.homeScore != null && fx.homeScore !== '' && fx.awayScore != null && fx.awayScore !== '' ? 'completed' : 'scheduled',
      matchDate: fx.date,
      matchTime: fx.time,
      field: fixtureVenue(fx),
      officialFixture: true,
      playedAt: fx.homeScore != null && fx.awayScore != null ? fx.date + 'T' + (fx.time || '00:00') + ':00+02:00' : null
    };
  }

  function hasOfficialFixtures(comp) {
    if (!comp) return false;
    if (String(comp.officialCalendarVersion || '') === VERSION) {
      var ids = officialMatchIds();
      var have = {};
      (comp.matches || []).forEach(function (m) {
        have[String(m.id)] = true;
      });
      return ids.every(function (id) {
        return have[id];
      });
    }
    return (comp.matches || []).some(function (m) {
      return String(m.id || '').indexOf('F7OFF_') === 0;
    });
  }

  function newCompetition() {
    return {
      id: COMP_ID,
      appScope: 'cdsanabriacf',
      name: 'Torneo Fútbol 7 Puebla de Sanabria 2026',
      title: 'Torneo Fútbol 7 — Calendario oficial',
      type: 'liga',
      formatType: 'futbol_7',
      sportMode: 'futbol',
      footballFormat: '7',
      category: 'Alevín',
      categories: CATS.slice(),
      startDate: '2026-08-16',
      endDate: '2026-08-23',
      description: 'Calendario oficial 17–23 de agosto. Campo El Pinar. Torneo 1 sénior (20:15). Torneo 2: alevín 18:00, infantil 18:00/18:45, cadete 19:30. Semifinales sénior el 22. Finales el 23.',
      rules: 'Victoria 3 puntos · Empate 1 · Derrota 0. Desempate: diferencia de goles, goles a favor, enfrentamiento directo. Semifinales solo en sénior (1ºA-2ºB y 1ºB-2ºA). Alevín, Infantil y Cadete: sin semifinales, final el 23.',
      maxTeams: 32,
      defaultField: FIELD,
      fieldList: [FIELD],
      fieldMode: 'single',
      status: 'activo',
      excludeFromOfficialPlayerStats: true,
      officialCalendarId: COMP_ID,
      officialCalendarVersion: VERSION,
      teams: [],
      matches: [],
      phases: [],
      createdAt: new Date().toISOString(),
      createdBy: 'calendario_oficial_f7'
    };
  }

  function applyOfficialCalendar(list, opts) {
    opts = opts || {};
    var comps = (Array.isArray(list) ? list : readList()).slice();
    var created = false;
    var competition = findCompetition(comps);
    if (!competition) {
      competition = newCompetition();
      comps.push(competition);
      created = true;
    }

    if (!opts.force && hasOfficialFixtures(competition) && String(competition.officialCalendarVersion) === VERSION && !missingSeededResults(competition)) {
      return { list: comps, competition: competition, created: false, changed: false, added: 0 };
    }

    competition.appScope = 'cdsanabriacf';
    competition.name = competition.name || 'Torneo Fútbol 7 Puebla de Sanabria 2026';
    competition.title = competition.title || competition.name;
    competition.type = 'liga';
    competition.formatType = competition.formatType || 'futbol_7';
    competition.categories = CATS.slice();
    competition.startDate = competition.startDate || '2026-08-16';
    competition.endDate = '2026-08-23';
    competition.defaultField = competition.defaultField || FIELD;
    competition.fieldList = [FIELD];
    competition.maxTeams = Math.max(Number(competition.maxTeams) || 0, 32);
    competition.status = competition.manualClosed ? 'finalizado' : 'activo';
    competition.excludeFromOfficialPlayerStats = competition.excludeFromOfficialPlayerStats !== false;
    competition.officialCalendarId = COMP_ID;
    competition.officialCalendarVersion = VERSION;
    if (!Array.isArray(competition.teams)) competition.teams = [];
    if (!Array.isArray(competition.matches)) competition.matches = [];

    TEAMS.forEach(function (t) {
      var team = ensureTeam(competition.teams, t.name, t.category, t.id, t.group);
      if (t.crest) team.crest = t.crest;
      if (t.group) team.group = t.group;
    });

    var byId = {};
    competition.matches.forEach(function (m) {
      byId[String(m.id)] = m;
    });

    var added = 0;
    FIXTURES.forEach(function (fx) {
      var home = ensureTeam(
        competition.teams,
        fx.isFinal ? fx.cat + ' · ' + fx.home : fx.home,
        fx.cat,
        fx.homeId || (fx.isFinal ? 'F7_' + fx.cat.toUpperCase() + '_1O' : null),
        fx.group
      );
      var away = ensureTeam(
        competition.teams,
        fx.isFinal ? fx.cat + ' · ' + fx.away : fx.away,
        fx.cat,
        fx.awayId || (fx.isFinal ? 'F7_' + fx.cat.toUpperCase() + '_2O' : null),
        fx.group
      );
      var prev = byId[fx.id];
      if (!prev) {
        var match = buildMatch(fx, home, away, competition.id);
        competition.matches.push(match);
        byId[fx.id] = match;
        added += 1;
        return;
      }
      if (String(prev.status) !== 'completed' && !matchIsPlayed(prev)) {
        prev.matchDate = fx.date;
        prev.matchTime = fx.time;
        prev.field = FIELD;
        prev.stageName = fx.cat + ' · ' + fx.stage;
        prev.categoryHint = fx.cat;
        prev.groupHint = fx.group || prev.groupHint || '';
        prev.round = fx.round;
        prev.homeTeamId = home.id;
        prev.homeTeamName = home.name;
        prev.awayTeamId = away.id;
        prev.awayTeamName = away.name;
        prev.officialFixture = true;
      } else {
        prev.matchDate = fx.date;
        prev.matchTime = fx.time;
        prev.field = FIELD;
        prev.categoryHint = prev.categoryHint || fx.cat;
        prev.groupHint = prev.groupHint || fx.group || '';
        prev.officialFixture = true;
      }
      if (fx.homeScore != null && fx.homeScore !== '' && fx.awayScore != null && fx.awayScore !== '' && !matchIsPlayed(prev)) {
        prev.homeScore = fx.homeScore;
        prev.awayScore = fx.awayScore;
        prev.status = 'completed';
        prev.playedAt = prev.playedAt || (fx.date + 'T' + (fx.time || '00:00') + ':00+02:00');
      }
    });

    var otherMatches = competition.matches.filter(function (m) {
      return String(m.id || '').indexOf('F7OFF_') !== 0;
    });
    var othersPlayed = otherMatches.some(function (m) {
      return matchIsPlayed(m);
    });
    if (!othersPlayed && otherMatches.length) {
      competition.matches = competition.matches.filter(function (m) {
        return String(m.id || '').indexOf('F7OFF_') === 0;
      });
    }

    (competition.matches || []).forEach(function (m) {
      m.field = FIELD;
    });
    competition.description = 'Calendario oficial 17–23 de agosto. Campo El Pinar. Torneo 1 sénior (20:15). Torneo 2: alevín 18:00, infantil 18:00/18:45, cadete 19:30. Semifinales sénior el 22. Finales el 23.';

    competition.updatedAt = new Date().toISOString();
    var ix = comps.findIndex(function (c) {
      return c && c.id === competition.id;
    });
    if (ix >= 0) comps[ix] = competition;
    else comps.push(competition);

    return {
      list: comps,
      competition: competition,
      created: created,
      changed: true,
      added: added
    };
  }

  function hasNumericScore(v) {
    if (v == null || v === '') return false;
    if (typeof v === 'number') return !isNaN(v);
    var n = Number(String(v).trim());
    return String(v).trim() !== '' && !isNaN(n);
  }

  function matchIsPlayed(m) {
    if (!m) return false;
    if (String(m.status || '') === 'postponed' || String(m.status || '') === 'cancelled') return false;
    return hasNumericScore(m.homeScore) && hasNumericScore(m.awayScore);
  }

  function missingSeededResults(competition) {
    var byId = {};
    (competition.matches || []).forEach(function (m) {
      if (m && m.id) byId[String(m.id)] = m;
    });
    return FIXTURES.some(function (fx) {
      if (!hasNumericScore(fx.homeScore) || !hasNumericScore(fx.awayScore)) return false;
      var live = byId[fx.id];
      return !matchIsPlayed(live);
    });
  }

  function pairKey(m, swap) {
    var home = swap ? m.awayTeamName : m.homeTeamName;
    var away = swap ? m.homeTeamName : m.awayTeamName;
    return [String(m.matchDate || ''), normName(home), normName(away)].join('|');
  }

  function fixtureKey(m) {
    return [
      String(m.matchDate || ''),
      String(m.matchTime || ''),
      normName(m.homeTeamName),
      normName(m.awayTeamName)
    ].join('|');
  }

  function applyLiveResult(seed, live, swapped) {
    var hs = swapped ? live.awayScore : live.homeScore;
    var as = swapped ? live.homeScore : live.awayScore;
    var homeScore = hasNumericScore(hs) ? hs : seed.homeScore;
    var awayScore = hasNumericScore(as) ? as : seed.awayScore;
    var scored = hasNumericScore(homeScore) && hasNumericScore(awayScore);
    var next = Object.assign({}, seed, {
      matchDate: seed.matchDate,
      matchTime: seed.matchTime,
      homeScore: homeScore,
      awayScore: awayScore,
      status: scored ? 'completed' : (String(live.status || '') === 'postponed' ? 'postponed' : seed.status),
      playedAt: live.playedAt || seed.playedAt,
      categoryHint: seed.categoryHint || live.categoryHint || '',
      groupHint: seed.groupHint || live.groupHint || '',
      stageName: seed.stageName || live.stageName,
      field: FIELD
    });
    if (isPlaceholderTeam(seed.homeTeamName) && live.homeTeamName && !isPlaceholderTeam(swapped ? live.awayTeamName : live.homeTeamName)) {
      next.homeTeamName = swapped ? live.awayTeamName : live.homeTeamName;
      next.homeTeamId = swapped ? live.awayTeamId : live.homeTeamId || seed.homeTeamId;
    }
    if (isPlaceholderTeam(seed.awayTeamName) && live.awayTeamName && !isPlaceholderTeam(swapped ? live.homeTeamName : live.awayTeamName)) {
      next.awayTeamName = swapped ? live.homeTeamName : live.awayTeamName;
      next.awayTeamId = swapped ? live.homeTeamId : live.awayTeamId || seed.awayTeamId;
    }
    return next;
  }

  function officialPublicSnapshot(live) {
    var seeded = applyOfficialCalendar([], { force: true }).competition;
    if (!live) return seeded;
    var liveById = {};
    var liveByFixture = {};
    var liveByPair = {};
    (live.matches || []).forEach(function (m) {
      if (!m) return;
      if (m.id) liveById[String(m.id)] = m;
      liveByFixture[fixtureKey(m)] = m;
      liveByPair[pairKey(m, false)] = { live: m, swapped: false };
      liveByPair[pairKey(m, true)] = { live: m, swapped: true };
    });
    seeded.matches = (seeded.matches || []).map(function (m) {
      var hit =
        (m.id && liveById[String(m.id)] && { live: liveById[String(m.id)], swapped: false }) ||
        (liveByFixture[fixtureKey(m)] && { live: liveByFixture[fixtureKey(m)], swapped: false }) ||
        liveByPair[pairKey(m, false)] ||
        liveByPair[pairKey(m, true)];
      if (!hit || !hit.live) return m;
      return applyLiveResult(m, hit.live, !!hit.swapped);
    });
    if (Array.isArray(live.teams) && live.teams.length) {
      seeded.teams = (seeded.teams || []).map(function (seed) {
        var liveT =
          live.teams.find(function (t) {
            return t && t.id && seed.id && String(t.id) === String(seed.id);
          }) ||
          live.teams.find(function (t) {
            return t && normName(t.name) === normName(seed.name) && (!t.category || normName(t.category) === normName(seed.category));
          });
        if (!liveT) return seed;
        return Object.assign({}, seed, {
          crest: liveT.crest || seed.crest,
          group: liveT.group || seed.group,
          name: seed.name,
          category: seed.category || liveT.category
        });
      });
    }
    if (live.name) seeded.name = live.name;
    if (live.title) seeded.title = live.title;
    return seeded;
  }

  function getPublicCompetition(list) {
    return officialPublicSnapshot(findCompetition(list));
  }

  function hasAccess() {
    if (global.AdminOrganizerAccess && global.AdminOrganizerAccess.hasCompetitionManagementAccess) {
      return global.AdminOrganizerAccess.hasCompetitionManagementAccess();
    }
    if (typeof global.hasCompetitionAdminAccess === 'function') {
      return global.hasCompetitionAdminAccess();
    }
    return false;
  }

  async function persistCompetition(competition) {
    var list = readList();
    var ix = list.findIndex(function (c) {
      return c && c.id === competition.id;
    });
    if (ix >= 0) list[ix] = competition;
    else list.push(competition);
    global.localStorage.setItem('clubCompetitions', JSON.stringify(list));
    if (typeof global.upsertDocument === 'function') {
      await global.upsertDocument('competitions', competition.id, competition);
    } else if (typeof global.persistRecordToFirebase === 'function') {
      await global.persistRecordToFirebase('clubCompetitions', 'competitions', competition);
    } else if (global.CdsanCompetitionEngine && global.CdsanCompetitionEngine.saveCompetitionRecord) {
      await global.CdsanCompetitionEngine.saveCompetitionRecord(competition);
    }
    try {
      global.dispatchEvent(new CustomEvent('competitionsUpdated', { detail: list }));
    } catch (_) {}
    return competition;
  }

  async function ensureInEngine(opts) {
    opts = opts || {};
    if (!hasAccess()) {
      return { changed: false, skipped: true };
    }
    if (global.__f7calEnsuring) return global.__f7calEnsuring;
    global.__f7calEnsuring = (async function () {
      var applied = applyOfficialCalendar(readList(), opts);
      if (!applied.changed) return applied;
      await persistCompetition(applied.competition);
      if (typeof global.loadCompetitionsList === 'function') {
        try {
          global.loadCompetitionsList();
        } catch (_) {}
      }
      return applied;
    })();
    try {
      return await global.__f7calEnsuring;
    } finally {
      global.__f7calEnsuring = null;
    }
  }

  async function loadFromButton() {
    if (typeof global.ensureCompetitionAdminAccess === 'function' && !global.ensureCompetitionAdminAccess()) {
      return;
    }
    try {
      var result = await ensureInEngine({ force: true });
      var n = (result.competition && result.competition.matches) ? result.competition.matches.length : 0;
      alert(
        '✅ Calendario oficial cargado en Competiciones.\n\n' +
          n +
          ' partidos (El Pinar + sénior).\n' +
          'Los resultados se guardan en la nube para administradores y organizadores.'
      );
    } catch (err) {
      console.error(err);
      alert('❌ No se pudo guardar el calendario en la nube. Revisa la conexión e inténtalo de nuevo.');
    }
  }

  function formatDateEs(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      });
    } catch (_) {
      return iso;
    }
  }

  function scoreLine(m) {
    if (hasNumericScore(m.homeScore) && hasNumericScore(m.awayScore)) {
      return Number(m.homeScore) + ' - ' + Number(m.awayScore);
    }
    if (String(m.status || '') === 'postponed') return 'Aplazado';
    return '- -';
  }

  function isPlaceholderTeam(name) {
    return /clasificado|grupo a|grupo b|ganador semifinal|1º grupo|2º grupo/i.test(String(name || ''));
  }

  function isKnockoutStage(stageName) {
    return /final|semifinal/i.test(String(stageName || ''));
  }

  function standingsForCategory(comp, category, group) {
    var rows = {};
    (comp.teams || []).forEach(function (t) {
      if (normName(t.category) !== normName(category)) return;
      if (isPlaceholderTeam(t.name)) return;
      if (group && String(t.group || '') !== String(group)) return;
      rows[t.id] = {
        id: t.id,
        name: t.name,
        crest: t.crest || '',
        pj: 0,
        pg: 0,
        pe: 0,
        pp: 0,
        gf: 0,
        gc: 0,
        pts: 0
      };
    });
    function findStandingRow(rows, teamId, teamName) {
      if (teamId && rows[teamId]) return rows[teamId];
      var n = normName(teamName);
      var ids = Object.keys(rows);
      for (var i = 0; i < ids.length; i++) {
        if (normName(rows[ids[i]].name) === n) return rows[ids[i]];
      }
      return null;
    }
    (comp.matches || []).forEach(function (m) {
      if (String(m.categoryHint || '') !== category) return;
      if (isKnockoutStage(m.stageName)) return;
      if (group && String(m.groupHint || '') !== String(group)) return;
      if (!matchIsPlayed(m)) return;
      var home = findStandingRow(rows, m.homeTeamId, m.homeTeamName);
      var away = findStandingRow(rows, m.awayTeamId, m.awayTeamName);
      if (!home || !away) return;
      var hs = Number(m.homeScore || 0);
      var as = Number(m.awayScore || 0);
      home.pj += 1;
      away.pj += 1;
      home.gf += hs;
      home.gc += as;
      away.gf += as;
      away.gc += hs;
      if (hs > as) {
        home.pg += 1;
        away.pp += 1;
        home.pts += 3;
      } else if (as > hs) {
        away.pg += 1;
        home.pp += 1;
        away.pts += 3;
      } else {
        home.pe += 1;
        away.pe += 1;
        home.pts += 1;
        away.pts += 1;
      }
    });
    return Object.keys(rows)
      .map(function (k) {
        return rows[k];
      })
      .sort(function (a, b) {
        if (b.pts !== a.pts) return b.pts - a.pts;
        var dga = a.gf - a.gc;
        var dgb = b.gf - b.gc;
        if (dgb !== dga) return dgb - dga;
        if (b.gf !== a.gf) return b.gf - a.gf;
        return String(a.name).localeCompare(String(b.name), 'es');
      });
  }

  function crestHtml(url, size) {
    var s = size || 28;
    if (!url) return '';
    return (
      '<img src="' +
      escapeHtml(url) +
      '" alt="" width="' +
      s +
      '" height="' +
      s +
      '" style="width:' +
      s +
      'px;height:' +
      s +
      'px;object-fit:contain;flex-shrink:0;background:#fff;">'
    );
  }

  function findCrest(comp, teamId, teamName) {
    var teams = (comp && Array.isArray(comp.teams) ? comp.teams : []) || [];
    var t = teams.find(function (x) {
      return String(x.id) === String(teamId || '');
    });
    if (t && t.crest) return t.crest;
    t = findTeam(teams, teamName);
    if (t && t.crest) return t.crest;
    var off = TEAMS.find(function (x) {
      return normName(x.name) === normName(teamName);
    });
    return (off && off.crest) || '';
  }

  function renderSeniorGroups(comp) {
    var groups = { A: [], B: [] };
    TEAMS.filter(function (t) {
      return t.category === 'Sénior' && t.group;
    }).forEach(function (t) {
      var live = findTeam((comp && comp.teams) || [], t.name, 'Sénior') || t;
      groups[t.group].push({
        name: t.name,
        crest: live.crest || t.crest
      });
    });
    function col(letter, list) {
      var html =
        '<div style="flex:1;min-width:220px;background:#fff;border:1px solid #dbeafe;border-radius:12px;overflow:hidden;">' +
        '<div style="background:#1e3a8a;color:#fff;text-align:center;font-weight:800;letter-spacing:0.06em;padding:8px 10px;">GRUPO ' +
        letter +
        '</div>' +
        '<div style="display:flex;justify-content:space-around;gap:6px;padding:12px 8px 10px;flex-wrap:wrap;">';
      list.forEach(function (t) {
        html +=
          '<div style="width:72px;text-align:center;">' +
          (t.crest
            ? '<img src="' +
              escapeHtml(t.crest) +
              '" alt="' +
              escapeHtml(t.name) +
              '" style="width:48px;height:48px;object-fit:contain;margin:0 auto 6px;display:block;">'
            : '') +
          '<div style="font-size:0.62rem;font-weight:700;line-height:1.2;color:#0f172a;">' +
          escapeHtml(t.name) +
          '</div></div>';
      });
      html += '</div></div>';
      return html;
    }
    return (
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin:12px 0 16px;">' +
      col('A', groups.A) +
      col('B', groups.B) +
      '</div>'
    );
  }

  function renderStandingsTable(title, rows) {
    if (!rows.length) return '';
    var html =
      '<h5 style="margin:14px 0 6px;color:#1e3a8a;">' +
      escapeHtml(title) +
      '</h5>' +
      '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:0.82rem;">' +
      '<thead><tr style="background:#eff6ff;text-align:left;">' +
      '<th style="padding:6px;">Equipo</th><th style="padding:6px;">Pts</th><th style="padding:6px;">PJ</th>' +
      '<th style="padding:6px;">PG</th><th style="padding:6px;">PE</th><th style="padding:6px;">PP</th>' +
      '<th style="padding:6px;">DG</th></tr></thead><tbody>';
    rows.forEach(function (r, i) {
      html +=
        '<tr style="border-top:1px solid #e2e8f0;">' +
        '<td style="padding:6px;font-weight:600;">' +
        '<span style="display:inline-flex;align-items:center;gap:6px;">' +
        crestHtml(r.crest, 22) +
        (i + 1) +
        '. ' +
        escapeHtml(r.name) +
        '</span></td>' +
        '<td style="padding:6px;font-weight:700;color:#0f766e;">' +
        r.pts +
        '</td>' +
        '<td style="padding:6px;">' +
        r.pj +
        '</td><td style="padding:6px;">' +
        r.pg +
        '</td><td style="padding:6px;">' +
        r.pe +
        '</td><td style="padding:6px;">' +
        r.pp +
        '</td><td style="padding:6px;">' +
        (r.gf - r.gc) +
        '</td></tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  function renderStandings(comp) {
    var html = '';
    ['Alevín', 'Infantil', 'Cadete'].forEach(function (cat) {
      html += renderStandingsTable(cat, standingsForCategory(comp, cat));
    });
    html += renderStandingsTable('Sénior · Grupo A', standingsForCategory(comp, 'Sénior', 'A'));
    html += renderStandingsTable('Sénior · Grupo B', standingsForCategory(comp, 'Sénior', 'B'));
    return html || '<p style="color:#64748b;margin:0;">Aún no hay resultados.</p>';
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function localTodayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  var publicUi = { view: 'calendar', day: 'today', category: 'all' };

  function sortedMatches(comp) {
    return ((comp && comp.matches) || []).slice().sort(function (a, b) {
      return (
        String(a.matchDate || '').localeCompare(String(b.matchDate || '')) ||
        String(a.matchTime || '').localeCompare(String(b.matchTime || ''))
      );
    });
  }

  function matchDates(comp) {
    var seen = {};
    var out = [];
    sortedMatches(comp).forEach(function (m) {
      var d = String(m.matchDate || '');
      if (!d || seen[d]) return;
      seen[d] = true;
      out.push(d);
    });
    return out;
  }

  function renderMatchCard(comp, m) {
    var homeCrest = findCrest(comp, m.homeTeamId, m.homeTeamName);
    var awayCrest = findCrest(comp, m.awayTeamId, m.awayTeamName);
    return (
      '<div style="border:1px solid #dbeafe;border-radius:10px;background:#fff;padding:10px;margin:0 0 8px;">' +
      '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center;">' +
      '<strong style="display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
      crestHtml(homeCrest, 26) +
      escapeHtml(m.homeTeamName || '—') +
      ' <span style="color:#94a3b8;font-weight:600;">vs</span> ' +
      crestHtml(awayCrest, 26) +
      escapeHtml(m.awayTeamName || '—') +
      '</strong>' +
      '<span style="color:#0f766e;font-weight:700;">' +
      escapeHtml(scoreLine(m)) +
      '</span></div>' +
      '<div style="font-size:0.85rem;color:#64748b;margin-top:4px;">' +
      (m.categoryHint ? '<span style="color:#1e3a8a;font-weight:700;">' + escapeHtml(m.categoryHint) + '</span> · ' : '') +
      escapeHtml(m.matchTime || '') +
      ' · ' +
      escapeHtml(FIELD) +
      (m.stageName ? ' · ' + escapeHtml(m.stageName) : '') +
      '</div></div>'
    );
  }

  function tabBtn(id, label, active) {
    return (
      '<button type="button" onclick="TorneoF7CalendarioOficial.setPublicView(\'' +
      id +
      '\')" style="flex:1;min-width:140px;padding:10px 12px;border:none;border-radius:10px;cursor:pointer;font-weight:800;' +
      (active
        ? 'background:#1e3a8a;color:#fff;'
        : 'background:#e2e8f0;color:#1e3a8a;') +
      '">' +
      label +
      '</button>'
    );
  }

  function dayBtn(value, label, active) {
    return (
      '<button type="button" onclick="TorneoF7CalendarioOficial.setPublicView(\'calendar\',\'' +
      value +
      '\')" style="padding:6px 10px;border-radius:999px;cursor:pointer;font-size:0.78rem;font-weight:700;' +
      (active
        ? 'background:#0f766e;color:#fff;border:1px solid #0f766e;'
        : 'background:#fff;color:#0f766e;border:1px solid #99f6e4;') +
      '">' +
      label +
      '</button>'
    );
  }

  function catBtn(view, catId, label, active) {
    return (
      '<button type="button" onclick="TorneoF7CalendarioOficial.setPublicView(\'' +
      view +
      '\',\'\',\'' +
      catId +
      '\')" style="padding:6px 10px;border-radius:999px;cursor:pointer;font-size:0.78rem;font-weight:700;' +
      (active
        ? 'background:#1e3a8a;color:#fff;border:1px solid #1e3a8a;'
        : 'background:#fff;color:#1e3a8a;border:1px solid #bfdbfe;') +
      '">' +
      label +
      '</button>'
    );
  }

  function categoryButtons(view, selected) {
    var html = catBtn(view, 'all', 'Todas', selected === 'all');
    CATS.forEach(function (cat) {
      html += catBtn(view, cat, cat, selected === cat);
    });
    return html;
  }

  function matchInCategory(m, cat) {
    if (!cat || cat === 'all') return true;
    return normName(m.categoryHint) === normName(cat);
  }

  function shortDateLabel(iso) {
    if (!iso) return iso;
    try {
      return new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      });
    } catch (_) {
      return iso;
    }
  }

  function renderCalendarPanel(comp) {
    var today = localTodayKey();
    var cat = publicUi.category || 'all';
    var matches = sortedMatches(comp).filter(function (m) {
      return matchInCategory(m, cat);
    });
    var dates = [];
    var seen = {};
    matches.forEach(function (m) {
      var d = String(m.matchDate || '');
      if (!d || seen[d]) return;
      seen[d] = true;
      dates.push(d);
    });
    var filter = publicUi.day || 'today';
    if (filter === 'today' && dates.indexOf(today) < 0) filter = 'all';
    var html = '<div style="display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px;">';
    html += dayBtn('today', 'Hoy', filter === 'today');
    html += dayBtn('all', 'Todo el calendario', filter === 'all');
    dates.forEach(function (d) {
      html += dayBtn(d, shortDateLabel(d), filter === d);
    });
    html += '</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px;">';
    html += categoryButtons('calendar', cat);
    html += '</div>';

    var byDate = {};
    matches.forEach(function (m) {
      var d = m.matchDate || 'sin-fecha';
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(m);
    });

    var daysToShow = [];
    if (filter === 'all') daysToShow = dates;
    else if (filter === 'today') daysToShow = byDate[today] ? [today] : [];
    else daysToShow = byDate[filter] ? [filter] : [];

    if (filter === 'today' || filter === today) {
      html += '<h4 style="margin:4px 0 8px;color:#1d4ed8;">Partidos de hoy</h4>';
    } else if (filter === 'all') {
      html += '<h4 style="margin:4px 0 8px;color:#1d4ed8;">Calendario completo</h4>';
    }

    if (!daysToShow.length) {
      html +=
        '<p style="margin:0;color:#64748b;">' +
        (filter === 'today' ? 'Hoy no hay partidos programados. Abre «Todo el calendario» o elige otro día.' : 'No hay partidos en este día.') +
        '</p>';
      return html;
    }

    daysToShow.forEach(function (d) {
      var list = byDate[d] || [];
      html +=
        '<h5 style="margin:12px 0 6px;text-transform:capitalize;color:#334155;">' +
        escapeHtml(formatDateEs(d)) +
        (d === today ? ' · hoy' : '') +
        ' · ' +
        list.length +
        (list.length === 1 ? ' partido' : ' partidos') +
        '</h5>';
      var cats = [];
      var byCat = {};
      list.forEach(function (m) {
        var c = m.categoryHint || 'Otros';
        if (!byCat[c]) {
          byCat[c] = [];
          cats.push(c);
        }
        byCat[c].push(m);
      });
      cats.forEach(function (c) {
        html +=
          '<div style="font-size:0.78rem;font-weight:800;color:#1e3a8a;margin:8px 0 4px;">' +
          escapeHtml(c) +
          '</div>';
        byCat[c].forEach(function (m) {
          html += renderMatchCard(comp, m);
        });
      });
    });
    return html;
  }

  function isSemiStage(stageName) {
    return /semifinal/i.test(String(stageName || ''));
  }

  function isFinalOnlyStage(stageName) {
    return /final/i.test(String(stageName || '')) && !isSemiStage(stageName);
  }

  function renderKnockoutBlock(comp, title, note, matches) {
    var html =
      '<h4 style="margin:14px 0 6px;color:#9a3412;">' +
      escapeHtml(title) +
      '</h4>';
    if (note) {
      html += '<p style="margin:0 0 8px;color:#64748b;font-size:0.82rem;">' + note + '</p>';
    }
    if (!matches.length) {
      html += '<p style="margin:0;color:#64748b;font-size:0.88rem;">Aún no hay partidos en este bloque.</p>';
      return html;
    }
    var cats = [];
    var byCat = {};
    matches.forEach(function (m) {
      var c = m.categoryHint || 'Otros';
      if (!byCat[c]) {
        byCat[c] = [];
        cats.push(c);
      }
      byCat[c].push(m);
    });
    cats.forEach(function (c) {
      html +=
        '<div style="font-size:0.78rem;font-weight:800;color:#1e3a8a;margin:8px 0 4px;">' +
        escapeHtml(c) +
        '</div>';
      byCat[c].forEach(function (m) {
        html +=
          '<div style="font-size:0.78rem;color:#64748b;margin:0 0 4px;">' +
          escapeHtml(formatDateEs(m.matchDate)) +
          (m.matchTime ? ' · ' + escapeHtml(m.matchTime) : '') +
          '</div>';
        html += renderMatchCard(comp, m);
      });
    });
    return html;
  }

  function renderKnockoutPanel(comp) {
    var all = sortedMatches(comp);
    var semis = all.filter(function (m) {
      return isSemiStage(m.stageName);
    });
    var finals = all.filter(function (m) {
      return isFinalOnlyStage(m.stageName);
    });
    return (
      '<h4 style="margin:0 0 8px;color:#9a3412;">Semifinales y finales</h4>' +
      '<p style="margin:0 0 10px;color:#64748b;font-size:0.86rem;">Por ahora <strong>solo el sénior</strong> tiene semifinales. Alevín, Infantil y Cadete pasan de la liga a la final.</p>' +
      renderKnockoutBlock(
        comp,
        'Semifinales · sénior',
        '22 de agosto. 1ºA vs 2ºB y 1ºB vs 2ºA.',
        semis
      ) +
      renderKnockoutBlock(
        comp,
        'Finales · 23 de agosto',
        'Finales de Alevín, Infantil, Cadete y Sénior.',
        finals
      )
    );
  }

  function renderStandingsPanel(comp) {
    var cat = publicUi.category || 'all';
    var html = '<div style="display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px;">';
    html += categoryButtons('standings', cat);
    html += '</div>';
    if (cat === 'all' || cat === 'Sénior') html += renderSeniorGroups(comp);
    html += '<h4 style="margin:8px 0 8px;color:#0f766e;">Clasificación</h4>';
    if (cat === 'all') {
      html += renderStandings(comp);
    } else if (cat === 'Sénior') {
      html += renderStandingsTable('Sénior · Grupo A', standingsForCategory(comp, 'Sénior', 'A'));
      html += renderStandingsTable('Sénior · Grupo B', standingsForCategory(comp, 'Sénior', 'B'));
    } else {
      html += renderStandingsTable(cat, standingsForCategory(comp, cat)) ||
        '<p style="color:#64748b;margin:0;">Aún no hay resultados en esta categoría.</p>';
    }
    return html;
  }

  function renderPublic(comp) {
    var viewComp = officialPublicSnapshot(comp && comp.matches && comp.matches.length ? comp : findCompetition(readList()));
    var view = publicUi.view === 'standings' ? 'standings' : publicUi.view === 'knockout' ? 'knockout' : 'calendar';
    var html =
      '<div style="margin:0 0 16px;padding:16px;background:#f8fafc;border-radius:12px;border:1px solid #dbeafe;">' +
      '<h3 style="margin:0 0 4px;color:#1e3a8a;">🏆 ' +
      escapeHtml(viewComp.title || viewComp.name || 'Torneo Fútbol 7') +
      '</h3>' +
      '<p style="margin:0 0 8px;font-size:1rem;font-weight:900;letter-spacing:0.08em;color:#dc2626;">NUEVOS HORARIOS</p>' +
      '<p style="margin:0 0 8px;color:#b91c1c;font-size:0.9rem;font-weight:700;">Torneo 2: alevín 18:00 · infantil 18:00 y 18:45 · cadete 19:30. Torneo 1 sénior: 20:15, 21:00, 21:45 y 22:30. Campo El Pinar, 17–23 de agosto.</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px;position:sticky;top:0;z-index:2;background:#f8fafc;padding:8px 0;">' +
      tabBtn('calendar', 'Calendario', view === 'calendar') +
      tabBtn('standings', 'Clasificación', view === 'standings') +
      '</div>';
    if (view === 'standings') {
      html += '<div id="f7PublicStandings">' + renderStandingsPanel(viewComp) + '</div>';
    } else {
      html += '<div id="f7PublicCalendar">' + renderCalendarPanel(viewComp) + '</div>';
    }
    html += '</div>';
    return html;
  }

  function refreshPublicBoard() {
    var box = document.getElementById('torneoF7PublicBoard') || document.getElementById('competicionesPublicBoard');
    if (!box) return;
    var list = readList();
    var comp = getPublicCompetition(list);
    if (box.id === 'torneoF7PublicBoard') {
      box.innerHTML = renderPublic(comp);
    } else {
      box.innerHTML = '<h3>🏆 Competiciones del Club</h3>' + renderPublic(comp);
    }
  }

  function setPublicView(view, day, category) {
    if (view === 'standings' || view === 'calendar') publicUi.view = view;
    if (day) publicUi.day = day;
    if (category) publicUi.category = category;
    if (view === 'standings' && !category && (!publicUi.category || publicUi.category === 'all')) {
      publicUi.category = 'Alevín';
    }
    refreshPublicBoard();
  }

  function injectOverlayStyles() {
    if (!global.document || document.getElementById('f7PublicOverlayStyle')) return;
    var st = document.createElement('style');
    st.id = 'f7PublicOverlayStyle';
    st.textContent =
      'html.f7-public-open,body.f7-public-open{overflow:hidden;height:100%;}' +
      '#f7PublicOverlay.is-open{position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;min-height:-webkit-fill-available;z-index:2147483000;background:#f1f5f9;display:flex!important;flex-direction:column;-webkit-transform:translateZ(0);}' +
      '#f7PublicOverlay:not(.is-open){display:none!important;}' +
      '.f7-public-close{position:fixed;top:10px;right:10px;z-index:2147483001;width:46px;height:46px;border:none;border-radius:50%;background:#fff;color:#1e3a8a;font-size:1.75rem;line-height:1;cursor:pointer;}' +
      '.f7-public-sheet{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:56px 16px 28px;width:100%;max-width:720px;margin:0 auto;box-sizing:border-box;}';
    document.head.appendChild(st);
  }

  function closePublicBoard() {
    var el = document.getElementById('f7PublicOverlay');
    if (el) {
      el.hidden = true;
      el.setAttribute('hidden', '');
      el.classList.remove('is-open');
      el.style.setProperty('display', 'none', 'important');
    }
    if (global.document) {
      if (document.documentElement) document.documentElement.classList.remove('f7-public-open');
      if (document.body) document.body.classList.remove('f7-public-open');
    }
  }

  function openPublicBoard() {
    if (!global.document) return;
    injectOverlayStyles();
    var el = document.getElementById('f7PublicOverlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'f7PublicOverlay';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.setAttribute('aria-label', 'Calendario y clasificación Torneo Fútbol 7');
      el.innerHTML =
        '<button type="button" class="f7-public-close" aria-label="Cerrar">&times;</button>' +
        '<div class="f7-public-sheet"><div id="torneoF7PublicBoard"></div></div>';
      (document.documentElement || document.body).appendChild(el);
      var closeBtn = el.querySelector('.f7-public-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', closePublicBoard);
        closeBtn.addEventListener('touchend', function (e) {
          e.preventDefault();
          closePublicBoard();
        }, { passive: false });
      }
    } else if (el.parentNode !== document.documentElement && document.documentElement) {
      document.documentElement.appendChild(el);
    }
    el.hidden = false;
    el.removeAttribute('hidden');
    el.classList.add('is-open');
    el.style.setProperty('display', 'flex', 'important');
    el.style.position = 'fixed';
    el.style.top = '0';
    el.style.left = '0';
    el.style.right = '0';
    el.style.bottom = '0';
    el.style.width = '100%';
    el.style.height = '100%';
    el.style.zIndex = '2147483000';
    el.style.background = '#f1f5f9';
    if (document.documentElement) document.documentElement.classList.add('f7-public-open');
    if (document.body) document.body.classList.add('f7-public-open');
    refreshPublicBoard();
    setTimeout(function () {
      var board = document.getElementById('torneoF7PublicBoard');
      if (board && !board.innerHTML) refreshPublicBoard();
    }, 80);
  }

  if (global.document) {
    global.document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var overlay = document.getElementById('f7PublicOverlay');
      if (overlay && !overlay.hidden) closePublicBoard();
    });
  }

  if (global.document) {
    global.document.addEventListener('competitionsUpdated', function () {
      refreshPublicBoard();
      if (!hasAccess()) return;
      ensureInEngine().catch(function (err) {
        console.warn('Calendario oficial F7:', err);
      });
    });
  }

  global.TorneoF7CalendarioOficial = {
    COMP_ID: COMP_ID,
    VERSION: VERSION,
    find: findCompetition,
    getPublicCompetition: getPublicCompetition,
    applyOfficialCalendar: applyOfficialCalendar,
    ensureInEngine: ensureInEngine,
    loadFromButton: loadFromButton,
    renderPublic: renderPublic,
    setPublicView: setPublicView,
    refreshPublicBoard: refreshPublicBoard,
    openPublicBoard: openPublicBoard,
    closePublicBoard: closePublicBoard,
    hasOfficialFixtures: hasOfficialFixtures
  };
  global.loadTorneoF7CalendarioOficial = loadFromButton;
})(typeof window !== 'undefined' ? window : globalThis);
