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
    if (panel.totalInscriptionFeeEur > 0 && panel.entryCount > 1) {
      const total =
        global.ClubTorneoPricing && global.ClubTorneoPricing.formatEur
          ? global.ClubTorneoPricing.formatEur(panel.totalInscriptionFeeEur)
          : panel.totalInscriptionFeeLabel || panel.totalInscriptionFeeEur + ' €';
      const thisFee =
        global.ClubTorneoPricing && global.ClubTorneoPricing.formatEur
          ? global.ClubTorneoPricing.formatEur(panel.inscriptionFeeEur)
          : panel.inscriptionFeeLabel || panel.inscriptionFeeEur + ' €';
      return thisFee + ' (este equipo) · Total a pagar: ' + total;
    }
    if (global.ClubTorneoPricing && global.ClubTorneoPricing.formatEur && panel.inscriptionFeeEur > 0) {
      return global.ClubTorneoPricing.formatEur(panel.inscriptionFeeEur);
    }
    if (global.ClubTorneoConfig && global.ClubTorneoConfig.formatFeeLabel) {
      return global.ClubTorneoConfig.formatFeeLabel(panel.inscriptionFeeEur);
    }
    const n = Number(panel.inscriptionFeeEur);
    if (!n || n <= 0) return 'Sin cuota online (el club confirmará el importe)';
    return n.toFixed(0) + ' €';
  }

  function renderFeeBreakdown(panel) {
    const el = $('panelFeeBreakdown');
    if (!el) return;
    const entries = Array.isArray(panel.teamEntries) ? panel.teamEntries : [];
    const unpaid = entries.filter(function (e) {
      return !['enviada_club', 'pagada'].includes(String(e.plantillaStatus || ''));
    });
    if (unpaid.length < 2) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    el.hidden = false;
    const fmt =
      global.ClubTorneoPricing && global.ClubTorneoPricing.formatEur
        ? function (n) {
            return global.ClubTorneoPricing.formatEur(n);
          }
        : function (n) {
            return n + ' €';
          };
    el.innerHTML =
      '<strong style="display:block;margin-bottom:6px;">Desglose por equipo:</strong>' +
      unpaid
        .map(function (e) {
          const cats =
            Array.isArray(e.categoryLabels) && e.categoryLabels.length ? e.categoryLabels.join(', ') : '—';
          return (
            '<div style="font-size:0.84rem;margin:4px 0;">' +
            escapeHtml(e.teamName || 'Equipo') +
            ' (' +
            escapeHtml(cats) +
            '): <strong>' +
            fmt(e.inscriptionFeeEur || 0) +
            '</strong></div>'
          );
        })
        .join('') +
      '<div style="margin-top:8px;font-weight:700;color:#713f12;">Total: ' +
      fmt(panel.totalInscriptionFeeEur || 0) +
      '</div>';
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

  async function readCoachFormWithDocuments(existingDocCount) {
    const base = readCoachForm();
    const U = global.TorneoDocumentUpload;
    if (!U) throw new Error('Subida de documentos no disponible.');
    const documents = await U.readLabeledInputs([
      { el: $('teCoachDocAnverso'), id: 'dni_anverso', label: 'DNI anverso' },
      { el: $('teCoachDocReverso'), id: 'dni_reverso', label: 'DNI reverso' },
      { el: $('teCoachDocOtro'), id: 'otro_doc', label: 'Otro documento' }
    ]);
    if (!documents.length && (existingDocCount || 0) > 0) {
      return Object.assign({}, base, { keepDocuments: true });
    }
    if (!documents.length) {
      throw new Error('Sube al menos el DNI por el anverso u otro documento válido.');
    }
    return Object.assign({}, base, { documents: documents });
  }

  function renderCategoryTabs(panel) {
    const wrap = $('panelCategoryTabs');
    if (!wrap) return;
    const entries = Array.isArray(panel.teamEntries) ? panel.teamEntries : [];
    if (entries.length < 2) {
      wrap.hidden = true;
      wrap.innerHTML = '';
      return;
    }
    wrap.hidden = false;
    const active = panel.activeAccessCode || panel.accessCode || '';
    const nameCounts = {};
    entries.forEach(function (e) {
      const k = String(e.teamName || '')
        .trim()
        .toLowerCase();
      if (k) nameCounts[k] = (nameCounts[k] || 0) + 1;
    });
    wrap.innerHTML = entries
      .map(function (e, idx) {
        const labels =
          Array.isArray(e.categoryLabels) && e.categoryLabels.length
            ? e.categoryLabels.join(', ')
            : 'Categoría';
        const teamLabel = e.teamName || 'Equipo ' + (idx + 1);
        const dupName = nameCounts[String(e.teamName || '').trim().toLowerCase()] > 1;
        const isActive = String(e.accessCode || '') === String(active);
        return (
          '<button type="button" class="category-tab' +
          (isActive ? ' is-active' : '') +
          '" data-access-code="' +
          escapeHtml(e.accessCode || '') +
          '">' +
          escapeHtml(teamLabel) +
          (dupName ? ' #' + (idx + 1) : '') +
          '<small>' +
          escapeHtml(labels) +
          ' · ' +
          escapeHtml(e.accessCode || '') +
          '</small></button>'
        );
      })
      .join('');
    wrap.querySelectorAll('.category-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const code = btn.getAttribute('data-access-code') || '';
        if (!code || !global.TorneoResponsableAccess) return;
        const next = global.TorneoResponsableAccess.setActiveCategory(code);
        if (next) renderPanel(next);
      });
    });
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
      'Responsable: ' +
      (panel.contactName || '—') +
      ' · ' +
      (panel.responsibleEmail || panel.contactEmail || '') +
      (panel.entryCount > 1 ? ' · ' + panel.entryCount + ' equipos' : '');
    renderCategoryTabs(panel);
    if ($('panelResponsibleCode')) {
      $('panelResponsibleCode').textContent = panel.responsibleCode || '—';
    }
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
    renderFeeBreakdown(panel);

    fillCoachForm(panel.coach);
    if ($('teCoachStatus')) {
      const docCount = panel.coach && panel.coach.documentCount ? panel.coach.documentCount : 0;
      $('teCoachStatus').textContent = panel.coach && panel.coach.complete
        ? '✅ Datos del responsable técnico guardados' + (docCount ? ' (' + docCount + ' documento(s))' : '')
        : 'Completa y guarda los datos del responsable técnico (incluye documentación)';
    }

    const list = $('panelFichaList');
    const fichas = Array.isArray(panel.fichas) ? panel.fichas : [];
    const inviteFichas = fichas.filter(function (f) {
      return String(f.source || '') === 'invite' || (f.inviteEmail && String(f.status || '') !== 'enviada');
    });
    if (list) {
      if (!inviteFichas.length) {
        list.innerHTML = '';
      } else {
        list.innerHTML = inviteFichas
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
    }

    if (global.TorneoRosterBatch && global.TorneoRosterBatch.render) {
      global.TorneoRosterBatch.render(panel);
    }

    const closeBtn = $('btnClosePlantilla');
    const sent = ['enviada_club', 'pagada'].includes(String(panel.plantillaStatus || ''));
    const unpaidEntries = (Array.isArray(panel.teamEntries) ? panel.teamEntries : []).filter(function (e) {
      return !['enviada_club', 'pagada'].includes(String(e.plantillaStatus || ''));
    });
    const allTeamsReady =
      unpaidEntries.length > 0 &&
      unpaidEntries.every(function (e) {
        return !!e.canFinalize;
      });
    const premiosOk = $('tePremiosAceptados') && $('tePremiosAceptados').checked;
    const totalPay = panel.totalInscriptionFeeEur || panel.inscriptionFeeEur || 0;
    if (closeBtn) {
      closeBtn.disabled = sent || !allTeamsReady || !premiosOk;
      closeBtn.textContent = sent
        ? '✅ Plantilla enviada al club'
        : totalPay > 0
          ? '💳 Finalizar y pagar ' +
            (global.ClubTorneoPricing && global.ClubTorneoPricing.formatEur
              ? global.ClubTorneoPricing.formatEur(totalPay)
              : totalPay + ' €')
          : '📤 Finalizar y enviar al club';
      closeBtn.title = panel.canFinalize
        ? premiosOk
          ? panel.documentsPendingCount > 0
            ? 'Enviar plantilla al club (aún faltan DNI; podéis subirlos después)'
            : 'Enviar plantilla completa al club'
          : 'Marca la casilla de aceptación de términos sobre premios'
        : 'Completa responsable técnico y todos los jugadores de la plantilla';
    }
    refreshChangePayToCardUI(panel);
  }

  function refreshChangePayToCardUI(panel) {
    const block = $('teChangePayCardBlock');
    const statusEl = $('teChangePayCardStatus');
    const msgEl = $('teChangePayCardMsg');
    const btn = $('btnChangePayToCard');
    if (!block) return;
    const canChange = !!panel.canChangePayToCard;
    block.hidden = !canChange;
    if (!canChange) {
      if (msgEl) msgEl.textContent = '';
      return;
    }
    const fee =
      panel.changePayToCardFeeEur > 0
        ? panel.changePayToCardFeeEur
        : panel.totalInscriptionFeeEur || panel.inscriptionFeeEur || 0;
    const feeLabel =
      panel.changePayToCardFeeLabel ||
      (global.ClubTorneoPricing && global.ClubTorneoPricing.formatEur
        ? global.ClubTorneoPricing.formatEur(fee)
        : fee + ' €');
    const entries = Array.isArray(panel.teamEntries) ? panel.teamEntries : [];
    const pending = entries.filter(function (e) {
      return !!e.canChangePayToCard;
    });
    const labels = pending
      .map(function (e) {
        return e.pendingPayMethodLabel || 'pendiente';
      })
      .filter(Boolean);
    const methodHint = labels.length
      ? labels.indexOf('efectivo') >= 0 && labels.indexOf('transferencia') >= 0
        ? 'efectivo/transferencia'
        : labels[0]
      : panel.pendingPayMethodLabel || 'transferencia o efectivo';
    if (statusEl) {
      statusEl.innerHTML =
        'Tu inscripción está <strong>pendiente de pago</strong> (' +
        escapeHtml(methodHint) +
        '). Puedes <strong>cambiar a tarjeta y pagar ahora</strong>' +
        (fee > 0 ? ' · Importe: <strong>' + escapeHtml(feeLabel) + '</strong>' : '') +
        '.';
    }
    if (btn) {
      btn.disabled = false;
      btn.textContent =
        fee > 0 ? '💳 Cambiar a tarjeta y pagar ' + feeLabel : '💳 Cambiar a tarjeta y pagar';
    }
    if (msgEl) msgEl.textContent = '';
  }

  async function handleChangePayToCard() {
    const errEl = $('teFinalizeError');
    const msgEl = $('teChangePayCardMsg');
    const btn = $('btnChangePayToCard');
    if (errEl) {
      errEl.hidden = true;
      errEl.textContent = '';
    }
    if (
      !global.confirm(
        '¿Cambiar el método de pago a tarjeta y pagar ahora?\n\nSe abrirá la pasarela segura. Al completar el pago, la inscripción quedará pagada.'
      )
    ) {
      return;
    }
    if (btn) btn.disabled = true;
    if (msgEl) {
      msgEl.style.color = '#64748b';
      msgEl.textContent = 'Abriendo pago con tarjeta…';
    }
    try {
      if (!global.TorneoEquipoManage || !global.TorneoEquipoManage.changePayMethodToCard) {
        throw new Error('Servicio de pago no disponible. Recarga la página.');
      }
      const result = await global.TorneoEquipoManage.changePayMethodToCard();
      if (result.paymentRequired && result.redirect) {
        global.TorneoEquipoManage.submitRedsysRedirect(result.redirect);
        return;
      }
      if (result.panel) renderPanel(result.panel);
      throw new Error('No se pudo abrir el pago con tarjeta. Inténtalo de nuevo.');
    } catch (err) {
      if (msgEl) {
        msgEl.style.color = '#dc2626';
        msgEl.textContent = err.message || 'No se pudo cambiar a tarjeta.';
      }
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = err.message || 'No se pudo cambiar a tarjeta.';
      }
    } finally {
      if (btn) btn.disabled = false;
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
      const session = global.TorneoResponsableAccess && global.TorneoResponsableAccess.readSession();
      const docCount =
        session && session.panel && session.panel.coach ? session.panel.coach.documentCount || 0 : 0;
      const coach = await readCoachFormWithDocuments(docCount);
      const panel = await global.TorneoEquipoManage.saveCoach(coach);
      renderPanel(panel);
      if ($('teCoachDocAnverso')) $('teCoachDocAnverso').value = '';
      if ($('teCoachDocReverso')) $('teCoachDocReverso').value = '';
      if ($('teCoachDocOtro')) $('teCoachDocOtro').value = '';
      if ($('teCoachStatus')) $('teCoachStatus').textContent = '✅ Datos del responsable técnico guardados';
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
    const premiosCb = $('tePremiosAceptados');
    if (!premiosCb || !premiosCb.checked) {
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = 'Debes leer y aceptar los términos sobre premios.';
      }
      return;
    }
    const session = global.TorneoResponsableAccess.readSession();
    const panel = session && session.panel;
    const totalPay = (panel && (panel.totalInscriptionFeeEur || panel.inscriptionFeeEur)) || 0;
    const teamCount = (panel && panel.entryCount) || 1;
    const teamLabel =
      panel && panel.teamEntries && panel.teamEntries.length > 1
        ? panel.teamEntries
            .map(function (e) {
              return e.teamName || e.accessCode;
            })
            .join(' · ')
        : panel && panel.teamName
          ? panel.teamName
          : 'Tu equipo';

    if (totalPay <= 0) {
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent =
          'No hay cuota de inscripción configurada para finalizar el pago online. Contacta con el club (cdsanabriafc@gmail.com).';
      }
      return;
    }

    if (!global.TorneoInscripcionPagoModal || !global.TorneoInscripcionPagoModal.show) {
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = 'El pago con tarjeta no está disponible. Recarga la página o contacta con el club.';
      }
      return;
    }

    const payMethod = await global.TorneoInscripcionPagoModal.show({
      amountEur: totalPay,
      teamCount: teamCount,
      teamLabel: teamLabel
    });
    if (!payMethod) return;
    const offlineOk = payMethod === 'transferencia' || payMethod === 'efectivo';
    if (payMethod !== 'card' && !offlineOk) {
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = 'Elige tarjeta, transferencia o efectivo para continuar.';
      }
      return;
    }

    const closeBtn = $('btnClosePlantilla');
    if (closeBtn) closeBtn.disabled = true;

    try {
      const result = await global.TorneoEquipoManage.finalizeInscription({
        inscripcionPremiosAceptados: true,
        payMethod: payMethod
      });
      if (result.paymentRequired && result.redirect) {
        global.TorneoEquipoManage.submitRedsysRedirect(result.redirect);
        return;
      }
      if (result.panel) renderPanel(result.panel);
      const bank =
        (global.PaymentMethodPicker && global.PaymentMethodPicker.CLUB_BANK_ACCOUNT) ||
        'CAJA RURAL ES12 3085 0034 8222 5127 9226';
      if (payMethod === 'transferencia') {
        alert(
          '✅ Plantilla enviada al club.\n\nRealiza la transferencia a:\n' +
            bank +
            '\n\nEl club validará el ingreso y confirmará tu inscripción.'
        );
      } else if (payMethod === 'efectivo') {
        alert(
          '✅ Plantilla enviada al club.\n\nAbona la cuota en efectivo en el club. El club validará el pago y confirmará tu inscripción.'
        );
      } else {
        alert('✅ Plantilla enviada al club correctamente.');
      }
    } catch (err) {
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = err.message || 'No se pudo finalizar.';
      }
    } finally {
      if (closeBtn) closeBtn.disabled = false;
    }
  }

  function handleLogout() {
    if (global.TorneoResponsableAccess) global.TorneoResponsableAccess.clearSession();
    showLogin();
  }

  function init() {
    if ($('teCoachDocLegal') && global.TorneoDocumentUpload) {
      $('teCoachDocLegal').textContent = global.TorneoDocumentUpload.TORNEO_DOC_LEGAL_TEXT;
    }
    if (global.TorneoRosterBatch && global.TorneoRosterBatch.init) {
      global.TorneoRosterBatch.init();
    }
    global.TorneoEquipoPanelRefresh = function (panel) {
      if (panel) renderPanel(panel);
      else refreshPanel();
    };
    const params = new URLSearchParams(global.location.search || '');
    const prefill = params.get('equipo') || params.get('code');
    const prefillEmail = params.get('email');
    if (prefill && $('loginAccessCode')) {
      $('loginAccessCode').value = global.TorneoResponsableAccess
        ? global.TorneoResponsableAccess.normalizeCode(prefill)
        : prefill;
    }
    if (prefillEmail && $('loginContactEmail')) {
      $('loginContactEmail').value = String(prefillEmail).trim();
    }

    $('loginForm') && $('loginForm').addEventListener('submit', handleLogin);
    $('btnLogout') && $('btnLogout').addEventListener('click', handleLogout);
    $('btnRefreshPanel') && $('btnRefreshPanel').addEventListener('click', refreshPanel);
    $('teCoachForm') && $('teCoachForm').addEventListener('submit', handleSaveCoach);
    $('teInviteForm') && $('teInviteForm').addEventListener('submit', handleInvite);
    $('btnClosePlantilla') && $('btnClosePlantilla').addEventListener('click', handleFinalize);
    $('btnChangePayToCard') && $('btnChangePayToCard').addEventListener('click', handleChangePayToCard);
    const premiosCb = $('tePremiosAceptados');
    if (premiosCb) {
      premiosCb.addEventListener('change', function () {
        const session = global.TorneoResponsableAccess && global.TorneoResponsableAccess.readSession();
        if (session && session.panel) renderPanel(session.panel);
      });
    }

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
