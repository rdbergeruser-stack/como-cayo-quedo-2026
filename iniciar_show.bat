@echo off
title EEA Impro 2026 - Servidor Local del Show
cd /d "%~dp0"

set PORT=8080
echo ======================================================
echo   EEA IMPRO 2026 - Iniciando servidor local en :%PORT%
echo ======================================================
echo.

where python >nul 2>nul
if %errorlevel%==0 (
    echo Usando Python HTTP Server...
    start "" "http://localhost:%PORT%/index.html"
    start "" "http://localhost:%PORT%/control.html"
    python -m http.server %PORT%
    goto :eof
)

where py >nul 2>nul
if %errorlevel%==0 (
    echo Usando Python Launcher HTTP Server...
    start "" "http://localhost:%PORT%/index.html"
    start "" "http://localhost:%PORT%/control.html"
    py -m http.server %PORT%
    goto :eof
)

where npx >nul 2>nul
if %errorlevel%==0 (
    echo Usando Node npx serve...
    start "" "http://localhost:%PORT%/index.html"
    start "" "http://localhost:%PORT%/control.html"
    npx --yes serve -l %PORT% .
    goto :eof
)

echo [AVISO] No se encontro Python ni Node.js para levantar localhost.
echo Abriendo archivos directamente...
start "" "%~dp0index.html"
start "" "%~dp0control.html"
pause
