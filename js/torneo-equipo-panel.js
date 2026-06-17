/**
 * Panel del responsable — torneo-equipo.html
 */
(function (global) {
  'use strict';

  function $(id) {
    return global.document.getElementById(id);
  }

  function escapeHtml(v) {
    return String(v || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatFee(panel) {
    if (global.ClubTorneoConfig && global.ClubTorneoConfig.formatFeeLabel) {
      return global.ClubTorneoConfig.formatFeeLabel(panel.inscriptionFeeEur);
    }
    const n = Number(panel.inscriptionFeeEur);
    if (!n || n <= 0) return 'Sin cuota online (el club confirmará el importe)';
    return n.toFixed(2).replace('.', ',') + ' €';
  }

  function fillCoachForm(coach) {
    const c = coach || {};
    if ($('teCoachName')) $('teCoachName').value = c.name || '';
    if ($('teCoachSurname')) $('teCoachSurname').value = c.surname || '';
    if ($('teCoachPhone')) $('teCoachPhone').value = c.phone || '';
    if ($('teCoachDni')) $('teCoachDni').value = c.dni && !String(c.dni).startsWith('***') ? c.dni : '';
    if ($('teCoachDniType')) $('teCoachDniType').value = c.dniType || 'espanol';
  }

  function readCoachForm() {
    return {
      name: ($('teCoachName') && $('teCoachName').value.trim()) || '',
      surname: ($('teCoachSurname') && $('teCoachSurname').value.trim()) || '',
      phone: ($('teCoachPhone') && $('teCoachPhone').value.trim()) || '',
      dni: ($('teCoachDni') && $('teCoachDni').value.trim()) || '',
      dniType: ($('teCoachDniType') && $('teCoachDniType').value) || 'espanol'
    };
  }

  function renderPanel(panel) {
    const cats =
      Array.isArray(panel.categoryLabels) && panel.categoryLabels.length
        ? panel.categoryLabels.join(', ')
        : '—';
    const submitted = parseInt(panel.fichasSubmitted, 10) || 0;
    const total = parseInt(panel.playerCount, 10) || 0;
    const pct = total > 0 ? Math.round((submitted / total) * 100) : 0;

    $('panelEventName').textContent = panel.eventName || 'Torneo Fútbol 7 — 2026';
    $('panelTeamName').textContent = panel.teamName || 'Mi equipo';
    $('panelSubtitle').textContent =
      'Responsable: ' + (panel.contactName || '—') + ' · ' + (panel.contactEmail || '');
    $('panelAccessCode').textContent = panel.accessCode || '—';
    $('panelCategories').textContent = cats;
    $('panelTown').textContent = panel.town || '—';
    $('panelPlayerCount').textContent = String(total || '—');
    $('panelStatus').textContent = global.TorneoResponsableAccess
      ? global.TorneoResponsableAccess.plantillaStatusLabel(panel.plantillaStatus)
      : panel.plantillaStatus || 'Pendiente';
    $('panelProgressBar').style.width = pct + '%';
    $('panelProgressLabel').textContent = submitted + ' de ' + total + ' fichas completadas';
    if ($('panelFeeLabel')) $('panelFeeLabel').textContent = formatFee(panel);

    fillCoachForm(panel.coach);
    if ($('teCoachStatus')) {
      $('teCoachStatus').textContent = panel.coach && panel.coach.complete
        ? '✅ Datos del entrenador/a guardados'
        : 'Completa y guarda los datos del entrenador/a';
    }

    const list = $('panelFichaList');
    const fichas = Array.isArray(panel.fichas) ? panel.fichas : [];
    if (!fichas.length) {
      list.innerHTML =
        '<li class="ficha-item"><span><strong>Sin invitaciones</strong><br><span style="font-size:0.82rem;color:#64748b;">Invita a cada jugador/a con su email.</span></span></li>';
    } else {
      list.innerHTML = fichas
        .map(function (f) {
          const done = String(f.status || '') === 'enviada';
          const link = f.inviteUrl
            ? '<br><button type="button" class="btn-link-copy" data-url="' +
              escapeHtml(f.inviteUrl) +
              '">Copiar enlace</button>'
            : '';
          return (
            '<li class="ficha-item">' +
            '<span><strong>' +
            escapeHtml(f.label || 'Jugador/a') +
            '</strong>' +
            (f.inviteEmail ? '<br><span style="font-size:0.8rem;color:#64748b;">' + escapeHtml(f.inviteEmail) + '</span>' : '') +
            link +
            '</span>' +
            '<span class="ficha-status ' +
            (done ? 'ficha-status--enviada' : 'ficha-status--pendiente') +
            '">' +
            (done ? '✅ Enviada' : '⏳ Pendiente') +
            '</span></li>'
          );
        })
        .join('');
      list.querySelectorAll('.btn-link-copy').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const url = btn.getAttribute('data-url') || '';
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(function () {
              alert('Enlace copiado.');
            });
          } else {
            prompt('Copia el enlace:', url);
          }
        });
      });
    }

    const closeBtn = $('btnClosePlantilla');
    const sent = ['enviada_club', 'pagada'].includes(String(panel.plantillaStatus || ''));
    if (closeBtn) {
      closeBtn.disabled = sent || !panel.canFinalize;
      closeBtn.textContent = sent
        ? '✅ Plantilla enviada al club'
        : Number(panel.inscriptionFeeEur) > 0
          ? '💳 Finalizar y pagar con tarjeta'
          : '📤 Finalizar y enviar al club';
      closeBtn.title = panel.canFinalize
        ? 'Enviar plantilla completa al club'
        : 'Completa entrenador/a y todas las fichas';
    }

    if ($('teInviteBlock')) {
      $('teInviteBlock').style.display = sent || fichas.length >= total ? 'none' : 'block';
    }
  }

  function showLogin() {
    $('loginView').hidden = false;
    $('panelView').hidden = true;
    $('btnLogout').style.display = 'none';
  }

  function showPanel() {
    $('loginView').hidden = true;
    $('panelView').hidden = false;
    $('btnLogout').style.display = 'inline-flex';
  }

  async function refreshPanel() {
    const session = global.TorneoResponsableAccess && global.TorneoResponsableAccess.readSession();
    if (!session) {
      showLogin();
      return;
    }
    let panel;
    if (global.TorneoEquipoManage && global.TorneoEquipoManage.refreshPanel) {
      panel = await global.TorneoEquipoManage.refreshPanel();
    } else {
      panel = await global.TorneoResponsableAccess.verifyAccess(session.accessCode, session.contactEmail);
      global.TorneoResponsableAccess.writeSession(session.accessCode, session.contactEmail, panel);
    }
    renderPanel(panel);
    showPanel();
  }

  async function handleLogin(ev) {
    ev.preventDefault();
    const code = $('loginAccessCode') && $('loginAccessCode').value;
    const email = $('loginContactEmail') && $('loginContactEmail').value;
    const errEl = $('loginError');
    const btn = $('loginSubmitBtn');
    if (errEl) {
      errEl.hidden = true;
      errEl.textContent = '';
    }
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Comprobando…';
    }
    try {
      const panel = await global.TorneoResponsableAccess.loginAndSave(code, email);
      renderPanel(panel);
      showPanel();
    } catch (err) {
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = err.message || 'No se pudo acceder.';
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Acceder a mi equipo';
      }
    }
  }

  async function handleSaveCoach(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    const errEl = $('teCoachError');
    const btn = $('teCoachSaveBtn');
    if (errEl) {
      errEl.hidden = true;
      errEl.textContent = '';
    }
    if (btn) btn.disabled = true;
    try {
      const panel = await global.TorneoEquipoManage.saveCoach(readCoachForm());
      renderPanel(panel);
      if ($('teCoachStatus')) $('teCoachStatus').textContent = '✅ Datos del entrenador/a guardados';
    } catch (err) {
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = err.message || 'No se pudo guardar.';
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function handleInvite(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    const errEl = $('teInviteError');
    const btn = $('teInviteBtn');
    const email = ($('teInviteEmail') && $('teInviteEmail').value.trim()) || '';
    const label = ($('teInviteLabel') && $('teInviteLabel').value.trim()) || '';
    if (errEl) {
      errEl.hidden = true;
      errEl.textContent = '';
    }
    if (btn) btn.disabled = true;
    try {
      const result = await global.TorneoEquipoManage.invitePlayer({ email: email, label: label });
      renderPanel(result.panel);
      if ($('teInviteEmail')) $('teInviteEmail').value = '';
      if ($('teInviteLabel')) $('teInviteLabel').value = '';
      const msg = result.emailSent
        ? 'Invitación enviada por correo.'
        : 'Invitación creada. Copia el enlace desde la lista si no llegó el correo.';
      if ($('teInviteOk')) {
        $('teInviteOk').hidden = false;
        $('teInviteOk').textContent = msg;
      }
    } catch (err) {
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = err.message || 'No se pudo invitar.';
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function handleFinalize() {
    if (!global.TorneoEquipoManage) return;
    const errEl = $('teFinalizeError');
    if (errEl) {
      errEl.hidden = true;
      errEl.textContent = '';
    }
    const session = global.TorneoResponsableAccess.readSession();
    const panel = session && session.panel;
    const fee = panel && Number(panel.inscriptionFeeEur) > 0;
    const msg = fee
      ? '¿Finalizar la inscripción y pagar con tarjeta? Se enviará la plantilla al club tras confirmar el pago.'
      : '¿Finalizar y enviar la plantilla al club?';
    if (!confirm(msg)) return;
    try {
      const result = await global.TorneoEquipoManage.finalizeInscription();
      if (result.paymentRequired && result.redirect) {
        global.TorneoEquipoManage.submitRedsysRedirect(result.redirect);
        return;
      }
      if (result.panel) renderPanel(result.panel);
      alert('✅ Plantilla enviada al club correctamente.');
    } catch (err) {
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = err.message || 'No se pudo finalizar.';
      }
    }
  }

  function handleLogout() {
    if (global.TorneoResponsableAccess) global.TorneoResponsableAccess.clearSession();
    showLogin();
  }

  function init() {
    const params = new URLSearchParams(global.location.search || '');
    const prefill = params.get('equipo') || params.get('code');
    if (prefill && $('loginAccessCode')) {
      $('loginAccessCode').value = global.TorneoResponsableAccess
        ? global.TorneoResponsableAccess.normalizeCode(prefill)
        : prefill;
    }

    $('loginForm') && $('loginForm').addEventListener('submit', handleLogin);
    $('btnLogout') && $('btnLogout').addEventListener('click', handleLogout);
    $('btnRefreshPanel') && $('btnRefreshPanel').addEventListener('click', refreshPanel);
    $('teCoachForm') && $('teCoachForm').addEventListener('submit', handleSaveCoach);
    $('teInviteForm') && $('teInviteForm').addEventListener('submit', handleInvite);
    $('btnClosePlantilla') && $('btnClosePlantilla').addEventListener('click', handleFinalize);

    const session = global.TorneoResponsableAccess && global.TorneoResponsableAccess.readSession();
    if (session) {
      refreshPanel().catch(function () {
        showLogin();
      });
    } else {
      showLogin();
    }
  }

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
