'use strict';

const { execSync } = require('child_process');
const path = require('path');

function loadServiceAccountFromNetlify() {
  const root = path.join(__dirname, '..');
  let map = {};
  try {
    const out = execSync('netlify env:list --json', {
      cwd: root,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    map = JSON.parse(out);
  } catch (e) {
    throw new Error('No se pudo leer variables de Netlify: ' + (e.message || e));
  }
  const raw = map.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('No FIREBASE_SERVICE_ACCOUNT_JSON en Netlify');
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify(loadServiceAccountFromNetlify());
require('./create-competition-organizer.js');
