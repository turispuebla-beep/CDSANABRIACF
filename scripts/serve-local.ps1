# Servidor HTTP local para CDSANABRIACF (Firebase Auth/Firestore no funcionan con file://)
$ErrorActionPreference = 'Stop'
$port = 8765
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

Write-Host ''
Write-Host ' CD SANABRIA CF — servidor local' -ForegroundColor Cyan
Write-Host " Carpeta: $root" -ForegroundColor DarkGray
Write-Host " Abre en el navegador: http://127.0.0.1:$port/" -ForegroundColor Green
Write-Host ' (Ctrl+C para detener)' -ForegroundColor DarkGray
Write-Host ''

if (Get-Command python -ErrorAction SilentlyContinue) {
    python -m http.server $port --bind 127.0.0.1
    exit $LASTEXITCODE
}
if (Get-Command py -ErrorAction SilentlyContinue) {
    py -m http.server $port --bind 127.0.0.1
    exit $LASTEXITCODE
}
if (Get-Command npx -ErrorAction SilentlyContinue) {
    npx --yes serve -l $port .
    exit $LASTEXITCODE
}

Write-Host 'Instala Python o Node (npx) para levantar el servidor.' -ForegroundColor Red
exit 1
