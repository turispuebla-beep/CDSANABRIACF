@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo Solo Netlify (web + funciones). Para subir TODO usa: SUBIR-TODO.cmd
echo.
pause

powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\deploy-netlify-prod.ps1"
set ERR=%ERRORLEVEL%
echo.
if %ERR% equ 0 (
    echo OK — https://www.cdsanabriacf.com/deploy-version.json
) else (
    echo ERROR. Codigo: %ERR%
)
echo.
pause
exit /b %ERR%
