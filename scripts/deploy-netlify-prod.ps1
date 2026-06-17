# Build netlify-dist + deploy producción (web + funciones Netlify).
# Requiere: netlify-cli-setup.ps1 ya ejecutado (login + link).
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\deploy-netlify-prod.ps1"
#
# Borrador (URL temporal, sin tocar producción):
#   powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\deploy-netlify-prod.ps1" -Draft

param(
    [switch]$Draft
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

Write-Host ''
Write-Host '=== Deploy Netlify producción (CDSANABRIACF) ===' -ForegroundColor Cyan
Write-Host "Raíz: $root" -ForegroundColor DarkGray
Write-Host ''

function Test-Command($name) {
    return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

if (-not (Test-Command 'node')) {
    Write-Host 'Falta Node.js: https://nodejs.org' -ForegroundColor Red
    exit 1
}
if (-not (Test-Command 'netlify')) {
    Write-Host 'Falta Netlify CLI. Ejecuta primero:' -ForegroundColor Red
    Write-Host '  powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\netlify-cli-setup.ps1"' -ForegroundColor Yellow
    exit 1
}

$stateFile = Join-Path $root '.netlify\state.json'
if (-not (Test-Path $stateFile)) {
    Write-Host 'Este PC no está enlazado al sitio Netlify.' -ForegroundColor Red
    Write-Host 'Ejecuta: scripts\netlify-cli-setup.ps1' -ForegroundColor Yellow
    exit 1
}

Write-Host '[1/4] npm install...' -ForegroundColor Cyan
npm install

Write-Host '[2/4] build-netlify-dist.ps1...' -ForegroundColor Cyan
& (Join-Path $root 'build-netlify-dist.ps1')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$dist = Join-Path $root 'netlify-dist'
$required = @('_redirects', '.netlifyignore', '404.html', 'index.html', 'deploy-version.json')
foreach ($f in $required) {
    if (-not (Test-Path (Join-Path $dist $f))) {
        Write-Host "Falta en netlify-dist: $f" -ForegroundColor Red
        exit 1
    }
}

Write-Host '[3/4] netlify deploy...' -ForegroundColor Cyan
if ($Draft) {
    Write-Host '      Modo BORRADOR (no es producción)' -ForegroundColor Yellow
    netlify deploy --skip-functions-cache
} else {
    Write-Host '      Producción (--skip-functions-cache: sube todas las funciones)' -ForegroundColor DarkGray
    netlify deploy --prod --skip-functions-cache
}
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host '[4/4] Comprobaciones sugeridas' -ForegroundColor Cyan
$siteUrl = ''
try {
    $status = netlify status --json 2>$null | ConvertFrom-Json
    if ($status.url) { $siteUrl = $status.url.TrimEnd('/') }
} catch { }

if (-not $siteUrl) {
    $siteUrl = 'https://www.cdsanabriacf.com'
    Write-Host "      (usa tu dominio si es otro)" -ForegroundColor DarkGray
}

Write-Host ''
Write-Host 'Deploy terminado.' -ForegroundColor Green
Write-Host "  $siteUrl/deploy-version.json" -ForegroundColor White
Write-Host "  $siteUrl/.netlify/functions/redsys-config" -ForegroundColor White
Write-Host ''
Write-Host 'Variables (correo, Firebase, Redsys): panel Netlify -> Environment variables' -ForegroundColor DarkGray
Write-Host ''
