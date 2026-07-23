@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ============================================================
echo   Activar preinscripcion torneo (modo actualizacion OFF)
echo ============================================================
echo.
echo   Requiere FIREBASE_SERVICE_ACCOUNT_JSON o GOOGLE_APPLICATION_CREDENTIALS
echo.
pause

node scripts/enable-public-registrations.js
set ERR=%ERRORLEVEL%

echo.
if %ERR% neq 0 (
    echo Si falla: entra en la web como admin y pulsa "Actualizacion: OFF".
)
echo.
pause
exit /b %ERR%
