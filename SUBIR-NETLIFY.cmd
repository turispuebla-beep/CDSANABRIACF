@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo === Subir CD Sanabria CF a Netlify (produccion) ===
echo Carpeta: %CD%
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\deploy-netlify-prod.ps1" %*
if errorlevel 1 (
  echo.
  echo ERROR: el deploy ha fallado.
  pause
  exit /b 1
)

echo.
echo Listo. Web: https://www.cdsanabriacf.com
pause
