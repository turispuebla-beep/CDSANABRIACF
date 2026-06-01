/**
 * Panel admin — listado de preinscripciones torneo (Firestore).
 */
(function (global) {
  'use strict';

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

  function renderRows(rows) {
    const listEl = global.document && global.document.getElementById('torneoPreinscripcionesAdminList');
    const countEl = global.document && global.document.getElementById('torneoPreinscripcionesAdminCount');
    if (countEl) countEl.textContent = String(rows.length);
    if (!listEl) return;

    if (!rows.length) {
      listEl.innerHTML =
        '<p style="color:#64748b;margin:0;">No hay preinscripciones en Firestore todavía. Las nuevas entradas aparecen al enviar el formulario público (mailto + copia en nube).</p>';
      return;
    }

    const sorted = rows.slice().sort(function (a, b) {
      const ta = new Date(a.createdAt || 0).getTime();
      const tb = new Date(b.createdAt || 0).getTime();
      return tb - ta;
    });

    listEl.innerHTML =
      '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:0.9rem;">' +
      '<thead><tr style="background:#eff6ff;text-align:left;">' +
      '<th style="padding:8px;border-bottom:1px solid #bfdbfe;">Fecha</th>' +
      '<th style="padding:8px;border-bottom:1px solid #bfdbfe;">Equipo</th>' +
      '<th style="padding:8px;border-bottom:1px solid #bfdbfe;">Categorías</th>' +
      '<th style="padding:8px;border-bottom:1px solid #bfdbfe;">Contacto</th>' +
      '<th style="padding:8px;border-bottom:1px solid #bfdbfe;">Tel.</th>' +
      '<th style="padding:8px;border-bottom:1px solid #bfdbfe;">Jug.</th>' +
      '</tr></thead><tbody>' +
      sorted
        .map(function (r) {
          const cats = Array.isArray(r.categories) ? r.categories.join(', ') : String(r.categories || '—');
          return (
            '<tr style="border-bottom:1px solid #e2e8f0;">' +
            '<td style="padding:8px;white-space:nowrap;">' +
            escapeHtml(formatDate(r.createdAt)) +
            '</td>' +
            '<td style="padding:8px;"><strong>' +
            escapeHtml(r.teamName) +
            '</strong><br><span style="color:#64748b;font-size:0.82rem;">' +
            escapeHtml(r.town || '') +
            '</span></td>' +
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
            '</tr>'
          );
        })
        .join('') +
      '</tbody></table></div>';
  }

  async function loadTorneoPreinscripcionesAdmin() {
    const listEl = global.document && global.document.getElementById('torneoPreinscripcionesAdminList');
    if (listEl) {
      listEl.innerHTML = '<p style="color:#64748b;margin:0;">Cargando preinscripciones…</p>';
    }
    try {
      if (!global.getDocuments) {
        renderRows([]);
        return;
      }
      const rows = await global.getDocuments('torneo_preinscripciones');
      renderRows(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.warn('[AdminTorneoPreinscripciones]', err);
      if (listEl) {
        listEl.innerHTML =
          '<p style="color:#b91c1c;margin:0;">Error al cargar: ' + escapeHtml(err.message || err) + '</p>';
      }
    }
  }

  global.loadTorneoPreinscripcionesAdmin = loadTorneoPreinscripcionesAdmin;
})(typeof window !== 'undefined' ? window : globalThis);
