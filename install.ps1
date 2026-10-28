# =========================================================
# Listen Together - Installer for Windows
# =========================================================

$ErrorActionPreference = 'Stop'

Write-Host "==========================================" -ForegroundColor Green
Write-Host " Installing Listen Together for Spotify" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green

# 1. Check if Spicetify is installed
$spicetifyCmd = Get-Command spicetify -ErrorAction SilentlyContinue
if (-not $spicetifyCmd) {
    $spicetifyPath = "$env:LOCALAPPDATA\spicetify"
    if (Test-Path "$spicetifyPath\spicetify.exe") {
        $env:PATH += ";$spicetifyPath"
    } else {
        Write-Host "`n[!] Spicetify CLI not found. Installing Spicetify first..." -ForegroundColor Yellow
        iwr -useb https://raw.githubusercontent.com/spicetify/cli/main/d.ps1 | iex
        $env:PATH += ";$env:LOCALAPPDATA\spicetify"
    }
}

# 2. Locate Extensions directory
$extensionsDir = "$env:LOCALAPPDATA\spicetify\Extensions"
if (-not (Test-Path $extensionsDir)) {
    New-Item -ItemType Directory -Path $extensionsDir -Force | Out-Null
}

# 3. Download the pre-compiled extension bundle from GitHub
$bundleUrl = "https://raw.githubusercontent.com/Jemyryuu/listra/main/extension/dist/listen-together.js"
$targetFile = "$extensionsDir\listen-together.js"

Write-Host "`n[1/3] Downloading Listen Together extension..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $bundleUrl -OutFile $targetFile -UseBasicParsing

# 4. Register listentogether:// URL scheme in registry
Write-Host "[2/3] Registering Windows protocol handler..." -ForegroundColor Cyan
$regKey = "HKCU:\Software\Classes\listentogether"
New-Item -Path $regKey -Force | Out-Null
Set-ItemProperty -Path $regKey -Name "(default)" -Value "URL:Listen Together Protocol"
Set-ItemProperty -Path $regKey -Name "URL Protocol" -Value ""
New-Item -Path "$regKey\shell\open\command" -Force | Out-Null

# 5. Enable extension in Spicetify config and apply
Write-Host "[3/3] Applying extension to Spotify..." -ForegroundColor Cyan
spicetify config extensions listen-together.js
spicetify apply

Write-Host "`n=================================================" -ForegroundColor Green
Write-Host " SUCCESS: Listen Together has been installed." -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green
Write-Host "Restart Spotify to start listening together with friends." -ForegroundColor White
