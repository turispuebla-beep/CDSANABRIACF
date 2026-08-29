@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ============================================================
echo   CD Sanabria CF — SUBIR TODO A PRODUCCION
echo ============================================================
echo.
echo   Carpeta: %CD%
echo.
echo   Sube:
echo   1. Web + panel (netlify-dist)
echo   2. Funciones Netlify (tarjeta/Bizum, contabilidad, correos)
echo   3. Reglas Firebase (Firestore + Storage)
echo.
echo   Requisitos: Node.js, Netlify CLI y Firebase CLI ya logueados.
echo   Si falta Netlify CLI: scripts\netlify-cli-setup.ps1
echo.
pause

echo.
echo [1/2] Netlify — build + web + funciones...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\deploy-netlify-prod.ps1"
if errorlevel 1 goto :fail

echo.
echo [2/2] Firebase — reglas...
echo.
where firebase >nul 2>&1
if errorlevel 1 (
  echo AVISO: no esta Firebase CLI. La web ya esta en Netlify.
  echo Para reglas: npm i -g firebase-tools  y  firebase login
  echo Luego: SUBIR-FIREBASE-RULES.cmd
  goto :ok
)

firebase deploy --only firestore:rules,storage --project cdsanabriacf2026
if errorlevel 1 goto :fail

:ok
echo.
echo ============================================================
echo   LISTO
echo   https://www.cdsanabriacf.com
echo   https://www.cdsanabriacf.com/deploy-version.json
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
