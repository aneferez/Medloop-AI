# MedLoop AI

MedLoop AI is a local-first medicine coordination application built with React, Vite, and Capacitor for Android. It manages medicine schedules, dose history, family contacts, appointments, prescriptions, stock levels, local reminders, and encrypted user-controlled backups. An optional Cloudflare Worker/D1/R2/FCM tier adds authenticated device sync, family coordination, prescription file storage, and push delivery when explicitly configured.

> MedLoop AI is an organization and reminder tool. It is not a diagnostic, treatment, emergency-monitoring, or clinical decision system.

## Project status

- Version: `1.1.0-beta.11` (`versionCode 15`)
- Android application ID: `com.medloop.ai`
- Minimum Android version: API 24 (Android 7.0)
- Target/compile SDK: API 36
- Primary platform: Android; the React interface also runs in a browser for development
- Data model: local-first, per-account records with an optional Cloudflare Worker/D1/R2/FCM cloud tier
- Release outputs: signed APK and AAB in `artifacts/`

## Documentation

| Document | Purpose |
| --- | --- |
| [Documentation index](docs/README.md) | Complete documentation map and project facts |
| [User guide](docs/USER_GUIDE.md) | Account setup, medicines, reminders, media, backups, and deletion |
| [Architecture and data](docs/ARCHITECTURE.md) | Runtime design, routes, storage, data model, and application flows |
| [Security and privacy](docs/SECURITY.md) | Trust boundaries, cryptography, permissions, retention, and limitations |
| [Developer guide](docs/DEVELOPMENT.md) | Setup, scripts, project layout, conventions, and troubleshooting |
| [Testing and QA](docs/TESTING.md) | Automated coverage, manual checks, and release acceptance criteria |
| [Android release guide](docs/ANDROID_RELEASE.md) | Signing, APK/AAB generation, device smoke tests, and Play handoff |
| [Beta release record](BETA_RELEASE.md) | Version-specific changes, physical-device verification, and checksums |
| [Design QA record](design-qa.md) | Responsive visual review and captured states |

## Quick start

Prerequisites: Node.js with npm. Android builds additionally require JDK 21 and Android SDK 36.

```powershell
npm install
npm run dev
```

Open `http://127.0.0.1:5174`.

Run the standard verification suite:

```powershell
npm run lint
npm test
npm run build
```

Build a debug APK:

```powershell
npm run android:apk
```

Build signed release APK and AAB files after configuring the private release keystore:

```powershell
npm run android:release
```

## Core capabilities

- Local email/password accounts and persistent local sessions
- Morning, afternoon, and night medicine schedules with selected-time reminders
- Taken, missed, and pending dose states with daily reset and a 200-entry event history
- Optional stock decrement, refill buffer, low-stock alerts, and monthly stock review
- Family profiles with one Level 1 contact and user-reviewed SMS/WhatsApp drafts
- Appointments, prescription notes, camera/gallery prescription images, and profile photos
- Three persistent dashboard layouts: Halo, Timeline, and Companion
- Post-login contextual AI guide for every section with English, Hindi, and Tamil speech, approved local help search, anonymous on-device feedback, and guided data entry
- Password-encrypted `.medloop` backup export and destructive restore confirmation
- Local account and associated record/media deletion
- In-app privacy, safety, medical disclaimer, and public privacy/deletion pages

## Technology stack

- React 19 and React DOM
- Vite 8
- Material UI and Emotion
- Lucide React icons
- Capacitor 8 with Android, App, Camera, Filesystem, Local Notifications, and Share plugins
- Capacitor Secure Storage for account/session/record storage
- IndexedDB for local profile and prescription images
- Vitest, fake-indexeddb, and Oxlint
- Gradle 8.14.3 and Android SDK 36

## Configuration

Assistant recordings are loaded from `public/audio/assistant/<language>/<section>.mp3` and work offline after they are bundled into the APK. To prefer an online mirror with automatic offline and device-speech fallback, copy `.env.example` to `.env` and set `VITE_ASSISTANT_AUDIO_BASE_URL` to the static host root.

The application has no required `.env` values for offline mode. Cloud sync is enabled only when `VITE_MEDLOOP_API_URL` points to the deployed HTTPS gateway; production builds reject insecure or localhost endpoints. The current cloud tier is Cloudflare Worker/D1/R2 with FCM for push delivery, not Firestore. Do not add secrets to source control. Android release signing uses ignored local files under `android/keystore/` and `android/keystore.properties`; see the [Android release guide](docs/ANDROID_RELEASE.md).

## Privacy summary

Application records remain on the device in offline mode. When cloud sync is enabled, the account snapshot is mirrored to the configured gateway and prescription media may be stored in its file tier. Media is held in the app's local IndexedDB database. Account credentials and structured account data use Capacitor Secure Storage. Exported backups use PBKDF2-SHA-256 key derivation and AES-256-GCM authenticated encryption. Android system backup and device-transfer extraction are disabled.

SMS and WhatsApp alerts are drafts: MedLoop opens the target app and the user reviews and sends the message. The app does not silently contact family members.

## License and ownership

No open-source license file is currently included. Treat the repository as proprietary unless the project owner adds an explicit license.

Developed by Aneruth | Rosaline.
