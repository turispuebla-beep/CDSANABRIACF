# Documentos sanabria_admins para panel de administración (crear en consola Firestore).
# Usuario normal alarico1963@gmail.com NO debe tener entrada en sanabria_admins.
$ErrorActionPreference = 'Stop'

$admins = @(
    @{
        uid          = 'PMhRCGKtlJgftYfHARSNOmS7A7D3'
        email        = 'amco@gmx.es'
        name         = 'Super administrador'
        isSuperAdmin = $true
        role         = 'super_admin'
    },
    @{
        uid          = 'H15Is5zg6iegMX3Nnj8xMnKsjII2'
        email        = 'cdsanabriacf@gmail.com'
        name         = 'CD Sanabria CF'
        isSuperAdmin = $false
        role         = 'admin'
    }
)

Write-Host 'Crear en Firestore (colección sanabria_admins):' -ForegroundColor Cyan
foreach ($a in $admins) {
    Write-Host ''
    Write-Host "  ID: $($a.uid)  |  $($a.email)" -ForegroundColor White
    Write-Host '  Campos:' -ForegroundColor DarkGray
    Write-Host '    appScope: cdsanabriacf'
    Write-Host '    isAdmin: true'
    Write-Host "    isSuperAdmin: $($a.isSuperAdmin)"
    Write-Host "    role: $($a.role)"
    Write-Host "    email: $($a.email)"
    Write-Host "    name: $($a.name)"
}

Write-Host ''
Write-Host 'Consola: https://console.firebase.google.com/project/cdsanabriacf2026/firestore' -ForegroundColor Green
Write-Host ''
Write-Host 'alarico1963@gmail.com (3YvmxvrvPfOhSPmwSxirdgrnCeB2): usuario normal — NO crear sanabria_admins.' -ForegroundColor Yellow
Write-Host 'Login web: email + contraseña en Authentication (no enlace por correo).' -ForegroundColor Yellow
