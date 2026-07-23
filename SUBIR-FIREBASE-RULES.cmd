@echo off

chcp 65001 >nul

cd /d "%~dp0"



echo.

echo ============================================================

echo   CD Sanabria CF — Reglas Firebase (Firestore + Storage)

echo ============================================================

echo.

echo   Proyecto: cdsanabriacf2026

echo   Archivos: firestore.rules, storage.rules

echo.

pause



firebase deploy --only firestore:rules,storage --project cdsanabriacf2026

set ERR=%ERRORLEVEL%



echo.

if %ERR% equ 0 (echo OK — reglas desplegadas.) else (echo ERROR. Codigo: %ERR%)

echo.

pause

exit /b %ERR%

