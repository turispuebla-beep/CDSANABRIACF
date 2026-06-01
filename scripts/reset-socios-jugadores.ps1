# Vacía SOLO socios, jugadores y solicitudes en Firestore (cdsanabriacf2026).
# NO toca: sanabria_admins, sanabria_users, Firebase Authentication, eventos, equipos, etc.
# Requiere: firebase CLI con sesión iniciada (firebase login).
$ErrorActionPreference = 'Stop'
$Project = 'cdsanabriacf2026'
$Collections = @(
    'sanabria_members',
    'sanabria_players',
    'sanabria_player_applications',
    'sanabria_player_portal_resets'
)

Write-Host "Reset socios/jugadores — proyecto $Project" -ForegroundColor Cyan
Write-Host "  (administradores sanabria_admins NO se borran)" -ForegroundColor DarkGray
foreach ($col in $Collections) {
    Write-Host "  Borrando $col ..." -ForegroundColor Yellow
    firebase firestore:delete $col --recursive --force --project $Project
}
Write-Host ""
Write-Host "Firestore vaciado (solo socios/jugadores). Login admin intacto." -ForegroundColor Green
Write-Host "Si ves datos viejos en el panel, usa Reset socios y jugadores o Ctrl+F5." -ForegroundColor Green
