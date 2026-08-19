/**
 * Control de asistencia a eventos por QR — solo administradores.
 * Lee QR de socio/jugador/honorífico (y búsqueda manual amigo/directiva),
 * marca pago del evento y genera lista exportable Excel / Word / PDF.
 */
(function (global) {
  'use strict';

  const STORAGE_EVENTS = 'clubEvents';
  let html5Qr = null;
  let activeEventId = null;
  let scanBusy = false;

  function requireAdmin() {
    const sess =
      (global.AdminSession && typeof global.AdminSession.getStoredAdminSession === 'function'
        ? global.AdminSession.getStoredAdminSession()
        : null) ||
      (function () {
        try {
          return JSON.parse(localStorage.getItem('currentAdmin') || 'null');
        } catch (_) {
          return null;
        }
      })();
    const authOk =
      global.AdminSession && typeof global.AdminSession.isAdminAuthenticated === 'function'
        ? global.AdminSession.isAdminAuthenticated()
        : !!(sess && sess.email);
    if (!sess || !sess.email || !authOk) {
      return { ok: false, message: 'Solo administradores con sesión activa pueden leer QR de asistencia.' };
    }
    return { ok: true, admin: sess };
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function normEmail(v) {
    return String(v || '')
      .trim()
      .toLowerCase();
  }

  function normDni(v) {
    return String(v || '')
      .trim()
      .toUpperCase()
      .replace(/[\s-]/g, '');
  }

  function readJsonArray(key) {
    try {
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  function loadEvents() {
    return readJsonArray(STORAGE_EVENTS);
  }

  function saveEvents(events) {
    localStorage.setItem(STORAGE_EVENTS, JSON.stringify(events));
    try {
      global.dispatchEvent(new CustomEvent('eventsUpdated', { detail: events }));
    } catch (_) {}
  }

  function getEventById(eventId) {
    return loadEvents().find(function (e) {
      return e && String(e.id) === String(eventId);
    });
  }

  function ensureAttendance(event) {
    if (!event.attendance || !Array.isArray(event.attendance)) event.attendance = [];
    return event.attendance;
  }

  function fromBase64Url(s) {
    try {
      var b64 = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      return decodeURIComponent(escape(atob(b64)));
    } catch (_) {
      return '';
    }
  }

  /** Parsea URL de QR de carnet o texto pegado. */
  function parseQrPayload(rawText) {
    const text = String(rawText || '').trim();
    if (!text) return null;

    let url;
    try {
      url = new URL(text, 'https://www.cdsanabriacf.com/');
    } catch (_) {
      url = null;
    }

    let params = null;
    if (url) {
      params = url.searchParams;
      if ((!params.get('nombre') && !params.get('p')) && url.hash) {
        params = new URLSearchParams(url.hash.replace(/^#/, ''));
      }
    } else if (text.indexOf('nombre=') >= 0 || text.indexOf('p=') === 0) {
      params = new URLSearchParams(text.replace(/^\?/, ''));
    }

    if (params && params.get('nombre')) {
      return {
        nombre: params.get('nombre'),
        dni: params.get('dni') || '',
        num: params.get('num') || '',
        tipo: params.get('tipo') || 'socio',
        temp: params.get('temp') || '',
        id: params.get('id') || '',
        email: params.get('email') || ''
      };
    }

    if (params && (params.get('p') || params.get('d'))) {
      try {
        const data = JSON.parse(fromBase64Url(params.get('p') || params.get('d')));
        if (data && data.nombre) return data;
      } catch (_) {}
    }

    // DNI suelto
    if (/^[0-9]{7,8}[A-Za-z]$/.test(text.replace(/\s/g, ''))) {
      return { dni: text.replace(/\s/g, ''), nombre: '', tipo: '' };
    }

    return null;
  }

  function findClubPerson(payload) {
    const dni = normDni(payload && payload.dni);
    const email = normEmail(payload && payload.email);
    const id = payload && payload.id ? String(payload.id) : '';
    const num = String((payload && payload.num) || '').replace(/\D/g, '');

    function matchRow(row, kind) {
      if (!row) return null;
      if (id && String(row.id) === id) return { row: row, kind: kind };
      if (dni && normDni(row.dni) === dni) return { row: row, kind: kind };
      if (email && normEmail(row.email) === email) return { row: row, kind: kind };
      if (num) {
        const n1 = String(row.numeroSocio || row.memberNumber || row.numeroSocioHonor || '').replace(/\D/g, '');
        const n2 = String(row.friendNumber || row.numeroAmigo || '').replace(/\D/g, '');
        if (n1 && n1 === num) return { row: row, kind: kind };
        if (n2 && n2 === num) return { row: row, kind: kind };
      }
      return null;
    }

    const members = readJsonArray('clubMembers');
    for (let i = 0; i < members.length; i++) {
      const hit = matchRow(members[i], 'socio');
      if (hit) {
        const m = hit.row;
        let kind = 'socio';
        if (m.socioDeHonor || m.membershipTier === 'honor') kind = 'honorifico';
        else if (m.socioJugador || m.isJugador || m.memberKind === 'jugador') kind = 'jugador';
        return { row: m, kind: kind };
      }
    }

    const friends = readJsonArray('clubFriends');
    for (let i = 0; i < friends.length; i++) {
      const hit = matchRow(friends[i], 'amigo');
      if (hit) return hit;
    }

    const board = readJsonArray('clubBoard');
    for (let i = 0; i < board.length; i++) {
      const hit = matchRow(board[i], 'directiva');
      if (hit) return hit;
    }

    const players = readJsonArray('clubPlayers');
    for (let i = 0; i < players.length; i++) {
      const hit = matchRow(players[i], 'jugador');
      if (hit) return hit;
    }

    if (payload && payload.nombre) {
      return {
        row: {
          nombre: payload.nombre,
          name: payload.nombre,
          dni: payload.dni,
          email: payload.email,
          numeroSocio: payload.num,
          id: payload.id
        },
        kind: payload.tipo || 'desconocido'
      };
    }
    return null;
  }

  function personDisplayName(row) {
    if (!row) return '—';
    const n = [row.nombre || row.name, row.apellidos || row.surname].filter(Boolean).join(' ').trim();
    return n || row.email || 'Sin nombre';
  }

  function kindLabel(kind) {
    const map = {
      socio: 'Socio/a',
      jugador: 'Socio-jugador',
      honorifico: 'Socio de honor',
      amigo: 'Amigo/a',
      directiva: 'Directiva',
      desconocido: 'Identificado'
    };
    return map[kind] || kind || '—';
  }

  function findEventParticipant(event, person) {
    const list = Array.isArray(event.participants) ? event.participants : [];
    const dni = normDni(person.dni);
    const email = normEmail(person.email);
    const id = person.id ? String(person.id) : '';
    return (
      list.find(function (p) {
        if (!p || p.isGuest) return false;
        if (id && (String(p.id) === id || String(p.memberId || '') === id || String(p.playerId || '') === id))
          return true;
        if (email && normEmail(p.email) === email) return true;
        if (dni && normDni(p.dni) === dni) return true;
        return false;
      }) || null
    );
  }

  function isEventFreeForParticipant(event, participant, kind) {
    const prices = event.pricesByType || {};
    let tier = 'socios';
    if (participant && participant.priceTier) tier = participant.priceTier;
    else if (kind === 'amigo') tier = 'amigos';
    else if (kind === 'jugador') tier = 'jugadores';
    else if (kind === 'directiva') tier = 'directiva';
    const price = Number(
      participant && participant.appliedPrice != null
        ? participant.appliedPrice
        : prices[tier] != null
          ? prices[tier]
          : event.price || 0
    );
    return !Number.isFinite(price) || price <= 0;
  }

  function resolvePayment(event, participant, kind) {
    if (isEventFreeForParticipant(event, participant, kind)) {
      return { key: 'free', label: 'Gratuito', ok: true };
    }
    if (!participant) {
      return { key: 'not_registered', label: 'No inscrito en el evento', ok: false };
    }
    const status = String(participant.paymentStatus || '').toLowerCase();
    if (status === 'paid' || participant.paid === true || participant.paidOnline === true) {
      return { key: 'paid', label: 'Pagado', ok: true };
    }
    if (status === 'pending_transfer' || String(participant.paymentMethod || '').toLowerCase() === 'transfer') {
      return { key: 'pending', label: 'Falta el pago', ok: false };
    }
    return { key: 'pending', label: 'Falta el pago', ok: false };
  }

  function upsertAttendance(eventId, entry) {
    const events = loadEvents();
    const ix = events.findIndex(function (e) {
      return e && String(e.id) === String(eventId);
    });
    if (ix < 0) throw new Error('Evento no encontrado');
    const event = events[ix];
    const list = ensureAttendance(event);
    const dni = normDni(entry.dni);
    const email = normEmail(entry.email);
    const existingIx = list.findIndex(function (a) {
      if (dni && normDni(a.dni) === dni) return true;
      if (email && normEmail(a.email) === email) return true;
      return false;
    });
    if (existingIx >= 0) {
      list[existingIx] = Object.assign({}, list[existingIx], entry, {
        scans: (Number(list[existingIx].scans) || 1) + 1,
        lastScanAt: entry.scannedAt
      });
    } else {
      list.push(Object.assign({ scans: 1 }, entry));
    }
    event.attendance = list;
    event.updatedAt = new Date().toISOString();
    events[ix] = event;
    saveEvents(events);
    if (typeof global.saveEventToStorage === 'function') {
      global.saveEventToStorage(event).catch(function (e) {
        console.warn('Persist asistencia evento:', e);
      });
    }
    return event;
  }

  async function ensureHtml5Qr() {
    if (global.Html5Qrcode) return global.Html5Qrcode;
    await new Promise(function (resolve, reject) {
      const url = 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';
      if (document.querySelector('script[data-dyn="' + url + '"]')) {
        const t = setInterval(function () {
          if (global.Html5Qrcode) {
            clearInterval(t);
            resolve();
          }
        }, 100);
        setTimeout(function () {
          clearInterval(t);
          reject(new Error('Timeout QR lib'));
        }, 8000);
        return;
      }
      const s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.dataset.dyn = url;
      s.onload = function () {
        resolve();
      };
      s.onerror = function () {
        reject(new Error('No se pudo cargar el lector QR'));
      };
      document.head.appendChild(s);
    });
    return global.Html5Qrcode;
  }

  async function ensureXlsx() {
    if (global.XLSX) return;
    if (typeof global.ensureScriptLoaded === 'function') {
      await global.ensureScriptLoaded('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', 'XLSX');
      return;
    }
    await new Promise(function (resolve, reject) {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function downloadBlob(content, filename, mime) {
    if (typeof global.downloadBlobFile === 'function') {
      global.downloadBlobFile(content, filename, mime);
      return;
    }
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
    }, 1500);
  }

  function attendanceRows(event) {
    return (ensureAttendance(event) || []).slice().sort(function (a, b) {
      return String(a.scannedAt || '').localeCompare(String(b.scannedAt || ''));
    });
  }

  function exportExcel(eventId) {
    const event = getEventById(eventId);
    if (!event) return alert('Evento no encontrado');
    const rows = attendanceRows(event);
    if (!rows.length) return alert('La lista de asistencia está vacía');
    ensureXlsx().then(function () {
      const data = rows.map(function (r, i) {
        return {
          '#': i + 1,
          Nombre: r.nombre || '',
          DNI: r.dni || '',
          Email: r.email || '',
          Rol: r.kindLabel || r.kind || '',
          'Pago evento': r.paymentLabel || '',
          Acceso: r.accessLabel || '',
          '1ª lectura': r.scannedAt ? new Date(r.scannedAt).toLocaleString('es-ES') : '',
          'Última lectura': r.lastScanAt ? new Date(r.lastScanAt).toLocaleString('es-ES') : '',
          Escaneos: r.scans || 1,
          Admin: r.scannedBy || ''
        };
      });
      const ws = global.XLSX.utils.json_to_sheet(data);
      const wb = global.XLSX.utils.book_new();
      global.XLSX.utils.book_append_sheet(wb, ws, 'Asistencia');
      const buf = global.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const name = 'asistencia_' + String(event.name || event.id).replace(/[^\w.-]/g, '_') + '.xlsx';
      downloadBlob(buf, name, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    });
  }

  function exportWord(eventId) {
    const event = getEventById(eventId);
    if (!event) return alert('Evento no encontrado');
    const rows = attendanceRows(event);
    if (!rows.length) return alert('La lista de asistencia está vacía');
    const lines = [
      'Lista de asistencia — ' + (event.name || 'Evento'),
      'Fecha evento: ' + (event.date || '—'),
      'Generado: ' + new Date().toLocaleString('es-ES'),
      'Total: ' + rows.length,
      ''
    ];
    rows.forEach(function (r, i) {
      lines.push(
        i +
          1 +
          '. ' +
          (r.nombre || '—') +
          ' | ' +
          (r.dni || '—') +
          ' | ' +
          (r.kindLabel || '') +
          ' | ' +
          (r.paymentLabel || '') +
          ' | ' +
          (r.accessLabel || '') +
          ' | ' +
          (r.scannedAt ? new Date(r.scannedAt).toLocaleString('es-ES') : '')
      );
    });
    const name = 'asistencia_' + String(event.name || event.id).replace(/[^\w.-]/g, '_') + '.doc';
    downloadBlob(lines.join('\n'), name, 'application/msword;charset=utf-8;');
  }

  function exportPdf(eventId) {
    const event = getEventById(eventId);
    if (!event) return alert('Evento no encontrado');
    const rows = attendanceRows(event);
    if (!rows.length) return alert('La lista de asistencia está vacía');
    const w = window.open('', '_blank');
    if (!w) {
      alert('Permite ventanas emergentes para exportar PDF');
      return;
    }
    const trs = rows
      .map(function (r, i) {
        return (
          '<tr><td>' +
          (i + 1) +
          '</td><td>' +
          escapeHtml(r.nombre) +
          '</td><td>' +
          escapeHtml(r.dni) +
          '</td><td>' +
          escapeHtml(r.kindLabel) +
          '</td><td>' +
          escapeHtml(r.paymentLabel) +
          '</td><td>' +
          escapeHtml(r.accessLabel) +
          '</td><td>' +
          escapeHtml(r.scannedAt ? new Date(r.scannedAt).toLocaleString('es-ES') : '') +
          '</td></tr>'
        );
      })
      .join('');
    w.document.write(
      '<html><head><title>Asistencia</title><style>body{font-family:system-ui,sans-serif;padding:16px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #cbd5e1;padding:6px;text-align:left}th{background:#1e3a8a;color:#fff}</style></head><body>' +
        '<h1>Asistencia — ' +
        escapeHtml(event.name || 'Evento') +
        '</h1>' +
        '<p>Fecha evento: ' +
        escapeHtml(event.date || '—') +
        ' · Total: ' +
        rows.length +
        '</p>' +
        '<table><thead><tr><th>#</th><th>Nombre</th><th>DNI</th><th>Rol</th><th>Pago</th><th>Acceso</th><th>Hora</th></tr></thead><tbody>' +
        trs +
        '</tbody></table>' +
        '<script>window.onload=function(){window.print()}<\/script></body></html>'
    );
    w.document.close();
  }

  function renderListHtml(event) {
    const rows = attendanceRows(event);
    if (!rows.length) {
      return '<p style="color:#64748b;text-align:center;margin:12px 0">Aún no hay lecturas. Escanea un QR de carnet.</p>';
    }
    return (
      '<div style="max-height:280px;overflow:auto;border:1px solid #e2e8f0;border-radius:8px">' +
      '<table style="width:100%;border-collapse:collapse;font-size:0.82rem">' +
      '<thead><tr style="background:#1e3a8a;color:#fff">' +
      '<th style="padding:6px">#</th><th style="padding:6px">Nombre</th><th style="padding:6px">Rol</th><th style="padding:6px">Pago</th><th style="padding:6px">Acceso</th><th style="padding:6px">Hora</th>' +
      '</tr></thead><tbody>' +
      rows
        .map(function (r, i) {
          const payColor = r.paymentOk ? '#059669' : '#dc2626';
          const accColor = r.accessOk ? '#059669' : '#d97706';
          return (
            '<tr style="border-bottom:1px solid #e2e8f0">' +
            '<td style="padding:6px">' +
            (i + 1) +
            '</td>' +
            '<td style="padding:6px">' +
            escapeHtml(r.nombre) +
            '<div style="color:#64748b;font-size:0.75rem">' +
            escapeHtml(r.dni || '') +
            '</div></td>' +
            '<td style="padding:6px">' +
            escapeHtml(r.kindLabel) +
            '</td>' +
            '<td style="padding:6px;color:' +
            payColor +
            ';font-weight:700">' +
            escapeHtml(r.paymentLabel) +
            '</td>' +
            '<td style="padding:6px;color:' +
            accColor +
            ';font-weight:700">' +
            escapeHtml(r.accessLabel) +
            '</td>' +
            '<td style="padding:6px;white-space:nowrap">' +
            escapeHtml(r.scannedAt ? new Date(r.scannedAt).toLocaleTimeString('es-ES') : '') +
            '</td></tr>'
          );
        })
        .join('') +
      '</tbody></table></div>'
    );
  }

  function showScanResult(msg, isError) {
    const el = document.getElementById('evtAttLastResult');
    if (!el) return;
    el.style.background = isError ? '#fef2f2' : '#ecfdf5';
    el.style.color = isError ? '#991b1b' : '#065f46';
    el.style.borderColor = isError ? '#fecaca' : '#a7f3d0';
    el.textContent = msg;
  }

  function refreshListUi(eventId) {
    const event = getEventById(eventId);
    const host = document.getElementById('evtAttListHost');
    const count = document.getElementById('evtAttCount');
    if (host && event) host.innerHTML = renderListHtml(event);
    if (count && event) count.textContent = String(ensureAttendance(event).length);
  }

  function processScan(eventId, rawText, admin) {
    if (scanBusy) return;
    scanBusy = true;
    try {
      const payload = parseQrPayload(rawText);
      if (!payload) {
        showScanResult('❌ QR no reconocido. Usa el QR del carnet o pega el enlace.', true);
        return;
      }
      const found = findClubPerson(payload);
      if (!found || !found.row) {
        showScanResult('❌ Persona no encontrada en socios, amigos, directiva o jugadores.', true);
        return;
      }
      const event = getEventById(eventId);
      if (!event) {
        showScanResult('❌ Evento no encontrado', true);
        return;
      }
      const person = found.row;
      const nombre = personDisplayName(person) || payload.nombre;
      const participant = findEventParticipant(event, person);
      const pay = resolvePayment(event, participant, found.kind);
      const accessOk = !!(participant && pay.ok);
      const accessLabel = !participant
        ? 'Sin inscripción'
        : pay.ok
          ? 'Acceso OK'
          : 'Inscrito — falta pago';

      const entry = {
        id: person.id || '',
        nombre: nombre,
        dni: person.dni || payload.dni || '',
        email: person.email || payload.email || '',
        kind: found.kind,
        kindLabel: kindLabel(found.kind),
        paymentKey: pay.key,
        paymentLabel: pay.label,
        paymentOk: !!pay.ok,
        accessOk: accessOk,
        accessLabel: accessLabel,
        participantId: participant && participant.id ? participant.id : '',
        scannedAt: new Date().toISOString(),
        lastScanAt: new Date().toISOString(),
        scannedBy: (admin && (admin.name || admin.email)) || 'admin'
      };

      upsertAttendance(eventId, entry);
      refreshListUi(eventId);

      const icon = accessOk ? '✅' : pay.key === 'pending' ? '⚠️' : '⛔';
      showScanResult(
        icon +
          ' ' +
          nombre +
          ' · ' +
          kindLabel(found.kind) +
          ' · ' +
          pay.label +
          ' · ' +
          accessLabel,
        !accessOk
      );
    } catch (e) {
      console.error(e);
      showScanResult('❌ ' + (e.message || e), true);
    } finally {
      setTimeout(function () {
        scanBusy = false;
      }, 900);
    }
  }

  async function startCamera(eventId) {
    const gate = requireAdmin();
    if (!gate.ok) {
      alert(gate.message);
      return;
    }
    try {
      const Html5Qrcode = await ensureHtml5Qr();
      const readerId = 'evtAttQrReader';
      if (html5Qr) {
        try {
          await html5Qr.stop();
        } catch (_) {}
        try {
          await html5Qr.clear();
        } catch (_) {}
        html5Qr = null;
      }
      html5Qr = new Html5Qrcode(readerId);
      await html5Qr.start(
        { facingMode: 'environment' },
        { fps: 8, qrbox: { width: 240, height: 240 } },
        function (decoded) {
          processScan(eventId, decoded, gate.admin);
        },
        function () {}
      );
      const btn = document.getElementById('evtAttCamBtn');
      if (btn) btn.textContent = '⏹️ Parar cámara';
      btn && (btn.dataset.running = '1');
    } catch (e) {
      console.warn(e);
      alert(
        'No se pudo abrir la cámara (' +
          (e.message || e) +
          ').\n\nPuedes pegar el enlace del QR manualmente en el cuadro de texto.'
      );
    }
  }

  async function stopCamera() {
    if (!html5Qr) return;
    try {
      await html5Qr.stop();
      await html5Qr.clear();
    } catch (_) {}
    html5Qr = null;
    const btn = document.getElementById('evtAttCamBtn');
    if (btn) {
      btn.textContent = '📷 Activar cámara';
      btn.dataset.running = '0';
    }
  }

  function closeModal() {
    stopCamera();
    activeEventId = null;
    const el = document.getElementById('evtAttModalOverlay');
    if (el) el.remove();
  }

  function openAttendanceModal(eventId) {
    const gate = requireAdmin();
    if (!gate.ok) {
      alert('❌ ' + gate.message);
      return;
    }
    const event = getEventById(eventId);
    if (!event) {
      alert('Evento no encontrado');
      return;
    }
    activeEventId = eventId;
    closeModal();

    const overlay = document.createElement('div');
    overlay.id = 'evtAttModalOverlay';
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(15,23,42,.65);z-index:10060;display:flex;align-items:center;justify-content:center;padding:12px;';
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });

    overlay.innerHTML =
      '<div style="background:#fff;border-radius:14px;max-width:720px;width:100%;max-height:95vh;overflow:auto;padding:18px;box-shadow:0 20px 50px rgba(0,0,0,.3)">' +
      '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">' +
      '<div><h2 style="margin:0 0 4px;color:#1e3a8a;font-size:1.15rem">📷 Asistencia QR</h2>' +
      '<p style="margin:0;color:#64748b;font-size:0.88rem">' +
      escapeHtml(event.name || 'Evento') +
      ' · Solo administradores</p></div>' +
      '<button type="button" id="evtAttCloseBtn" style="border:none;background:#e2e8f0;border-radius:8px;padding:8px 12px;cursor:pointer;font-weight:700">Cerrar</button>' +
      '</div>' +
      '<p style="font-size:0.85rem;color:#475569;margin:12px 0">Escanea el QR del carnet (socio / socio-jugador / honorífico). También puedes pegar el enlace del QR o un DNI. Se comprueba si está inscrito y si ha <strong>pagado</strong> el evento.</p>' +
      '<div id="evtAttQrReader" style="width:100%;max-width:360px;margin:0 auto 10px;border-radius:10px;overflow:hidden;background:#0f172a"></div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:10px">' +
      '<button type="button" id="evtAttCamBtn" style="padding:8px 14px;background:#1e3a8a;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer">📷 Activar cámara</button>' +
      '</div>' +
      '<label style="display:block;font-size:0.85rem;font-weight:700;margin-bottom:4px">Pegar enlace del QR / DNI</label>' +
      '<div style="display:flex;gap:8px;margin-bottom:10px">' +
      '<input id="evtAttManualInput" type="text" placeholder="https://...carnet-asistencia.html?... o DNI" style="flex:1;padding:8px;border:1px solid #cbd5e1;border-radius:8px">' +
      '<button type="button" id="evtAttManualBtn" style="padding:8px 12px;background:#059669;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer">Leer</button>' +
      '</div>' +
      '<div id="evtAttLastResult" style="border:1px solid #a7f3d0;background:#ecfdf5;color:#065f46;border-radius:8px;padding:10px;font-size:0.9rem;margin-bottom:12px;min-height:42px">Esperando lectura…</div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
      '<strong>Lista de asistencia (<span id="evtAttCount">0</span>)</strong>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
      '<button type="button" id="evtAttXlsx" style="padding:6px 10px;background:#166534;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:0.8rem">📊 Excel</button>' +
      '<button type="button" id="evtAttWord" style="padding:6px 10px;background:#0ea5e9;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:0.8rem">📝 Word</button>' +
      '<button type="button" id="evtAttPdf" style="padding:6px 10px;background:#b45309;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:0.8rem">🖨️ PDF</button>' +
      '</div></div>' +
      '<div id="evtAttListHost"></div>' +
      '</div>';

    document.body.appendChild(overlay);
    refreshListUi(eventId);

    document.getElementById('evtAttCloseBtn').onclick = closeModal;
    document.getElementById('evtAttCamBtn').onclick = function () {
      if (this.dataset.running === '1') stopCamera();
      else startCamera(eventId);
    };
    document.getElementById('evtAttManualBtn').onclick = function () {
      const v = (document.getElementById('evtAttManualInput') || {}).value || '';
      processScan(eventId, v, gate.admin);
    };
    document.getElementById('evtAttManualInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        processScan(eventId, this.value, gate.admin);
      }
    });
    document.getElementById('evtAttXlsx').onclick = function () {
      exportExcel(eventId);
    };
    document.getElementById('evtAttWord').onclick = function () {
      exportWord(eventId);
    };
    document.getElementById('evtAttPdf').onclick = function () {
      exportPdf(eventId);
    };
  }

  global.AdminEventAttendance = {
    open: openAttendanceModal,
    close: closeModal,
    exportExcel: exportExcel,
    exportWord: exportWord,
    exportPdf: exportPdf,
    requireAdmin: requireAdmin
  };

  global.openEventAttendanceQr = function (eventId) {
    openAttendanceModal(eventId);
  };
})(typeof window !== 'undefined' ? window : globalThis);
