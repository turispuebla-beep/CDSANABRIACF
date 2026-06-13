/**
 * PayGold SMS — cobro con enlace desde panel admin (Redsys / Caja Rural).
 */
(function (global) {
  'use strict';

  const API_SEND = '/.netlify/functions/redsys-paygold-send';
  const API_CONFIG = '/.netlify/functions/redsys-config';

  const CONCEPT_PRESETS = {
    membership: 'Cuota de socio/a CD Sanabria CF',
    kit: 'Equipación / ropa CD Sanabria CF',
    other: 'Pago CD Sanabria CF'
  };

  let paygoldReady = null;

  async function isPayGoldEnabled() {
    if (paygoldReady !== null) return paygoldReady;
    try {
      const res = await fetch(API_CONFIG, { cache: 'no-store' });
      const data = await res.json().catch(function () { return {}; });
      paygoldReady = !!(data && data.ok && data.paygoldEnabled !== false);
    } catch (_) {
      paygoldReady = false;
    }
    return paygoldReady;
  }

  function getClubMembers() {
    try {
      const raw = global.localStorage.getItem('clubMembers');
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  function memberLabel(m) {
    const name = [m.nombre || m.name, m.apellidos || m.surname].filter(Boolean).join(' ').trim();
    const email = String(m.email || '').trim();
    const num = m.numeroSocio || m.memberNumber || '';
    return (name || email || 'Socio') + (email ? ' — ' + email : '') + (num ? ' [' + num + ']' : '');
  }

  function fillMemberSelect() {
    const sel = global.document.getElementById('paygoldMemberSelect');
    if (!sel) return;
    const members = getClubMembers().slice().sort(function (a, b) {
      return memberLabel(a).localeCompare(memberLabel(b), 'es');
    });
    sel.innerHTML = '<option value="">— Sin vincular / manual —</option>';
    members.forEach(function (m) {
      if (!m || !m.id) return;
      const opt = global.document.createElement('option');
      opt.value = m.id;
      opt.textContent = memberLabel(m);
      sel.appendChild(opt);
    });
  }

  function onPaygoldMemberChange() {
    const sel = global.document.getElementById('paygoldMemberSelect');
    const id = sel && sel.value;
    if (!id) return;
    const m = getClubMembers().find(function (x) { return String(x.id) === String(id); });
    if (!m) return;
    const emailEl = global.document.getElementById('paygoldEmail');
    const mobileEl = global.document.getElementById('paygoldMobile');
    const nameEl = global.document.getElementById('paygoldBuyerName');
    const amountEl = global.document.getElementById('paygoldAmount');
    if (emailEl && m.email) emailEl.value = m.email;
    if (mobileEl && (m.telefono || m.phone)) mobileEl.value = m.telefono || m.phone;
    if (nameEl) {
      nameEl.value = [m.nombre || m.name, m.apellidos || m.surname].filter(Boolean).join(' ').trim();
    }
    if (amountEl && m.cuota != null && !amountEl.value) {
      amountEl.value = Number(m.cuota).toFixed(2);
    }
    const cat = global.document.getElementById('paygoldCategory');
    if (cat && (m.status === 'pending_validation' || m.estado === 'pendiente')) {
      cat.value = 'membership';
      onPaygoldCategoryChange();
    }
  }

  function onPaygoldCategoryChange() {
    const cat = global.document.getElementById('paygoldCategory');
    const conceptEl = global.document.getElementById('paygoldConcept');
    if (!cat || !conceptEl) return;
    const preset = CONCEPT_PRESETS[cat.value] || CONCEPT_PRESETS.other;
    if (!conceptEl.value || Object.values(CONCEPT_PRESETS).indexOf(conceptEl.value) >= 0) {
      conceptEl.value = preset;
    }
  }

  function setPaygoldStatus(msg, type) {
    const el = global.document.getElementById('paygoldStatus');
    if (!el) return;
    el.style.display = 'block';
    el.style.background = type === 'error' ? '#fef2f2' : type === 'success' ? '#ecfdf5' : '#eff6ff';
    el.style.color = type === 'error' ? '#991b1b' : type === 'success' ? '#065f46' : '#1e40af';
    el.style.border = '1px solid ' + (type === 'error' ? '#fecaca' : type === 'success' ? '#a7f3d0' : '#bfdbfe');
    el.textContent = msg;
  }

  function formatEur(n) {
    const x = Number(n);
    return Number.isFinite(x) ? x.toFixed(2) + ' €' : '—';
  }

  function statusLabel(st) {
    const s = String(st || '').toLowerCase();
    if (s === 'paid') return '✅ Pagado';
    if (s === 'link_sent') return '📱 Enlace enviado';
    if (s === 'failed') return '❌ Error';
    if (s === 'pending') return '⏳ Pendiente';
    return st || '—';
  }

  async function loadPaygoldHistory() {
    const wrap = global.document.getElementById('paygoldHistoryBody');
    if (!wrap) return;
    wrap.innerHTML = '<tr><td colspan="6" style="padding:12px;color:#64748b;">Cargando…</td></tr>';

    let rows = [];
    try {
      if (typeof global.getDocuments === 'function') {
        const all = await global.getDocuments('payments');
        rows = (all || [])
          .filter(function (p) { return p && p.type === 'paygold_custom'; })
          .sort(function (a, b) {
            return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
          })
          .slice(0, 30);
      }
    } catch (e) {
      wrap.innerHTML = '<tr><td colspan="6" style="padding:12px;color:#dc2626;">No se pudo cargar el historial.</td></tr>';
      return;
    }

    if (!rows.length) {
      wrap.innerHTML = '<tr><td colspan="6" style="padding:12px;color:#64748b;">Sin cobros PayGold todavía.</td></tr>';
      return;
    }

    wrap.innerHTML = rows.map(function (p) {
      const link = p.paygoldPaymentUrl
        ? '<a href="' + p.paygoldPaymentUrl + '" target="_blank" rel="noopener">Enlace</a>'
        : '—';
      return '<tr>' +
        '<td style="padding:8px;border-bottom:1px solid #e2e8f0;font-size:0.85rem;">' + (p.createdAt ? new Date(p.createdAt).toLocaleString('es-ES') : '—') + '</td>' +
        '<td style="padding:8px;border-bottom:1px solid #e2e8f0;">' + (p.buyerName || p.customerEmail || '—') + '</td>' +
        '<td style="padding:8px;border-bottom:1px solid #e2e8f0;">' + (p.conceptLabel || '—') + '</td>' +
        '<td style="padding:8px;border-bottom:1px solid #e2e8f0;">' + formatEur(p.amountEur) + '</td>' +
        '<td style="padding:8px;border-bottom:1px solid #e2e8f0;">' + statusLabel(p.status) + '</td>' +
        '<td style="padding:8px;border-bottom:1px solid #e2e8f0;">' + link + '</td>' +
        '</tr>';
    }).join('');
  }

  async function initPaygoldPanel() {
    fillMemberSelect();
    onPaygoldCategoryChange();
    const enabled = await isPayGoldEnabled();
    const form = global.document.getElementById('paygoldForm');
    const warn = global.document.getElementById('paygoldDisabledWarn');
    if (!enabled) {
      if (warn) warn.style.display = 'block';
      if (form) form.querySelectorAll('input,select,button,textarea').forEach(function (el) {
        if (el.id !== 'paygoldRefreshHistory') el.disabled = true;
      });
      setPaygoldStatus('TPV Redsys no configurado en Netlify. PayGold estará disponible tras el deploy y la prueba del TPV.', 'info');
    } else if (warn) {
      warn.style.display = 'none';
    }
    await loadPaygoldHistory();
  }

  async function sendPaygoldLink() {
    const amount = Number(global.document.getElementById('paygoldAmount')?.value);
    const concept = String(global.document.getElementById('paygoldConcept')?.value || '').trim();
    const category = String(global.document.getElementById('paygoldCategory')?.value || 'other');
    const mobile = String(global.document.getElementById('paygoldMobile')?.value || '').trim();
    const email = String(global.document.getElementById('paygoldEmail')?.value || '').trim();
    const buyerName = String(global.document.getElementById('paygoldBuyerName')?.value || '').trim();
    const memberId = String(global.document.getElementById('paygoldMemberSelect')?.value || '').trim();
    const sendSms = !!global.document.getElementById('paygoldSendSms')?.checked;
    const sendEmail = !!global.document.getElementById('paygoldSendEmail')?.checked;

    if (!Number.isFinite(amount) || amount <= 0) {
      setPaygoldStatus('Indica un importe válido mayor que 0.', 'error');
      return;
    }
    if (!concept) {
      setPaygoldStatus('Indica el concepto del cobro.', 'error');
      return;
    }
    if (sendSms && !mobile) {
      setPaygoldStatus('Indica el móvil para enviar el SMS.', 'error');
      return;
    }
    if (sendEmail && !email) {
      setPaygoldStatus('Indica el email si marcas envío por correo.', 'error');
      return;
    }
    if (!sendSms && !sendEmail) {
      setPaygoldStatus('Marca SMS y/o email.', 'error');
      return;
    }

    const btn = global.document.getElementById('paygoldSendBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Enviando…';
    }
    setPaygoldStatus('Contactando con Redsys PayGold…', 'info');

    try {
      if (!global.CdsanAdminApiAuth) throw new Error('Sesión admin no disponible');
      const res = await global.CdsanAdminApiAuth.adminFetch(API_SEND, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountEur: amount,
          conceptCategory: category,
          conceptLabel: concept,
          mobile: mobile,
          email: email,
          buyerName: buyerName,
          memberId: memberId || null,
          sendSms: sendSms,
          sendEmail: sendEmail
        })
      });
      const data = await res.json().catch(function () { return {}; });
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Error ' + res.status);
      }
      let msg = data.message || 'Enlace PayGold generado.';
      if (data.paymentUrl) {
        msg += ' Enlace (copia de seguridad): ' + data.paymentUrl;
      }
      setPaygoldStatus(msg, 'success');
      await loadPaygoldHistory();
    } catch (e) {
      setPaygoldStatus('❌ ' + (e.message || e), 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '📱 Enviar enlace PayGold';
      }
    }
  }

  function copyPaygoldLinkFromStatus() {
    const el = global.document.getElementById('paygoldStatus');
    if (!el) return;
    const m = String(el.textContent || '').match(/https?:\/\/\S+/);
    if (!m) {
      alert('No hay enlace en el último mensaje. Revisa el historial.');
      return;
    }
    navigator.clipboard.writeText(m[0]).then(function () {
      alert('Enlace copiado al portapapeles.');
    }).catch(function () {
      prompt('Copia el enlace:', m[0]);
    });
  }

  global.initPaygoldPanel = initPaygoldPanel;
  global.sendPaygoldLink = sendPaygoldLink;
  global.onPaygoldMemberChange = onPaygoldMemberChange;
  global.onPaygoldCategoryChange = onPaygoldCategoryChange;
  global.loadPaygoldHistory = loadPaygoldHistory;
  global.copyPaygoldLinkFromStatus = copyPaygoldLinkFromStatus;
})(typeof window !== 'undefined' ? window : this);
