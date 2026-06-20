/**
 * Panel admin — preinscripciones torneo (Firestore) + alta en competiciones.
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

  function parseResponsibleNumber(code) {
    const c = String(code || '')
      .trim()
      .toUpperCase();
    let m = /^TP-R(\d{3})$/.exec(c);
    if (m) return parseInt(m[1], 10);
    m = /^TP-R(\d{3})-/.exec(c);
    if (m) return parseInt(m[1], 10);
    return 0;
  }

  function formatResponsibleCode(num) {
    return 'TP-R' + String(num).padStart(3, '0');
  }

  async function ensureResponsibleCodes(rows) {
    if (!global.updateDocument) return rows;
    const active = rows.filter(isActivePreinscripcion);
    let maxR = 0;
    active.forEach(function (r) {
      maxR = Math.max(maxR, parseResponsibleNumber(r.responsibleCode));
      maxR = Math.max(maxR, parseResponsibleNumber(r.accessCode));
    });
    const byEmail = {};
    active.forEach(function (r) {
      const email = String(r.contactEmail || '')
        .trim()
        .toLowerCase();
      if (!email) return;
      if (!byEmail[email]) byEmail[email] = [];
      byEmail[email].push(r);
    });
    const out = rows.slice();
    const emails = Object.keys(byEmail);
    for (let e = 0; e < emails.length; e++) {
      const group = byEmail[emails[e]];
      if (group.some(function (r) { return r.responsibleCode; })) continue;
      const rc = formatResponsibleCode(++maxR);
      for (let i = 0; i < group.length; i++) {
        const row = group[i];
        if (!row.id) continue;
        try {
          await global.updateDocument('torneo_preinscripciones', row.id, {
            responsibleCode: rc,
            updatedAt: new Date().toISOString()
          });
          for (let j = 0; j < out.length; j++) {
            if (out[j].id === row.id) {
              out[j] = Object.assign({}, out[j], { responsibleCode: rc });
            }
          }
        } catch (err) {
          console.warn('[AdminTorneoPreinscripciones] responsibleCode:', err);
        }
      }
    }
    return out;
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
        listId: 'torneoPreinscripcionesCompList',
        countId: 'torneoPreinscripcionesCompCount'
      }
    ].filter(function (t) {
      return global.document && global.document.getElementById(t.listId);
    });
  }

  function normalizeTeamName(name) {
    return String(name || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  function getCategoryKeys(row) {
    const ids = Array.isArray(row.categories) ? row.categories : [];
    return ids
      .map(function (c) {
        return String(c || '').trim().toLowerCase();
      })
      .filter(Boolean)
      .sort();
  }

  function isActivePreinscripcion(row) {
    const st = String(row.status || 'preinscripcion_enviada').trim().toLowerCase();
    return st !== 'descartada' && st !== 'eliminada' && st !== 'cancelada';
  }

  /** Mismo nombre (sin distinguir mayúsculas) + mismo email responsable + misma categoría. */
  function buildDuplicateMap(rows) {
    const active = rows.filter(isActivePreinscripcion);
    const map = {};
    active.forEach(function (r) {
      const nameKey = normalizeTeamName(r.teamName);
      const email = String(r.contactEmail || '')
        .trim()
        .toLowerCase();
      const cats = getCategoryKeys(r);
      if (!nameKey || !email || !cats.length) return;
      cats.forEach(function (cat) {
        const groupKey = nameKey + '::' + email + '::' + cat;
        if (!map[groupKey]) map[groupKey] = [];
        map[groupKey].push(r);
      });
    });
    const dupById = {};
    Object.keys(map).forEach(function (groupKey) {
      const group = map[groupKey];
      if (group.length < 2) return;
      group.forEach(function (r) {
        const rowId = String(r.id || r.localId || '');
        if (!dupById[rowId]) dupById[rowId] = { rows: [], codes: [] };
        group.forEach(function (other) {
          const otherId = String(other.id || other.localId || '');
          if (otherId === rowId) return;
          if (
            !dupById[rowId].rows.some(function (x) {
              return String(x.id || x.localId) === otherId;
            })
          ) {
            dupById[rowId].rows.push(other);
            if (other.accessCode) dupById[rowId].codes.push(String(other.accessCode));
          }
        });
      });
    });
    return dupById;
  }

  function buildTeamGroups(rows) {
    const active = rows.filter(isActivePreinscripcion);
    const groups = {};
    active.forEach(function (r) {
      const email = String(r.contactEmail || '')
        .trim()
        .toLowerCase();
      const rc = r.responsibleCode || 'legacy-' + email;
      const key = rc + '::' + email;
      if (!groups[key]) {
        groups[key] = {
          responsibleCode: r.responsibleCode || '',
          teamName: r.teamName,
          email: email,
          contactName: r.contactName || '',
          contactPhone: r.contactPhone || '',
          entries: []
        };
      }
      groups[key].entries.push(r);
    });
    return Object.values(groups).sort(function (a, b) {
      const ta = Math.max.apply(
        null,
        a.entries.map(function (e) {
          return new Date(e.createdAt || 0).getTime();
        })
      );
      const tb = Math.max.apply(
        null,
        b.entries.map(function (e) {
          return new Date(e.createdAt || 0).getTime();
        })
      );
      return tb - ta;
    });
  }

  function renderDocumentsHtml(documents) {
    const docs = Array.isArray(documents) ? documents : [];
    if (!docs.length) {
      return '<p style="color:#94a3b8;font-size:0.85rem;margin:4px 0;">Sin documentos subidos.</p>';
    }
    return docs
      .map(function (doc) {
        const mime = String(doc.mimeType || '').toLowerCase();
        const label = escapeHtml(doc.label || doc.fileName || 'Documento');
        const b64 = String(doc.contentBase64 || '').replace(/^data:[^;]+;base64,/, '');
        if (!b64) return '<p style="margin:4px 0;">' + label + ' (sin contenido)</p>';
        const url = 'data:' + (doc.mimeType || 'application/octet-stream') + ';base64,' + b64;
        if (mime.indexOf('image/') === 0) {
          return (
            '<div style="margin:8px 0 12px;">' +
            '<p style="margin:0 0 6px;font-weight:600;font-size:0.88rem;">' +
            label +
            '</p>' +
            '<img src="' +
            url +
            '" alt="' +
            label +
            '" style="max-width:100%;max-height:200px;border:1px solid #e2e8f0;border-radius:8px;">' +
            '</div>'
          );
        }
        const fname = escapeHtml(doc.fileName || 'documento.pdf');
        return (
          '<p style="margin:6px 0;">📎 <strong>' +
          label +
          '</strong> — <a href="' +
          url +
          '" download="' +
          fname +
          '" target="_blank" rel="noopener">Ver / descargar PDF</a></p>'
        );
      })
      .join('');
  }

  function fichasDocsPendingCount(row) {
    const fichas = Array.isArray(row.fichas) ? row.fichas : [];
    return fichas.filter(function (f) {
      return (
        String(f.status || '') === 'enviada' &&
        f.documentsPending !== false &&
        !(f.data && f.data.documents && f.data.documents.length)
      );
    }).length;
  }

  function fichaFieldsHtml(data) {
    const d = data && typeof data === 'object' ? data : {};
    const rows = [
      ['Nombre', [d.name, d.surname].filter(Boolean).join(' ')],
      ['Documento', d.dni],
      ['Tipo documento', d.dniType === 'extranjero' ? 'Extranjero' : 'DNI español'],
      ['Fecha nacimiento', d.birthDate],
      ['Edad', d.age != null ? d.age + ' años' : '—'],
      ['Email', d.email],
      ['Teléfono', d.phone]
    ];
    if (d.isMinor) {
      rows.push(
        ['Tutor/a', [d.guardianName, d.guardianSurname].filter(Boolean).join(' ')],
        ['Doc. tutor/a', d.guardianDni],
        ['Tel. tutor/a', d.guardianPhone],
        ['Email tutor/a', d.guardianEmail]
      );
    }
    rows.push(
      ['Consentimiento imagen', d.photoConsent ? 'Sí' : 'No'],
      ['Normas aceptadas', d.clubRulesAccepted ? 'Sí' : 'No']
    );
    return (
      '<table style="width:100%;border-collapse:collapse;font-size:0.88rem;margin:8px 0;">' +
      rows
        .map(function (r) {
          return (
            '<tr><td style="padding:4px 8px 4px 0;color:#64748b;white-space:nowrap;vertical-align:top;"><strong>' +
            escapeHtml(r[0]) +
            '</strong></td><td style="padding:4px 0;">' +
            escapeHtml(r[1] || '—') +
            '</td></tr>'
          );
        })
        .join('') +
      '</table>'
    );
  }

  function ensureDetailModal() {
    let modal = global.document.getElementById('torneoPreinscripcionDetailModal');
    if (modal) return modal;
    modal = global.document.createElement('div');
    modal.id = 'torneoPreinscripcionDetailModal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.style.cssText =
      'display:none;position:fixed;inset:0;z-index:10050;background:rgba(15,23,42,0.55);padding:16px;overflow:auto;';
    modal.innerHTML =
      '<div style="max-width:720px;margin:24px auto;background:#fff;border-radius:14px;padding:20px 22px;box-shadow:0 20px 50px rgba(0,0,0,.2);">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px;">' +
      '<h2 id="tpDetailTitle" style="margin:0;color:#1e3a8a;font-size:1.15rem;">Detalle inscripción</h2>' +
      '<button type="button" id="tpDetailCloseBtn" style="border:none;background:#f1f5f9;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:1.1rem;line-height:1;">×</button>' +
      '</div>' +
      '<div id="tpDetailBody" style="max-height:70vh;overflow:auto;font-size:0.9rem;line-height:1.45;"></div>' +
      '</div>';
    global.document.body.appendChild(modal);
    modal.addEventListener('click', function (ev) {
      if (ev.target === modal) closeTorneoPreinscripcionDetail();
    });
    modal.querySelector('#tpDetailCloseBtn').addEventListener('click', closeTorneoPreinscripcionDetail);
    return modal;
  }

  function closeTorneoPreinscripcionDetail() {
    const modal = global.document.getElementById('torneoPreinscripcionDetailModal');
    if (modal) modal.style.display = 'none';
  }

  function showTorneoPreinscripcionDetail(preinscripcionId) {
    const rows = global.__torneoPreinscripcionesCache || [];
    const row = rows.find(function (r) {
      return String(r.id) === String(preinscripcionId) || String(r.localId) === String(preinscripcionId);
    });
    if (!row) {
      alert('Preinscripción no encontrada. Pulsa «Actualizar listado».');
      return;
    }

    const modal = ensureDetailModal();
    global.document.getElementById('tpDetailTitle').textContent =
      'Inscripción — ' + (row.teamName || 'Equipo');
    global.document.getElementById('tpDetailBody').innerHTML =
      '<p style="color:#64748b;margin:0;">Cargando datos y documentos…</p>';
    modal.style.display = 'block';

    const render = function (docsByOwner) {
      docsByOwner = docsByOwner || {};
      const coach = row.coach && typeof row.coach === 'object' ? row.coach : {};
      const coachDocs = docsByOwner.coach || coach.documents || [];
      const fichas = Array.isArray(row.fichas) ? row.fichas : [];
      const cats = Array.isArray(row.categoryLabels)
        ? row.categoryLabels.join(', ')
        : Array.isArray(row.categories)
          ? row.categories.join(', ')
          : '—';

      let html =
        '<p style="margin:0 0 12px;color:#64748b;font-size:0.85rem;line-height:1.45;">El club puede solicitar documentación acreditativa de edad (DNI por ambas caras u otro documento válido) y su presentación física en cualquier momento, aunque ya se hubiera enviado por la web.</p>' +
        '<table style="width:100%;border-collapse:collapse;font-size:0.88rem;margin:0 0 16px;">' +
        '<tr><td style="padding:4px 8px 4px 0;color:#64748b;"><strong>Equipo</strong></td><td>' +
        escapeHtml(row.teamName) +
        '</td></tr>' +
        '<tr><td style="padding:4px 8px 4px 0;color:#64748b;"><strong>Cód. responsable</strong></td><td>' +
        escapeHtml(row.responsibleCode || '—') +
        '</td></tr>' +
        '<tr><td style="padding:4px 8px 4px 0;color:#64748b;"><strong>Cód. equipo</strong></td><td>' +
        escapeHtml(row.accessCode || '—') +
        '</td></tr>' +
        '<tr><td style="padding:4px 8px 4px 0;color:#64748b;"><strong>Categoría</strong></td><td>' +
        escapeHtml(cats) +
        '</td></tr>' +
        '<tr><td style="padding:4px 8px 4px 0;color:#64748b;"><strong>Responsable</strong></td><td>' +
        escapeHtml(row.contactName) +
        ' · <a href="mailto:' +
        escapeHtml(row.contactEmail) +
        '">' +
        escapeHtml(row.contactEmail) +
        '</a></td></tr>' +
        '<tr><td style="padding:4px 8px 4px 0;color:#64748b;"><strong>Teléfono</strong></td><td>' +
        escapeHtml(row.contactPhone || '—') +
        '</td></tr>' +
        '<tr><td style="padding:4px 8px 4px 0;color:#64748b;"><strong>Plantilla</strong></td><td>' +
        escapeHtml(row.plantillaStatus || 'pendiente') +
        '</td></tr>' +
        '<tr><td style="padding:4px 8px 4px 0;color:#64748b;"><strong>Pago</strong></td><td>' +
        escapeHtml(row.paymentStatus || row.paymentMethod || '—') +
        (row.offlinePaymentChannel ? ' · ' + escapeHtml(row.offlinePaymentChannel) : '') +
        '</td></tr>' +
        '<tr><td style="padding:4px 8px 4px 0;color:#64748b;"><strong>Premios (preinscr.)</strong></td><td>' +
        (row.premiosAceptados
          ? '✅ Aceptado' + (row.premiosAceptadosAt ? ' · ' + escapeHtml(formatDate(row.premiosAceptadosAt)) : '')
          : '—') +
        '</td></tr>' +
        '<tr><td style="padding:4px 8px 4px 0;color:#64748b;"><strong>Premios (inscr.)</strong></td><td>' +
        (row.inscripcionPremiosAceptados
          ? '✅ Aceptado' +
            (row.inscripcionPremiosAceptadosAt
              ? ' · ' + escapeHtml(formatDate(row.inscripcionPremiosAceptadosAt))
              : '')
          : '—') +
        '</td></tr></table>';

      html +=
        '<h3 style="color:#1e3a8a;margin:16px 0 8px;font-size:1rem;border-bottom:1px solid #e2e8f0;padding-bottom:6px;">Responsable técnico en el campo (solo torneo)</h3>';
      if (coach.name || coach.surname) {
        html +=
          '<p style="margin:0 0 8px;"><strong>' +
          escapeHtml([coach.name, coach.surname].filter(Boolean).join(' ')) +
          '</strong> · ' +
          escapeHtml(coach.dni || '—') +
          ' · ' +
          escapeHtml(coach.phone || '—') +
          '</p>';
        html += renderDocumentsHtml(coachDocs);
      } else {
        html += '<p style="color:#94a3b8;">Sin datos del responsable técnico.</p>';
      }

      html +=
        '<h3 style="color:#1e3a8a;margin:20px 0 8px;font-size:1rem;border-bottom:1px solid #e2e8f0;padding-bottom:6px;">Participantes del torneo (' +
        fichas.length +
        ')</h3>';
      if (!fichas.length) {
        html += '<p style="color:#94a3b8;">Sin invitaciones todavía.</p>';
      } else {
        fichas.forEach(function (f, i) {
          const done = String(f.status || '') === 'enviada';
          const docsPending =
            done &&
            f.documentsPending !== false &&
            !(f.data && f.data.documents && f.data.documents.length);
          const fichaDocs = (f.id && docsByOwner[f.id]) || (f.data && f.data.documents) || [];
          html +=
            '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin:0 0 12px;">' +
            '<p style="margin:0 0 8px;font-weight:700;">' +
            (i + 1) +
            '. ' +
            escapeHtml(f.label || f.inviteEmail || 'Jugador/a') +
            ' <span style="font-weight:600;color:' +
            (done ? '#059669' : '#b45309') +
            ';">' +
            (done ? '✅ Datos' : '⏳ Pendiente') +
            '</span>' +
            (docsPending
              ? ' <span style="font-weight:600;color:#c2410c;font-size:0.82rem;">· DNI pendiente</span>'
              : done
                ? ' <span style="font-weight:600;color:#059669;font-size:0.82rem;">· DNI OK</span>'
                : '') +
            (f.source === 'batch_responsable'
              ? ' <span style="font-size:0.78rem;color:#64748b;">(plantilla conjunta)</span>'
              : '') +
            '</p>';
          if (done && f.data) {
            html += fichaFieldsHtml(f.data);
            html += renderDocumentsHtml(fichaDocs);
          } else if (f.inviteEmail) {
            html +=
              '<p style="margin:0;color:#64748b;font-size:0.85rem;">Invitación: ' +
              escapeHtml(f.inviteEmail) +
              '</p>';
          }
          html += '</div>';
        });
      }

      global.document.getElementById('tpDetailBody').innerHTML = html;
    };

    if (global.getDocuments && row.id) {
      global
        .getDocuments('torneo_documents', [{ field: 'preinscripcionId', operator: '==', value: row.id }])
        .then(function (docs) {
          const byOwner = {};
          (docs || []).forEach(function (d) {
            const key = String(d.ownerKey || '');
            if (!byOwner[key]) byOwner[key] = [];
            byOwner[key].push(d);
          });
          render(byOwner);
        })
        .catch(function () {
          render({});
        });
    } else {
      render({});
    }
  }

  function rowActionsHtml(r, rowId, duplicateInfo) {
    const safeId = escapeHtml(String(rowId)).replace(/'/g, "\\'");
    const parts = [];
    parts.push(
      '<button type="button" class="btn" style="padding:4px 8px;font-size:0.78rem;background:#475569;color:#fff;border:none;border-radius:4px;cursor:pointer;margin:0 0 4px 0;display:block;width:100%;" onclick="showTorneoPreinscripcionDetail(\'' +
        safeId +
        '\')">👁️ Ver detalle</button>'
    );
    parts.push(
      '<button type="button" class="btn" style="padding:4px 8px;font-size:0.78rem;background:#b45309;color:#fff;border:none;border-radius:4px;cursor:pointer;margin:0 0 4px 0;display:block;width:100%;" onclick="discardTorneoPreinscripcion(\'' +
        safeId +
        '\', \'duplicado\')">🗑️ Eliminar (duplicado)</button>'
    );
    parts.push(
      '<button type="button" class="btn" style="padding:4px 8px;font-size:0.78rem;background:#dc2626;color:#fff;border:none;border-radius:4px;cursor:pointer;display:block;width:100%;" onclick="discardTorneoPreinscripcion(\'' +
        safeId +
        '\', \'no_juega\')">🗑️ Eliminar (no juega)</button>'
    );
    return parts.join('');
  }

  function renderRows(rows) {
    const targets = listTargets();
    if (!targets.length) return;

    const activeRows = rows.filter(isActivePreinscripcion);
    const duplicateMap = buildDuplicateMap(rows);
    const duplicateCount = Object.keys(duplicateMap).length;
    const teamGroups = buildTeamGroups(rows);

    const introNote =
      '<p style="margin:0 0 10px;padding:10px 12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:0.88rem;color:#166534;line-height:1.5;">' +
      '<strong>Puente con Competiciones.</strong> Podéis importar inscritos como equipos invitados y enviar recordatorio de plantilla + pago al responsable.</p>' +
      '<p style="margin:0 0 10px;padding:10px 12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;font-size:0.88rem;color:#991b1b;line-height:1.5;">' +
      '<strong>Datos del torneo F7.</strong> No se mezclan con jugadores/entrenadores del club hasta que los importéis abajo.</p>' +
      '<p style="margin:0 0 12px;font-size:0.88rem;color:#475569;line-height:1.5;">' +
      '<strong>Código responsable</strong> (TP-R001): personal, todos sus equipos. ' +
      '<strong>Código equipo</strong> (TP-R001-INF…): una inscripción/categoría.</p>' +
      '<p style="margin:0 0 12px;display:flex;flex-wrap:wrap;gap:8px;">' +
      '<button type="button" class="btn btn-success" style="padding:6px 12px;font-size:0.85rem;" onclick="openImportTorneoModal()">📥 Importar inscritos a competición</button>' +
      '</p>' +
      (duplicateCount
        ? '<p style="margin:0 0 12px;padding:10px 12px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;font-size:0.88rem;color:#92400e;">' +
          '⚠️ Hay <strong>' +
          String(duplicateCount) +
          '</strong> fila(s) con posible <strong>envío duplicado</strong> (mismo equipo, mismo email y misma categoría). ' +
          'Conservad un código y eliminad el resto.</p>'
        : '');

    const tableHtml =
      !activeRows.length
        ? introNote + '<p style="color:#64748b;margin:0;">No hay preinscripciones activas en Firestore.</p>'
        : introNote +
          '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:0.9rem;">' +
          '<thead><tr style="background:#eff6ff;text-align:left;">' +
          '<th style="padding:8px;border-bottom:1px solid #bfdbfe;">Fecha</th>' +
          '<th style="padding:8px;border-bottom:1px solid #bfdbfe;">Responsable / contacto</th>' +
          '<th style="padding:8px;border-bottom:1px solid #bfdbfe;">TP-R</th>' +
          '<th style="padding:8px;border-bottom:1px solid #bfdbfe;">Equipo</th>' +
          '<th style="padding:8px;border-bottom:1px solid #bfdbfe;">Categoría</th>' +
          '<th style="padding:8px;border-bottom:1px solid #bfdbfe;">Población</th>' +
          '<th style="padding:8px;border-bottom:1px solid #bfdbfe;">Tel.</th>' +
          '<th style="padding:8px;border-bottom:1px solid #bfdbfe;">Jug.</th>' +
          '<th style="padding:8px;border-bottom:1px solid #bfdbfe;">Plantilla</th>' +
          '<th style="padding:8px;border-bottom:1px solid #bfdbfe;">Acciones</th>' +
          '</tr></thead><tbody>' +
          teamGroups
            .map(function (group) {
              const multi = group.entries.length > 1;
              const header =
                '<tr style="background:#f1f5f9;">' +
                '<td colspan="10" style="padding:10px 8px;border-bottom:1px solid #e2e8f0;">' +
                '<strong style="color:#1e3a8a;font-size:0.95rem;">' +
                (group.responsibleCode
                  ? 'Responsable <span style="font-family:ui-monospace,monospace;">' +
                    escapeHtml(group.responsibleCode) +
                    '</span> · '
                  : '') +
                escapeHtml(group.contactName || group.teamName || 'Equipo') +
                '</strong>' +
                (multi
                  ? ' <span style="font-size:0.78rem;color:#475569;">(' +
                    group.entries.length +
                    ' equipos/categorías)</span>'
                  : '') +
                '<br><span style="font-size:0.82rem;color:#64748b;">Responsable: ' +
                escapeHtml(group.contactName) +
                ' · <a href="mailto:' +
                escapeHtml(group.email) +
                '">' +
                escapeHtml(group.email) +
                '</a></span>' +
                '<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;">' +
                '<button type="button" style="padding:5px 10px;font-size:0.78rem;background:#1e3a8a;color:#fff;border:none;border-radius:6px;cursor:pointer;" onclick="sendTorneoPlantillaReminder(\'' +
                escapeHtml(group.email).replace(/'/g, "\\'") +
                '\', \'' +
                escapeHtml(group.responsibleCode || '').replace(/'/g, "\\'") +
                '\')">📧 Recordatorio plantilla</button>' +
                '<button type="button" style="padding:5px 10px;font-size:0.78rem;background:#475569;color:#fff;border:none;border-radius:6px;cursor:pointer;" onclick="copyTorneoPanelLink(\'' +
                escapeHtml(group.email).replace(/'/g, "\\'") +
                '\', \'' +
                escapeHtml(group.responsibleCode || '').replace(/'/g, "\\'") +
                '\')">🔗 Copiar enlace panel</button>' +
                '<button type="button" style="padding:5px 10px;font-size:0.78rem;background:#059669;color:#fff;border:none;border-radius:6px;cursor:pointer;" onclick="openImportTorneoModal({contactEmail:\'' +
                escapeHtml(group.email).replace(/'/g, "\\'") +
                '\',responsibleCode:\'' +
                escapeHtml(group.responsibleCode || '').replace(/'/g, "\\'") +
                '\'})">📥 Importar a competición</button>' +
                '</div>' +
                '</td></tr>';

              const entryRows = group.entries
                .slice()
                .sort(function (a, b) {
                  return String(a.accessCode || '').localeCompare(String(b.accessCode || ''), 'es');
                })
                .map(function (r) {
                  const rowId = r.id || r.localId || '';
                  const dup = duplicateMap[String(rowId)];
                  const cats = Array.isArray(r.categoryLabels)
                    ? r.categoryLabels.join(', ')
                    : Array.isArray(r.categories)
                      ? r.categories.join(', ')
                      : String(r.categories || '—');
                  const accessCode = r.accessCode ? String(r.accessCode) : '';
                  const respCode = r.responsibleCode ? String(r.responsibleCode) : group.responsibleCode || '';
                  const rowStyle = 'border-bottom:1px solid #e2e8f0;' + (dup ? 'background:#fffbeb;' : '');
                  return (
                    '<tr style="' +
                    rowStyle +
                    '">' +
                    '<td style="padding:8px;white-space:nowrap;">' +
                    escapeHtml(formatDate(r.createdAt)) +
                    '</td>' +
                    '<td style="padding:8px;font-size:0.82rem;color:#64748b;">' +
                    escapeHtml(r.teamName || '—') +
                    (dup
                      ? '<br><span style="color:#b45309;font-weight:600;">⚠️ Posible duplicado</span>'
                      : '') +
                    '</td>' +
                    '<td style="padding:8px;font-family:ui-monospace,monospace;font-size:0.82rem;">' +
                    (respCode ? escapeHtml(respCode) : '<span style="color:#94a3b8;">—</span>') +
                    '</td>' +
                    '<td style="padding:8px;font-family:ui-monospace,monospace;font-size:0.82rem;">' +
                    (accessCode
                      ? '<strong>' + escapeHtml(accessCode) + '</strong>'
                      : '<span style="color:#94a3b8;">—</span>') +
                    '</td>' +
                    '<td style="padding:8px;">' +
                    escapeHtml(cats) +
                    '</td>' +
                    '<td style="padding:8px;">' +
                    escapeHtml(r.town || '—') +
                    '</td>' +
                    '<td style="padding:8px;">' +
                    escapeHtml(r.contactPhone || group.contactPhone) +
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
                        ' fichas</span>' +
                        (fichasDocsPendingCount(r) > 0
                          ? '<br><span style="color:#c2410c;">DNI pend.: ' +
                            fichasDocsPendingCount(r) +
                            '</span>'
                          : '')
                      : '') +
                    '</td>' +
                    '<td style="padding:8px;white-space:nowrap;min-width:148px;">' +
                    rowActionsHtml(r, rowId, dup) +
                    '</td>' +
                    '</tr>'
                  );
                })
                .join('');

              return header + entryRows;
            })
            .join('') +
          '</tbody></table></div>';

    targets.forEach(function (t) {
      const listEl = global.document.getElementById(t.listId);
      const countEl = global.document.getElementById(t.countId);
      if (countEl) countEl.textContent = String(activeRows.length);
      if (listEl) listEl.innerHTML = tableHtml;
    });
  }

  async function discardTorneoPreinscripcion(preinscripcionId, reason) {
    const rows = global.__torneoPreinscripcionesCache || [];
    const row = rows.find(function (r) {
      return String(r.id) === String(preinscripcionId) || String(r.localId) === String(preinscripcionId);
    });
    if (!row) {
      alert('❌ Preinscripción no encontrada. Pulsa «Actualizar listado».');
      return;
    }

    const code = row.accessCode ? String(row.accessCode) : '(sin código)';
    const reasonLabel =
      reason === 'duplicado'
        ? 'envío duplicado (mismo nombre y categoría)'
        : reason === 'no_juega'
          ? 'el equipo no va a jugar'
          : String(reason || 'descartada');

    const msg =
      '¿Eliminar esta preinscripción?\n\n' +
      'Equipo: ' +
      (row.teamName || '—') +
      '\nCódigo: ' +
      code +
      '\nMotivo: ' +
      reasonLabel +
      '\n\nEl código dejará de ser válido. Esta acción no se puede deshacer.';

    if (!global.confirm(msg)) return;

    if (typeof global.deleteDocument !== 'function') {
      alert('❌ No se puede eliminar: Firebase no disponible.');
      return;
    }

    try {
      await global.deleteDocument('torneo_preinscripciones', row.id, 'admin');
    } catch (err) {
      alert('❌ Error al eliminar: ' + (err && err.message ? err.message : String(err)));
      return;
    }

    global.__torneoPreinscripcionesCache = rows.filter(function (r) {
      return String(r.id) !== String(row.id);
    });
    renderRows(global.__torneoPreinscripcionesCache);
    alert('✅ Preinscripción eliminada.\nCódigo ' + code + ' ya no es válido.');
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
      const withResponsible = await ensureResponsibleCodes(Array.isArray(rows) ? rows : []);
      const withCodes = await ensureAccessCodes(withResponsible);
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
  global.discardTorneoPreinscripcion = discardTorneoPreinscripcion;
  global.showTorneoPreinscripcionDetail = showTorneoPreinscripcionDetail;
  global.closeTorneoPreinscripcionDetail = closeTorneoPreinscripcionDetail;
})(typeof window !== 'undefined' ? window : globalThis);
