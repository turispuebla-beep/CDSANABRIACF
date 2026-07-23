/**
 * Vista pública del torneo F7 para responsables: equipos (sin jugadores), calendario y resultados.
 */
(function (global) {
  'use strict';

  var TORNEO_NAME_HINT = /torneo\s*f[uú]tbol\s*7|f[uú]tbol\s*7\s*[-—]?\s*2026|torneo\s*f7/i;

  function escapeHtml(v) {
    return String(v || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function readCompetitions() {
    try {
      return JSON.parse(global.localStorage.getItem('clubCompetitions') || '[]');
    } catch (_) {
      return [];
    }
  }

  function findTorneoCompetition(list) {
    var comps = Array.isArray(list) ? list : [];
    var active = comps.filter(function (c) {
      return ['active', 'activo'].includes(String(c.status || '').toLowerCase());
    });
    var pool = active.length ? active : comps;
    for (var i = 0; i < pool.length; i++) {
      if (TORNEO_NAME_HINT.test(String(pool[i].name || ''))) return pool[i];
    }
    return pool[0] || null;
  }

  function publicTeam(team) {
    if (!team || typeof team !== 'object') return null;
    return {
      name: String(team.name || 'Equipo').trim(),
      category: String(team.category || '').trim(),
      crest: team.crest || team.logo || ''
    };
  }

  function sortMatches(matches) {
    return (matches || []).slice().sort(function (a, b) {
      var da = String(a.matchDate || '') + '|' + String(a.matchTime || '');
      var db = String(b.matchDate || '') + '|' + String(b.matchTime || '');
      return da.localeCompare(db);
    });
  }

  function matchScoreLine(m) {
    if (String(m.status || '') === 'completed') {
      return (m.homeScore != null ? m.homeScore : 0) + ' - ' + (m.awayScore != null ? m.awayScore : 0);
    }
    if (String(m.status || '') === 'postponed') return 'Aplazado';
    return 'Pendiente';
  }

  function formatDateEs(iso) {
    if (!iso) return '—';
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

  function renderTeamsSection(comp) {
    var teams = (Array.isArray(comp.teams) ? comp.teams : [])
      .map(publicTeam)
      .filter(function (t) {
        return t && t.name;
      });
    if (!teams.length) {
      return (
        '<p style="margin:0;color:#64748b;font-size:0.92rem;">Aún no hay equipos publicados en el cuadro del torneo.</p>'
      );
    }
    var byCat = {};
    teams.forEach(function (t) {
      var cat = t.category || 'General';
      if (!byCat[cat]) byCat[cat] = [];
      byCat[cat].push(t);
    });
    var html = '';
    Object.keys(byCat)
      .sort()
      .forEach(function (cat) {
        html +=
          '<h3 style="margin:16px 0 8px;font-size:0.95rem;color:#1e3a8a;">' +
          escapeHtml(cat) +
          '</h3><div style="display:flex;flex-wrap:wrap;gap:8px;">';
        byCat[cat].forEach(function (t) {
          html +=
            '<div style="display:flex;align-items:center;gap:6px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:999px;padding:6px 12px;font-size:0.88rem;">';
          if (t.crest) {
            html +=
              '<img src="' +
              escapeHtml(t.crest) +
              '" alt="" style="width:22px;height:22px;border-radius:50%;object-fit:cover;">';
          }
          html += escapeHtml(t.name) + '</div>';
        });
        html += '</div>';
      });
    html +=
      '<p style="margin:12px 0 0;font-size:0.8rem;color:#64748b;">Solo nombres de equipos. Los datos de jugadores/as no se publican aquí.</p>';
    return html;
  }

  function renderMatchCard(m) {
    return (
      '<div style="border:1px solid #dbeafe;border-radius:10px;background:#fff;padding:12px;margin:0 0 8px;">' +
      '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start;">' +
      '<strong style="color:#1e293b;">' +
      escapeHtml(m.homeTeamName || '—') +
      ' <span style="color:#94a3b8;font-weight:600;">vs</span> ' +
      escapeHtml(m.awayTeamName || '—') +
      '</strong>' +
      '<span style="color:#0f766e;font-weight:700;white-space:nowrap;">' +
      escapeHtml(matchScoreLine(m)) +
      '</span></div>' +
      '<div style="font-size:0.85rem;color:#64748b;margin-top:6px;">' +
      escapeHtml(formatDateEs(m.matchDate)) +
      (m.matchTime ? ' · ' + escapeHtml(m.matchTime) : '') +
      (m.field ? ' · ' + escapeHtml(m.field) : '') +
      (m.stageName ? ' · ' + escapeHtml(m.stageName) : '') +
      '</div></div>'
    );
  }

  function renderMatchesSection(comp) {
    var todayKey = new Date().toISOString().slice(0, 10);
    var all = sortMatches(comp.matches);
    var completed = all.filter(function (m) {
      return String(m.status || '') === 'completed';
    });
    var upcoming = all.filter(function (m) {
      return String(m.status || '') !== 'completed' && String(m.matchDate || '') >= todayKey;
    });
    var html = '';
    html += '<h3 style="margin:0 0 8px;font-size:0.95rem;color:#0f766e;">Próximos partidos</h3>';
    if (upcoming.length) {
      html += upcoming.slice(0, 20).map(renderMatchCard).join('');
    } else {
      html += '<p style="margin:0 0 16px;color:#64748b;font-size:0.9rem;">No hay partidos programados todavía.</p>';
    }
    html += '<h3 style="margin:16px 0 8px;font-size:0.95rem;color:#1d4ed8;">Resultados</h3>';
    if (completed.length) {
      html += completed
        .slice()
        .reverse()
        .slice(0, 30)
        .map(renderMatchCard)
        .join('');
    } else {
      html += '<p style="margin:0;color:#64748b;font-size:0.9rem;">Aún no hay resultados publicados.</p>';
    }
    return html;
  }

  function render(container, opts) {
    opts = opts || {};
    if (!container) return;
    var comp = opts.competition || findTorneoCompetition(readCompetitions());
    if (!comp) {
      container.innerHTML =
        '<div class="card" style="padding:18px;background:#fff;border-radius:12px;">' +
        '<p style="margin:0;color:#64748b;">El calendario del torneo se publicará aquí cuando el club active la competición.</p></div>';
      return;
    }
    var session = global.TorneoResponsableAccess && global.TorneoResponsableAccess.readSession();
    var welcome = session && session.panel && session.panel.contactName ? session.panel.contactName : '';
    container.innerHTML =
      '<div class="card" style="padding:18px;background:#fff;border-radius:12px;margin-bottom:14px;box-shadow:0 4px 14px rgba(0,0,0,.05);">' +
      (welcome
        ? '<p style="margin:0 0 10px;font-size:0.9rem;color:#64748b;">Hola, <strong>' +
          escapeHtml(welcome) +
          '</strong></p>'
        : '') +
      '<h2 style="margin:0 0 6px;color:#1e3a8a;font-size:1.2rem;">' +
      escapeHtml(comp.name || 'Torneo Fútbol 7') +
      '</h2>' +
      '<p style="margin:0;font-size:0.88rem;color:#64748b;">Equipos inscritos, calendario y resultados (sin datos de jugadores).</p></div>' +
      '<div class="card" style="padding:18px;background:#fff;border-radius:12px;margin-bottom:14px;box-shadow:0 4px 14px rgba(0,0,0,.05);">' +
      '<h2 style="margin:0 0 12px;color:#1e3a8a;font-size:1.05rem;">Equipos participantes</h2>' +
      renderTeamsSection(comp) +
      '</div>' +
      '<div class="card" style="padding:18px;background:#fff;border-radius:12px;box-shadow:0 4px 14px rgba(0,0,0,.05);">' +
      '<h2 style="margin:0 0 12px;color:#1e3a8a;font-size:1.05rem;">Calendario y resultados</h2>' +
      renderMatchesSection(comp) +
      '</div>';
  }

  global.TorneoPublicView = {
    readCompetitions: readCompetitions,
    findTorneoCompetition: findTorneoCompetition,
    render: render
  };
})(typeof window !== 'undefined' ? window : globalThis);
