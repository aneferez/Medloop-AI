# MedLoop AI

MedLoop AI is a React, Vite, and Capacitor-based Android app for medicine coordination. It helps users track medicines, dose schedules, family contacts, appointments, prescription records, refill reminders, and local encrypted backups.

The current build is designed as a local-first app. User health data stays on the device unless the user manually exports an encrypted backup.

## Current Status

- Android release APK generated.
- Android release AAB generated for Play Store upload.
- Login page uses the MedLoop logo from `public/icon.jpg`.
- App watermark added: `Developed by Aneruth | Rosaline`.
- Profile photo upload is supported.
- Prescription image upload is supported after saving a prescription record.
- Direct prescription image upload accepts JPG, PNG, and WebP files up to 10 MB.
- Medicine stock tracking is supported with stock decrement after taken doses.
- End-of-day medicine review notifications are scheduled when reminders are enabled.
- Stock buffer and monthly stock review notifications are scheduled when medicine stock is set.
- Lint check passed.
- Production build passed.
- Android release build passed.
- Automated unit and integration tests pass.
- The release APK installs and launches on an Android emulator without an app crash.
- Page-level code splitting keeps the main production JavaScript chunk below 500 KB.

## Tech Stack

- React
- Vite
- Capacitor
- Android
- Capacitor Local Notifications
- Capacitor Camera
- Capacitor Filesystem
- Local device storage
- IndexedDB for local media storage

## Main Features

- Local email/password account access
- Medicine routine management
- Dose status tracking
- Exact-time medicine reminders
- Medicine stock count tracking
- Stock update notification after taken doses
- End-of-day taken/pending/missed review notification
- Stock buffer and monthly stock review reminders
- Refill alerts
- Family contact management
- SMS and WhatsApp draft alerts
- Appointment tracking
- Prescription records
- Prescription image upload
- Profile photo upload
- Local encrypted backup and restore
- Account deletion from the device
- Privacy policy and medical disclaimer inside the app

## Run Locally

Install dependencies:

```powershell
npm install
```

Start the development server:

```powershell
npm run dev
```

The app runs at:

```text
http://127.0.0.1:5174
```

## Verification

Run lint:

```powershell
npm run lint
```

Run automated tests:

```powershell
npm test
```

Create a production web build:

```powershell
npm run build
```

## Android Build

The Android package ID is:

```text
com.medloop.ai
```

Create the Android release APK and AAB:

```powershell
npm run android:release
```

Release outputs are generated under:

```text
artifacts/
```

Use this file for direct Android testing:

```text
artifacts/MedLoop-AI-release.apk
```

Use this file for Google Play Store upload:

```text
artifacts/MedLoop-AI-release.aab
```

With one authorized physical Android device connected, install and start the release smoke test:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-android-device.ps1
```

## Image Upload Notes

Profile photo upload is available from the Settings page.

Prescription image upload works from the Prescriptions page:

1. Add and save a prescription record.
2. Use the `Upload` button on the saved prescription item.
3. Choose a JPG, PNG, or WebP image.
4. The image is saved locally on the device.

Prescription images are limited to 10 MB.

## Medicine Stock Notes

Medicine stock can be entered from the Medicines page.

For each medicine, the app can track:

- Current stock
- Units used per dose
- Refill buffer days
- Stock unit label, such as tablets or capsules

When a dose is marked as `Taken`, MedLoop subtracts the configured units per dose from the remaining stock and shows an in-app update message. If Android notifications are enabled, it also sends a stock update notification.

If a taken dose is changed back to `Pending` or `Missed`, the deducted stock is restored.

When remaining stock reaches the configured buffer level, MedLoop creates an alert and schedules a stock buffer notification.

## Local-Only Architecture

MedLoop AI currently stores data on the user's device.

Stored locally:

- Account details
- Medicine routines
- Dose logs
- Family contacts
- Appointments
- Alerts
- Prescription notes
- Settings
- Profile photos
- Prescription images
- Medicine stock counts and buffer settings
- Encrypted backup files created by the user

The app does not silently send family alerts. It opens SMS or WhatsApp drafts so the user can review and send them manually.

Android cloud backup and device-transfer extraction are disabled for the app's private data.

## Future Improvement Note

A paid cloud backup option may be added later.

Suggested future idea:

- INR 399 unlock for encrypted Google Drive backup and restore.
- Use Google Drive app-specific storage.
- Keep normal medicine tracking local by default.
- Use Google Play Billing if distributed through the Play Store.

Firebase Storage is not enabled in this build because creating a new Firebase Storage bucket requires a paid Firebase billing plan.

## Privacy and Safety

MedLoop AI is a reminder and organization tool. It is not a diagnostic, treatment, emergency-monitoring, or clinical decision system.

Users should always follow the original prescription and confirm unclear medicine instructions with a qualified doctor, pharmacist, or caregiver.

## Developer Credit

Developed by Aneruth | Rosaline
