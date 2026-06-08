/**
 * Columnas configurables para exportar jugadores/as (Excel, Word, PDF)
 * localStorage: clubPlayerExportSettings
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'clubPlayerExportSettings';

  /** mandatory: siempre en la exportación. mandatoryNonMinor: columna fija; en menores el valor puede ir vacío. */
  const FIELD_CATALOG = [
    { id: 'nombre', label: 'Nombre', mandatory: true, group: 'identidad' },
    { id: 'apellidos', label: 'Apellidos', mandatory: true, group: 'identidad' },
    { id: 'dni', label: 'DNI (obligatorio si no es menor)', mandatory: true, mandatoryNonMinor: true, group: 'identidad' },
    { id: 'temporada', label: 'Temporada', defaultEnabled: true, group: 'identidad' },
    { id: 'email', label: 'Email', defaultEnabled: true, group: 'contacto' },
    { id: 'telefono', label: 'Teléfono', defaultEnabled: true, group: 'contacto' },
    { id: 'direccion', label: 'Dirección', defaultEnabled: false, group: 'contacto' },
    { id: 'fecha_nacimiento', label: 'Fecha de nacimiento', defaultEnabled: true, group: 'identidad' },
    { id: 'edad', label: 'Edad', defaultEnabled: true, group: 'identidad' },
    { id: 'categoria', label: 'Categoría', defaultEnabled: true, group: 'deportivo' },
    { id: 'posicion', label: 'Posición', defaultEnabled: true, group: 'deportivo' },
    { id: 'dorsal', label: 'Dorsal (asigna el club)', clubOnly: true, defaultEnabled: true, group: 'club' },
    { id: 'licencia', label: 'Licencia federativa (asigna el club / federación)', clubOnly: true, defaultEnabled: true, group: 'club' },
    { id: 'peso', label: 'Peso (kg)', defaultEnabled: true, group: 'fisico' },
    { id: 'altura', label: 'Altura (cm)', defaultEnabled: true, group: 'fisico' },
    { id: 'kit_match_shirt', label: 'Talla camiseta partido', defaultEnabled: true, group: 'equipacion' },
    { id: 'kit_match_shorts', label: 'Talla pantalón partido', defaultEnabled: true, group: 'equipacion' },
    { id: 'kit_tracksuit', label: 'Talla chándal', defaultEnabled: true, group: 'equipacion' },
    { id: 'kit_train_kit', label: 'Talla ropa de entreno', defaultEnabled: true, group: 'equipacion' },
    { id: 'kit_train_jacket', label: 'Talla chubasquero', defaultEnabled: true, group: 'equipacion' },
    { id: 'kit_cazadora', label: 'Talla cazadora', defaultEnabled: true, group: 'equipacion' },
    { id: 'kit_resumen', label: 'Equipación (resumen)', defaultEnabled: false, group: 'equipacion' },
    { id: 'importe_ropa', label: 'Importe ropa (€)', defaultEnabled: true, group: 'pagos' },
    { id: 'importe_ficha', label: 'Cuota ficha (€)', defaultEnabled: true, group: 'pagos' },
    { id: 'importe_socio', label: 'Cuota socio (€)', defaultEnabled: true, group: 'pagos' },
    { id: 'importe_total', label: 'Total inscripción (€)', defaultEnabled: true, group: 'pagos' },
    { id: 'incluye_ficha', label: 'Incluye cuota ficha', defaultEnabled: false, group: 'pagos' },
    { id: 'incluye_socio', label: 'Incluye cuota socio', defaultEnabled: false, group: 'pagos' },
    { id: 'estado_pago', label: 'Estado pago / inscripción', defaultEnabled: true, group: 'pagos' },
    { id: 'metodo_pago', label: 'Método de pago', defaultEnabled: true, group: 'pagos' },
    { id: 'fecha_pago', label: 'Fecha pago', defaultEnabled: false, group: 'pagos' },
    { id: 'fecha_registro', label: 'Fecha registro', defaultEnabled: true, group: 'pagos' },
    { id: 'tutor_nombre', label: 'Nombre tutor/a', defaultEnabled: true, group: 'tutor' },
    { id: 'tutor_dni', label: 'DNI tutor/a', defaultEnabled: true, group: 'tutor' },
    { id: 'tutor_telefono', label: 'Teléfono tutor/a', defaultEnabled: true, group: 'tutor' },
    { id: 'tutor_email', label: 'Email tutor/a', defaultEnabled: false, group: 'tutor' },
    { id: 'tutor_direccion', label: 'Dirección tutor/a', defaultEnabled: false, group: 'tutor' },
    { id: 'consent_jugador', label: 'Consent. jugador', defaultEnabled: false, group: 'otros' },
    { id: 'consent_imagen', label: 'Consent. imagen', defaultEnabled: false, group: 'otros' },
    { id: 'partidos', label: 'Partidos', defaultEnabled: false, group: 'estadisticas' },
    { id: 'goles', label: 'Goles', defaultEnabled: false, group: 'estadisticas' },
    { id: 'asistencias', label: 'Asistencias', defaultEnabled: false, group: 'estadisticas' },
    { id: 'amarillas', label: 'Tarjetas amarillas', defaultEnabled: false, group: 'estadisticas' },
    { id: 'rojas', label: 'Tarjetas rojas', defaultEnabled: false, group: 'estadisticas' },
    { id: 'socio_jugador', label: 'Socio-jugador', defaultEnabled: false, group: 'otros' },
    { id: 'es_menor', label: 'Es menor', defaultEnabled: false, group: 'otros' }
  ];

  const GROUP_LABELS = {
    identidad: 'Identidad (obligatorios fijos: nombre, apellidos, DNI)',
    contacto: 'Contacto',
    deportivo: 'Datos deportivos',
    club: 'Asignación del club (no se pide en la inscripción web)',
    fisico: 'Datos físicos',
    equipacion: 'Equipación y tallas',
    pagos: 'Pagos e inscripción',
    tutor: 'Tutor/a (menores)',
    estadisticas: 'Estadísticas',
    otros: 'Otros'
  };

  function defaultEnabledFields() {
    const enabled = {};
    FIELD_CATALOG.forEach(function (f) {
      enabled[f.id] = !!f.mandatory || !!f.defaultEnabled;
    });
    return enabled;
  }

  function getDefaultSettings() {
    return {
      enabledFields: defaultEnabledFields(),
      updatedAt: new Date().toISOString()
    };
  }

  function mergeSettings(raw) {
    const base = getDefaultSettings();
    if (!raw || typeof raw !== 'object') return base;
    const merged = { ...base, ...raw };
    merged.enabledFields = { ...base.enabledFields, ...(raw.enabledFields || {}) };
    FIELD_CATALOG.forEach(function (f) {
      if (f.mandatory) merged.enabledFields[f.id] = true;
    });
    const ef = merged.enabledFields;
    if (raw && raw.enabledFields) {
      if (
        (ef.kit_train_shirt || ef.kit_train_shorts) &&
        ef.kit_train_kit == null
      ) {
        ef.kit_train_kit = !!(ef.kit_train_shirt || ef.kit_train_shorts);
      }
    }
    return merged;
  }

  function read() {
    try {
      const raw = JSON.parse(global.localStorage.getItem(STORAGE_KEY) || 'null');
      return mergeSettings(raw);
    } catch (_) {
      return getDefaultSettings();
    }
  }

  function write(settings) {
    const merged = mergeSettings(settings);
    merged.updatedAt = new Date().toISOString();
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    if (typeof global.syncLocalSettingsBlobToFirebase === 'function') {
      global.syncLocalSettingsBlobToFirebase(STORAGE_KEY).catch(function () {});
    }
    return merged;
  }

  function getActiveFields(settings) {
    const s = settings || read();
    const enabled = s.enabledFields || {};
    return FIELD_CATALOG.filter(function (f) {
      return f.mandatory || enabled[f.id];
    });
  }

  function getFieldById(id) {
    return FIELD_CATALOG.find(function (f) {
      return f.id === id;
    });
  }

  global.ClubPlayerExportConfig = {
    STORAGE_KEY: STORAGE_KEY,
    FIELD_CATALOG: FIELD_CATALOG,
    GROUP_LABELS: GROUP_LABELS,
    read: read,
    write: write,
    getActiveFields: getActiveFields,
    getFieldById: getFieldById,
    defaultEnabledFields: defaultEnabledFields
  };
})(typeof window !== 'undefined' ? window : globalThis);
