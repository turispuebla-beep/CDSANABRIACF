/**
 * Carrito de inscripción — un carrito por evento (CD Sanabria CF).
 * Invitados sin cuenta: van ligados al socio/amigo/entrenador logueado.
 */
(function (global) {
  'use strict';

  const CART_PREFIX = 'cdsan_event_cart_';

  function storageKey(eventId) {
    return CART_PREFIX + String(eventId || '');
  }

  function getClubPublicEmail() {
    if (global.ClubContactDefaults && global.ClubContactDefaults.getPublicEmail) {
      return global.ClubContactDefaults.getPublicEmail();
    }
    return 'cdsanabriafc@gmail.com';
  }

  function getClubNotifyEmail() {
    if (global.ClubContactDefaults && global.ClubContactDefaults.getNotifyEmail) {
      return global.ClubContactDefaults.getNotifyEmail();
    }
    if (global.ClubMailto && global.ClubMailto.getClubNotifyEmail) {
      return global.ClubMailto.getClubNotifyEmail();
    }
    return 'cdsanabriafc@gmail.com';
  }

  function buildEventEmailPayload(event, cart, registrant, total) {
    const holder = cart.holder || {};
    const guests = cart.guests || [];
    const time =
      [event.startTime, event.endTime].filter(Boolean).join(' — ') || event.time || '';
    return {
      email: registrant.email,
      nombre: holder.nombre || holder.name || registrant.nombre || registrant.name,
      apellidos: holder.apellidos || holder.surname || registrant.apellidos || registrant.surname,
      eventTitle: event.title || event.name,
      eventDate: event.date,
      eventTime: time,
      eventLocation: event.location,
      totalEur: total,
      slots: 1 + guests.length,
      guestCount: guests.length
    };
  }

  function notifyRegistrantEventPending(event, cart, registrant, total) {
    if (!global.CdsanClubEmail || !global.CdsanClubEmail.sendEventRegistrationPending) return;
    if (!registrant || !registrant.email) return;
    global.CdsanClubEmail.sendEventRegistrationPending(buildEventEmailPayload(event, cart, registrant, total)).catch(
      function (e) {
        console.warn('Correo inscrito evento (pendiente):', e);
      }
    );
  }

  function notifyRegistrantEventConfirmed(event, cart, registrant, total, paymentChannel) {
    if (!global.CdsanClubEmail || !global.CdsanClubEmail.sendEventRegistrationConfirmed) return;
    if (!registrant || !registrant.email) return;
    const payload = buildEventEmailPayload(event, cart, registrant, total);
    payload.paymentChannel = paymentChannel || 'gratuito';
    global.CdsanClubEmail.sendEventRegistrationConfirmed(payload).catch(function (e) {
      console.warn('Correo inscrito evento (confirmado):', e);
    });
  }

  function notifyClubEventRegistration(event, cart, registrant, total, paymentChannel) {
    if (!global.CdsanClubEmail || !registrant || !registrant.email) return;
    const ch = paymentChannel === 'transfer' ? 'transferencia' : paymentChannel || 'transferencia';
    const holder = cart.holder || {};
    const guests = cart.guests || [];
    const tier = getRegistrantEventTier(registrant);
    const tierLabel =
      typeof global.formatRegistrantTierLabel === 'function'
        ? global.formatRegistrantTierLabel(tier)
        : tier;
    global.CdsanClubEmail.sendClubAdminNotify({
      kind: 'evento_inscripcion',
      title: 'Nueva inscripción a evento (pendiente de pago)',
      subject: 'Inscripción evento — ' + (event.title || event.name || 'CD Sanabria CF'),
      paymentChannel: ch,
      requesterEmail: registrant.email,
      nombre: holder.nombre || holder.name || registrant.nombre || registrant.name,
      apellidos: holder.apellidos || holder.surname || registrant.apellidos || registrant.surname,
      dni: holder.dni || registrant.dni,
      direccion: holder.direccion || holder.address || registrant.direccion || registrant.address,
      telefono: holder.telefono || holder.phone || registrant.telefono || registrant.phone,
      email: registrant.email,
      numeroSocio: registrant.numeroSocio || registrant.memberNumber,
      memberNumber: registrant.numeroSocio || registrant.memberNumber,
      numeroAmigo: registrant.numeroAmigo || registrant.friendNumber,
      friendNumber: registrant.numeroAmigo || registrant.friendNumber,
      fields: [
        { label: 'Perfil inscrito', value: tierLabel },
        { label: 'Evento', value: event.title || event.name },
        { label: 'Titular', value: [holder.nombre || holder.name, holder.apellidos || holder.surname].filter(Boolean).join(' ') },
        { label: 'Plazas', value: String(1 + guests.length) },
        { label: 'Invitados', value: String(guests.length) },
        { label: 'Importe (€)', value: total != null ? Number(total).toFixed(2) : '—' }
      ]
    }).catch(function (e) {
      console.warn('Correo aviso club evento:', e);
    });
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatPrice(value) {
    const n = Number(value || 0);
    return n === 0 ? 'Gratuito' : n.toFixed(2) + ' €';
  }

  function getRegistrantEventTier(registrant) {
    if (registrant?.isDirectiva) return 'directiva';
    if (registrant?.isEntrenador) return 'entrenadores';
    if (registrant?.isJugador) return 'jugadores';
    if (registrant?.kind === 'amigo' || registrant?.membershipKind === 'amigo') return 'amigos';
    return 'socios';
  }

  function normalizeEvent(event) {
    const safe = { ...(event || {}) };
    const basePrice = Number(safe.price || 0);
    safe.pricesByType = {
      socios: Number(safe.pricesByType?.socios ?? basePrice ?? 0),
      amigos: Number(safe.pricesByType?.amigos ?? basePrice ?? 0),
      jugadores: Number(safe.pricesByType?.jugadores ?? basePrice ?? 0),
      directiva: Number(safe.pricesByType?.directiva ?? basePrice ?? 0),
      entrenadores: Number(safe.pricesByType?.entrenadores ?? basePrice ?? 0),
      invitados: Number(safe.pricesByType?.invitados ?? safe.pricesByType?.invitado ?? basePrice ?? 0)
    };
    const allZero = Object.values(safe.pricesByType).every((v) => Number(v) === 0);
    safe.isFreeEvent = safe.isFreeEvent === true || allZero;
    safe.allowGuests = !!safe.allowGuests;
    safe.maxGuestsPerRegistration = Math.max(0, parseInt(safe.maxGuestsPerRegistration, 10) || 0);
    const pm = safe.paymentMethods && typeof safe.paymentMethods === 'object' ? safe.paymentMethods : {};
    if (safe.isFreeEvent) {
      safe.paymentMethods = {};
    } else if (!pm.card && !pm.bizum && !pm.transfer) {
      safe.paymentMethods = { card: true, bizum: !!pm.bizum, transfer: true };
    } else {
      safe.paymentMethods = {
        card: !!pm.card,
        bizum: !!pm.bizum,
        transfer: !!pm.transfer
      };
    }
    return safe;
  }

  function isEventFree(event) {
    return !!normalizeEvent(event).isFreeEvent;
  }

  function getPaymentMethods(event) {
    const e = normalizeEvent(event);
    if (e.isFreeEvent) return [];
    const out = [];
    if (e.paymentMethods.card) out.push('card');
    if (
      e.paymentMethods.bizum &&
      global.CdsanRedsys &&
      typeof global.CdsanRedsys.isBizumEnabled === 'function' &&
      global.CdsanRedsys.isBizumEnabled()
    ) {
      out.push('bizum');
    }
    if (e.paymentMethods.transfer) out.push('transfer');
    return out;
  }

  function getHolderPrice(event, registrant) {
    const e = normalizeEvent(event);
    if (e.isFreeEvent) return 0;
    const prices = e.pricesByType;
    const tier = getRegistrantEventTier(registrant);
    return Number(prices[tier] ?? e.price ?? 0);
  }

  function getGuestPrice(event) {
    const e = normalizeEvent(event);
    if (e.isFreeEvent) return 0;
    return Number(e.pricesByType.invitados ?? 0);
  }

  function getCart(eventId) {
    try {
      const raw = localStorage.getItem(storageKey(eventId));
      if (!raw) return null;
      const cart = JSON.parse(raw);
      if (!cart || String(cart.eventId) !== String(eventId)) return null;
      cart.guests = Array.isArray(cart.guests) ? cart.guests : [];
      return cart;
    } catch (_) {
      return null;
    }
  }

  function saveCart(cart) {
    if (!cart || !cart.eventId) return;
    cart.updatedAt = new Date().toISOString();
    localStorage.setItem(storageKey(cart.eventId), JSON.stringify(cart));
  }

  function clearCart(eventId) {
    localStorage.removeItem(storageKey(eventId));
  }

  function hasCart(eventId) {
    const c = getCart(eventId);
    return !!(c && (c.holder || (c.guests && c.guests.length)));
  }

  function cartBadgeCount(eventId) {
    const c = getCart(eventId);
    if (!c) return 0;
    let n = c.holder ? 1 : 0;
    n += (c.guests || []).length;
    return n;
  }

  function computeCartTotal(event, cart) {
    if (!cart) return 0;
    const e = normalizeEvent(event);
    if (e.isFreeEvent) return 0;
    let total = 0;
    if (cart.holder) total += Number(cart.holder.appliedPrice || 0);
    (cart.guests || []).forEach((g) => {
      total += Number(g.appliedPrice || 0);
    });
    return Math.round(total * 100) / 100;
  }

  function buildGuestLine(nombre, apellidos, index, event, invitedBy) {
    const price = getGuestPrice(event);
    return {
      id: 'GUEST_' + Date.now() + '_' + index + '_' + Math.random().toString(36).slice(2, 7),
      nombre: String(nombre || '').trim(),
      apellidos: String(apellidos || '').trim(),
      name: String(nombre || '').trim(),
      surname: String(apellidos || '').trim(),
      kind: 'invitado',
      tipoUsuario: 'invitado',
      priceTier: 'invitados',
      resolvedBy: 'invitado',
      appliedPrice: price,
      isGuest: true,
      guestIndex: index,
      guestLabel: 'Invitado ' + index,
      invitedById: invitedBy?.id || null,
      invitedByEmail: invitedBy?.email || '',
      invitedByName: [invitedBy?.nombre, invitedBy?.apellidos].filter(Boolean).join(' ').trim(),
      registeredAt: new Date().toISOString()
    };
  }

  function findEvent(eventId) {
    const events = JSON.parse(localStorage.getItem('clubEvents') || '[]');
    const ev = events.find((e) => String(e.id) === String(eventId));
    return ev ? normalizeEvent(ev) : null;
  }

  function findEventIndex(eventId) {
    const events = JSON.parse(localStorage.getItem('clubEvents') || '[]');
    return events.findIndex((e) => String(e.id) === String(eventId));
  }

  function persistEvent(event) {
    const events = JSON.parse(localStorage.getItem('clubEvents') || '[]');
    const idx = events.findIndex((e) => String(e.id) === String(event.id));
    if (idx >= 0) events[idx] = event;
    else events.push(event);
    localStorage.setItem('clubEvents', JSON.stringify(events));
    if (typeof global.updateDocument === 'function' && event.id) {
      global.updateDocument('events', event.id, event).catch(function () {});
    }
  }

  function countSlotsForCart(cart) {
    if (!cart) return 0;
    return (cart.holder ? 1 : 0) + (cart.guests || []).length;
  }

  function openAddModal(eventId) {
    if (global.SiteUpdateMode && !global.SiteUpdateMode.guard()) return;
    const registrant = typeof global.getCurrentRegistrant === 'function' ? global.getCurrentRegistrant() : null;
    if (!registrant) {
      alert('❌ Debes iniciar sesión para inscribirte en eventos.');
      return;
    }
    const event = findEvent(eventId);
    if (!event) {
      alert('❌ Evento no encontrado');
      return;
    }
    const participants = Array.isArray(event.participants) ? event.participants : [];
    const status =
      typeof global.getEventRegistrationStatus === 'function'
        ? global.getEventRegistrationStatus(event, participants, registrant)
        : { canRegister: true };
    if (typeof global.isAlreadyRegistered === 'function' && global.isAlreadyRegistered(event, registrant)) {
      alert('✅ Ya estás inscrito/a en este evento. Usa «Desapuntarme» si quieres cancelar.');
      return;
    }
    if (!status.canRegister) {
      alert('⛔ No es posible inscribirse: ' + (status.message || ''));
      return;
    }

    const holderPrice = getHolderPrice(event, registrant);
    const guestPrice = getGuestPrice(event);
    const allowGuests = event.allowGuests && event.maxGuestsPerRegistration > 0;
    const tierLabel =
      typeof global.formatRegistrantTierLabel === 'function'
        ? global.formatRegistrantTierLabel(getRegistrantEventTier(registrant))
        : getRegistrantEventTier(registrant);

    let guestFields = '';
    if (allowGuests) {
      const maxG = event.maxGuestsPerRegistration;
      guestFields =
        '<div style="margin-top:14px;padding:12px;background:#f0f9ff;border-radius:8px;border:1px solid #bae6fd">' +
        '<p style="margin:0 0 10px;font-weight:700;color:#0369a1">Invitados (opcional)</p>' +
        '<p style="margin:0 0 10px;font-size:0.88rem;color:#475569">Precio por invitado: <strong>' +
        escapeHtml(formatPrice(guestPrice)) +
        '</strong> · Máximo ' +
        maxG +
        '</p>' +
        '<label style="display:block;margin-bottom:6px;font-size:0.9rem">¿Cuántos invitados?</label>' +
        '<select id="ecAddGuestCount" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:6px">' +
        '<option value="0">Ninguno</option>';
      for (let i = 1; i <= maxG; i++) {
        guestFields += '<option value="' + i + '">' + i + ' invitado(s)</option>';
      }
      guestFields +=
        '</select>' +
        '<div id="ecGuestNamesWrap" style="margin-top:12px"></div></div>';
    }

    const overlay = document.createElement('div');
    overlay.id = 'ecAddModalOverlay';
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:10060;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
    overlay.innerHTML =
      '<div style="background:#fff;border-radius:14px;max-width:440px;width:100%;max-height:90vh;overflow:auto;padding:22px;box-shadow:0 20px 50px rgba(0,0,0,.25)">' +
      '<h3 style="margin:0 0 12px;color:#1e3a8a">🛒 Añadir al carrito</h3>' +
      '<p style="margin:0 0 8px"><strong>' +
      escapeHtml(event.title || event.name) +
      '</strong></p>' +
      '<p style="margin:0 0 4px;font-size:0.95rem">Tu precio (<em>' +
      escapeHtml(tierLabel) +
      '</em>): <strong>' +
      escapeHtml(formatPrice(holderPrice)) +
      '</strong></p>' +
      guestFields +
      '<div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap">' +
      '<button type="button" id="ecAddConfirm" style="flex:1;min-width:120px;padding:12px;background:#059669;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer">Añadir al carrito</button>' +
      '<button type="button" id="ecAddCancel" style="padding:12px 16px;background:#6b7280;color:#fff;border:none;border-radius:8px;cursor:pointer">Cancelar</button>' +
      '</div></div>';
    document.body.appendChild(overlay);

    function renderGuestNameFields() {
      const wrap = document.getElementById('ecGuestNamesWrap');
      const sel = document.getElementById('ecAddGuestCount');
      if (!wrap || !sel) return;
      const n = parseInt(sel.value, 10) || 0;
      let html = '';
      for (let i = 1; i <= n; i++) {
        html +=
          '<div style="margin-bottom:10px;padding:10px;background:#fff;border:1px solid #e2e8f0;border-radius:8px">' +
          '<div style="font-weight:600;margin-bottom:6px;color:#334155">Invitado ' +
          i +
          '</div>' +
          '<input type="text" class="ec-guest-nombre" data-idx="' +
          i +
          '" placeholder="Nombre" required style="width:100%;padding:8px;margin-bottom:6px;border:1px solid #cbd5e1;border-radius:6px;box-sizing:border-box">' +
          '<input type="text" class="ec-guest-apellidos" data-idx="' +
          i +
          '" placeholder="Apellidos" required style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:6px;box-sizing:border-box">' +
          '</div>';
      }
      wrap.innerHTML = html;
    }

    const sel = document.getElementById('ecAddGuestCount');
    if (sel) sel.addEventListener('change', renderGuestNameFields);

    document.getElementById('ecAddCancel').onclick = function () {
      overlay.remove();
    };
    overlay.addEventListener('click', function (ev) {
      if (ev.target === overlay) overlay.remove();
    });

    document.getElementById('ecAddConfirm').onclick = function () {
      if (global.SiteUpdateMode && !global.SiteUpdateMode.guard()) return;
      const guests = [];
      if (allowGuests) {
        const n = parseInt(document.getElementById('ecAddGuestCount').value, 10) || 0;
        for (let i = 1; i <= n; i++) {
          const nomEl = overlay.querySelector('.ec-guest-nombre[data-idx="' + i + '"]');
          const apeEl = overlay.querySelector('.ec-guest-apellidos[data-idx="' + i + '"]');
          const nombre = nomEl ? nomEl.value.trim() : '';
          const apellidos = apeEl ? apeEl.value.trim() : '';
          if (!nombre || !apellidos) {
            alert('❌ Indica nombre y apellidos del invitado ' + i);
            return;
          }
          guests.push(buildGuestLine(nombre, apellidos, i, event, registrant));
        }
      }

      let holder = null;
      if (typeof global.buildEventParticipantRecord === 'function') {
        holder = global.buildEventParticipantRecord(registrant, event);
      } else {
        holder = {
          id: registrant.id,
          nombre: registrant.nombre,
          apellidos: registrant.apellidos,
          email: registrant.email,
          appliedPrice: holderPrice,
          priceTier: getRegistrantEventTier(registrant)
        };
      }

      const cart = {
        eventId: String(eventId),
        holder: holder,
        guests: guests,
        registrantEmail: registrant.email,
        createdAt: new Date().toISOString()
      };
      saveCart(cart);
      overlay.remove();
      alert('✅ Añadido al carrito del evento. Abre el carrito para elegir forma de pago y confirmar.');
      if (typeof global.showEventsInfo === 'function') global.showEventsInfo();
    };
  }

  function paymentMethodLabel(m) {
    if (m === 'card') return '💳 Tarjeta (TPV)';
    if (m === 'bizum') return '📱 Bizum';
    if (m === 'transfer') return '🏦 Transferencia / efectivo';
    return m;
  }

  function openCartModal(eventId) {
    const cart = getCart(eventId);
    if (!cart || !cart.holder) {
      alert('🛒 El carrito de este evento está vacío. Pulsa «Añadir al carrito» primero.');
      return;
    }
    const event = findEvent(eventId);
    if (!event) {
      alert('❌ Evento no encontrado');
      return;
    }
    const registrant = typeof global.getCurrentRegistrant === 'function' ? global.getCurrentRegistrant() : null;
    const total = computeCartTotal(event, cart);
    const methods = getPaymentMethods(event);
    const free = isEventFree(event) || total <= 0;

    let lines =
      '<li style="margin-bottom:8px"><strong>Titular:</strong> ' +
      escapeHtml([cart.holder.nombre, cart.holder.apellidos].filter(Boolean).join(' ')) +
      ' — ' +
      escapeHtml(formatPrice(cart.holder.appliedPrice)) +
      '</li>';
    (cart.guests || []).forEach((g) => {
      lines +=
        '<li style="margin-bottom:8px"><strong>' +
        escapeHtml(g.guestLabel || 'Invitado') +
        ':</strong> ' +
        escapeHtml([g.nombre, g.apellidos].filter(Boolean).join(' ')) +
        ' — ' +
        escapeHtml(formatPrice(g.appliedPrice)) +
        '</li>';
    });

    let payBlock = '';
    if (free) {
      payBlock =
        '<p style="background:#ecfdf5;padding:12px;border-radius:8px;color:#065f46;font-weight:600">Evento gratuito — sin pago</p>';
    } else if (!methods.length) {
      payBlock =
        '<p style="background:#fef2f2;padding:12px;border-radius:8px;color:#991b1b">No hay formas de pago configuradas para este evento. Contacta con el club.</p>';
    } else {
      payBlock = '<p style="font-weight:600;margin:0 0 8px">Forma de pago</p>';
      methods.forEach((m, i) => {
        payBlock +=
          '<label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer">' +
          '<input type="radio" name="ecPayMethod" value="' +
          m +
          '"' +
          (i === 0 ? ' checked' : '') +
          '> ' +
          escapeHtml(paymentMethodLabel(m)) +
          '</label>';
      });
    }

    const overlay = document.createElement('div');
    overlay.id = 'ecCartModalOverlay';
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:10061;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
    overlay.innerHTML =
      '<div style="background:#fff;border-radius:14px;max-width:480px;width:100%;max-height:90vh;overflow:auto;padding:22px">' +
      '<h3 style="margin:0 0 8px;color:#1e3a8a">🛒 Carrito del evento</h3>' +
      '<p style="margin:0 0 12px;color:#64748b;font-size:0.9rem">' +
      escapeHtml(event.title || event.name) +
      '</p>' +
      '<ul style="list-style:none;padding:0;margin:0 0 14px">' +
      lines +
      '</ul>' +
      '<p style="font-size:1.15rem;font-weight:800;margin:0 0 16px">Total: ' +
      escapeHtml(formatPrice(total)) +
      '</p>' +
      payBlock +
      '<div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap">' +
      '<button type="button" id="ecCartConfirm" style="flex:1;min-width:140px;padding:12px;background:#1e3a8a;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer">Confirmar inscripción</button>' +
      '<button type="button" id="ecCartClear" style="padding:12px;background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;border-radius:8px;cursor:pointer">Vaciar</button>' +
      '<button type="button" id="ecCartClose" style="padding:12px 14px;background:#6b7280;color:#fff;border:none;border-radius:8px;cursor:pointer">Cerrar</button>' +
      '</div></div>';
    document.body.appendChild(overlay);

    document.getElementById('ecCartClose').onclick = function () {
      overlay.remove();
    };
    document.getElementById('ecCartClear').onclick = function () {
      if (confirm('¿Vaciar el carrito de este evento?')) {
        clearCart(eventId);
        overlay.remove();
        if (typeof global.showEventsInfo === 'function') global.showEventsInfo();
      }
    };
    overlay.addEventListener('click', function (ev) {
      if (ev.target === overlay) overlay.remove();
    });

    document.getElementById('ecCartConfirm').onclick = function () {
      if (global.SiteUpdateMode && !global.SiteUpdateMode.guard()) return;
      let payMethod = 'free';
      if (!free) {
        const picked = overlay.querySelector('input[name="ecPayMethod"]:checked');
        if (!picked) {
          alert('❌ Elige una forma de pago');
          return;
        }
        payMethod = picked.value;
      }
      overlay.remove();
      finalizeCheckout(eventId, payMethod).catch(function (err) {
        alert('❌ ' + (err.message || err));
      });
    };
  }

  async function finalizeCheckout(eventId, payMethod) {
    if (global.SiteUpdateMode && !global.SiteUpdateMode.guard()) return;
    const cart = getCart(eventId);
    if (!cart || !cart.holder) throw new Error('Carrito vacío');

    const events = JSON.parse(localStorage.getItem('clubEvents') || '[]');
    const eventIndex = events.findIndex((e) => String(e.id) === String(eventId));
    if (eventIndex < 0) throw new Error('Evento no encontrado');
    const event = normalizeEvent(events[eventIndex]);
    const registrant = typeof global.getCurrentRegistrant === 'function' ? global.getCurrentRegistrant() : null;
    if (!registrant) throw new Error('Debes iniciar sesión');

    const participants = Array.isArray(event.participants) ? event.participants : [];
    const status =
      typeof global.getEventRegistrationStatus === 'function'
        ? global.getEventRegistrationStatus(event, participants, registrant)
        : { canRegister: true };
    if (typeof global.isAlreadyRegistered === 'function' && global.isAlreadyRegistered(event, registrant)) {
      throw new Error('Ya estás inscrito/a en este evento');
    }
    if (!status.canRegister) {
      throw new Error(status.message || 'Inscripción no disponible');
    }

    const slots = countSlotsForCart(cart);
    const maxP = Number(event.maxParticipants || 0);
    if (maxP > 0 && participants.length + slots > maxP) {
      throw new Error('No hay plazas suficientes (incluye invitados del carrito)');
    }

    const total = computeCartTotal(event, cart);
    const toAdd = [cart.holder, ...(cart.guests || [])];

    if (payMethod === 'free' || total <= 0 || isEventFree(event)) {
      await completeRegistrationLocal(events, eventIndex, event, toAdd, registrant, {
        paymentMethod: 'free',
        paid: true
      });
      clearCart(eventId);
      notifyRegistrantEventConfirmed(event, cart, registrant, 0, 'gratuito');
      alert('✅ Inscripción confirmada (gratuita).\n\n📧 Te hemos enviado un correo de confirmación.');
      if (typeof global.showEventsInfo === 'function') global.showEventsInfo();
      return;
    }

    if (payMethod === 'transfer') {
      toAdd.forEach((p) => {
        p.paymentMethod = 'transfer';
        p.paymentStatus = 'pending_transfer';
        p.paidOnline = false;
      });
      await completeRegistrationLocal(events, eventIndex, event, toAdd, registrant, {
        paymentMethod: 'transfer',
        paid: false
      });
      clearCart(eventId);
      notifyClubEventRegistration(event, cart, registrant, total, 'transfer');
      notifyRegistrantEventPending(event, cart, registrant, total);
      alert(
        '✅ Inscripción registrada.\n\n📧 Te hemos enviado un correo con los datos.\n\n🏦 Realiza el ingreso de ' +
          total.toFixed(2) +
          ' € por transferencia o efectivo. El club validará el pago.\n\nConsultas: ' +
          getClubPublicEmail()
      );
      if (typeof global.showEventsInfo === 'function') global.showEventsInfo();
      return;
    }

    if (payMethod === 'card' || payMethod === 'bizum') {
      if (!global.CdsanRedsys) throw new Error('Pasarela de pago no disponible');
      const registrationBundle = {
        holder: cart.holder,
        guests: cart.guests || [],
        totalEur: total,
        slots: slots
      };
      try {
        localStorage.setItem('cdsan_pending_event_cart_' + eventId, JSON.stringify(cart));
      } catch (_) {}
      await global.CdsanRedsys.payEventRegistration({
        payMethod: payMethod,
        amountEur: total,
        email: registrant.email,
        eventId: String(eventId),
        priceTier: cart.holder.priceTier,
        participant: cart.holder,
        guests: cart.guests || [],
        registrationBundle: registrationBundle,
        description: 'Evento: ' + (event.title || event.name || 'CD Sanabria CF')
      });
      return;
    }

    throw new Error('Forma de pago no válida');
  }

  async function completeRegistrationLocal(events, eventIndex, event, records, registrant, payMeta) {
    const participants = Array.isArray(event.participants) ? [...event.participants] : [];
    records.forEach((rec) => {
      const copy = { ...rec, ...payMeta, registeredAt: rec.registeredAt || new Date().toISOString() };
      participants.push(copy);
    });
    event.participants = participants;
    event.registeredMembers = participants;
    event.updatedAt = new Date().toISOString();
    events[eventIndex] = event;
    localStorage.setItem('clubEvents', JSON.stringify(events));
    if (typeof global.updateDocument === 'function' && event.id) {
      try {
        await global.updateDocument('events', event.id, event);
      } catch (e) {
        console.warn('Sync evento:', e);
      }
    }
    const total = records.reduce((s, r) => s + Number(r.appliedPrice || 0), 0);
    if (payMeta.paid && total > 0 && typeof global.ClubAccounting !== 'undefined') {
      const bucket = event.revenueDestination === 'B' ? 'B' : 'A';
      const hint = [registrant.nombre, registrant.apellidos].filter(Boolean).join(' ').trim() || registrant.email;
      const row = global.ClubAccounting.recordEventIncome(bucket, total, event.id, event.name || event.title, hint);
      global.ClubAccounting.trySyncLedgerRow(row);
    }
  }

  global.ClubEventCart = {
    normalizeEvent: normalizeEvent,
    isEventFree: isEventFree,
    getPaymentMethods: getPaymentMethods,
    getHolderPrice: getHolderPrice,
    getGuestPrice: getGuestPrice,
    getCart: getCart,
    saveCart: saveCart,
    clearCart: clearCart,
    hasCart: hasCart,
    cartBadgeCount: cartBadgeCount,
    computeCartTotal: computeCartTotal,
    openAddModal: openAddModal,
    openCartModal: openCartModal,
    finalizeCheckout: finalizeCheckout,
    getRegistrantEventTier: getRegistrantEventTier
  };
})(typeof window !== 'undefined' ? window : globalThis);
