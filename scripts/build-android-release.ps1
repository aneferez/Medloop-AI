$ErrorActionPreference = 'Stop'

$workspace = Split-Path $PSScriptRoot -Parent
$javaHome = Get-ChildItem 'C:\Program Files\Eclipse Adoptium' -Directory -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -like 'jdk-21*' } |
  Sort-Object Name -Descending |
  Select-Object -First 1 -ExpandProperty FullName

if (-not $javaHome) {
  $javaHome = Get-ChildItem 'C:\Program Files\Java' -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like 'jdk-17*' } |
    Sort-Object Name -Descending |
    Select-Object -First 1 -ExpandProperty FullName
}

if (-not $javaHome) {
  throw 'Java 17 or newer is required to build the Android app.'
}

$androidHome = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "$env:LOCALAPPDATA\Android\Sdk" }
$keystoreProperties = "$workspace\android\keystore.properties"
$keystore = "$workspace\android\keystore\medloop-upload-key.jks"

if (-not (Test-Path -LiteralPath $androidHome)) {
  throw "Android SDK not found at $androidHome"
}
if (-not (Test-Path -LiteralPath $keystoreProperties)) {
  throw "Release signing configuration not found at $keystoreProperties"
}
if (-not (Test-Path -LiteralPath $keystore)) {
  throw "Release keystore not found at $keystore"
}

$env:JAVA_HOME = $javaHome
$env:Path = "$javaHome\bin;$env:Path"
$env:ANDROID_HOME = $androidHome
$env:ANDROID_SDK_ROOT = $androidHome

Push-Location "$workspace\android"
try {
  & .\gradlew.bat --no-daemon assembleRelease
  if ($LASTEXITCODE -ne 0) { throw "Gradle APK build failed with exit code $LASTEXITCODE" }
  & .\gradlew.bat --no-daemon bundleRelease
  if ($LASTEXITCODE -ne 0) { throw "Gradle app bundle build failed with exit code $LASTEXITCODE" }
} finally {
  Pop-Location
}

$artifactDirectory = "$workspace\artifacts"
$sourceApk = "$workspace\android\app\build\outputs\apk\release\app-release.apk"
$sourceBundle = "$workspace\android\app\build\outputs\bundle\release\app-release.aab"
$targetApk = "$artifactDirectory\MedLoop-AI-release.apk"
$targetBundle = "$artifactDirectory\MedLoop-AI-release.aab"
$targetBetaApk = "$artifactDirectory\MedLoop-AI-1.1.0-beta.11.apk"
$targetBetaBundle = "$artifactDirectory\MedLoop-AI-1.1.0-beta.11.aab"

New-Item -ItemType Directory -Path $artifactDirectory -Force | Out-Null
Copy-Item -LiteralPath $sourceApk -Destination $targetApk -Force
Copy-Item -LiteralPath $sourceBundle -Destination $targetBundle -Force
Copy-Item -LiteralPath $sourceApk -Destination $targetBetaApk -Force
Copy-Item -LiteralPath $sourceBundle -Destination $targetBetaBundle -Force
Write-Host "Release APK created: $targetApk"
Write-Host "Release AAB created: $targetBundle"
Write-Host "Versioned beta APK created: $targetBetaApk"
Write-Host "Versioned beta AAB created: $targetBetaBundle"
