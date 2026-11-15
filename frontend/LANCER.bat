@echo off
REM Lance le frontend depuis son dossier et installe les dépendances absentes.
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js n'est pas installe. Installez Node.js LTS puis relancez. & pause & exit /b)
if not exist node_modules call npm ci
call npm run dev
pause
