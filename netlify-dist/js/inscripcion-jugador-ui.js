/**
 * UI pública — inscripción jugador/a
 */
(function (global) {
  'use strict';

  const state = {
    settings: null,
    kitSelections: {},
    photoData: null,
    flowContinue: false,
    flowFinalize: false,
    continuePlayer: null,
    continueEditable: false,
    lookupIdentity: null,
    payWarningAcknowledged: false,
    lookupCheck: null,
    portalResetToken: null
  };

  function $(id) {
    return document.getElementById(id);
  }

  function show(el, visible) {
    if (!el) return;
    el.style.display = visible ? '' : 'none';
  }

  function formatEur(n) {
    return Number(n || 0).toFixed(2).replace('.', ',') + ' €';
  }

  function normalizeDniAuth(v) {
    if (global.PlayerInscription && global.PlayerInscription.normalizeDni) {
      return global.PlayerInscription.normalizeDni(v);
    }
    return String(v || '')
      .trim()
      .toUpperCase()
      .replace(/[^0-9A-Z]/g, '');
  }

  function getInscriptionSession() {
    try {
      const socio = JSON.parse(global.localStorage.getItem('currentSocio') || 'null');
      if (socio && socio.email) {
        return {
          type: 'socio',
          email: String(socio.email).trim().toLowerCase(),
          dni: normalizeDniAuth(socio.dni),
          nombre: String(socio.nombre || '').trim().toLowerCase(),
          apellidos: String(socio.apellidos || '').trim().toLowerCase(),
          playerId: socio.playerId || null
        };
      }
    } catch (_) {}
    try {
      const member = JSON.parse(global.localStorage.getItem('currentMember') || 'null');
      if (member && member.email) {
        return {
          type: 'socio',
          email: String(member.email).trim().toLowerCase(),
          dni: normalizeDniAuth(member.dni),
          nombre: String(member.name || member.nombre || '').trim().toLowerCase(),
          apellidos: String(member.surname || member.apellidos || '').trim().toLowerCase(),
          playerId: member.playerId || null
        };
      }
    } catch (_) {}
    return null;
  }

  function isInscriptionUserLoggedIn() {
    return !!getInscriptionSession();
  }

  function isPlayerClubApproved(player, season) {
    if (global.PlayerInscription && global.PlayerInscription.isApprovedForInscription) {
      return global.PlayerInscription.isApprovedForInscription(player, season);
    }
    return (
      player &&
      String(player.inscriptionStatus || '').toLowerCase() === 'approved_for_inscription' &&
      String(player.inscriptionSeason || '') === String(season || '')
    );
  }

  function canLookupPlayerRecord(session, player, season) {
    if (!player) return false;
    if (session && canAccessPlayerRecord(session, player)) return true;
    if (isPlayerClubApproved(player, season)) {
      return !!String(player.portalPasswordHash || '').trim();
    }
    return false;
  }

  function getLookupIdentityFromForm() {
    return {
      dni: ($('insLookupDni') && $('insLookupDni').value.trim()) || '',
      name: ($('insLookupName') && $('insLookupName').value.trim()) || '',
      surname: ($('insLookupSurname') && $('insLookupSurname').value.trim()) || ''
    };
  }

  function hidePortalAuthBlocks() {
    ['insPortalLoginBlock', 'insPortalSetupBlock', 'insPortalResetBlock', 'insPortalResetTokenBlock'].forEach(
      function (id) {
        show($(id), false);
      }
    );
    show($('insLookupAuthWrap'), false);
  }

  function showPortalAuthBlock(blockId, hintText) {
    hidePortalAuthBlocks();
    show($('insLookupAuthWrap'), true);
    show($(blockId), true);
    const hint = $('insLookupAuthHint');
    if (hint) hint.textContent = hintText || '';
  }

  function resetLookupAuthFlow() {
    state.lookupCheck = null;
    hidePortalAuthBlocks();
    show($('insLookupFieldsWrap'), true);
  }

  function openForgotPasswordPanel() {
    const identity = state.lookupIdentity || getLookupIdentityFromForm();
    state.lookupIdentity = identity;
    hidePortalAuthBlocks();
    show($('insLookupAuthWrap'), true);
    show($('insPortalResetBlock'), true);
    const hint = $('insLookupAuthHint');
    if (hint) hint.textContent = 'Recuperación de contraseña — el club te responderá por email o teléfono.';
    const msg = $('insLookupMsg');
    if (msg) msg.textContent = '';
  }

  function finishLookupWithPlayer(player) {
    if (!player) return;
    if (global.PlayerPortalAuth && global.PlayerPortalAuth.mergePlayerIntoLocalStorage) {
      global.PlayerPortalAuth.mergePlayerIntoLocalStorage(player);
    }
    const season = state.settings.season;
    const msg = $('insLookupMsg');
    hidePortalAuthBlocks();

    if (
      global.PlayerInscription.requiresPasswordForInscriptionAccess &&
      global.PlayerInscription.requiresPasswordForInscriptionAccess(player.dni, season)
    ) {
      enforceInscriptionCompletedMode();
      return;
    }

    if (state.flowFinalize && !isPlayerClubApproved(player, season)) {
      if (msg) {
        msg.style.color = '#d97706';
        msg.textContent =
          'El club aún no te ha admitido. Cuando te acepten, vuelve a pulsar Finalizar ficha en Nuevo jugador/a.';
      }
      hideInscriptionFormSections();
      return;
    }

    enterContinueMode(player);
  }

  async function runPortalLogin() {
    const msg = $('insLookupMsg');
    const identity = state.lookupIdentity || getLookupIdentityFromForm();
    const password = ($('insPortalPassword') && $('insPortalPassword').value) || '';
    if (!password) {
      if (msg) msg.textContent = 'Introduce tu contraseña de acceso.';
      return;
    }
    if (!global.PlayerPortalAuth) {
      if (msg) {
        msg.style.color = '#dc2626';
        msg.textContent = 'Servicio de acceso no disponible. Prueba más tarde o inicia sesión como socio/a.';
      }
      return;
    }
    try {
      if (msg) msg.textContent = 'Verificando acceso…';
      const player = await global.PlayerPortalAuth.login({
        dni: identity.dni,
        password: password,
        season: state.settings.season
      });
      finishLookupWithPlayer(player);
    } catch (e) {
      if (msg) {
        msg.style.color = '#dc2626';
        msg.textContent =
          e.code === 'bad_password'
            ? 'Contraseña incorrecta.'
            : e.code === 'not_found'
              ? 'No encontramos la ficha.'
              : e.message || 'No se pudo acceder.';
      }
    }
  }

  async function runPortalSetup() {
    const msg = $('insLookupMsg');
    const identity = state.lookupIdentity || getLookupIdentityFromForm();
    const email = ($('insPortalSetupEmail') && $('insPortalSetupEmail').value.trim()) || '';
    const pwd = ($('insPortalSetupPwd') && $('insPortalSetupPwd').value) || '';
    const pwd2 = ($('insPortalSetupPwd2') && $('insPortalSetupPwd2').value) || '';
    if (!email || !pwd || !pwd2) {
      if (msg) msg.textContent = 'Completa email y contraseña.';
      return;
    }
    if (pwd !== pwd2) {
      if (msg) {
        msg.style.color = '#dc2626';
        msg.textContent = 'Las contraseñas no coinciden.';
      }
      return;
    }
    if (pwd.length < 6) {
      if (msg) {
        msg.style.color = '#dc2626';
        msg.textContent = 'La contraseña debe tener al menos 6 caracteres.';
      }
      return;
    }
    try {
      if (msg) msg.textContent = 'Guardando contraseña…';
      const player = await global.PlayerPortalAuth.setupPassword({
        dni: identity.dni,
        email: email,
        password: pwd,
        season: state.settings.season
      });
      finishLookupWithPlayer(player);
    } catch (e) {
      if (msg) {
        msg.style.color = '#dc2626';
        msg.textContent =
          e.code === 'email_mismatch'
            ? 'El email no coincide con el de la ficha. Usa el mismo correo del jugador/a o del tutor/a.'
            : e.code === 'already_set'
              ? 'Esta ficha ya tiene contraseña. Inicia sesión o recupérala por email.'
              : e.message || 'No se pudo crear la contraseña.';
      }
    }
  }

  function runPortalResetRequest() {
    const msg = $('insLookupMsg');
    const identity = state.lookupIdentity || getLookupIdentityFromForm();
    const email = ($('insPortalResetEmail') && $('insPortalResetEmail').value.trim()) || '';
    if (global.PlayerPortalAuth && global.PlayerPortalAuth.openPasswordRecoveryMailto) {
      global.PlayerPortalAuth.openPasswordRecoveryMailto({
        dni: identity.dni,
        name: identity.name,
        surname: identity.surname,
        email: email,
        season: state.settings.season
      });
      if (msg) {
        msg.style.color = '#059669';
        msg.textContent =
          'Se abrirá tu programa de correo hacia el club. Pulsa Enviar en Gmail/Outlook. Cuando te restablezcan la contraseña, vuelve a «Acceder a mi ficha».';
      }
      return;
    }
    if (msg) {
      msg.style.color = '#dc2626';
      const clubEm =
        (global.ClubContactDefaults && global.ClubContactDefaults.getNotifyEmail && global.ClubContactDefaults.getNotifyEmail()) ||
        (global.ClubMailto && global.ClubMailto.getClubNotifyEmail && global.ClubMailto.getClubNotifyEmail()) ||
        'cdsanabriacf@gmail.com';
      msg.textContent = 'No se pudo abrir el correo. Escribe a ' + clubEm + ' con tu DNI.';
    }
  }

  function runPortalResetMailto() {
    runPortalResetRequest();
  }

  async function runPortalResetWithToken() {
    const msg = $('insLookupMsg');
    const token = state.portalResetToken;
    const pwd = ($('insPortalResetTokenPwd') && $('insPortalResetTokenPwd').value) || '';
    const pwd2 = ($('insPortalResetTokenPwd2') && $('insPortalResetTokenPwd2').value) || '';
    if (!token) return;
    if (!pwd || pwd !== pwd2) {
      if (msg) {
        msg.style.color = '#dc2626';
        msg.textContent = pwd !== pwd2 ? 'Las contraseñas no coinciden.' : 'Indica la nueva contraseña.';
      }
      return;
    }
    try {
      if (msg) msg.textContent = 'Guardando nueva contraseña…';
      await global.PlayerPortalAuth.resetPasswordWithToken(token, pwd);
      if (msg) {
        msg.style.color = '#059669';
        msg.textContent = 'Contraseña actualizada. Busca tu ficha con DNI y la nueva contraseña.';
      }
      hidePortalAuthBlocks();
      show($('insLookupFieldsWrap'), true);
      setLookupPanelOpen(true);
      state.portalResetToken = null;
      if (global.history && global.history.replaceState) {
        global.history.replaceState({}, '', 'inscripcion-jugador.html?flow=finalize');
      }
    } catch (e) {
      if (msg) {
        msg.style.color = '#dc2626';
        msg.textContent =
          e.code === 'expired' || e.code === 'invalid_token'
            ? 'El enlace ha caducado o no es válido. Solicita uno nuevo.'
            : e.message || 'No se pudo restablecer la contraseña.';
      }
    }
  }

  async function proceedAfterIdentityCheck(session, player, check) {
    const msg = $('insLookupMsg');
    const season = state.settings.season;

    if (player && global.PlayerInscription.findPaidPlayerForSeason(player.dni, season)) {
      if (msg) {
        msg.style.color = '#dc2626';
        msg.textContent = 'Inscripción ya completada para esta temporada.';
      }
      return;
    }

    if (session && player && canAccessPlayerRecord(session, player)) {
      finishLookupWithPlayer(player);
      return;
    }

    if (!check || !check.ok) {
      if (global.PlayerApplication && state.lookupIdentity && state.lookupIdentity.dni) {
        const pending = global.PlayerApplication.findPendingByDni(state.lookupIdentity.dni, season);
        if (pending) {
          if (msg) {
            msg.style.color = '#d97706';
            msg.textContent =
              'Tu solicitud está pendiente de revisión por el club. Te avisaremos cuando puedas continuar aquí.';
          }
          return;
        }
      }
      if (msg) {
        msg.style.color = '#b45309';
        msg.textContent =
          'No encontramos tu ficha. Puedes rellenar el formulario de abajo. Si eres nuevo/a, solicita alta desde la página principal.';
      }
      hideInscriptionFormSections();
      return;
    }

    show($('insLookupFieldsWrap'), false);
    state.lookupCheck = check;

    if (check.hasPortalPassword) {
      showPortalAuthBlock(
        'insPortalLoginBlock',
        'Introduce la contraseña de acceso a tu ficha' +
          (check.maskedEmail ? ' (email registrado: ' + check.maskedEmail + ').' : '.')
      );
      if (msg) msg.textContent = '';
      return;
    }

    showPortalAuthBlock(
      'insPortalSetupBlock',
      'Crea tu contraseña de acceso. Debe coincidir el email de la ficha' +
        (check.maskedEmail ? ' (' + check.maskedEmail + ').' : '.')
    );
    if (msg) msg.textContent = '';
  }

  function canAccessPlayerRecord(session, player) {
    if (!session || !player) return false;
    const playerDni = normalizeDniAuth(player.dni);
    const playerEmail = String(player.email || '').trim().toLowerCase();
    const gDni = normalizeDniAuth(player.guardianDNI || player.guardianDni);
    const gEmail = String(player.guardianEmail || '').trim().toLowerCase();
    const pName = String(player.name || player.nombre || '').trim().toLowerCase();
    const pSurname = String(player.surname || player.apellidos || '').trim().toLowerCase();

    if (session.playerId && player.id && String(session.playerId) === String(player.id)) return true;
    if (session.dni && playerDni && session.dni === playerDni) return true;
    if (session.email && playerEmail && session.email === playerEmail) return true;
    if (session.dni && gDni && session.dni === gDni) return true;
    if (session.email && gEmail && session.email === gEmail) return true;
    if (
      session.nombre &&
      session.apellidos &&
      pName === session.nombre &&
      pSurname === session.apellidos
    ) {
      return true;
    }
    return false;
  }

  function getLoginReturnUrl() {
    const path = 'inscripcion-jugador.html';
    const q = state.flowFinalize ? '?flow=finalize' : state.flowContinue ? '?flow=continue' : '';
    return path + q;
  }

  function promptLoginForLookup() {
    const ret = encodeURIComponent(getLoginReturnUrl());
    const go = global.confirm(
      'Por protección de datos, debes iniciar sesión como socio/a del club para buscar una ficha de jugador/a.\n\n¿Ir a la página de acceso ahora?'
    );
    if (go) {
      global.location.href = 'index.html?openAcceso=1&return=' + ret;
    }
  }

  function updateLookupAuthUI() {
    const logged = isInscriptionUserLoggedIn();
    const session = getInscriptionSession();
    const warn = $('insLookupLoginWarn');
    const fields = $('insLookupFieldsWrap');
    const btn = $('insLookupBtn');
    if (warn) {
      warn.style.display = 'block';
      if (logged) {
        warn.style.background = '#ecfdf5';
        warn.style.border = '1px solid #6ee7b7';
        warn.style.color = '#065f46';
        warn.innerHTML =
          'Sesión: <strong>' +
          (session.email || 'socio/a') +
          '</strong>. Puedes buscar fichas vinculadas a tu cuenta o las que el club ya haya admitido como jugador/a.';
      } else {
        warn.style.background = '#eff6ff';
        warn.style.border = '1px solid #93c5fd';
        warn.style.color = '#1e3a8a';
        warn.innerHTML =
          'Si el club <strong>ya te admitió</strong>, busca con tu DNI y la <strong>contraseña de acceso</strong>. ' +
          'Si la olvidas, usa <strong>¿Olvidaste tu contraseña?</strong> y escribe al club (no hace falta correo automático). ' +
          'Si ya eres socio/a, también puedes <a href="index.html?openAcceso=1&amp;return=' +
          encodeURIComponent(getLoginReturnUrl()) +
          '" style="color:#1d4ed8;font-weight:700;">iniciar sesión</a>.';
      }
    }
    if (fields) fields.style.display = '';
    if (btn) btn.style.display = '';
  }

  function sizeOptionsHtml() {
    if (!global.ClubInscriptionConfig) return '';
    const sizes =
      global.ClubInscriptionConfig.INSCRIPTION_KIT_SIZES ||
      global.ClubInscriptionConfig.ALL_SIZES;
    return sizes
      .map(function (s) {
        return '<option value="' + s + '">' + s + '</option>';
      })
      .join('');
  }

  function getCategoryRow(categoryId) {
    const rows = global.ClubInscriptionConfig.INSCRIPTION_CATEGORY_ROWS || [];
    return rows.find(function (r) {
      return r.id === categoryId;
    });
  }

  function categoryFeeLabel(row) {
    if (!row) return '';
    return row.ficha + '€ + ' + row.socio + '€ cuota socio';
  }

  function hasExistingPortalPassword() {
    const p = state.continuePlayer;
    if (p && String(p.portalPasswordHash || '').trim().length >= 32) return true;
    const season = state.settings ? state.settings.season : '';
    const dni =
      ($('insDni') && $('insDni').value.trim()) ||
      ($('insGuardianDni') && $('insGuardianDni').value.trim()) ||
      '';
    if (dni && global.PlayerInscription) {
      const found =
        global.PlayerInscription.findPlayerForSeason(dni, season) ||
        global.PlayerInscription.findApprovedForInscription(dni, season);
      if (found && String(found.portalPasswordHash || '').trim().length >= 32) return true;
    }
    if (dni) {
      try {
        const apps = JSON.parse(global.localStorage.getItem('clubPlayerApplications') || '[]');
        const n = normalizeDniAuth(dni);
        const app = apps.find(function (a) {
          return (
            normalizeDniAuth(a.dni) === n &&
            String(a.season || '') === String(season) &&
            String(a.portalPasswordHash || '').trim().length >= 32
          );
        });
        if (app) return true;
      } catch (_) {}
    }
    return false;
  }

  function updatePortalPasswordBlockUI() {
    const block = $('insPortalPwdBlock');
    if (!block) return;
    if (state.passwordOnlyMode || (state.continuePlayer && !state.continueEditable)) {
      show(block, false);
      return;
    }
    show(block, true);
    const existing = hasExistingPortalPassword();
    const hint = $('insPortalPwdExistingHint');
    const l1 = $('insPortalPasswordNewLabel');
    const l2 = $('insPortalPasswordNew2Label');
    const req = existing ? '' : ' *';
    if (hint) show(hint, existing);
    if (l1) l1.textContent = 'Contraseña' + req;
    if (l2) l2.textContent = 'Repetir contraseña' + req;
    const p1 = $('insPortalPasswordNew');
    const p2 = $('insPortalPasswordNew2');
    if (p1) p1.required = !existing;
    if (p2) p2.required = !existing;
  }

  function composeGuardianAddress(parts) {
    if (global.PlayerInscription && global.PlayerInscription.composeAddress) {
      return global.PlayerInscription.composeAddress(parts);
    }
    const domicilio = String(parts?.domicilio || '').trim();
    const localidad = String(parts?.localidad || '').trim();
    const provincia = String(parts?.provincia || '').trim();
    return [domicilio, localidad, provincia].filter(Boolean).join(', ');
  }

  function guardianSameDomicilioChecked() {
    const cb = $('insGuardianSameDomicilio');
    return !cb || cb.checked;
  }

  function toggleGuardianDomicilioFields() {
    const wrap = $('insGuardianDomicilioFields');
    if (!wrap) return;
    wrap.style.display = guardianSameDomicilioChecked() ? 'none' : 'block';
  }

  function resolveGuardianAddressFromForm() {
    if (guardianSameDomicilioChecked()) {
      return {
        guardianSameDomicilio: true,
        guardianDomicilio: ($('insDomicilio') && $('insDomicilio').value.trim()) || '',
        guardianLocalidad: ($('insLocalidad') && $('insLocalidad').value.trim()) || '',
        guardianProvincia: ($('insProvincia') && $('insProvincia').value.trim()) || 'Zamora'
      };
    }
    return {
      guardianSameDomicilio: false,
      guardianDomicilio: ($('insGuardianDomicilio') && $('insGuardianDomicilio').value.trim()) || '',
      guardianLocalidad: ($('insGuardianLocalidad') && $('insGuardianLocalidad').value.trim()) || '',
      guardianProvincia: ($('insGuardianProvincia') && $('insGuardianProvincia').value.trim()) || 'Zamora'
    };
  }

  function setPersonalReadonly(readonly) {
    [
      'insName',
      'insSurname',
      'insDni',
      'insEmail',
      'insPhone',
      'insBirth',
      'insDomicilio',
      'insLocalidad',
      'insProvincia',
      'insPortalPasswordNew',
      'insPortalPasswordNew2',
      'insWeight',
      'insHeight',
      'insPosition',
      'insBloodGroup',
      'insInjuries',
      'insAllergy',
      'insObservations',
      'insGuardianName',
      'insGuardianDni',
      'insGuardianPhone',
      'insGuardianEmail',
      'insGuardianSameDomicilio',
      'insGuardianDomicilio',
      'insGuardianLocalidad',
      'insGuardianProvincia'
    ].forEach(function (id) {
      const el = $(id);
      if (el) el.disabled = !!readonly;
    });
    document.querySelectorAll('[name="insCategoryPick"]').forEach(function (cb) {
      cb.disabled = !!readonly;
    });
    if ($('insPhoto')) $('insPhoto').disabled = !!readonly;
    updatePortalPasswordBlockUI();
  }

  function setCategoryCheckbox(categoryId) {
    const id = String(categoryId || '').trim();
    document.querySelectorAll('[name="insCategoryPick"]').forEach(function (cb) {
      cb.checked = cb.value === id;
    });
    if ($('insCategory')) $('insCategory').value = id;
    refreshCart();
  }

  function onCategoryCheckChange(changedCb) {
    if (changedCb && changedCb.checked) {
      document.querySelectorAll('[name="insCategoryPick"]').forEach(function (cb) {
        if (cb !== changedCb) cb.checked = false;
      });
    }
    const picked = document.querySelector('[name="insCategoryPick"]:checked');
    if ($('insCategory')) $('insCategory').value = picked ? picked.value : '';
    refreshCart();
  }

  function renderCategoryFeesTable() {
    const tbody = $('insCategoryFeesBody');
    if (!tbody || !global.ClubInscriptionConfig) return;
    const rows = global.ClubInscriptionConfig.INSCRIPTION_CATEGORY_ROWS || [];
    tbody.innerHTML = rows
      .map(function (r) {
        const yrs = r.years ? ' <span style="font-weight:400;color:#64748b;">' + r.years + '</span>' : '';
        return (
          '<tr><td class="insc-cat-pick">' +
          '<input type="checkbox" name="insCategoryPick" value="' +
          r.id +
          '" aria-label="' +
          r.label +
          yrs +
          '">' +
          '</td><td><strong>' +
          r.label +
          '</strong>' +
          yrs +
          '</td><td>' +
          categoryFeeLabel(r) +
          '</td></tr>'
        );
      })
      .join('');
    tbody.querySelectorAll('[name="insCategoryPick"]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        onCategoryCheckChange(cb);
      });
    });
  }

  function enforceInscriptionCompletedMode() {
    state.passwordOnlyMode = true;
    hideInscriptionFormSections();
    show($('inscFinalizeIntro'), false);
    const banner = $('inscPasswordOnlyBanner');
    if (banner) {
      banner.style.display = 'block';
      banner.innerHTML =
        'Ya has completado (o enviado) tu inscripción. Entra con <strong>Acceso</strong> en la página principal como <strong>socio/a</strong> o <strong>jugador/a</strong>, con tu <strong>email</strong> y la <strong>misma contraseña</strong>.';
    }
    setLookupPanelOpen(true);
    show($('insLookupFieldsWrap'), false);
    hidePortalAuthBlocks();
    const msg = $('insLookupMsg');
    if (msg) msg.textContent = '';
  }

  function enforcePasswordOnlyMode() {
    enforceInscriptionCompletedMode();
  }

  function prefillFromPlayer(p) {
    if (!p) return;
    if ($('insName')) $('insName').value = p.name || p.nombre || '';
    if ($('insSurname')) $('insSurname').value = p.surname || p.apellidos || '';
    if ($('insDni')) $('insDni').value = p.dni || '';
    if ($('insEmail')) $('insEmail').value = p.email || '';
    if ($('insPhone')) $('insPhone').value = p.phone || p.telefono || '';
    if ($('insBirth')) $('insBirth').value = p.birthDate || p.fechaNacimiento || '';
    if ($('insDomicilio')) {
      $('insDomicilio').value =
        p.domicilio || (p.localidad || p.provincia ? '' : p.address || p.direccion || '');
    }
    if ($('insLocalidad')) $('insLocalidad').value = p.localidad || p.town || '';
    if ($('insProvincia')) {
      $('insProvincia').value = p.provincia || p.province || 'Zamora';
    }
    if (p.category || p.categoria) setCategoryCheckbox(p.category || p.categoria);
    if ($('insWeight') && p.weightKg != null) $('insWeight').value = p.weightKg;
    if ($('insHeight') && p.heightCm != null) $('insHeight').value = p.heightCm;
    if ($('insPosition') && p.position) $('insPosition').value = p.position || p.posicion || '';
    if ($('insBloodGroup') && p.bloodGroup) $('insBloodGroup').value = p.bloodGroup;
    if ($('insInjuries')) {
      const inj = [p.injuries, p.injuriesYear].filter(Boolean).join(p.injuriesYear ? ' — ' : '');
      $('insInjuries').value = inj || p.injuries || '';
    }
    if ($('insAllergy') && p.allergyIllness) $('insAllergy').value = p.allergyIllness;
    if ($('insObservations') && p.observations) $('insObservations').value = p.observations;
    if ($('insGuardianName')) $('insGuardianName').value = p.guardianName || '';
    if ($('insGuardianDni')) $('insGuardianDni').value = p.guardianDNI || p.guardianDni || '';
    if ($('insGuardianPhone')) $('insGuardianPhone').value = p.guardianPhone || '';
    if ($('insGuardianEmail')) $('insGuardianEmail').value = p.guardianEmail || '';
    const playerAddr = composeGuardianAddress({
      domicilio: p.domicilio,
      localidad: p.localidad,
      provincia: p.provincia
    });
    const guardianAddr =
      p.guardianAddress ||
      composeGuardianAddress({
        domicilio: p.guardianDomicilio,
        localidad: p.guardianLocalidad,
        provincia: p.guardianProvincia
      });
    const sameDom =
      p.guardianSameDomicilio === true ||
      (p.guardianSameDomicilio !== false && (!guardianAddr || guardianAddr === playerAddr));
    if ($('insGuardianSameDomicilio')) $('insGuardianSameDomicilio').checked = sameDom;
    if ($('insGuardianDomicilio')) {
      $('insGuardianDomicilio').value = p.guardianDomicilio || '';
    }
    if ($('insGuardianLocalidad')) $('insGuardianLocalidad').value = p.guardianLocalidad || '';
    if ($('insGuardianProvincia')) {
      $('insGuardianProvincia').value = p.guardianProvincia || p.provincia || 'Zamora';
    }
    if ($('insCategorySuperiorConsent')) {
      $('insCategorySuperiorConsent').checked =
        !!p.categorySuperiorConsent || !!p.categorySuperiorConsentAt;
    }
    toggleGuardianDomicilioFields();
    onBirthChange();
    updatePortalPasswordBlockUI();
  }

  function hideInscriptionFormSections() {
    ['insCategorySection', 'insPersonalSection', 'guardianBlock'].forEach(function (id) {
      const el = $(id);
      if (el) el.style.display = 'none';
    });
    document.querySelectorAll('#inscFormWrap section.card').forEach(function (el) {
      if (el.id === 'insLookupBlock' || el.id === 'insPersonalSection' || el.id === 'insCategorySection') return;
      el.style.display = 'none';
    });
  }

  function showAllFormSections() {
    show($('insCategorySection'), true);
    show($('insPersonalSection'), true);
    document.querySelectorAll('#inscFormWrap section.card').forEach(function (el) {
      if (el.id === 'insLookupBlock') return;
      el.style.display = '';
    });
    show($('guardianBlock'), false);
    onBirthChange();
  }

  function enterContinueMode(player) {
    state.continuePlayer = player;
    state.continueEditable = false;
    prefillFromPlayer(player);
    setPersonalReadonly(true);
    show($('inscFinalizeIntro'), false);
    show($('insClubRulesLine'), true);
    if ($('insPlayerConsent')) $('insPlayerConsent').checked = true;
    if ($('insPhotoConsent')) $('insPhotoConsent').checked = true;
    showAllFormSections();
    setLookupPanelOpen(false);
    const msg = $('insLookupMsg');
    if (msg) {
      msg.style.color = '#059669';
      msg.textContent =
        'Solicitud aceptada. Revisa equipación y pago para la temporada ' + (state.settings.season || '') + '.';
    }
    refreshCart();
    const personal = $('insPersonalSection');
    if (personal && personal.scrollIntoView) personal.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function prefillReturningPlayer(player) {
    state.continuePlayer = player;
    state.continueEditable = true;
    prefillFromPlayer(player);
    setPersonalReadonly(false);
    show($('insClubRulesLine'), true);
    showAllFormSections();
    setLookupPanelOpen(false);
    const msg = $('insLookupMsg');
    if (msg) {
      msg.style.color = '#059669';
      msg.textContent =
        'Ficha encontrada. Revisa tus datos, elige equipación y paga la inscripción de la temporada ' +
        (state.settings.season || '') +
        '.';
    }
    refreshCart();
    const personal = $('insPersonalSection');
    if (personal && personal.scrollIntoView) personal.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function setLookupPanelOpen(open) {
    show($('insLookupBlock'), !!open);
  }

  async function runLookup() {
    const session = getInscriptionSession();
    const identity = getLookupIdentityFromForm();
    const password = ($('insPortalPassword') && $('insPortalPassword').value) || '';
    const msg = $('insLookupMsg');
    const season = state.settings.season;

    state.lookupIdentity = identity;
    hidePortalAuthBlocks();

    if (!identity.dni && (!identity.name || !identity.surname)) {
      if (msg) {
        msg.style.color = '#dc2626';
        msg.textContent = 'Introduce tu DNI o nombre y apellidos.';
      }
      return;
    }
    if (!password) {
      if (msg) {
        msg.style.color = '#dc2626';
        msg.textContent = 'Introduce la contraseña de acceso a tu ficha.';
      }
      if ($('insPortalPassword') && $('insPortalPassword').focus) $('insPortalPassword').focus();
      return;
    }

    const paid = identity.dni
      ? global.PlayerInscription.findPaidPlayerForSeason(identity.dni, season)
      : null;
    if (paid) {
      if (msg) {
        msg.style.color = '#dc2626';
        msg.textContent = 'Ya tienes la inscripción de esta temporada completada y pagada.';
      }
      return;
    }

    let player = null;
    if (global.PlayerInscription.findApprovedForInscriptionByIdentity) {
      player = global.PlayerInscription.findApprovedForInscriptionByIdentity(
        identity.dni,
        identity.name,
        identity.surname,
        season
      );
    } else if (identity.dni) {
      player = global.PlayerInscription.findApprovedForInscription(identity.dni, season);
    }
    if (!player) {
      player = global.PlayerInscription.findPlayerForContinueLookup(
        identity.dni,
        identity.name,
        identity.surname,
        season
      );
    }

    if (session && player && canAccessPlayerRecord(session, player)) {
      finishLookupWithPlayer(player);
      return;
    }

    if (!global.PlayerPortalAuth) {
      if (msg) {
        msg.style.color = '#dc2626';
        msg.textContent = 'Acceso protegido no disponible. Inicia sesión como socio/a o inténtalo más tarde.';
      }
      return;
    }

    try {
      if (msg) {
        msg.style.color = '#64748b';
        msg.textContent = 'Comprobando acceso…';
      }
      const loggedPlayer = await global.PlayerPortalAuth.login({
        dni: identity.dni,
        name: identity.name,
        surname: identity.surname,
        password: password,
        season: season
      });
      if (!loggedPlayer) {
        throw new Error('No se pudo acceder a la ficha.');
      }
      finishLookupWithPlayer(loggedPlayer);
    } catch (e) {
      if (global.PlayerApplication && identity.dni) {
        const pending = global.PlayerApplication.findPendingByDni(identity.dni, season);
        if (pending) {
          if (msg) {
            msg.style.color = '#d97706';
            msg.textContent =
              'Tu solicitud está pendiente de revisión. Cuando el club te acepte, usa aquí la contraseña que elegiste al registrarte.';
          }
          return;
        }
      }
      if (msg) {
        msg.style.color = '#dc2626';
        if (e.code === 'bad_password') {
          msg.textContent = 'Contraseña incorrecta. Si la olvidaste, pulsa «¿Olvidaste tu contraseña?».';
        } else if (e.code === 'no_password') {
          msg.textContent =
            'Esta ficha aún no tiene contraseña. Escríbe al club o pide que te la asignen desde el panel de administración.';
        } else if (e.code === 'not_found') {
          msg.textContent =
            'No encontramos tu ficha con esos datos. Si eres nuevo/a, solicita el alta en la página principal. Si ya te aceptaron, comprueba DNI y contraseña.';
          hideInscriptionFormSections();
        } else {
          msg.textContent = e.message || 'No se pudo acceder. Comprueba DNI y contraseña.';
        }
      }
    }
  }

  function renderKitSection() {
    const wrap = $('kitGarmentsWrap');
    if (!wrap || !state.settings) return;
    const garments = global.ClubInscriptionConfig.getEnabledGarments(state.settings);
    wrap.innerHTML = '';
    if (!garments.length) {
      wrap.innerHTML = '<p style="color:#64748b;">No hay equipación configurada para esta temporada.</p>';
      return;
    }
    garments.forEach(function (g) {
      const row = document.createElement('div');
      row.className = 'kit-row';
      const priceHint =
        Number(g.price) > 0 ? ' <span class="muted">(' + formatEur(g.price) + ')</span>' : '';
      const mandatoryHint =
        g.id === 'train_kit'
          ? ' <span class="kit-mandatory-hint">Obligatoria en los entrenamientos</span>'
          : '';
      const optionalHint =
        g.id === 'cazadora' ? ' <span class="kit-optional-hint">Opcional</span>' : '';
      row.innerHTML =
        '<span class="kit-label">' +
        g.label +
        priceHint +
        '</span>' +
        '<select data-kit-size="' +
        g.id +
        '" class="kit-size"><option value="">Talla</option>' +
        sizeOptionsHtml() +
        '</select>' +
        mandatoryHint +
        optionalHint;
      wrap.appendChild(row);
      const sel = row.querySelector('[data-kit-size]');
      if (sel) sel.addEventListener('change', refreshCart);
    });
  }

  function collectKitItems() {
    const items = [];
    const garments = global.ClubInscriptionConfig.getEnabledGarments(state.settings);
    garments.forEach(function (g) {
      const sel = document.querySelector('[data-kit-size="' + g.id + '"]');
      const size = sel ? sel.value : '';
      if (!size) return;
      items.push({
        id: g.id,
        label: g.label,
        size: size,
        price: Number(g.price || 0)
      });
    });
    return items;
  }

  function inscriptionPaysCategoryFees() {
    const s = state.settings || {};
    return !!(s.chargeFicha || s.chargeSocio);
  }

  function getFormData() {
    const guardianAddrParts = resolveGuardianAddressFromForm();
    return {
      name: ($('insName') && $('insName').value.trim()) || '',
      surname: ($('insSurname') && $('insSurname').value.trim()) || '',
      dni: ($('insDni') && $('insDni').value.trim()) || '',
      email: ($('insEmail') && $('insEmail').value.trim()) || '',
      phone: ($('insPhone') && $('insPhone').value.trim()) || '',
      domicilio: ($('insDomicilio') && $('insDomicilio').value.trim()) || '',
      localidad: ($('insLocalidad') && $('insLocalidad').value.trim()) || '',
      provincia: ($('insProvincia') && $('insProvincia').value.trim()) || 'Zamora',
      address: global.PlayerInscription.composeAddress
        ? global.PlayerInscription.composeAddress({
            domicilio: ($('insDomicilio') && $('insDomicilio').value.trim()) || '',
            localidad: ($('insLocalidad') && $('insLocalidad').value.trim()) || '',
            provincia: ($('insProvincia') && $('insProvincia').value.trim()) || 'Zamora'
          })
        : '',
      birthDate: ($('insBirth') && $('insBirth').value) || '',
      category: ($('insCategory') && $('insCategory').value) || '',
      position: ($('insPosition') && $('insPosition').value) || '',
      bloodGroup: ($('insBloodGroup') && $('insBloodGroup').value.trim()) || '',
      injuries: ($('insInjuries') && $('insInjuries').value.trim()) || '',
      injuriesYear: '',
      allergyIllness: ($('insAllergy') && $('insAllergy').value.trim()) || '',
      observations: ($('insObservations') && $('insObservations').value.trim()) || '',
      previousSeasonPlayed: state.flowContinue || state.flowFinalize ? '2025-2026' : '',
      weightKg: $('insWeight') && $('insWeight').value ? Number($('insWeight').value) : null,
      heightCm: $('insHeight') && $('insHeight').value ? Number($('insHeight').value) : null,
      guardianName: ($('insGuardianName') && $('insGuardianName').value.trim()) || '',
      guardianDNI: ($('insGuardianDni') && $('insGuardianDni').value.trim()) || '',
      guardianPhone: ($('insGuardianPhone') && $('insGuardianPhone').value.trim()) || '',
      guardianEmail: ($('insGuardianEmail') && $('insGuardianEmail').value.trim()) || '',
      guardianSameDomicilio: guardianAddrParts.guardianSameDomicilio,
      guardianDomicilio: guardianAddrParts.guardianDomicilio,
      guardianLocalidad: guardianAddrParts.guardianLocalidad,
      guardianProvincia: guardianAddrParts.guardianProvincia,
      guardianAddress: composeGuardianAddress(guardianAddrParts),
      categorySuperiorConsent:
        $('insCategorySuperiorConsent') && $('insCategorySuperiorConsent').checked,
      playerConsent: $('insPlayerConsent') && $('insPlayerConsent').checked,
      photoConsent: $('insPhotoConsent') && $('insPhotoConsent').checked,
      clubRulesAccepted: $('insClubRules') && $('insClubRules').checked,
      photoData: state.photoData,
      portalPassword: ($('insPortalPasswordNew') && $('insPortalPasswordNew').value) || '',
      portalPasswordConfirm: ($('insPortalPasswordNew2') && $('insPortalPasswordNew2').value) || ''
    };
  }

  function validatePortalPasswordFields() {
    if (state.passwordOnlyMode || (state.continuePlayer && !state.continueEditable)) {
      return null;
    }
    const pwd = ($('insPortalPasswordNew') && $('insPortalPasswordNew').value) || '';
    const pwd2 = ($('insPortalPasswordNew2') && $('insPortalPasswordNew2').value) || '';
    const existing = hasExistingPortalPassword();
    if (!existing) {
      if (!pwd || pwd.length < 6) {
        return 'Indica una contraseña de acceso a tu ficha (mínimo 6 caracteres).';
      }
      if (pwd !== pwd2) {
        return 'Las contraseñas de acceso no coinciden.';
      }
      return null;
    }
    if (!pwd && !pwd2) return null;
    if (pwd.length < 6) {
      return 'La nueva contraseña debe tener al menos 6 caracteres.';
    }
    if (pwd !== pwd2) {
      return 'Las contraseñas no coinciden.';
    }
    return null;
  }

  function refreshCart() {
    const form = getFormData();
    const category = form.category || global.ClubInscriptionConfig.suggestCategoryFromBirthDate(form.birthDate);
    const kitItems = collectKitItems();
    const payFees = !!category && inscriptionPaysCategoryFees();
    const payFicha = payFees && state.settings.chargeFicha !== false;
    const paySocio = payFees && state.settings.chargeSocio !== false;
    const cart = global.PlayerInscription.computeCart(state.settings, category, kitItems, payFicha, paySocio);

    const lines = $('cartLines');
    if (!lines) return;
    let html = '';
    let hasLines = false;

    if (cart.fichaFee > 0) {
      html +=
        '<div class="cart-line"><span>Cuota inscripción federativa</span><span>' +
        formatEur(cart.fichaFee) +
        '</span></div>';
      hasLines = true;
    }
    if (cart.socioFee > 0) {
      html +=
        '<div class="cart-line"><span>Cuota socio del club</span><span>' +
        formatEur(cart.socioFee) +
        '</span></div>';
      hasLines = true;
    }
    const feesSubtotal = (cart.fichaFee || 0) + (cart.socioFee || 0);
    if (feesSubtotal > 0) {
      html +=
        '<div class="cart-subtotal"><span>Subtotal inscripción</span><span>' +
        formatEur(feesSubtotal) +
        '</span></div>';
    }

    kitItems.forEach(function (it) {
      const priceTxt = it.price > 0 ? formatEur(it.price) : '—';
      html +=
        '<div class="cart-line"><span>' +
        it.label +
        ' (talla ' +
        it.size +
        ')</span><span>' +
        priceTxt +
        '</span></div>';
      hasLines = true;
    });
    if (cart.kitTotal > 0) {
      html +=
        '<div class="cart-subtotal"><span>Subtotal ropa entreno</span><span>' +
        formatEur(cart.kitTotal) +
        '</span></div>';
    }

    lines.innerHTML = html;
    if ($('cartTotal')) $('cartTotal').textContent = formatEur(cart.total);
    state.lastCart = { kitItems: kitItems, cart: cart, category: category };
  }

  function clubEmailsEqual(a, b) {
    return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  }

  function toggleGuardian() {
    if (state.continuePlayer && !state.continueEditable) return;
    const bd = $('insBirth') && $('insBirth').value;
    const age = global.ClubInscriptionConfig.calculateAge(bd);
    const sec = $('guardianBlock');
    show(sec, age != null && age < 18);
  }

  function onBirthChange() {
    const bd = $('insBirth') && $('insBirth').value;
    const cat = global.ClubInscriptionConfig.suggestCategoryFromBirthDate(bd);
    if (cat && (!state.continuePlayer || state.continueEditable) && !state.passwordOnlyMode) {
      const picked = document.querySelector('[name="insCategoryPick"]:checked');
      if (!picked) setCategoryCheckbox(cat);
    }
    if ($('insAge')) $('insAge').textContent = global.ClubInscriptionConfig.calculateAge(bd) ?? '—';
    const hint = $('insDniHint');
    const age = global.ClubInscriptionConfig.calculateAge(bd);
    if (hint) {
      hint.textContent =
        age != null && age < 18
          ? '(opcional para menores; obligatorio DNI del tutor/a abajo)'
          : '(obligatorio si eres mayor de edad)';
    }
    toggleGuardian();
    toggleGuardianDomicilioFields();
    refreshCart();
  }

  function validateForm() {
    const f = getFormData();
    const approvedOnly =
      state.continuePlayer && !state.continueEditable;

    if (!approvedOnly) {
      if (!f.name || !f.surname || !f.email || !f.phone || !f.birthDate) {
        return 'Completa nombre, apellidos, email, teléfono y fecha de nacimiento.';
      }
      const age = global.ClubInscriptionConfig.calculateAge(f.birthDate);
      if (age != null && age >= 18 && !f.dni) {
        return 'El DNI es obligatorio para mayores de edad.';
      }
      if (age != null && age < 18) {
        if (!f.guardianName || !f.guardianDNI || !f.guardianPhone || !f.guardianEmail) {
          return 'Para menores, los datos del tutor/a son obligatorios.';
        }
        if (clubEmailsEqual(f.email, f.guardianEmail)) {
          return 'El menor no puede usar el mismo correo que su padre o tutor/a. Indica un email distinto para el jugador/a.';
        }
        if (!f.categorySuperiorConsent) {
          return 'Para menores, debes leer y aceptar la autorización de categoría superior (CATEGORÍA).';
        }
      }
    }

    if ((state.flowContinue || state.flowFinalize) && !f.clubRulesAccepted) {
      return 'Debes leer y aceptar las normas y condiciones de inscripción del club.';
    }
    if (!f.playerConsent || !f.photoConsent) {
      return 'Debes aceptar los consentimientos obligatorios.';
    }
    if (!f.category) {
      return 'Marca la categoría a la que perteneces esta temporada.';
    }

    const season = state.settings.season;
    const dniCheck = f.dni || f.guardianDNI;
    if (dniCheck) {
      const paid = global.PlayerInscription.findPaidPlayerForSeason(dniCheck, season);
      if (paid && (!state.continuePlayer || paid.id !== state.continuePlayer.id)) {
        return 'Ya existe una inscripción pagada para esta temporada con este DNI.';
      }
    }

    const pwdErr = validatePortalPasswordFields();
    if (pwdErr) return pwdErr;
    return null;
  }

  async function handlePhoto(file) {
    if (!file || (state.continuePlayer && !state.continueEditable)) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('La foto no puede superar 2 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = function () {
      state.photoData = reader.result;
      const img = $('insPhotoPreview');
      if (img) {
        img.src = state.photoData;
        show($('insPhotoBox'), true);
      }
    };
    reader.readAsDataURL(file);
  }

  function buildRegistration() {
    const f = getFormData();
    f.category = f.category || global.ClubInscriptionConfig.suggestCategoryFromBirthDate(f.birthDate);
    const kitItems = state.lastCart ? state.lastCart.kitItems : collectKitItems();
    const payFees = !!f.category && inscriptionPaysCategoryFees();
    const payFicha = payFees && state.settings.chargeFicha !== false;
    const paySocio = payFees && state.settings.chargeSocio !== false;
    const cart = global.PlayerInscription.computeCart(state.settings, f.category, kitItems, payFicha, paySocio);
    const player = global.PlayerInscription.buildPlayerRecord(f, { kitItems: kitItems, ...cart }, state.settings);
    if (state.continuePlayer && state.continuePlayer.id) {
      player.id = state.continuePlayer.id;
      player.applicationId = state.continuePlayer.applicationId || player.applicationId;
    }
    const member = global.PlayerInscription.findMemberByDni(f.dni);
    if (member && member.id) player.linkedMemberId = member.id;
    if (f.clubRulesAccepted) player.clubRulesAcceptedAt = new Date().toISOString();
    if (f.categorySuperiorConsent) player.categorySuperiorConsentAt = new Date().toISOString();
    return player;
  }

  function buildPlayerClubNotifyFields(reg) {
    const kit = (reg.kit && reg.kit.items) || reg.kitOrder || [];
    const kitTxt = Array.isArray(kit)
      ? kit
          .map(function (k) {
            return (k.garment || k.prenda || '') + ' ' + (k.size || k.talla || '');
          })
          .join('; ')
      : '—';
    const cb = reg.chargeBreakdown || {};
    return [
      { label: 'Nombre', value: reg.name || reg.nombre },
      { label: 'Apellidos', value: reg.surname || reg.apellidos },
      { label: 'DNI', value: reg.dni },
      { label: 'Email', value: reg.email },
      { label: 'Teléfono', value: reg.phone || reg.telefono },
      { label: 'Temporada', value: reg.inscriptionSeason || reg.temporada },
      { label: 'Categoría', value: reg.category || reg.categoria },
      { label: 'Fecha nacimiento', value: reg.birthDate || reg.fechaNacimiento },
      { label: 'Domicilio', value: reg.domicilio || reg.address },
      { label: 'Localidad', value: reg.localidad },
      { label: 'Provincia', value: reg.provincia },
      { label: 'Cuota ficha (€)', value: cb.ficha != null ? cb.ficha : reg.fichaFee },
      { label: 'Cuota socio (€)', value: cb.socio != null ? cb.socio : reg.socioFee },
      { label: 'Ropa entreno (€)', value: cb.kit != null ? cb.kit : reg.kitTotal },
      { label: 'Total (€)', value: cb.total != null ? cb.total : reg.totalCharge },
      { label: 'Ropa (tallas)', value: kitTxt || '—' },
      { label: 'Tutor/a', value: reg.guardianName || '—' },
      { label: 'DNI tutor/a', value: reg.guardianDNI || reg.guardianDni || '—' },
      {
        label: 'Autorización categoría superior',
        value: reg.categorySuperiorConsent ? 'Sí' : 'No'
      },
      {
        label: 'Domicilio tutor/a',
        value: reg.guardianAddress || composeGuardianAddress({
          domicilio: reg.guardianDomicilio,
          localidad: reg.guardianLocalidad,
          provincia: reg.guardianProvincia
        }) || '—'
      },
      { label: 'Cuenta club', value: 'CAJA RURAL ES12 3085 0034 8222 5127 9226' }
    ];
  }

  function offlinePaymentSubjectLabel(ch) {
    if (ch === 'efectivo') return 'efectivo';
    if (ch === 'tpv') return 'TPV';
    return 'transferencia';
  }

  function offlinePaymentUserHint(ch) {
    if (ch === 'efectivo') return 'efectivo en el club';
    if (ch === 'tpv') return 'TPV (datáfono en el club)';
    return 'transferencia a la cuenta del club (CAJA RURAL ES12 3085 0034 8222 5127 9226)';
  }

  function notifyClubPlayerInscription(reg, paymentChannel) {
    if (!global.CdsanClubEmail || !reg || !reg.email) return;
    const ch =
      paymentChannel === 'efectivo' ? 'efectivo' : paymentChannel === 'tpv' ? 'tpv' : 'transferencia';
    global.CdsanClubEmail.sendClubAdminNotify({
      kind: 'inscripcion_jugador',
      title: 'Nueva inscripción jugador/a (pendiente de pago)',
      subject: 'Inscripción jugador — ' + offlinePaymentSubjectLabel(ch),
      paymentChannel: ch,
      requesterEmail: reg.email,
      fields: buildPlayerClubNotifyFields(reg)
    }).catch(function (e) {
      console.warn('Correo aviso club inscripción:', e);
    });
  }

  function openInsPayWarningModal() {
    const m = $('insPayWarningModal');
    if (m) {
      m.style.display = 'flex';
      global.document.body.style.overflow = 'hidden';
    }
  }

  function closeInsPayWarningModal() {
    const m = $('insPayWarningModal');
    if (m) {
      m.style.display = 'none';
      global.document.body.style.overflow = '';
    }
    state.payWarningAcknowledged = true;
  }

  function bindInsPayWarningModal() {
    global.document.querySelectorAll('[data-ins-pay-warning-close]').forEach(function (el) {
      if (el.dataset.boundPayWarn) return;
      el.dataset.boundPayWarn = '1';
      el.addEventListener('click', closeInsPayWarningModal);
    });
    const m = $('insPayWarningModal');
    if (m && !m.dataset.bound) {
      m.dataset.bound = '1';
      m.addEventListener('click', function (e) {
        if (e.target === m) closeInsPayWarningModal();
      });
    }
  }

  function guardPaymentAction(fn) {
    return function () {
      if (state.payWarningAcknowledged) {
        return fn.apply(this, arguments);
      }
      openInsPayWarningModal();
    };
  }

  async function submit(method, offlineChannel) {
    if (global.SiteUpdateMode && !global.SiteUpdateMode.guard()) return;
    const err = validateForm();
    if (err) {
      alert('❌ ' + err);
      return;
    }
    try {
      const reg = buildRegistration();
      if (offlineChannel) reg.offlinePaymentChannel = offlineChannel;
      const f = getFormData();
      if (f.portalPassword && typeof global.hashClubAccessKey === 'function') {
        reg.portalPasswordHash = await global.hashClubAccessKey(f.portalPassword);
        reg.portalPasswordSetAt = new Date().toISOString();
      }
      const result = await global.PlayerInscription.submitCheckout(reg, method);
      if (result.free) {
        alert('✅ Inscripción completada (importe 0 €). Tu ficha queda activa.');
        global.location.href = 'index.html';
      } else if (result.transfer) {
        const ch = result.offlineChannel || offlineChannel || 'transferencia';
        notifyClubPlayerInscription(reg, ch);
        alert(
          '✅ Inscripción registrada con estado PENDIENTE DE PAGO (' +
            offlinePaymentSubjectLabel(ch) +
            ').\n\nRealiza el pago por ' +
            offlinePaymentUserHint(ch) +
            '. Un administrador validará el ingreso y activará tu ficha.\n\n📧 Hemos enviado un aviso al club con tus datos.'
        );
        global.location.href = 'index.html';
      } else if (result.redirect) {
        /* Redirige a la pasarela */
      }
    } catch (e) {
      alert('❌ ' + (e.message || e));
    }
  }

  async function submitTransferWithPicker() {
    const err = validateForm();
    if (err) {
      alert('❌ ' + err);
      return;
    }
    if (!global.PaymentMethodPicker || !global.PaymentMethodPicker.showPaymentOfflinePicker) {
      await submit('transfer', 'transferencia');
      return;
    }
    const choice = await global.PaymentMethodPicker.showPaymentOfflinePicker({
      title: 'Forma de pago de la inscripción'
    });
    if (!choice) return;
    await submit('transfer', choice);
  }

  function initCategoryUI() {
    if (global.ClubInscriptionConfig.applyDefaultFeesIfEmpty) {
      state.settings = global.ClubInscriptionConfig.applyDefaultFeesIfEmpty(state.settings);
    }
    renderCategoryFeesTable();
  }

  function initPaymentButtons() {
    const pm = state.settings.paymentMethods || {};
    show($('payCardBlock'), !!pm.card);
    show($('payBizumBlock'), !!pm.bizum);
    show($('payTransferBlock'), !!pm.transfer);
    if ($('btnPayCard')) $('btnPayCard').onclick = guardPaymentAction(function () { submit('card'); });
    if ($('btnPayBizum')) $('btnPayBizum').onclick = guardPaymentAction(function () { submit('bizum'); });
    if ($('btnPayTransfer')) {
      $('btnPayTransfer').onclick = guardPaymentAction(function () {
        submitTransferWithPicker();
      });
    }
    if (global.CdsanRedsys && global.CdsanRedsys.loadConfig) {
      global.CdsanRedsys.loadConfig().then(function () {
        if ($('btnPayBizum') && !global.CdsanRedsys.isBizumEnabled()) {
          $('btnPayBizum').disabled = true;
          $('btnPayBizum').title = 'Bizum no activado en el club';
        }
      });
    }
  }

  function bindPortalAuthControls() {
    function bindClick(id, handler) {
      const el = $(id);
      if (!el || el.dataset.bound) return;
      el.dataset.bound = '1';
      el.addEventListener('click', function (ev) {
        ev.preventDefault();
        handler();
      });
    }
    bindClick('insPortalSetupBtn', runPortalSetup);
    bindClick('insPortalResetBtn', runPortalResetRequest);
    bindClick('insPortalResetMailtoBtn', runPortalResetMailto);
    bindClick('insPortalResetTokenBtn', runPortalResetWithToken);
    bindClick('insPortalForgotLink', function (e) {
      if (e && e.preventDefault) e.preventDefault();
      openForgotPasswordPanel();
    });
    bindClick('insPortalBackLink2', resetLookupAuthFlow);
    bindClick('insPortalBackLink3', resetLookupAuthFlow);
    const pwd = $('insPortalPassword');
    if (pwd && !pwd.dataset.bound) {
      pwd.dataset.bound = '1';
      pwd.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') runLookup();
      });
    }
  }

  function setupPortalResetFromUrl(token) {
    if (!token) return;
    state.portalResetToken = token;
    setupFinalizeFichaFlow();
    setLookupPanelOpen(true);
    show($('insLookupFieldsWrap'), false);
    showPortalAuthBlock('insPortalResetTokenBlock', 'Restablecer contraseña de acceso a la ficha');
    const msg = $('insLookupMsg');
    if (msg) {
      msg.style.color = '#1e3a8a';
      msg.textContent = 'Enlace de recuperación detectado. Elige tu nueva contraseña.';
    }
  }

  function setupYaSoyJugadorFlow() {
    state.flowContinue = true;
    state.flowFinalize = false;
    show($('inscYaSoyIntro'), true);
    show($('inscFinalizeIntro'), false);
    if ($('inscPageTitle')) $('inscPageTitle').textContent = 'Inscripción jugador/a';
    show($('inscPasswordOnlyBanner'), false);
    bindPortalAuthControls();
    if ($('insLookupBtn') && !$('insLookupBtn').dataset.bound) {
      $('insLookupBtn').dataset.bound = '1';
      $('insLookupBtn').addEventListener('click', runLookup);
    }

    const season = state.settings.season;
    let lockDni = '';
    try {
      lockDni = global.sessionStorage.getItem('cdsan_insc_lock_dni') || '';
    } catch (_) {}
    if (
      lockDni &&
      global.PlayerInscription.requiresPasswordForInscriptionAccess &&
      global.PlayerInscription.requiresPasswordForInscriptionAccess(lockDni, season)
    ) {
      enforceInscriptionCompletedMode();
      return;
    }

    state.passwordOnlyMode = false;
    show($('insClubRulesLine'), true);
    showAllFormSections();
    setLookupPanelOpen(false);
    updateLookupAuthUI();
    const msg = $('insLookupMsg');
    if (msg) msg.textContent = '';
  }

  function setupFinalizeFichaFlow() {
    state.flowFinalize = true;
    state.flowContinue = false;
    show($('inscYaSoyIntro'), false);
    show($('inscFinalizeIntro'), true);
    if ($('inscPageTitle')) $('inscPageTitle').textContent = 'Finalizar ficha';
    show($('inscPasswordOnlyBanner'), false);
    bindPortalAuthControls();
    if ($('insLookupBtn') && !$('insLookupBtn').dataset.bound) {
      $('insLookupBtn').dataset.bound = '1';
      $('insLookupBtn').addEventListener('click', runLookup);
    }

    const season = state.settings.season;
    let lockDni = '';
    try {
      lockDni = global.sessionStorage.getItem('cdsan_insc_lock_dni') || '';
    } catch (_) {}
    if (
      lockDni &&
      global.PlayerInscription.requiresPasswordForInscriptionAccess &&
      global.PlayerInscription.requiresPasswordForInscriptionAccess(lockDni, season)
    ) {
      enforceInscriptionCompletedMode();
      return;
    }

    state.passwordOnlyMode = false;
    hideInscriptionFormSections();
    setLookupPanelOpen(true);
    updateLookupAuthUI();
    const msg = $('insLookupMsg');
    if (msg) msg.textContent = '';
  }

  function init() {
    if (!global.ClubInscriptionConfig || !global.PlayerInscription) {
      $('inscClosedMsg').textContent = 'Error cargando módulos de inscripción.';
      return;
    }
    const params = new URLSearchParams(global.location.search);
    const flowParam = params.get('flow') || '';
    state.flowFinalize = flowParam === 'finalize';
    state.flowContinue = flowParam === 'continue';

    state.settings = global.ClubInscriptionConfig.read();
    if (global.ClubInscriptionConfig.applyDefaultFeesIfEmpty) {
      state.settings = global.ClubInscriptionConfig.applyDefaultFeesIfEmpty(state.settings);
    }
    if (global.ClubSeason && global.ClubSeason.getActiveSeason) {
      state.settings.season = global.ClubSeason.getActiveSeason();
    }
    const open = global.ClubInscriptionConfig.isOpenNow(state.settings);
    if ($('inscSeasonLabel')) $('inscSeasonLabel').textContent = state.settings.season;
    if (!open.ok) {
      show($('inscFormWrap'), false);
      show($('inscClosedWrap'), true);
      $('inscClosedMsg').textContent = open.reason;
      return;
    }
    show($('inscClosedWrap'), false);
    show($('inscFormWrap'), true);
    initCategoryUI();
    renderKitSection();
    initPaymentButtons();

    if (!state.flowFinalize && !state.flowContinue) {
      global.location.replace('index.html');
      return;
    }
    const portalReset = params.get('portalReset');
    if (portalReset) {
      setupPortalResetFromUrl(portalReset);
    } else if (state.flowContinue) {
      setupYaSoyJugadorFlow();
    } else {
      setupFinalizeFichaFlow();
    }

    bindInsPayWarningModal();
    if (global.ClubInscriptionLegal && global.ClubInscriptionLegal.bindAllModals) {
      global.ClubInscriptionLegal.bindAllModals();
    } else if (global.ClubInscriptionLegal && global.ClubInscriptionLegal.bindModal) {
      global.ClubInscriptionLegal.bindModal();
    }
    updatePortalPasswordBlockUI();
    const dniForPwd = $('insDni');
    if (dniForPwd && !dniForPwd.dataset.pwdUiBound) {
      dniForPwd.dataset.pwdUiBound = '1';
      dniForPwd.addEventListener('blur', updatePortalPasswordBlockUI);
    }
    const gDniForPwd = $('insGuardianDni');
    if (gDniForPwd && !gDniForPwd.dataset.pwdUiBound) {
      gDniForPwd.dataset.pwdUiBound = '1';
      gDniForPwd.addEventListener('blur', updatePortalPasswordBlockUI);
    }
    const guardianSameDom = $('insGuardianSameDomicilio');
    if (guardianSameDom && !guardianSameDom.dataset.bound) {
      guardianSameDom.dataset.bound = '1';
      guardianSameDom.addEventListener('change', toggleGuardianDomicilioFields);
    }
    refreshCart();
    if ($('insBirth')) {
      $('insBirth').addEventListener('change', onBirthChange);
      $('insBirth').addEventListener('input', onBirthChange);
      if ($('insBirth').value) onBirthChange();
      else toggleGuardian();
    }
    if ($('insPhoto')) {
      $('insPhoto').addEventListener('change', function (e) {
        handlePhoto(e.target.files[0]);
      });
    }
    ['insName', 'insSurname', 'insDni'].forEach(function (id) {
      const node = $(id);
      if (node) node.addEventListener('blur', refreshCart);
    });
    const dniNode = $('insDni');
    if (dniNode && !dniNode.dataset.lockBound) {
      dniNode.dataset.lockBound = '1';
      dniNode.addEventListener('blur', function () {
        if ((!state.flowContinue && !state.flowFinalize) || state.passwordOnlyMode) return;
        const dni = dniNode.value.trim();
        if (
          dni &&
          global.PlayerInscription.requiresPasswordForInscriptionAccess &&
          global.PlayerInscription.requiresPasswordForInscriptionAccess(dni, state.settings.season)
        ) {
          enforcePasswordOnlyMode();
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})(typeof window !== 'undefined' ? window : globalThis);
