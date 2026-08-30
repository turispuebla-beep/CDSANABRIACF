@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo === Subir codigo a GitHub (commit + push) ===
echo Carpeta: %CD%
echo.
pause

set "GIT_AUTHOR_NAME=turispuebla-beep"
set "GIT_AUTHOR_EMAIL=turispuebla@gmail.com"
set "GIT_COMMITTER_NAME=turispuebla-beep"
set "GIT_COMMITTER_EMAIL=turispuebla@gmail.com"

git add -A
if errorlevel 1 goto :fail

git diff --cached --quiet
if %errorlevel% equ 0 (
  echo.
  echo No hay cambios nuevos para commit. Se hace push por si falta algo.
  echo.
) else (
  git commit -m "Actualiza CD Sanabria CF."
  if errorlevel 1 goto :fail
)

git push
if errorlevel 1 goto :fail

echo.
echo Listo. GitHub actualizado.
echo   https://github.com/turispuebla-beep/CDSANABRIACF.git
echo.
pause
exit /b 0

:fail
echo.
echo ERROR. Revisa los mensajes de arriba.
echo.
pause
exit /b 1
