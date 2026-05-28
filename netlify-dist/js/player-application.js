/**
 * Solicitudes «Nuevo jugador» — envío público y lectura local (espejo Firebase en admin).
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'clubPlayerApplications';
  const FN_PATH = '/.netlify/functions/submit-player-application';

  function normalizeDni(v) {
    return String(v || '')
      .trim()
      .toUpperCase()
      .replace(/[^0-9A-Z]/g, '');
  }

  function readApplications() {
    try {
      return JSON.parse(global.localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (_) {
      return [];
    }
  }

  function writeApplications(list) {
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(list || []));
  }

  function getActiveSeason() {
    if (global.ClubSeason && global.ClubSeason.getActiveSeason) {
      return global.ClubSeason.getActiveSeason();
    }
    return '2026-2027';
  }

  function calculateAge(birthDateStr) {
    if (global.ClubInscriptionConfig && global.ClubInscriptionConfig.calculateAge) {
      return global.ClubInscriptionConfig.calculateAge(birthDateStr);
    }
    if (!birthDateStr) return null;
    const b = new Date(birthDateStr);
    if (isNaN(b.getTime())) return null;
    const t = new Date();
    let a = t.getFullYear() - b.getFullYear();
    const md = t.getMonth() - b.getMonth();
    if (md < 0 || (md === 0 && t.getDate() < b.getDate())) a--;
    return a;
  }

  function validateApplicationForm(data) {
    if (!data.name || !data.surname || !data.email || !data.phone || !data.birthDate) {
      return 'Completa nombre, apellidos, email, teléfono y fecha de nacimiento.';
    }
    const age = calculateAge(data.birthDate);
    if (age != null && age >= 18 && !data.dni) {
      return 'El DNI es obligatorio para mayores de edad.';
    }
    if (age != null && age < 18) {
      if (
        !data.guardianName ||
        !data.guardianSurname ||
        !data.guardianDni ||
        !data.guardianPhone ||
        !data.guardianEmail
      ) {
        return 'Para menores, indica nombre, apellidos, DNI, teléfono y email del tutor/a.';
      }
    }
    if (!data.commitmentAccepted) {
      return 'Debes confirmar el compromiso y la política interna del club.';
    }
    if (!data.clubRulesAccepted) {
      return 'Debes leer y aceptar el compromiso deportivo del club.';
    }
    return null;
  }

  async function submitApplication(formData) {
    const err = validateApplicationForm(formData);
    if (err) throw new Error(err);

    const season = getActiveSeason();
    const payload = {
      season: season,
      name: formData.name.trim(),
      surname: formData.surname.trim(),
      dni: formData.dni ? normalizeDni(formData.dni) : '',
      email: String(formData.email).trim().toLowerCase(),
      phone: formData.phone.trim(),
      address: (formData.address || '').trim(),
      birthDate: formData.birthDate,
      category:
        formData.category ||
        (global.ClubInscriptionConfig
          ? global.ClubInscriptionConfig.suggestCategoryFromBirthDate(formData.birthDate)
          : ''),
      guardianName: (formData.guardianName || '').trim(),
      guardianSurname: (formData.guardianSurname || '').trim(),
      guardianDni: formData.guardianDni ? normalizeDni(formData.guardianDni) : '',
      guardianPhone: (formData.guardianPhone || '').trim(),
      guardianEmail: (formData.guardianEmail || '').trim(),
      guardianAddress: (formData.guardianAddress || '').trim(),
      commitmentAccepted: !!formData.commitmentAccepted,
      clubRulesAccepted: !!formData.clubRulesAccepted,
      isMinor: calculateAge(formData.birthDate) != null && calculateAge(formData.birthDate) < 18
    };

    const res = await fetch(FN_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json().catch(function () {
      return { ok: false, error: 'Respuesta no válida del servidor' };
    });
    if (!res.ok || !json.ok) {
      throw new Error(json.error || 'No se pudo enviar la solicitud');
    }

    if (json.application) {
      const list = readApplications();
      const ix = list.findIndex(function (a) {
        return a.id === json.application.id;
      });
      if (ix >= 0) list[ix] = json.application;
      else list.push(json.application);
      writeApplications(list);
    }
    return json;
  }

  function findPendingByDni(dni, season) {
    const n = normalizeDni(dni);
    const s = season || getActiveSeason();
    return (
      readApplications().find(function (a) {
        return (
          normalizeDni(a.dni) === n &&
          String(a.season || '') === String(s) &&
          String(a.status || '') === 'pending_review'
        );
      }) || null
    );
  }

  global.PlayerApplication = {
    STORAGE_KEY: STORAGE_KEY,
    normalizeDni: normalizeDni,
    readApplications: readApplications,
    writeApplications: writeApplications,
    getActiveSeason: getActiveSeason,
    validateApplicationForm: validateApplicationForm,
    submitApplication: submitApplication,
    findPendingByDni: findPendingByDni
  };
})(typeof window !== 'undefined' ? window : globalThis);
