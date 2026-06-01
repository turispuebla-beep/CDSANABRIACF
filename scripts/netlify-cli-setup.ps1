# Configuración inicial Netlify CLI (solo una vez por PC).
# Ejecutar en PowerShell:
#   powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\netlify-cli-setup.ps1"

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

Write-Host ''
Write-Host '=== Netlify CLI — configuración inicial (CDSANABRIACF) ===' -ForegroundColor Cyan
Write-Host "Carpeta: $root" -ForegroundColor DarkGray
Write-Host ''

function Test-Command($name) {
    return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

if (-not (Test-Command 'node')) {
    Write-Host 'Falta Node.js. Instálalo (LTS): https://nodejs.org' -ForegroundColor Red
    exit 1
}
Write-Host ('Node: ' + (node -v)) -ForegroundColor Green
Write-Host ('npm:  ' + (npm -v)) -ForegroundColor Green

if (-not (Test-Command 'netlify')) {
    Write-Host 'Instalando netlify-cli (global)...' -ForegroundColor Yellow
    npm install -g netlify-cli
}
Write-Host ('Netlify CLI: ' + (netlify --version)) -ForegroundColor Green

Write-Host ''
Write-Host '[1/3] Dependencias del proyecto (firebase-admin, nodemailer)...' -ForegroundColor Cyan
npm install

Write-Host ''
Write-Host '[2/3] Inicio de sesión en Netlify (se abrirá el navegador)...' -ForegroundColor Cyan
netlify login

Write-Host ''
Write-Host '[3/3] Enlazar este proyecto con tu sitio del club...' -ForegroundColor Cyan
Write-Host '      Elige el sitio correcto cuando pregunte.' -ForegroundColor DarkGray
netlify link

Write-Host ''
Write-Host 'Listo en este PC.' -ForegroundColor Green
Write-Host ''
Write-Host 'Siguiente (panel web Netlify, una sola vez):' -ForegroundColor Yellow
Write-Host '  Site configuration -> Environment variables' -ForegroundColor White
Write-Host '  Copia variables de: netlify_env.example' -ForegroundColor White
Write-Host '  Guía correo: docs/EMAIL-SOCIOS.md' -ForegroundColor White
Write-Host ''
Write-Host 'Para subir web + funciones a producción:' -ForegroundColor Yellow
Write-Host '  powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\deploy-netlify-prod.ps1"' -ForegroundColor White
Write-Host ''
