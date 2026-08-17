$ErrorActionPreference = 'Stop'

$workspace = Split-Path $PSScriptRoot -Parent
$javaHome = Get-ChildItem 'C:\Program Files\Eclipse Adoptium' -Directory -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -like 'jdk-21*' } |
  Sort-Object Name -Descending |
  Select-Object -First 1 -ExpandProperty FullName

if (-not $javaHome) {
  $javaHome = Get-ChildItem 'C:\Program Files\Java' -Directory -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -like 'jdk-21*' } |
    Sort-Object Name -Descending |
    Select-Object -First 1 -ExpandProperty FullName
}

if (-not $javaHome) {
  throw 'JDK 21 is required to build the Android app.'
}

$androidHome = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "$env:LOCALAPPDATA\Android\Sdk" }
if (-not (Test-Path -LiteralPath $androidHome)) {
  throw "Android SDK not found at $androidHome"
}

$env:JAVA_HOME = $javaHome
$env:Path = "$javaHome\bin;$env:Path"
$env:ANDROID_HOME = $androidHome
$env:ANDROID_SDK_ROOT = $androidHome

Push-Location "$workspace\android"
try {
  & .\gradlew.bat assembleDebug
  if ($LASTEXITCODE -ne 0) { throw "Gradle build failed with exit code $LASTEXITCODE" }
} finally {
  Pop-Location
}

$artifactDirectory = "$workspace\artifacts"
$sourceApk = "$workspace\android\app\build\outputs\apk\debug\app-debug.apk"
$targetApk = "$artifactDirectory\MedLoop-AI-debug.apk"

New-Item -ItemType Directory -Path $artifactDirectory -Force | Out-Null
Copy-Item -LiteralPath $sourceApk -Destination $targetApk -Force
Write-Host "APK created: $targetApk"
