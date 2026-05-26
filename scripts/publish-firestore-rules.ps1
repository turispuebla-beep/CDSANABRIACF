# Publica firestore.rules en Firebase (proyecto cdsanabriacf2026).
# Requisitos: npm i -g firebase-tools  y  firebase login
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
    Write-Host '❌ No está instalado firebase-tools. Ejecuta: npm install -g firebase-tools' -ForegroundColor Red
    exit 1
}

Write-Host '📤 Publicando reglas Firestore → cdsanabriacf2026...' -ForegroundColor Cyan
firebase deploy --only firestore:rules --project cdsanabriacf2026
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host '✅ Reglas publicadas.' -ForegroundColor Green
