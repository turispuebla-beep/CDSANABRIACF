/**
 * Texto legal — inscripción jugador/a (normas, autorización tutor/a, condiciones).
 */
(function (global) {
  'use strict';

  function getInscriptionLegalHtml() {
    return (
      '<ul style="margin:0 0 16px;padding-left:1.2rem;">' +
      '<li style="margin-bottom:10px;">EL CUMPLIR ESTA INSCRIPCIÓN DARÁ LUGAR A DETERMINAR LA COMPOSICIÓN E INSCRIPCIÓN DE LOS EQUIPOS.</li>' +
      '<li style="margin-bottom:10px;">EN EL CASO DE QUE HUBIERA MÁS INSCRIPTOS QUE PLAZAS DE JUGADORES SE TENDRÁ EN CUENTA EL HABER ESTADO YA EN EL EQUIPO EN LA TEMPORADA 25-26, TEMPORADAS ANTERIORES Y DESPUÉS POR RIGUROSO ORDEN DE INSCRIPCIÓN COMPLETA.</li>' +
      '<li style="margin-bottom:10px;">SI NO HUBIERA EQUIPO, O UN JUGADOR NO ENTRARA POR FALTA DE PLAZA SE DEVOLVERÁ EL IMPORTE ABONADO.</li>' +
      '</ul>' +
      '<p style="margin:0 0 12px;">Como padre/madre/tutor del jugador del Sanabria CF, indicado arriba, autorizo al Sanabria CF a realizar los trámites oportunos para la inscripción del mismo como jugador del equipo. Así como a poder utilizar la foto del mismo, siempre con equipación del Sanabria C.F., de juego o de paseo con fines de promoción del club y de difusión del equipo en sitios relacionados con el mismo, en los cuales figuraría además de la foto el nombre deportivo, nunca nombre completo ni otros datos personales.</p>' +
      '<p style="margin:0 0 12px;">Igualmente se hace responsable, todos, de los daños que se ocasionen, teniendo que abonar el precio de las prendas por causas ajenas a los lances del juego y uso normal del material deportivo y ropa cedida por el club: 2 equipaciones de camiseta y pantalón corto, 1 polo, 1 chándal, 1 mochila y demás prendas que se les puedan ceder, así como el material de entrenamiento. Se devolverán al finalizar la temporada.</p>' +
      '<p style="margin:0 0 12px;">También se hace responsable de las aplicaciones de internet y redes sociales que su hijo utilice, y en las cuales no podrá utilizar ningún símbolo ni datos del Club, ni la utilización de números o caracteres que puedan dar lugar a identificarlos como miembros del club.</p>' +
      '<p style="margin:0 0 12px;">Al estar vinculado al Real Valladolid S.A.D. se permite al Sanabria C.F. a facilitar datos de identificación y deportivos de su hijo, y permitirá al Real Valladolid S.A.D. a realizar pruebas deportivas, previo contacto con el Sanabria C.F. y con el firmante.</p>' +
      '<p style="margin:0 0 12px;">Las faltas de los jugadores en los reglamentos internos pueden llegar a la expulsión del jugador del equipo, previo aviso al firmante.</p>' +
      '<p style="margin:0;"><strong>Al enviar la inscripción acepto las condiciones del club.</strong></p>'
    );
  }

  function openModal() {
    const m = global.document.getElementById('insCompromisoModal');
    if (m) {
      m.style.display = 'flex';
      global.document.body.style.overflow = 'hidden';
    }
  }

  function closeModal() {
    const m = global.document.getElementById('insCompromisoModal');
    if (m) {
      m.style.display = 'none';
      global.document.body.style.overflow = '';
    }
  }

  function getCategorySuperiorAuthHtml() {
    return (
      '<p style="margin:0;line-height:1.55;">Autorizo al CD Sanabria CF a que mi hijo/a, siendo menor de edad, participe en entrenamientos y/o competiciones de categoría superior a la que le corresponda por edad, de forma temporal o permanente, en los entrenamientos y/o competiciones, siempre dentro de la normativa federativa aplicable y previa valoración del cuerpo técnico.</p>'
    );
  }

  function openCategoryAuthModal() {
    const m = global.document.getElementById('insCategoryAuthModal');
    if (m) {
      m.style.display = 'flex';
      global.document.body.style.overflow = 'hidden';
    }
  }

  function closeCategoryAuthModal() {
    const m = global.document.getElementById('insCategoryAuthModal');
    if (m) {
      m.style.display = 'none';
      global.document.body.style.overflow = '';
    }
  }

  function bindCategoryAuthModal() {
    const body = global.document.getElementById('insCategoryAuthBody');
    if (body && !body.dataset.filled) {
      body.innerHTML = getCategorySuperiorAuthHtml();
      body.dataset.filled = '1';
    }
    const openBtn = global.document.getElementById('insOpenCategoryAuthBtn');
    if (openBtn && !openBtn.dataset.bound) {
      openBtn.dataset.bound = '1';
      openBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        openCategoryAuthModal();
      });
    }
    global.document.querySelectorAll('[data-ins-category-auth-close]').forEach(function (el) {
      if (el.dataset.boundCategory) return;
      el.dataset.boundCategory = '1';
      el.addEventListener('click', closeCategoryAuthModal);
    });
    const m = global.document.getElementById('insCategoryAuthModal');
    if (m && !m.dataset.bound) {
      m.dataset.bound = '1';
      m.addEventListener('click', function (e) {
        if (e.target === m) closeCategoryAuthModal();
      });
    }
  }

  function bindModal() {
    const body = global.document.getElementById('insCompromisoLegalBody');
    if (body && !body.dataset.filled) {
      body.innerHTML = getInscriptionLegalHtml();
      body.dataset.filled = '1';
    }
    const openBtn = global.document.getElementById('insOpenCompromisoBtn');
    if (openBtn && !openBtn.dataset.bound) {
      openBtn.dataset.bound = '1';
      openBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        openModal();
      });
    }
    global.document.querySelectorAll('[data-ins-compromiso-close]').forEach(function (el) {
      if (el.dataset.bound) return;
      el.dataset.bound = '1';
      el.addEventListener('click', closeModal);
    });
    const m = global.document.getElementById('insCompromisoModal');
    if (m && !m.dataset.bound) {
      m.dataset.bound = '1';
      m.addEventListener('click', function (e) {
        if (e.target === m) closeModal();
      });
    }
  }

  function bindAllModals() {
    bindModal();
    bindCategoryAuthModal();
  }

  global.ClubInscriptionLegal = {
    getInscriptionLegalHtml: getInscriptionLegalHtml,
    getCategorySuperiorAuthHtml: getCategorySuperiorAuthHtml,
    openModal: openModal,
    closeModal: closeModal,
    bindModal: bindModal,
    bindCategoryAuthModal: bindCategoryAuthModal,
    bindAllModals: bindAllModals
  };
})(typeof window !== 'undefined' ? window : globalThis);
