# Builds the web app, syncs it into the Android project, and produces a debug APK
# at release\DailyLog.apk. Usage: npm run apk
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent

# Use Android Studio's bundled Java unless JAVA_HOME is already set.
if (-not $env:JAVA_HOME) {
  $studio = (Get-ItemProperty HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*, HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\* -ErrorAction SilentlyContinue |
    Where-Object DisplayName -like "Android Studio*" | Select-Object -First 1).DisplayIcon
  if (-not $studio) { throw "Android Studio not found. Set JAVA_HOME to a JDK 21 install." }
  $env:JAVA_HOME = Join-Path (Split-Path (Split-Path $studio -Parent) -Parent) "jbr"
}

# Java's Unix-domain sockets fail when the temp path uses a short 8.3 name (e.g. JOHNGO~1),
# which breaks the Gradle daemon with "Unable to establish loopback connection".
$env:JAVA_TOOL_OPTIONS = "-Djdk.net.unixdomain.tmpdir=$env:SystemRoot\Temp"

Push-Location $root
try {
  npm run android:sync
  if ($LASTEXITCODE -ne 0) { throw "Web build or sync failed." }

  Push-Location android
  try {
    .\gradlew.bat assembleDebug --console=plain
    if ($LASTEXITCODE -ne 0) { throw "Gradle build failed." }
  } finally { Pop-Location }

  New-Item -ItemType Directory -Force release | Out-Null
  Copy-Item android\app\build\outputs\apk\debug\app-debug.apk release\DailyLog.apk -Force
  Write-Host "APK ready: $root\release\DailyLog.apk"
} finally { Pop-Location }
