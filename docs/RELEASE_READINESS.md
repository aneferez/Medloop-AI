# MedLoop release readiness

**Review date:** 31 August 2026  
**Current status:** Internal beta testing only — not approved for public release

## Verified in this review

- Frontend: `47` test files and `306` tests passed; lint and production build passed.
- Production bundle: route-level chunks are enabled; the largest JavaScript chunk is
  below the previous 500 kB warning threshold.
- Dependency audit: root app and Worker both report `0 vulnerabilities` at the
  high-severity threshold.
- Worker: dry-run passed with Cloudflare D1 (`medloop`), R2 (`medloop-files`), and
  Workers AI bindings. Production health returned HTTP `200`.
- Authentication probe: an invalid production login returned the expected generic
  HTTP `401`, not the previous Worker CPU-limit `500`.
- Push privacy: all FCM messages now use generic title/body copy and carry only an
  opaque alert ID plus controlled alert metadata. Medicine names, dosage, and
  patient details are kept behind the authenticated alert view.
- Android release: `1.1.0-beta.11`, package `com.medloop.ai`, `minSdk 24`,
  `targetSdk 36`; release APK and AAB built successfully with JDK 21. APK v2
  signature verification and AAB JAR verification passed.
- Android backup: manifest disables backup and device transfer through
  `allowBackup=false`, `fullBackupContent=false`, and extraction exclusions.
- Emulator smoke: release APK installed and launched, then launched again after a
  device reboot without an app crash.
- Firestore migration: not required. The deployed backend source of truth is
  Cloudflare D1/R2; Firebase is used only for FCM delivery.

## Release gates still requiring operator/device access

- Run authenticated `GET /v1/system/config-check` and record the boolean result for
  FCM, email, AI, Turnstile, and R2. The unauthenticated endpoint correctly returns
  `401`; no production token is stored in this repository.
- Production secret review currently confirms FCM credential names and the AI
  credential name. Resend email and Turnstile secret presence still need operator
  confirmation before relying on those channels.
- Test an authenticated caregiver account linked to at least two test patients and
  visually verify permission-gated inventory, dose cards, escalation, and empty/error
  states. The in-app browser connector was unavailable during this review.
- Test notifications, exact alarms, reboot persistence, battery restrictions,
  camera/gallery capture, encrypted backup/restore, and account deletion on a real
  Android device. The emulator had notification permission granted but exact-alarm
  access denied, so timing delivery was not marked passed.
- Upload the signed AAB to Play Console internal testing and complete the Play
  Console Data safety and privacy disclosures. Play Console access was not available
  from this workspace.
- Replace the beta privacy wording with the final approved policy and publish a
  monitored privacy/grievance contact. The exact contact must be supplied by the
  product owner; none is invented here.

## Artifacts

- APK: `android/app/build/outputs/apk/release/app-release.apk`
- AAB: `android/app/build/outputs/bundle/release/app-release.aab`
- APK SHA-256: `E8F7107DD5DB244095EEF2253532942D39831FB286D4F91242581F6FEA31896A`
- AAB SHA-256: `9C62360A4F2F3AC6947E0567FFCB544BE3F64AB1C225EB66AD631454F024FD82`

