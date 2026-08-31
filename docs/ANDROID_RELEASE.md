# Android release guide

## Android configuration

| Setting | Value |
| --- | --- |
| Application ID / namespace | `com.medloop.ai` |
| App name | `MedLoop AI` |
| Version name | `1.1.0-beta.11` |
| Version code | `15` |
| Minimum SDK | 24 |
| Target / compile SDK | 36 |
| Gradle wrapper | 8.14.3 |
| Web asset directory | `dist/` |
| Android WebView scheme | `https` (secure local Capacitor origin) |

Before every distribution build, increment `versionCode` and set the intended `versionName` in `android/app/build.gradle`; keep `package.json`, release filenames/scripts, release notes, and documentation aligned.

## Toolchain

- JDK 21; build scripts search `C:\Program Files\Eclipse Adoptium\jdk-21*`, then `C:\Program Files\Java\jdk-21*`. JDK 17 is not compatible with the current Java source release.
- Android SDK at `ANDROID_HOME` or `%LOCALAPPDATA%\Android\Sdk`.
- SDK platform 36 and required build/platform tools installed.
- Node/npm dependencies installed.

## Debug APK

```powershell
npm install
npm run android:apk
```

This builds/syncs the web application, regenerates native assets, runs Gradle `assembleDebug`, and copies:

```text
artifacts/MedLoop-AI-debug.apk
```

## Release signing

Release builds require these ignored local files:

```text
android/keystore/medloop-upload-key.jks
android/keystore.properties
```

`android/keystore.properties` uses Gradle property syntax:

```properties
storeFile=keystore/medloop-upload-key.jks
storePassword=REPLACE_WITH_PRIVATE_VALUE
keyAlias=REPLACE_WITH_PRIVATE_VALUE
keyPassword=REPLACE_WITH_PRIVATE_VALUE
```

Never commit either file or print secret values in logs. Back up the upload keystore and credentials securely; losing them can prevent future updates depending on Play App Signing configuration.

The build script specifically verifies `android/keystore/medloop-upload-key.jks`. If the Gradle `storeFile` points elsewhere, align the script and configuration intentionally.

## Signed APK and AAB

```powershell
npm run android:release
```

The script runs Capacitor sync, Gradle `assembleRelease` and `bundleRelease`, then creates:

```text
artifacts/MedLoop-AI-release.apk
artifacts/MedLoop-AI-release.aab
artifacts/MedLoop-AI-1.1.0-beta.11.apk
artifacts/MedLoop-AI-1.1.0-beta.11.aab
```

The APK is for direct device testing/distribution. The AAB is the Play Console upload artifact. `artifacts/` is gitignored and should be transferred through a controlled release channel.

## Verify artifacts

Generate checksums:

```powershell
Get-FileHash artifacts\MedLoop-AI-1.1.0-beta.11.apk -Algorithm SHA256
Get-FileHash artifacts\MedLoop-AI-1.1.0-beta.11.aab -Algorithm SHA256
```

Inspect APK signing when Android build-tools are available:

```powershell
& "$env:ANDROID_HOME\build-tools\36.0.0\apksigner.bat" verify --verbose --print-certs artifacts\MedLoop-AI-1.1.0-beta.11.apk
```

Adjust the build-tools directory if another installed revision is used. Confirm package ID, version, signing certificate, supported SDKs, and permissions before handoff.

## Physical device smoke test

Enable USB debugging, authorize exactly one physical device, then run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-android-device.ps1
```

To test a non-default APK:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-android-device.ps1 -ApkPath "D:\path\candidate.apk"
```

The automated portion installs/replaces the app, launches it, checks for a running process, and scans current logcat output for a fatal exception. Complete the hardware/user-flow checklist in [TESTING.md](TESTING.md).

## Play Console handoff

1. Complete all release acceptance gates.
2. Upload the versioned AAB to an internal testing track first.
3. Confirm Play App Signing/upload-key status and that version code 15 (or the new incremented code) is unused.
4. Complete the Data safety form based on [SECURITY.md](SECURITY.md) and the actual deployment mode, including explicit backup/message-sharing behavior and any enabled cloud gateway/data storage.
5. Provide the hosted privacy-policy and account-deletion URLs required by the chosen distribution setup; repository source pages alone are not public URLs.
6. Supply store listing, content rating, target audience, medical disclaimer, screenshots, app icon, contact details, and testing instructions.
7. Install the Play-delivered build from internal testing and repeat core flows because Play processing/signing can differ from a locally installed APK.
8. Promote only after reviewing pre-launch reports and resolving critical issues.

Google Play submission itself is manual and requires owner credentials; no automated publishing configuration exists in this repository.

## Release rollback and incident handling

Android/Play releases cannot be replaced with the same version code. For a fix, increment the version code, rebuild, retest, and publish a new artifact. Keep the prior signed artifacts/checksums and release notes for traceability, but do not retain signing secrets alongside them.

If a release is suspected of data loss or unsafe reminders, pause rollout in the distribution console, preserve logs without personal health data, reproduce on a test account/device, and ship a higher-version corrective build after completing the acceptance gates.
