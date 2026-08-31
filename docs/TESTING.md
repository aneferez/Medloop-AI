# Testing and QA

## Standard verification

From the repository root:

```powershell
npm install
npm run lint
npm test
npm run build
```

For Android debug packaging:

```powershell
npm run android:apk
```

For a signed release candidate, use `npm run android:release` only after private signing files are configured. Then install and launch on one connected physical device:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-android-device.ps1
```

## Automated test inventory

The Vitest suite is split across client unit/integration tests and Worker contract tests. The exact file and assertion count is produced by `npm test`; do not use a stale hand-maintained count as a release gate.

| Suite | Coverage |
| --- | --- |
| `medicineSchedule.test.js` | Local date keys, daily status retention, midnight reset |
| `notifications.integration.test.js` | Dose/review/refill/stock schedules, 10-second test, Taken/Missed callbacks |
| `prescriptionCamera.test.js` | Supported MIME types and size rejection |
| `localMedia.integration.test.js` | IndexedDB profile/prescription save, reload, delete |
| `localAccount.integration.test.js` | Local credential persistence, logout/login, account deletion |
| `backup.test.js` | Authenticated encrypted round trip and image round trip |
| `dashboard.test.js` | Chronological dose rail, next dose, dashboard variant persistence/fallback |
| `guidedAssistant.test.js` | Required fields, immutable updates/toggles, bounded progress |
| `cloudConfig.test.js` | HTTPS-only production gateway validation and local development allowance |
| `cloudSession.test.js` | Cloud device-session revocation and local credential cleanup |
| `consent.test.js` | Versioned privacy/medical-safety acknowledgement gate |

Tests mock or emulate browser/native boundaries where required. Passing tests do not prove real Android permission prompts, exact-alarm timing, camera behavior, share sheets, or vendor-specific battery management.

## Manual browser smoke test

1. Start `npm run dev` and open `http://127.0.0.1:5174`.
2. Create an account; validate invalid email and short-password messages.
3. Sign out and sign back in; confirm local persistence.
4. Create/edit/delete a family profile, medicine, prescription, and appointment.
5. Confirm direct paths and Back/Forward navigation work.
6. Mark doses Taken/Missed/Pending and verify reports and stock transitions.
7. Switch all three dashboard variants and reload.
8. Upload supported/unsupported/oversized images where browser inputs are available.
9. Export an encrypted backup, alter data, restore, cancel once, then confirm replacement.
10. Check narrow mobile and wide desktop layouts, keyboard navigation, labels, focus visibility, alerts, loading, and empty states.

Native reminders are expected to report that they are Android-only during browser development.

## Physical Android acceptance test

The helper script verifies exactly one authorized non-emulator device, installs with `adb install -r`, clears logcat, force-stops/launches `com.medloop.ai/.MainActivity`, confirms a running PID, and rejects detected fatal runtime entries. Complete these checks manually afterward:

1. Create/sign in to a local account and restart the process; verify session and data persistence.
2. Allow Notifications and Alarms & reminders.
3. Run the 10-second sound test with screen on, locked, and app backgrounded.
4. Schedule a near-future dose; verify selected lead time and custom sound.
5. Use Taken and Missed notification actions; confirm matching UI state, log, and stock.
6. Verify the next local calendar day returns statuses to Pending without losing history.
7. Capture from camera and choose from gallery; force-stop/relaunch and verify images.
8. Export a backup, change/delete records, restore via Android picker, and verify records/images.
9. Trigger an SMS/WhatsApp draft and verify no message is sent until the user taps Send.
10. Create a fresh account or clear only the test account state; verify consent appears before medication data, Continue is disabled until checked, and accepted consent persists after restart.
11. Enter a wrong deletion password, then delete with the correct password and confirm records/media no longer load.
12. Check phone, tablet/large-window, portrait, landscape, light/dark system setting, font scaling, and accessibility service behavior.
13. Review `adb logcat` for fatal errors, sensitive-data logs, repeated exceptions, or plugin failures.

## Release acceptance gates

A release candidate is acceptable only when:

- dependency installation succeeds from the lockfile;
- lint, all automated tests, and the production web build pass;
- Android sync and the intended debug/release build pass;
- package ID, version code/name, SDK targets, and signing identity are correct;
- APK installation and cold launch pass on a supported physical device;
- notification permission/exact alarm, action buttons, camera/gallery, persistence, backup/restore, messaging drafts, and deletion pass;
- no critical or high-confidence fatal runtime issue is known;
- privacy/deletion pages and in-app legal text match actual data behavior;
- release artifacts and checksums are recorded;
- remaining untested conditions and limitations are documented.

## Useful diagnostic commands

```powershell
npm test -- --reporter=verbose
npm run build
Set-Location android
.\gradlew.bat assembleDebug --stacktrace
```

With Android SDK available:

```powershell
& "$env:ANDROID_HOME\platform-tools\adb.exe" devices
& "$env:ANDROID_HOME\platform-tools\adb.exe" logcat -d -v brief
```

Do not include real user health data, passwords, backup contents, or images in test logs or bug reports.

## Current gaps

- No React component-rendering or end-to-end browser automation suite.
- No automated accessibility scanner or visual-regression gate.
- No CI workflow.
- No automated APK UI/instrumentation tests.
- No automated security/dependency policy gate.
- Exact alarms and notification delivery remain device/vendor dependent and require physical testing.
