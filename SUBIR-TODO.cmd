@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ============================================================
echo   CD Sanabria CF — SUBIR TODO A PRODUCCION
echo   1. Netlify (web + funciones)
echo   2. Reglas Firebase (privacidad jugadores)
echo   3. Activar preinscripcion torneo (modo actualizacion OFF)
echo ============================================================
echo.
echo   Carpeta: %CD%
echo.
echo   Requisitos:
echo   - Node.js + Netlify CLI (scripts\netlify-cli-setup.ps1 si falta)
echo   - Firebase CLI (firebase login)
echo   - Para paso 3: FIREBASE_SERVICE_ACCOUNT_JSON o GOOGLE_APPLICATION_CREDENTIALS
echo.
pause

echo.
echo [1/3] Netlify — build + deploy produccion...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\deploy-netlify-prod.ps1"
if errorlevel 1 goto :fail

echo.
echo [2/3] Firebase — reglas Firestore...
echo.
firebase deploy --only firestore:rules --project cdsanabriacf2026
if errorlevel 1 goto :fail

echo.
echo [3/3] Firebase — activar preinscripciones publicas...
echo.
node scripts/enable-public-registrations.js
if errorlevel 1 (
    echo.
    echo AVISO: No se pudo activar por script.
    echo En la web, entra como admin y pulsa "Actualizacion: OFF" en el banner.
    echo.
) else (
    echo.
    echo Preinscripcion torneo ACTIVADA.
    echo.
)

echo.
echo ============================================================
echo   LISTO
echo   Comprueba: https://www.cdsanabriacf.com/deploy-version.json
echo   Prueba torneo: Inscribete en la home
echo ============================================================
echo.
pause
exit /b 0

:fail
echo.
echo ERROR en el deploy. Revisa los mensajes de arriba.
echo.
pause
exit /b 1
