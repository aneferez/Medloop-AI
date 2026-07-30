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
- Added page-level lazy loading; the main production JavaScript chunk is 442.67 KB and no longer triggers the 500 KB warning.
- Added 11 automated unit/integration tests covering daily midnight reset, reminder schedules/actions, camera/gallery validation, local image persistence, account login/deletion, and encrypted backup/restore.
- Verified lint, production web build, dependency audit, signed APK/AAB build, APK installation, Android launch, and absence of MedLoop fatal runtime logs on an Android emulator.
- Added `scripts/test-android-device.ps1` for repeatable physical-device installation and smoke-test setup.

## Physical-device checks still required

No physical phone was connected during the 30 July build. Run `scripts/test-android-device.ps1` with one authorized phone, then complete its on-device checklist for alarm delivery/sound, notification buttons, midnight behavior, camera/gallery hardware, restart persistence, backup/restore, and deletion. SMS/WhatsApp messages must remain user-reviewed before sending.

## Artifacts

- `artifacts/MedLoop-AI-1.1.0-beta.11.apk`
  - SHA-256: `5AB2AA9539DA1933994A792C8EED64423847F18062B6781297226BAF5071318A`
- `artifacts/MedLoop-AI-1.1.0-beta.11.aab`
  - SHA-256: `AEE2FBE0091A7EAD12397500E7B48BD4D858185035B569B8A7EEFED60580FD28`
