# @dexscannerappbot — Description API kilidi + kontrol
# Kullanım:
#   1) Proje kökünde .env → BOT_TOKEN=...
#   2) veya: .\scripts\fix-dex-description.ps1 -Token "123:ABC..."
#   3) veya: scripts\dex-token.txt içine sadece token (tek satır), dosya git'e gitmez

param(
  [string]$Token = "",
  [switch]$CheckOnly,
  [switch]$ClearOnly
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent

function Read-DotEnvToken {
  param([string]$EnvPath)
  if (-not (Test-Path $EnvPath)) { return "" }
  foreach ($line in Get-Content $EnvPath -Encoding UTF8) {
    $t = $line.Trim()
    if ($t -match '^\s*BOT_TOKEN\s*=\s*(.+)\s*$') {
      return $Matches[1].Trim().Trim('"').Trim("'")
    }
  }
  return ""
}

function TgApi {
  param([string]$BotToken, [string]$Method, [hashtable]$Query = @{})
  $q = @{ }
  foreach ($k in $Query.Keys) { $q[$k] = $Query[$k] }
  $uri = "https://api.telegram.org/bot$BotToken/$Method"
  if ($q.Count -gt 0) {
    $uri += "?" + (($q.GetEnumerator() | ForEach-Object { "{0}={1}" -f $_.Key, [uri]::EscapeDataString([string]$_.Value) }) -join "&")
  }
  return Invoke-RestMethod -Uri $uri -Method Get
}

# Token kaynağı
if (-not $Token) { $Token = Read-DotEnvToken (Join-Path $root ".env") }
if (-not $Token) {
  $localFile = Join-Path $PSScriptRoot "dex-token.txt"
  if (Test-Path $localFile) {
    $Token = (Get-Content $localFile -Raw).Trim()
  }
}
if (-not $Token) {
  Write-Host ""
  Write-Host "BOT_TOKEN yok." -ForegroundColor Red
  Write-Host "  A) $root\.env  icine:  BOT_TOKEN=`"123456:ABC...`"" -ForegroundColor Yellow
  Write-Host "  B) $PSScriptRoot\dex-token.txt  (tek satir token)" -ForegroundColor Yellow
  Write-Host "  C) .\scripts\fix-dex-description.ps1 -Token `"123456:ABC...`"" -ForegroundColor Yellow
  Write-Host ""
  exit 1
}

$Token = $Token.Trim().Trim('"').Trim("'")
if ($Token -notmatch '^\d+:[A-Za-z0-9_-]+$') {
  Write-Host "Token formati hatali (ornek: 123456789:AAH...)" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "=== DEX bot description fix ===" -ForegroundColor Cyan

$me = TgApi -BotToken $Token -Method "getMe"
$user = $me.result.username
Write-Host "Bot: @$user ($($me.result.first_name))" -ForegroundColor Green

if ($user -ne "dexscannerappbot") {
  Write-Host ""
  Write-Host "UYARI: Bu token @dexscannerappbot degil!" -ForegroundColor Red
  Write-Host "Railway DEX servisindeki BOT_TOKEN ile BotFather @dexscannerappbot token ayni olmali." -ForegroundColor Yellow
  $ans = Read-Host "Yine de devam? (e/h)"
  if ($ans -notmatch '^e') { exit 1 }
}

$langs = @("", "en", "tr", "ru")
Write-Host ""
Write-Host "--- API Description (BotFather'dan ayri) ---" -ForegroundColor Cyan

$hadBlock = $false
foreach ($lang in $langs) {
  $params = @{}
  if ($lang) { $params["language_code"] = $lang }
  $r = TgApi -BotToken $Token -Method "getMyDescription" -Query $params
  $text = [string]$r.result.description
  $label = if ($lang) { $lang } else { "varsayilan" }
  if ($text) {
    $hadBlock = $true
    Write-Host "[$label] DOLU ($($text.Length) karakter):" -ForegroundColor Yellow
    if ($text.Length -gt 120) { Write-Host ($text.Substring(0, 120) + "...") } else { Write-Host $text }
  } else {
    Write-Host "[$label] bos" -ForegroundColor DarkGray
  }
}

if ($CheckOnly) {
  if ($hadBlock) {
    Write-Host ""
    Write-Host "Temizlemek icin: .\scripts\fix-dex-description.ps1 -ClearOnly" -ForegroundColor Yellow
  }
  exit 0
}

if (-not $ClearOnly -and -not $hadBlock) {
  Write-Host ""
  Write-Host "API kilidi yok. BotFather -> Edit Description -> kaydet; Telegram onbellegini yenile." -ForegroundColor Green
  exit 0
}

if (-not $ClearOnly) {
  Write-Host ""
  $go = Read-Host "en/tr/ru API kayitlarini silip BotFather metnini acayim mi? (e/h)"
  if ($go -notmatch '^e') { exit 0 }
}

Write-Host ""
Write-Host "Siliniyor: en, tr, ru ..." -ForegroundColor Cyan
foreach ($lang in @("en", "tr", "ru")) {
  $d = TgApi -BotToken $Token -Method "setMyDescription" -Query @{ description = ""; language_code = $lang }
  $s = TgApi -BotToken $Token -Method "setMyShortDescription" -Query @{ short_description = ""; language_code = $lang }
  $okD = if ($d.ok) { "ok" } else { "HATA" }
  $okS = if ($s.ok) { "ok" } else { "HATA" }
  Write-Host "  [$lang] description: $okD  short: $okS"
}

Write-Host ""
Write-Host "Bitti." -ForegroundColor Green
Write-Host "1) BotFather -> @dexscannerappbot -> Edit Description -> metni kaydet" -ForegroundColor White
Write-Host "2) Telegram: botu sil, tekrar ara, Start oncesi profile bak" -ForegroundColor White
Write-Host "3) Token sohbette aciksa BotFather -> Revoke -> Railway BOT_TOKEN guncelle" -ForegroundColor Yellow
Write-Host ""
