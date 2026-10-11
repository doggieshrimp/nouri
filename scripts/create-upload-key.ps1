# One-time setup: creates the Google Play upload key at keys\dailylog-upload.jks and
# writes android\keystore.properties so `npm run aab` can sign release builds.
# BACK UP keys\dailylog-upload.jks AND THE PASSWORD. Without them you can't ship updates
# (Play support can reset a lost upload key, but it takes days).
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$keystore = Join-Path $root "keys\dailylog-upload.jks"
$propsFile = Join-Path $root "android\keystore.properties"

if (Test-Path $keystore) { throw "$keystore already exists. Refusing to overwrite it." }

if (-not $env:JAVA_HOME) {
  $studio = (Get-ItemProperty HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*, HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\* -ErrorAction SilentlyContinue |
    Where-Object DisplayName -like "Android Studio*" | Select-Object -First 1).DisplayIcon
  $env:JAVA_HOME = Join-Path (Split-Path (Split-Path $studio -Parent) -Parent) "jbr"
}
$keytool = Join-Path $env:JAVA_HOME "bin\keytool.exe"

$name = Read-Host "Your name or developer name (shown in the certificate, e.g. Nouri)"
do {
  $p1 = Read-Host "Choose a key password (at least 6 characters)" -AsSecureString
  $p2 = Read-Host "Repeat the password" -AsSecureString
  $pw1 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($p1))
  $pw2 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($p2))
  if ($pw1 -ne $pw2) { Write-Host "Passwords don't match, try again." }
  elseif ($pw1.Length -lt 6) { Write-Host "Too short, try again." }
} until ($pw1 -eq $pw2 -and $pw1.Length -ge 6)

New-Item -ItemType Directory -Force (Split-Path $keystore) | Out-Null
& $keytool -genkeypair -v -keystore $keystore -storetype PKCS12 -alias upload `
  -keyalg RSA -keysize 2048 -validity 10000 `
  -dname "CN=$name" -storepass $pw1 -keypass $pw1
if ($LASTEXITCODE -ne 0) { throw "keytool failed." }

@"
storeFile=../keys/dailylog-upload.jks
storePassword=$pw1
keyAlias=upload
keyPassword=$pw1
"@ | Set-Content -Path $propsFile -Encoding ascii

Write-Host ""
Write-Host "Upload key created: $keystore"
Write-Host "Now back up that file and your password (e.g. a password manager plus a USB drive or cloud storage)."
