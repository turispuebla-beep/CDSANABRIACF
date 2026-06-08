/**
 * Contador y panel de notificaciones del panel de administración.
 * Combina avisos dinámicos (socios, solicitudes, inscripciones) con localStorage.
 */
(function () {
    const STORE_KEY = 'notificacionesAdmin';
    const DISMISSED_KEY = 'notificacionesAdminDismissed';

    function safeParse(key, fallback) {
        try {
            return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
        } catch (_) {
            return fallback;
        }
    }

    function readDismissed() {
        return new Set(safeParse(DISMISSED_KEY, []));
    }

    function readStoredNotifs() {
        return safeParse(STORE_KEY, []).filter(function (n) {
            return n && !n.leida;
        });
    }

    function playerDisplayName(p) {
        return [p.name || p.nombre, p.surname || p.apellidos].filter(Boolean).join(' ').trim();
    }

    function computeDynamicAdminNotifications() {
        const dismissed = readDismissed();
        const items = [];

        const members = safeParse('clubMembers', []);
        members.filter(function (m) {
            return m && m.status === 'pending_validation';
        }).forEach(function (m) {
            const id = 'socio-' + (m.id || m.dni || m.email || Math.random());
            if (dismissed.has(id)) return;
            items.push({
                id: id,
                tipo: 'nuevo_socio',
                titulo: 'Socio pendiente de validación',
                mensaje: [m.nombre, m.apellidos].filter(Boolean).join(' ').trim() || m.email || 'Nuevo socio',
                fecha: m.registrationDate || m.createdAt || new Date().toISOString(),
                dinamica: true,
                tab: 'socios'
            });
        });

        const apps = safeParse('clubPlayerApplications', []);
        apps.filter(function (a) {
            return a && (!a.status || a.status === 'pending_review');
        }).forEach(function (a) {
            const id = 'app-' + (a.id || a.email || Math.random());
            if (dismissed.has(id)) return;
            items.push({
                id: id,
                tipo: 'solicitud_jugador',
                titulo: 'Solicitud de jugador/a',
                mensaje: [a.name || a.nombre, a.surname || a.apellidos].filter(Boolean).join(' ').trim(),
                fecha: a.submittedAt || a.createdAt || new Date().toISOString(),
                dinamica: true,
                tab: 'jugadores'
            });
        });

        const players = safeParse('clubPlayers', []);
        const pendingIns = ['pending_payment', 'pending_transfer', 'pending_cash', 'pending_tpv'];
        players.forEach(function (p) {
            if (!p) return;
            const ins = String(p.inscriptionStatus || '').toLowerCase();
            const needsAction = pendingIns.indexOf(ins) >= 0 || p.status === 'pending_validation';
            if (!needsAction) return;
            const id = 'ins-' + (p.id || p.dni || Math.random());
            if (dismissed.has(id)) return;
            let titulo = 'Inscripción pendiente';
            if (ins === 'pending_payment') titulo = 'Inscripción pendiente de pago';
            else if (ins === 'pending_transfer') titulo = 'Transferencia pendiente de confirmar';
            else if (ins === 'pending_cash' || ins === 'pending_tpv') titulo = 'Pago pendiente de confirmar';
            items.push({
                id: id,
                tipo: 'inscripcion_jugador',
                titulo: titulo,
                mensaje: playerDisplayName(p),
                fecha: p.inscriptionDate || p.updatedAt || p.createdAt || new Date().toISOString(),
                dinamica: true,
                tab: 'jugadores'
            });
        });

        return items;
    }

    function obtenerNotificacionesAdmin() {
        const all = computeDynamicAdminNotifications().concat(readStoredNotifs());
        all.sort(function (a, b) {
            return new Date(b.fecha || 0) - new Date(a.fecha || 0);
        });
        return all;
    }

    function actualizarContadorNotificacionesAdmin() {
        const count = obtenerNotificacionesAdmin().length;
        const badge = document.getElementById('adminNotificationCounter');
        const btn = document.getElementById('adminNotifBtn');
        if (badge) {
            badge.textContent = count > 99 ? '99+' : String(count);
            badge.hidden = count === 0;
            badge.setAttribute('aria-hidden', count === 0 ? 'true' : 'false');
        }
        if (btn) {
            btn.setAttribute(
                'aria-label',
                count > 0 ? 'Notificaciones (' + count + ' pendientes)' : 'Notificaciones'
            );
        }
    }

    function tipoMeta(notif) {
        const map = {
            nuevo_socio: { color: '#059669', icon: '👤' },
            solicitud_jugador: { color: '#2563eb', icon: '⚽' },
            inscripcion_jugador: { color: '#ea580c', icon: '📋' },
            eliminacion: { color: '#dc2626', icon: '🗑️' }
        };
        return map[notif.tipo] || { color: '#8b5cf6', icon: '🔔' };
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function renderAdminNotificationRow(notif) {
        const meta = tipoMeta(notif);
        const safeId = escapeHtml(String(notif.id)).replace(/'/g, '&#39;');
        const fecha = notif.fecha ? new Date(notif.fecha).toLocaleString() : '';
        return (
            '<div class="admin-notif-item" style="border-left-color:' + meta.color + '">' +
            '<div class="admin-notif-item-body">' +
            '<div class="admin-notif-item-title" style="color:' + meta.color + '">' +
            meta.icon + ' ' + escapeHtml(notif.titulo) +
            '</div>' +
            '<div class="admin-notif-item-msg">' + escapeHtml(notif.mensaje) + '</div>' +
            '<div class="admin-notif-item-time">' + escapeHtml(fecha) + '</div>' +
            '</div>' +
            '<button type="button" class="admin-notif-item-action" onclick="marcarNotificacionLeida(\'' +
            safeId +
            '\')" title="Ir / marcar leída">✓</button>' +
            '</div>'
        );
    }

    function renderAdminNotificationsPanel() {
        const panel = document.getElementById('adminNotificationsPanel');
        if (!panel) return;
        const notificaciones = obtenerNotificacionesAdmin();
        if (notificaciones.length === 0) {
            panel.innerHTML = '<p class="admin-notif-empty">No hay notificaciones pendientes</p>';
            return;
        }
        panel.innerHTML =
            '<div class="admin-notif-panel-header">' +
            '<strong>🔔 Pendientes (' + notificaciones.length + ')</strong>' +
            '<button type="button" onclick="toggleAdminNotificationsPanel()" aria-label="Cerrar">✕</button>' +
            '</div>' +
            '<div class="admin-notif-panel-list">' +
            notificaciones.map(renderAdminNotificationRow).join('') +
            '</div>';
    }

    function isAdminNotifPanelOpen() {
        const panel = document.getElementById('adminNotificationsPanel');
        return panel && panel.style.display === 'block';
    }

    function toggleAdminNotificationsPanel() {
        const panel = document.getElementById('adminNotificationsPanel');
        const btn = document.getElementById('adminNotifBtn');
        if (!panel) return;
        if (isAdminNotifPanelOpen()) {
            panel.style.display = 'none';
            if (btn) btn.setAttribute('aria-expanded', 'false');
            return;
        }
        renderAdminNotificationsPanel();
        panel.style.display = 'block';
        if (btn) btn.setAttribute('aria-expanded', 'true');
    }

    function marcarNotificacionLeida(id) {
        const all = obtenerNotificacionesAdmin();
        const notif = all.find(function (n) {
            return String(n.id) === String(id);
        });
        if (notif && notif.dinamica) {
            if (notif.tab && typeof showTab === 'function') showTab(notif.tab);
            const dismissed = safeParse(DISMISSED_KEY, []);
            if (dismissed.indexOf(id) < 0) {
                dismissed.push(id);
                localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed.slice(-500)));
            }
        } else {
            const list = safeParse(STORE_KEY, []);
            const ix = list.findIndex(function (n) {
                return String(n.id) === String(id);
            });
            if (ix >= 0) {
                list[ix].leida = true;
                localStorage.setItem(STORE_KEY, JSON.stringify(list));
            }
        }
        actualizarContadorNotificacionesAdmin();
        if (isAdminNotifPanelOpen()) renderAdminNotificationsPanel();
        const preview = document.getElementById('dbNotificationsPreview');
        if (preview && preview.style.display === 'block' && typeof mostrarNotificaciones === 'function') {
            mostrarNotificaciones();
        }
    }

    function pushNotificacionAdmin(data) {
        const list = safeParse(STORE_KEY, []);
        list.unshift({
            id: data.id || Date.now(),
            tipo: data.tipo || 'general',
            titulo: data.titulo || 'Notificación',
            mensaje: data.mensaje || '',
            fecha: data.fecha || new Date().toISOString(),
            leida: false
        });
        localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(0, 200)));
        actualizarContadorNotificacionesAdmin();
        if (isAdminNotifPanelOpen()) renderAdminNotificationsPanel();
    }

    function limpiarNotificacionesAdminStore() {
        localStorage.removeItem(STORE_KEY);
        localStorage.removeItem(DISMISSED_KEY);
        actualizarContadorNotificacionesAdmin();
        if (isAdminNotifPanelOpen()) renderAdminNotificationsPanel();
    }

    document.addEventListener('click', function (e) {
        if (!isAdminNotifPanelOpen()) return;
        const wrap = document.querySelector('.admin-notif-wrap');
        if (wrap && !wrap.contains(e.target)) {
            toggleAdminNotificationsPanel();
        }
    });

    window.addEventListener('storage', function (e) {
        if (
            e.key === STORE_KEY ||
            e.key === DISMISSED_KEY ||
            e.key === 'clubMembers' ||
            e.key === 'clubPlayers' ||
            e.key === 'clubPlayerApplications'
        ) {
            actualizarContadorNotificacionesAdmin();
            if (isAdminNotifPanelOpen()) renderAdminNotificationsPanel();
        }
    });

    window.obtenerNotificacionesAdmin = obtenerNotificacionesAdmin;
    window.actualizarContadorNotificacionesAdmin = actualizarContadorNotificacionesAdmin;
    window.toggleAdminNotificationsPanel = toggleAdminNotificationsPanel;
    window.marcarNotificacionLeida = marcarNotificacionLeida;
    window.pushNotificacionAdmin = pushNotificacionAdmin;
    window.limpiarNotificacionesAdminStore = limpiarNotificacionesAdminStore;

    document.addEventListener('DOMContentLoaded', function () {
        actualizarContadorNotificacionesAdmin();
    });
})();
