# Prepara netlify-dist/ para subida manual a Netlify.
# SIEMPRE incluye: _redirects, .netlifyignore, 404.html
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File ".\build-netlify-dist.ps1"

$ErrorActionPreference = 'Stop'
$root = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$dist = Join-Path $root 'netlify-dist'
$templates = Join-Path $root 'scripts\netlify-deploy'

Write-Host ''
Write-Host '=== build-netlify-dist (CDSANABRIACF) ===' -ForegroundColor Cyan
Write-Host "Raiz: $root" -ForegroundColor DarkGray

if (-not (Test-Path $dist)) {
    New-Item -ItemType Directory -Path $dist | Out-Null
}

# --- 1. Copiar fuentes de produccion desde la raiz ---
Write-Host '[1/4] Sincronizando HTML, JS, PWA...' -ForegroundColor Cyan
$copyItems = @(
    'index.html',
    'admin-panel.html',
    'pago-resultado.html',
    'pago-cuota-socio.html',
    'inscripcion-jugador.html',
    'inscripcion-jugador-demo.html',
    'sw.js',
    'manifest.json'
)
foreach ($item in $copyItems) {
    $src = Join-Path $root $item
    if (Test-Path $src) {
        Copy-Item $src (Join-Path $dist $item) -Force
        Write-Host "      + $item" -ForegroundColor Gray
    } else {
        Write-Host "      ! falta en raiz: $item" -ForegroundColor Yellow
    }
}

$jsSrc = Join-Path $root 'js'
$jsDest = Join-Path $dist 'js'
if (Test-Path $jsSrc) {
    if (-not (Test-Path $jsDest)) { New-Item -ItemType Directory -Path $jsDest | Out-Null }
    Copy-Item (Join-Path $jsSrc '*') $jsDest -Recurse -Force
    Write-Host '      + js/' -ForegroundColor Gray
}

# Escudos e imágenes del club (carpeta assets/)
$assetsSrc = Join-Path $root 'assets'
if (-not (Test-Path $assetsSrc)) { New-Item -ItemType Directory -Path $assetsSrc | Out-Null }
# Escudos en raíz → assets/ (la web usa assets/escudo-*.png)
@('escudo-180.png', 'escudo-192.png', 'escudo-512.png', 'escudo-cdsanabriacf.png') | ForEach-Object {
    $fromRoot = Join-Path $root $_
    $toAssets = Join-Path $assetsSrc $_
    if ((Test-Path $fromRoot) -and -not (Test-Path $toAssets)) {
        Copy-Item $fromRoot $toAssets -Force
        Write-Host "      + assets/$_ (desde raiz)" -ForegroundColor Gray
    }
}
$mainEscudo = Join-Path $assetsSrc 'escudo-cdsanabriacf.png'
if (-not (Test-Path $mainEscudo)) {
    $fallback = Join-Path $assetsSrc 'escudo-512.png'
    if (-not (Test-Path $fallback)) { $fallback = Join-Path $root 'escudo-512.png' }
    if (Test-Path $fallback) {
        Copy-Item $fallback $mainEscudo -Force
        Write-Host '      + assets/escudo-cdsanabriacf.png (desde escudo-512)' -ForegroundColor Gray
    }
}
$assetsDest = Join-Path $dist 'assets'
if (Test-Path $assetsSrc) {
    if (-not (Test-Path $assetsDest)) { New-Item -ItemType Directory -Path $assetsDest | Out-Null }
    Copy-Item (Join-Path $assetsSrc '*') $assetsDest -Recurse -Force
    Write-Host '      + assets/' -ForegroundColor Gray
}

# favicon.ico opcional en raíz
if (Test-Path (Join-Path $root 'favicon.ico')) {
    Copy-Item (Join-Path $root 'favicon.ico') (Join-Path $dist 'favicon.ico') -Force
    Write-Host '      + favicon.ico' -ForegroundColor Gray
}

# --- 2. Plantillas obligatorias Netlify (SIEMPRE) ---
Write-Host '[2/4] Copiando _redirects, .netlifyignore, 404.html (obligatorios)...' -ForegroundColor Cyan
$required = @('_redirects', '.netlifyignore', '404.html')
foreach ($name in $required) {
    $src = Join-Path $templates $name
    if (-not (Test-Path $src)) {
        Write-Host "      ERROR: falta plantilla $src" -ForegroundColor Red
        exit 1
    }
    Copy-Item $src (Join-Path $dist $name) -Force
    Write-Host "      OK $name" -ForegroundColor Green
}

# --- 3. Quitar del deploy manual archivos que no deben subirse ---
Write-Host '[3/4] Limpiando archivos no publicables en netlify-dist...' -ForegroundColor Cyan
$removePatterns = @(
    '*.md',
    'database.js',
    'firestore.rules',
    'realtime-sync.js',
    'ecosystem.config.js',
    'error-handler.js',
    'data-manager.js',
    'probar-*',
    'test-*',
    'verificar-*',
    'limpiar-*',
    'demo-*',
    'quick-test.js',
    'sync-test-*',
    '*railway*',
    '*RAILWAY*',
    'test-persistencia.html',
    'database-admin.html',
    'netlify.toml'
)
$removed = 0
foreach ($pat in $removePatterns) {
    Get-ChildItem $dist -Recurse -File -Filter $pat -ErrorAction SilentlyContinue | ForEach-Object {
        Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
        $removed++
    }
}
# Patrones sin Filter directo
@('crear-icono-', 'generador-', 'qr-', 'create-qr', 'generate-qr', 'enlace-admin', 'boton-tienda', 'tienda', 'admin-tienda', 'coach-panel', 'friends-access', 'members-access', 'admin-socios', '-access.html', 'sw-ios.js', 'manifest-ios.json') | ForEach-Object {
    $pat = $_
    Get-ChildItem $dist -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*$pat*" } | ForEach-Object {
        Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
        $removed++
    }
}
Write-Host "      Eliminados (aprox.): $removed archivos" -ForegroundColor Gray

# Raíz de netlify-dist: solo lo publicable (evita basura de subidas anteriores)
$keepRoot = @(
    'index.html', 'admin-panel.html', 'pago-resultado.html', 'pago-cuota-socio.html',
    'inscripcion-jugador.html', 'inscripcion-jugador-demo.html',
    'sw.js', 'manifest.json', 'favicon.ico',
    '_redirects', '.netlifyignore', '404.html', 'deploy-version.json'
)
Get-ChildItem $dist -File -ErrorAction SilentlyContinue | ForEach-Object {
    if ($keepRoot -notcontains $_.Name) {
        Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
        $removed++
    }
}
Get-ChildItem $dist -Directory -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -notin @('js', 'assets')
} | ForEach-Object {
    Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
    $removed++
}

# Version para comprobar deploy
$builtAt = (Get-Date).ToString('yyyyMMdd-HHmm')
$version = @{
    builtAt = (Get-Date).ToString('o')
    project = 'cdsanabriacf2026'
    appScope = 'cdsanabriacf'
    cacheVersion = "cdsanabriacf-v$builtAt"
} | ConvertTo-Json
Set-Content (Join-Path $dist 'deploy-version.json') $version -Encoding UTF8

# --- 3b. Actualizar version de cache en sw.js (deploy) ---
$swPath = Join-Path $dist 'sw.js'
if (Test-Path $swPath) {
    $cacheVer = "cdsanabriacf-v$builtAt"
    $sw = Get-Content $swPath -Raw -Encoding UTF8
    $sw = $sw -replace "const CACHE_NAME = '[^']+'", "const CACHE_NAME = '$cacheVer'"
    $sw = $sw -replace "const STATIC_CACHE = '[^']+'", "const STATIC_CACHE = '$cacheVer-static'"
    $sw = $sw -replace "const DYNAMIC_CACHE = '[^']+'", "const DYNAMIC_CACHE = '$cacheVer-dynamic'"
    Set-Content $swPath $sw -Encoding UTF8 -NoNewline
    Write-Host "      OK sw.js cache -> $cacheVer" -ForegroundColor Green
}

# --- 4. Verificacion ---
Write-Host '[4/4] Verificacion...' -ForegroundColor Cyan
$ok = $true
foreach ($name in $required) {
    $p = Join-Path $dist $name
    if (-not (Test-Path $p)) {
        Write-Host "      FALTA: $name" -ForegroundColor Red
        $ok = $false
    }
}
foreach ($name in @('index.html', 'admin-panel.html', 'sw.js', 'manifest.json')) {
    if (-not (Test-Path (Join-Path $dist $name))) {
        Write-Host "      FALTA: $name" -ForegroundColor Red
        $ok = $false
    }
}
foreach ($name in @('escudo-192.png', 'escudo-512.png', 'escudo-cdsanabriacf.png', 'torneo-futbol-7-2026.jpeg')) {
    $p = Join-Path $dist "assets\$name"
    if (-not (Test-Path $p)) {
        Write-Host "      FALTA: assets/$name" -ForegroundColor Red
        $ok = $false
    }
}
foreach ($name in @('admin-session.js', 'club-contact-defaults.js', 'torneo-preinscripcion.js', 'admin-torneo-preinscripciones.js', 'player-application.js', 'protocol-guard.js', 'club-password-hash.js', 'colaborador-solicitud.js', 'site-update-mode.js')) {
    $p = Join-Path $dist "js\$name"
    if (-not (Test-Path $p)) {
        Write-Host "      FALTA: js/$name" -ForegroundColor Red
        $ok = $false
    }
}
if (-not $ok) {
    Write-Host ''
    Write-Host 'Build INCOMPLETO.' -ForegroundColor Red
    exit 1
}

Write-Host ''
Write-Host 'Listo. Sube el CONTENIDO de:' -ForegroundColor Green
Write-Host "  $dist" -ForegroundColor White
Write-Host 'Incluye siempre: _redirects, .netlifyignore, 404.html' -ForegroundColor DarkGray
Write-Host ''
Write-Host 'AVISO correo / Redsys / Firebase:' -ForegroundColor Yellow
Write-Host '  El ZIP de netlify-dist NO incluye funciones serverless.' -ForegroundColor Yellow
Write-Host '  Para SendGrid, Redsys y solicitudes jugador despliega el REPO completo' -ForegroundColor Yellow
Write-Host '  (Git + netlify.toml) o: netlify deploy --prod desde la raiz.' -ForegroundColor Yellow
Write-Host '  Variables: netlify_env.example  |  Guia email: docs/EMAIL-SOCIOS.md' -ForegroundColor DarkGray
Write-Host ''
