# Crea SOLO el documento de super administrador (amco@gmx.es).
# Usuario normal alarico1963@gmail.com NO debe tener entrada en sanabria_admins.
$ErrorActionPreference = 'Stop'
$project = 'cdsanabriacf2026'

$superAdmin = @{
    uid   = 'PMhRCGKtlJgftYfHARSNOmS7A7D3'
    email = 'amco@gmx.es'
    name  = 'Super administrador'
}

Write-Host 'Documento Firestore para super admin:' -ForegroundColor Cyan
Write-Host "  sanabria_admins/$($superAdmin.uid)" -ForegroundColor White
Write-Host "  email: $($superAdmin.email)" -ForegroundColor White
Write-Host ''
Write-Host 'La CLI de Firebase no siempre permite escribir documentos.' -ForegroundColor Yellow
Write-Host 'Crea el documento a mano en la consola con estos campos:' -ForegroundColor Yellow
Write-Host @"

  appScope: cdsanabriacf
  isAdmin: true
  isSuperAdmin: true
  role: super_admin
  email: $($superAdmin.email)
  name: $($superAdmin.name)

"@ -ForegroundColor Gray

Write-Host 'Consola: https://console.firebase.google.com/project/cdsanabriacf2026/firestore' -ForegroundColor Green
Write-Host ''
Write-Host 'Si existe sanabria_admins/3YvmxvrvPfOhSPmwSxirdgrnCeB2 (alarico), elimínalo (usuario normal).' -ForegroundColor Yellow
