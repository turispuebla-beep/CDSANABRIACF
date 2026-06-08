/**
 * Correo mailto al club — formato unificado (CD Sanabria CF).
 * Para: cdsanabriacf@gmail.com (modales) · CC: email del solicitante.
 */
(function (global) {
  'use strict';

  const CLUB_EMAIL_NOTIFY_FALLBACK =
    (global.ClubContactDefaults && global.ClubContactDefaults.CLUB_EMAIL_NOTIFY) ||
    'cdsanabriacf@gmail.com';
  const BORDER = '══════════════════════════════════════════';

  function getClubNotifyEmail() {
    if (global.ClubContactDefaults && global.ClubContactDefaults.getNotifyEmail) {
      return global.ClubContactDefaults.getNotifyEmail();
    }
    return CLUB_EMAIL_NOTIFY_FALLBACK;
  }

  function padField(label, value) {
    const lbl = String(label || '').trim();
    const val = value == null || value === '' ? '—' : String(value);
    return (lbl + ':').padEnd(20, ' ') + ' ' + val;
  }

  /**
   * @param {{ title: string, sections?: Array<{heading:string, fields?:Array<{label,value}>, lines?:string[]}>, footerLines?: string[] }} opts
   */
  function formatStructuredEmail(opts) {
    const title = String((opts && opts.title) || 'SOLICITUD').trim();
    const lines = [BORDER, '  ' + title, '  CD Sanabria CF', BORDER, ''];

    (opts.sections || []).forEach(function (sec) {
      if (sec.heading) lines.push('── ' + sec.heading + ' ──');
      (sec.fields || []).forEach(function (f) {
        if (f && f.label) lines.push(padField(f.label, f.value));
      });
      (sec.lines || []).forEach(function (ln) {
        lines.push(String(ln));
      });
      lines.push('');
    });

    lines.push('── NOTAS ──');
    (opts.footerLines || []).forEach(function (ln) {
      lines.push(String(ln));
    });
    if (opts.requesterEmail && String(opts.requesterEmail).includes('@')) {
      lines.push('Email del solicitante (CC): ' + String(opts.requesterEmail).trim());
    }
    lines.push('Fecha: ' + new Date().toLocaleString('es-ES'));
    lines.push('Enviado desde la web del club.');
    lines.push('');
    lines.push(BORDER);
    return lines.join('\r\n');
  }

  function buildMailtoUrl(to, cc, subject, body) {
    const addr = String(to || '').trim();
    if (!addr || !addr.includes('@')) return '';
    const q = [];
    const ccAddr = String(cc || '').trim();
    if (ccAddr && ccAddr.includes('@')) q.push('cc=' + encodeURIComponent(ccAddr));
    if (subject) q.push('subject=' + encodeURIComponent(subject));
    if (body) q.push('body=' + encodeURIComponent(body));
    return 'mailto:' + encodeURIComponent(addr) + (q.length ? '?' + q.join('&') : '');
  }

  /**
   * Mailto al club con CC al solicitante y cuerpo estructurado.
   */
  function buildNotifyClubMailto(opts) {
    const requesterEmail = String((opts && opts.requesterEmail) || '').trim();
    const body =
      opts.body ||
      formatStructuredEmail({
        title: opts.title,
        sections: opts.sections,
        footerLines: opts.footerLines,
        requesterEmail: requesterEmail
      });
    return buildMailtoUrl(
      getClubNotifyEmail(),
      requesterEmail,
      opts.subject || 'Solicitud — CD Sanabria CF',
      body
    );
  }

  function openMailto(url) {
    if (!url) return false;
    global.location.href = url;
    return true;
  }

  global.ClubMailto = {
    CLUB_EMAIL_NOTIFY_FALLBACK: CLUB_EMAIL_NOTIFY_FALLBACK,
    getClubNotifyEmail: getClubNotifyEmail,
    formatStructuredEmail: formatStructuredEmail,
    buildMailtoUrl: buildMailtoUrl,
    buildNotifyClubMailto: buildNotifyClubMailto,
    openMailto: openMailto
  };
})(typeof window !== 'undefined' ? window : globalThis);
