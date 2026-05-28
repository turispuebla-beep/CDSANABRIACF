/**
 * Panel admin — solicitudes «Nuevo jugador»
 */
(function (global) {
  'use strict';

  function readApplications() {
    if (global.PlayerApplication && global.PlayerApplication.readApplications) {
      return global.PlayerApplication.readApplications();
    }
    try {
      return JSON.parse(global.localStorage.getItem('clubPlayerApplications') || '[]');
    } catch (_) {
      return [];
    }
  }

  function writeApplications(list) {
    global.localStorage.setItem('clubPlayerApplications', JSON.stringify(list || []));
    if (global.PlayerApplication && global.PlayerApplication.writeApplications) {
      global.PlayerApplication.writeApplications(list);
    }
  }

  function statusLabel(st) {
    const s = String(st || '');
    if (s === 'approved') return { text: 'Aprobada', color: '#059669' };
    if (s === 'rejected') return { text: 'Rechazada', color: '#dc2626' };
    return { text: 'Pendiente revisión', color: '#d97706' };
  }

  async function approveApplication(applicationId) {
    const apps = readApplications();
    const ix = apps.findIndex(function (a) {
      return a.id === applicationId;
    });
    if (ix < 0) throw new Error('Solicitud no encontrada');

    const app = apps[ix];
    const season = app.season;
    const now = new Date().toISOString();
    const adminUser = global.currentUser?.email || global.currentUser?.nombre || 'admin';

    let players = [];
    try {
      players = JSON.parse(global.localStorage.getItem('clubPlayers') || '[]');
    } catch (_) {}

    const dni = global.PlayerInscription
      ? global.PlayerInscription.normalizeDni(app.dni)
      : String(app.dni || '').toUpperCase();

    let player = players.find(function (p) {
      return (
        global.PlayerInscription.normalizeDni(p.dni) === dni &&
        String(p.inscriptionSeason || '') === String(season)
      );
    });

    const playerPatch = {
      name: app.name,
      nombre: app.name,
      surname: app.surname,
      apellidos: app.surname,
      dni: dni,
      email: String(app.email || '').toLowerCase(),
      phone: app.phone,
      telefono: app.phone,
      address: app.address || '',
      direccion: app.address || '',
      birthDate: app.birthDate,
      fechaNacimiento: app.birthDate,
      category: app.category || '',
      categoria: app.category || '',
      guardianName: app.guardianName || '',
      guardianDNI: app.guardianDni || '',
      guardianPhone: app.guardianPhone || '',
      guardianEmail: app.guardianEmail || '',
      guardianAddress: app.guardianAddress || '',
      inscriptionSeason: season,
      temporada: season,
      inscriptionStatus: 'approved_for_inscription',
      status: 'pending_validation',
      estado: 'pendiente',
      paymentStatus: 'pending',
      inscriptionPaid: false,
      registrationSource: 'player_application',
      applicationId: app.id,
      playerConsent: true,
      photoConsent: true,
      approvedAt: now,
      approvedBy: adminUser,
      updatedAt: now,
      appScope: 'cdsanabriacf'
    };

    if (player) {
      Object.assign(player, playerPatch);
    } else {
      player = {
        id: 'PLAYER_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9),
        ...playerPatch,
        registrationDate: now
      };
      players.push(player);
    }

    global.localStorage.setItem('clubPlayers', JSON.stringify(players));
    if (typeof global.persistRecordToFirebase === 'function') {
      await global.persistRecordToFirebase('clubPlayers', 'players', player);
    } else if (typeof global.updateDocument === 'function') {
      if (String(player.id).startsWith('PLAYER_')) {
        const newId = await global.createDocument('players', player);
        if (newId) player.id = newId;
      } else {
        await global.updateDocument('players', player.id, player);
      }
    }

    apps[ix] = {
      ...app,
      status: 'approved',
      playerId: player.id,
      reviewedAt: now,
      reviewedBy: adminUser,
      updatedAt: now
    };
    writeApplications(apps);

    if (typeof global.updateDocument === 'function') {
      try {
        await global.updateDocument('player_applications', applicationId, apps[ix]);
      } catch (e) {
        console.warn('update application firebase:', e);
      }
    }

    return { application: apps[ix], player: player };
  }

  async function rejectApplication(applicationId, reason) {
    const apps = readApplications();
    const ix = apps.findIndex(function (a) {
      return a.id === applicationId;
    });
    if (ix < 0) throw new Error('Solicitud no encontrada');
    const now = new Date().toISOString();
    const adminUser = global.currentUser?.email || 'admin';
    apps[ix] = {
      ...apps[ix],
      status: 'rejected',
      rejectReason: String(reason || '').trim(),
      reviewedAt: now,
      reviewedBy: adminUser,
      updatedAt: now
    };
    writeApplications(apps);
    if (typeof global.updateDocument === 'function') {
      try {
        await global.updateDocument('player_applications', applicationId, apps[ix]);
      } catch (e) {
        console.warn('reject application firebase:', e);
      }
    }
    return apps[ix];
  }

  function renderPlayerApplicationsAdmin(applications) {
    const wrap = document.getElementById('playerApplicationsList');
    if (!wrap) return;
    const list = applications || readApplications();
    const pending = list.filter(function (a) {
      return String(a.status || '') === 'pending_review';
    });
    if (!list.length) {
      wrap.innerHTML = '<p style="color:#64748b;">No hay solicitudes registradas.</p>';
      return;
    }
    let html =
      '<p style="margin:0 0 12px;color:#64748b;">Pendientes: <strong>' +
      pending.length +
      '</strong> · Total: ' +
      list.length +
      '</p>';
    html += '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:0.9rem;">';
    html +=
      '<thead><tr style="background:#e2e8f0;"><th style="padding:8px;text-align:left;">Temporada</th><th>Nombre</th><th>DNI</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>';
    list
      .slice()
      .sort(function (a, b) {
        return String(b.submittedAt || '').localeCompare(String(a.submittedAt || ''));
      })
      .forEach(function (app) {
        const st = statusLabel(app.status);
        html +=
          '<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:8px;">' +
          (app.season || '—') +
          '</td><td style="padding:8px;">' +
          (app.name || '') +
          ' ' +
          (app.surname || '') +
          '</td><td style="padding:8px;">' +
          (app.dni || '—') +
          '</td><td style="padding:8px;"><span style="color:' +
          st.color +
          ';font-weight:700;">' +
          st.text +
          '</span></td><td style="padding:8px;white-space:nowrap;">';
        if (app.status === 'pending_review') {
          html +=
            '<button type="button" class="btn btn-success" style="padding:6px 10px;font-size:0.8rem;margin-right:6px;" onclick="approvePlayerApplicationAdmin(\'' +
            app.id +
            '\')">✅ Aceptar</button>';
          html +=
            '<button type="button" class="btn" style="padding:6px 10px;font-size:0.8rem;background:#dc2626;color:#fff;" onclick="rejectPlayerApplicationAdmin(\'' +
            app.id +
            '\')">✕ Rechazar</button>';
        } else if (app.status === 'approved' && app.playerId) {
          html += '<span style="color:#64748b;font-size:0.85rem;">Ficha: ' + app.playerId + '</span>';
        } else {
          html += '—';
        }
        html += '</td></tr>';
      });
    html += '</tbody></table></div>';
    wrap.innerHTML = html;
  }

  global.renderPlayerApplicationsAdmin = renderPlayerApplicationsAdmin;

  global.approvePlayerApplicationAdmin = async function (id) {
    if (!confirm('¿Aceptar esta solicitud? El jugador podrá completar ropa y pago en la web.')) return;
    try {
      await approveApplication(id);
      alert('✅ Solicitud aceptada. El jugador/a puede usar «Ya soy jugador/a» en la web.');
      renderPlayerApplicationsAdmin();
      if (typeof global.loadPlayers === 'function') global.loadPlayers();
    } catch (e) {
      alert('❌ ' + (e.message || e));
    }
  };

  global.rejectPlayerApplicationAdmin = async function (id) {
    const reason = prompt('Motivo del rechazo (opcional):', '');
    if (reason === null) return;
    try {
      await rejectApplication(id, reason);
      alert('Solicitud rechazada.');
      renderPlayerApplicationsAdmin();
    } catch (e) {
      alert('❌ ' + (e.message || e));
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      renderPlayerApplicationsAdmin();
    }, 800);
  });

  if (typeof document !== 'undefined') {
    document.addEventListener('playerApplicationsUpdated', function () {
      renderPlayerApplicationsAdmin();
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
