param(
  [string]$ApkPath = (Join-Path (Split-Path $PSScriptRoot -Parent) 'artifacts\MedLoop-AI-release.apk')
)

$ErrorActionPreference = 'Stop'

$androidHome = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "$env:LOCALAPPDATA\Android\Sdk" }
$adb = Join-Path $androidHome 'platform-tools\adb.exe'

if (-not (Test-Path -LiteralPath $adb)) { throw "ADB not found at $adb" }
if (-not (Test-Path -LiteralPath $ApkPath)) { throw "APK not found at $ApkPath" }

$physicalDevices = @(& $adb devices | Select-Object -Skip 1 | Where-Object {
  $_ -match '\sdevice$' -and $_ -notmatch '^emulator-'
} | ForEach-Object { ($_ -split '\s+')[0] })

if ($physicalDevices.Count -ne 1) {
  throw "Connect and authorize exactly one physical Android device. Found $($physicalDevices.Count)."
}

$serial = $physicalDevices[0]
& $adb -s $serial install -r $ApkPath
if ($LASTEXITCODE -ne 0) { throw 'APK installation failed.' }

& $adb -s $serial logcat -c
& $adb -s $serial shell am force-stop com.medloop.ai
& $adb -s $serial shell am start -n com.medloop.ai/.MainActivity
if ($LASTEXITCODE -ne 0) { throw 'MedLoop failed to launch.' }

Start-Sleep -Seconds 5
$pidValue = (& $adb -s $serial shell pidof com.medloop.ai).Trim()
if (-not $pidValue) { throw 'MedLoop is not running after launch.' }

$fatalLogs = @(& $adb -s $serial logcat -d -v brief | Select-String 'FATAL EXCEPTION|Process: com.medloop.ai')
if ($fatalLogs.Count -gt 0) {
  $fatalLogs | ForEach-Object { Write-Host $_ }
  throw 'A fatal Android runtime error was detected.'
}

Write-Host "MedLoop installed and running on $serial (PID $pidValue)."
Write-Host ''
Write-Host 'Complete these hardware checks on the unlocked device:'
Write-Host '1. Create/login to a local account and enable medicine reminders.'
Write-Host '2. Allow Notifications and Alarms & reminders, then run the 10-second test.'
Write-Host '3. Tap Taken and Missed from a notification and confirm the matching dose changes.'
Write-Host '4. Add a dose near midnight and verify the next calendar day returns to Pending.'
Write-Host '5. Capture a prescription with the camera and select another from the gallery.'
Write-Host '6. Restart MedLoop and verify records and images persist.'
Write-Host '7. Export an encrypted backup, delete data, restore it, and verify all records/images.'
Write-Host '8. Delete the local account and confirm its credentials and records no longer load.'
