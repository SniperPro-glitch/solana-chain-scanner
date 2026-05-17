@echo off
cd /d "%~dp0"
echo Helius anahtari test ediliyor (.env icinde HELIUS_API_KEY olmali)...
node scripts/verify-helius.js
pause
