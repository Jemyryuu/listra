$ErrorActionPreference = 'Stop'

Write-Host "==========================================" -ForegroundColor Green
Write-Host " Installing Listra (Spicetify Extension for Spotify)" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green

# 1. Ensure Spicetify CLI is installed (required: Listra is built for Spicetify and cannot run on regular Spotify)
Write-Host "`n[*] Verifying Spicetify CLI (required: Listra does not run on regular Spotify)..." -ForegroundColor Cyan
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

# 2. Ensure Node.js is installed (required for the host companion daemon)
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    $defaultNodePath = "$env:ProgramFiles\nodejs"
    $x86NodePath = "${env:ProgramFiles(x86)}\nodejs"
    
    if (Test-Path "$defaultNodePath\node.exe") {
        $env:PATH += ";$defaultNodePath"
    } elseif (Test-Path "$x86NodePath\node.exe") {
        $env:PATH += ";$x86NodePath"
    } else {
        $wingetCmd = Get-Command winget -ErrorAction SilentlyContinue
        if ($wingetCmd) {
            Write-Host "`n[!] Node.js not detected. Installing Node.js LTS silently via winget..." -ForegroundColor Yellow
            try {
                winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements | Out-Null
                if (Test-Path "$defaultNodePath\node.exe") {
                    $env:PATH += ";$defaultNodePath"
                } elseif (Test-Path "$x86NodePath\node.exe") {
                    $env:PATH += ";$x86NodePath"
                }
                Write-Host "Node.js successfully installed." -ForegroundColor Green
            } catch {
                Write-Host "[!] Failed to install Node.js automatically. You can install it manually from https://nodejs.org" -ForegroundColor Yellow
            }
        } else {
            Write-Host "`n[!] Node.js not detected. Please install Node.js from https://nodejs.org to use hosting features." -ForegroundColor Yellow
        }
    }
}

# 3. Setup directories
$extensionsDir = "$env:LOCALAPPDATA\spicetify\Extensions"
if (-not (Test-Path $extensionsDir)) {
    New-Item -ItemType Directory -Path $extensionsDir -Force | Out-Null
}

$listraDir = "$env:LOCALAPPDATA\listra"
if (-not (Test-Path $listraDir)) {
    New-Item -ItemType Directory -Path $listraDir -Force | Out-Null
}

# 4. Download bundles
$extensionBundleUrl = "https://raw.githubusercontent.com/Jemyryuu/listra/main/extension/dist/listra.js"
$daemonBundleUrl = "https://raw.githubusercontent.com/Jemyryuu/listra/main/daemon/dist/daemon.js"
$targetExtensionFile = "$extensionsDir\listra.js"
$targetDaemonFile = "$listraDir\daemon.js"

Write-Host "`n[1/4] Downloading Listra Spicetify extension..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $extensionBundleUrl -OutFile $targetExtensionFile -UseBasicParsing

Write-Host "[2/4] Downloading Listra companion daemon..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $daemonBundleUrl -OutFile $targetDaemonFile -UseBasicParsing

# 5. Create launcher scripts
$vbsContent = @"
Set shell = CreateObject("WScript.Shell")
args = ""
If WScript.Arguments.Count > 0 Then
  args = """" & WScript.Arguments(0) & """"
End If
target = "$targetDaemonFile"
cmd = "cmd.exe /c node """ & target & """ " & args
shell.Run cmd, 0, False
"@
Set-Content -Path "$listraDir\launch.vbs" -Value $vbsContent -Encoding ASCII

$cmdContent = "@echo off`r`nnode `"$targetDaemonFile`" %*`r`n"
Set-Content -Path "$listraDir\listra.cmd" -Value $cmdContent -Encoding ASCII

# 6. Add $listraDir to user PATH if not present
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notmatch [regex]::Escape($listraDir)) {
    [Environment]::SetEnvironmentVariable("Path", "$userPath;$listraDir", "User")
    $env:PATH += ";$listraDir"
}

# 7. Register listra:// and legacy listentogether:// protocol handlers
Write-Host "[3/4] Registering Windows protocol handler..." -ForegroundColor Cyan
$launcherCmd = "wscript.exe `"$listraDir\launch.vbs`" `"%1`""

foreach ($proto in @("listra", "listentogether")) {
    $regKey = "HKCU:\Software\Classes\$proto"
    New-Item -Path $regKey -Force | Out-Null
    Set-ItemProperty -Path $regKey -Name "(default)" -Value "URL:Listra Protocol"
    Set-ItemProperty -Path $regKey -Name "URL Protocol" -Value ""
    $cmdKey = "$regKey\shell\open\command"
    New-Item -Path $cmdKey -Force | Out-Null
    Set-ItemProperty -Path $cmdKey -Name "(default)" -Value $launcherCmd
}

# 8. Apply extension in Spicetify
Write-Host "[4/4] Applying extension to Spotify via Spicetify..." -ForegroundColor Cyan
$legacyExtensionFile = "$extensionsDir\listen-together.js"
if (Test-Path $legacyExtensionFile) {
    Remove-Item $legacyExtensionFile -Force -ErrorAction SilentlyContinue
}
try {
    spicetify config extensions listen-together.js- | Out-Null
} catch {}
spicetify config extensions listra.js
try {
    spicetify apply
} catch {
    Write-Host "[*] Initializing Spicetify backup and applying Spotify files..." -ForegroundColor Yellow
    spicetify backup apply
}

Write-Host "`n=================================================" -ForegroundColor Green
Write-Host " SUCCESS: Listra has been installed!" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green
Write-Host "You can now:" -ForegroundColor White
Write-Host "  1. Restart Spotify (patched with Spicetify) - click 'Listra' in Spicetify to Host or Join." -ForegroundColor White
Write-Host "  2. (Optional) Run 'listra' from any terminal to start the daemon manually." -ForegroundColor White
