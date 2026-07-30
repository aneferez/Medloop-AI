# MedLoop AI 1.1.0-beta.11

Build date: 30 July 2026

## Completed

- Converted the app to local-only account access and device-only data storage.
- Removed Firebase Auth, Firestore, App Check, Firebase AI, Remote Config, Crashlytics, Analytics, Performance Monitoring, Hosting config, Storage rules, Cloud Functions, and Android Google Services config.
- Deleted cloud deployment files, Firestore rules tests, Firebase environment values, Remote Config template, and Firebase service documentation.
- Removed Google sign-in, email verification, password-reset email links, and the cloud AI simplifier entry point because they require cloud services.
- Kept mandatory login/sign-up after splash, now backed by a local email/password account.
- Kept medicines, selectable morning/afternoon/night dose intervals, dose logs, family profiles, appointments, alerts, prescriptions, local notification scheduling, SMS drafts, WhatsApp drafts, camera/gallery prescription images, and local profile photos.
- Dose status is scoped to the local calendar day, automatically returns to pending at midnight, and retains prior Taken/Missed events in dose history.
- Device-local profile photos support JPG, PNG, and WebP files up to 10 MB.
- Saved prescription records support native camera capture or photo-library upload, with JPG/PNG/WebP images limited to 10 MB and stored only on the current device.
- Exact-time Android notifications continue to use local notification scheduling with custom sound, vibration, and Taken/Missed actions.
- Daily 10:00 PM and day-20 refill reminders continue to create user-reviewed Level 1 family SMS/WhatsApp drafts.
- Android backup and device-transfer extraction remain disabled.
- Updated privacy policy, medical disclaimer, and account-deletion disclosure for local-only storage.
- Fixed reminder lead-time scheduling so an early reminder is scheduled before the selected dose time.
- Added page-level lazy loading; the main production JavaScript chunk is 434.03 KB and no longer triggers the 500 KB warning.
- Added 13 automated unit/integration tests covering daily midnight reset, reminder schedules/actions, camera/gallery validation, local image persistence, account login/deletion, encrypted backup/restore, dashboard dose ordering, and dashboard-style persistence.
- Added three selectable, persistent dashboard designs—Halo, Timeline, and Companion—while preserving the existing MedLoop logo and live dose actions.
- Verified lint, production web build, dependency audit, signed APK/AAB build, APK installation, Android launch, and absence of MedLoop fatal runtime logs on an Android emulator.
- Added `scripts/test-android-device.ps1` for repeatable physical-device installation and smoke-test setup.
- Fixed Android restore-picker compatibility by accepting the `application/octet-stream` MIME type used for `.medloop` files.

## Physical-device verification

Verified on a POCO X6 Pro 5G running Android 16 / HyperOS V816:

- Installed and launched the signed beta APK with the local session intact and no MedLoop fatal runtime logs.
- Granted exact-alarm access and confirmed zero-window exact dose/refill alarms.
- Confirmed the 10-second reminder sound test, the real selected-time medicine notification, and its Taken/Missed actions; the Taken action updated adherence and stock on-device.
- Confirmed native camera capture, Android photo-picker upload, and prescription-image persistence after force-stop/relaunch.
- Confirmed encrypted backup creation, password-authenticated restore, record replacement, and native `.medloop` selection after the MIME compatibility fix.
- Confirmed account/session and medicine/prescription persistence after process restart.

The calendar-day dose reset remains covered by the automated midnight-boundary test without changing the physical phone's system clock. Account deletion requires the test account holder to enter the current password on-device.

## Artifacts

- `artifacts/MedLoop-AI-1.1.0-beta.11.apk`
  - SHA-256: `6B7F96FD970E1B42259567FCD2798E96C6178777C643038EEC9D224270C3AF92`
- `artifacts/MedLoop-AI-1.1.0-beta.11.aab`
  - SHA-256: `F30791DECC106A71BD559EA4928F5ED1783BBEF6AEF75462D4EE3F2F05183D20`
