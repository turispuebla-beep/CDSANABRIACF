# Envía correos de PRUEBA (solo correo, sin Firebase ni panel).
# Uso:
#   powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\send-test-player-emails.ps1"
#
# Vista previa en navegador (sin enviar):
#   node .\scripts\generate-email-previews.js
#   Abre previews\vista-previa-correos.html

$ErrorActionPreference = 'Continue'
$payloadFile = Join-Path $PSScriptRoot 'test-player-emails-payload.json'
$base = 'https://www.cdsanabriacf.com/.netlify/functions/send-club-email'

if (-not (Test-Path $payloadFile)) {
    Write-Host "No existe $payloadFile" -ForegroundColor Red
    exit 1
}

$tests = Get-Content $payloadFile -Raw -Encoding UTF8 | ConvertFrom-Json
Write-Host ''
Write-Host '=== Correos de prueba (sin guardar datos) ===' -ForegroundColor Cyan
Write-Host 'Destino: cdsanabriafc@gmail.com (buzón del club)' -ForegroundColor DarkGray
Write-Host ''

$skipTypes = @('member_registered')

foreach ($t in $tests) {
    if ($skipTypes -contains $t.body.type) {
        Write-Host "Omitido: $($t.name) (requiere socio real en Firebase)" -ForegroundColor Yellow
        continue
    }
    $json = $t.body | ConvertTo-Json -Depth 12 -Compress
    Write-Host "Enviando: $($t.name) ..." -NoNewline
    try {
        $r = Invoke-RestMethod -Uri $base -Method POST -ContentType 'application/json; charset=utf-8' -Body $json -TimeoutSec 120
        if ($r.ok) {
            Write-Host " OK (sent=$($r.sent))" -ForegroundColor Green
        } else {
            Write-Host " FALLO: $($r.error)" -ForegroundColor Red
        }
    } catch {
        $detail = $_.Exception.Message
        if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
            $detail = $_.ErrorDetails.Message
        }
        Write-Host " ERROR: $detail" -ForegroundColor Red
        if ($t.name -eq 'confirmacion_jugador_ficha_actualizada') {
            Write-Host '  -> Ejecuta deploy: scripts\deploy-netlify-prod.ps1' -ForegroundColor Yellow
        }
    }
    Start-Sleep -Seconds 2
}

Write-Host ''
Write-Host 'Revisa cdsanabriafc@gmail.com (y spam). Avisos al club llevan adjuntos CSV y Word.' -ForegroundColor Green
Write-Host 'Vista previa HTML: node scripts\generate-email-previews.js' -ForegroundColor DarkGray
Write-Host ''
