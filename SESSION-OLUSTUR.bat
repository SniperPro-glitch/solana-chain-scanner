@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Justin TG_SESSION olustur
echo.
echo ========================================
echo   Solana bot - TG_SESSION olusturucu
echo   Klasor: %CD%
echo ========================================
echo.

if not exist "package.json" (
  echo HATA: package.json yok. Bu dosyayi solana-chain-scanner klasorunde calistir.
  pause
  exit /b 1
)

if not exist ".env" (
  echo HATA: .env dosyasi yok!
  echo Bu klasorde .env olustur, icine yaz:
  echo   TG_API_ID=39062027
  echo   TG_API_HASH=buraya_hash
  pause
  exit /b 1
)

echo [1/3] Paketler kuruluyor (1-2 dk, bekleyin)...
call npm install
if errorlevel 1 (
  echo npm install hata verdi.
  pause
  exit /b 1
)

call npm install input --no-save
if errorlevel 1 (
  echo input paketi kurulamadi.
  pause
  exit /b 1
)

echo.
echo [2/3] Session basliyor - Justin telefonu hazir olsun
echo [3/3] Sorulari cevaplayin (numara, SMS kodu, 2FA)
echo.
node scripts\generate-session.js

echo.
echo Bitti. SESSION yukarida ----- arasinda.
echo Railway -^> TG_SESSION olarak yapistir.
echo.
pause
