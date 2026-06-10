#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { buildClubAdminContent } = require('../netlify/functions/lib/club-admin-notify-email');

const root = path.join(__dirname, '..');
const payloadFile = path.join(__dirname, 'test-player-emails-payload.json');
const outFile = path.join(root, 'previews', 'vista-previa-correos.html');

const tests = JSON.parse(fs.readFileSync(payloadFile, 'utf8'));
const clubTests = tests.filter((t) => t.body && t.body.type === 'club_admin_notify');

let sections = clubTests
  .map(function (t) {
    const content = buildClubAdminContent(t.body);
    return (
      '<section style="margin:0 0 40px;padding:24px;border:2px solid #e2e8f0;border-radius:12px;background:#fff">' +
      '<h2 style="margin:0 0 6px;color:#1e3a8a;font-size:1.1rem">' +
      escape(t.name) +
      '</h2>' +
      '<p style="margin:0 0 16px;color:#64748b;font-size:0.85rem">Asunto: <strong>' +
      escape(content.subject) +
      '</strong> · Adjuntos CSV + Word en el correo real</p>' +
      content.html +
      '</section>'
    );
  })
  .join('\n');

const html =
  '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>Vista previa correos — CD Sanabria CF</title>' +
  '<style>body{font-family:system-ui,sans-serif;background:#f1f5f9;margin:0;padding:24px 16px 48px}' +
  '.wrap{max-width:720px;margin:0 auto}h1{color:#1e3a8a}</style></head><body><div class="wrap">' +
  '<h1>Vista previa — correos al club</h1>' +
  '<p style="color:#64748b;line-height:1.5">Datos de <strong>prueba</strong>. Así se ven los avisos que recibe el club desde los modales <em>Nuevo jugador/a</em>, <em>Nueva inscripción</em> y <em>Registro socio</em>. Abre este archivo en el navegador sin conexión.</p>' +
  sections +
  '</div></body></html>';

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, html, 'utf8');
console.log('Generado:', outFile);

function escape(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
