# Security and privacy

## Security model

Offline MedLoop protects data within a single Android application installation and gives the user explicit control over export and messaging. The optional cloud tier adds bearer device sessions, remote revocation, multi-device snapshot sync, server-side family access checks, and push delivery; those controls apply only when a deployed HTTPS gateway is configured and must be verified separately before release.

## Data inventory and location

| Data | Storage | Protection |
| --- | --- | --- |
| Account email, display name, password verifier | Capacitor Secure Storage | App/device protected storage; salted PBKDF2 verifier |
| Active local session | Capacitor Secure Storage | App/device protected storage |
| Medicines, dose logs, family, appointments, prescriptions, alerts, settings | Capacitor Secure Storage | App/device protected storage |
| Profile and prescription images | IndexedDB in the app sandbox | Android application sandbox; not independently encrypted by MedLoop |
| Exported `.medloop` file | User-selected external destination | PBKDF2-SHA-256 + AES-256-GCM |
| Notification text | Android notification subsystem | May be visible according to device lock-screen settings |
| SMS/WhatsApp draft | External messaging application | Governed by the selected application after handoff |
| Cloud snapshot and family records (optional) | Configured Cloudflare Worker/D1 gateway | Authenticated device-session bearer token; server-side access checks |
| Prescription file (optional) | Configured R2 file tier | Authenticated prescription-scoped upload/download; retention follows gateway policy |

Android manifest settings disable platform backup (`allowBackup=false`) and use data extraction rules that disable cloud backup and device transfer. This reduces unintended copying but also means uninstalling/clearing app data is destructive unless an exported backup exists.

## Authentication

- Email is validated and normalized to lowercase.
- Password length minimum is eight characters.
- New password verifiers use PBKDF2-HMAC-SHA-256 with a random 16-byte salt and 210,000 iterations.
- Passwords are not stored in plaintext and are not included in backups.
- Legacy single-SHA-256 verifiers are upgraded after successful authentication.
- Account deletion requires the current password and an explicit confirmation.
- Password reset is implemented as a single-use, time-limited email-token flow
  through the Worker. Delivery remains disabled until the production email
  provider secrets are configured.

Local login primarily separates accounts within the app and discourages casual access. It is not a substitute for Android device encryption, a secure lock screen, or protection against a fully compromised/rooted device.

## Backup cryptography

Backups require at least an eight-character password. The key is derived using PBKDF2-HMAC-SHA-256 with a random salt and 310,000 iterations, then used with AES-256-GCM authenticated encryption and a random IV. Authentication failure, corruption, or a wrong password prevents restore.

Operational requirements:

- Use a strong, unique backup password; the eight-character rule is only a minimum.
- Keep the password separate from the backup file.
- Treat exported files as sensitive even though encrypted.
- Do not modify the JSON envelope.
- Securely remove obsolete copies from downloads, cloud drives, messaging apps, and removable storage as appropriate.

The app cannot recover a forgotten backup password.

## Permissions and Android exposure

Declared manifest permissions:

- `INTERNET`: required by the Capacitor WebView/runtime and by the optional cloud gateway/push tier.
- `SCHEDULE_EXACT_ALARM`: supports exact medicine reminder delivery after user/system approval.

Camera hardware is declared optional. Runtime camera/gallery and notification permissions are requested through Capacitor. The only exported activity is the launcher `MainActivity`; it uses `singleTask`. The FileProvider is not exported and grants URI permissions only for explicit shares.

Review lock-screen notification settings on shared devices because medicine name, dosage, dose time, stock, or contact name can appear in notification content.

## Privacy behavior

- No Firebase client SDK, analytics, crash reporting, or advertising SDK is active. The optional cloud tier uses a Cloudflare Worker/D1/R2/FCM gateway; AI requests are only available through the authenticated gateway when configured.
- Bundled voice instructions play locally and do not contain or transmit user-entered health details.
- SMS and WhatsApp integrations create drafts and require the user to send them.
- Backup sharing is user initiated through the Android share sheet.
- Static privacy and account-deletion pages are included for distribution disclosures.

External applications selected through the share sheet or message URI have their own privacy policies. MedLoop cannot control copies retained by those applications.

## Retention and deletion

Structured records remain until edited, deleted, restored over, account-deleted, or app data is cleared. Dose history retains the newest 200 Taken/Missed events. Account deletion removes the local account record, session, structured account state, profile image, and all prescription images owned by that account.

Deleting data inside MedLoop cannot delete previously exported backups or messages/files already shared to another application. Those copies must be deleted separately.

## Security limitations and risks

- IndexedDB media relies on the Android app sandbox and device-at-rest security rather than application-level encryption.
- A rooted/compromised device or malicious accessibility/overlay software may defeat local protections.
- Notification content can expose health-related information on a lock screen.
- Offline local accounts are not synchronized, remotely revocable, or recoverable. Cloud device sessions are revocable through the gateway, but cloud deletion and authorization must be verified against the deployed backend before release.
- The repository currently has no automated dependency scanning or CI security gate.
- Android release builds currently set `minifyEnabled false`; code shrinking/obfuscation is not a security control and is not enabled.
- There is no formal healthcare compliance certification. Do not claim HIPAA, GDPR, DPDP, medical-device, or other regulatory compliance without a dedicated legal/technical assessment.

## Secure development checklist

- Never commit `android/keystore.properties`, keystores, passwords, API keys, or user data.
- Keep dependencies locked with `package-lock.json`; review changes before updating.
- Run `npm audit` as a review input, then assess findings for reachable production impact.
- Run lint, tests, production build, Android build, and device smoke tests before release.
- Review manifest permissions and exported components after every Capacitor/plugin update.
- Test backup wrong-password/tamper failure and complete account deletion.
- Inspect release APK/AAB signing and package identity before distribution.
- Avoid logging account data, health data, passwords, backup contents, or image contents.

## Reporting a vulnerability

No monitored privacy/security contact is published in this repository yet.
Before public release, add one and document the disclosure process. Until then,
report vulnerabilities privately to the project owner and avoid filing public
issues that contain credentials, health information, backup files, or
reproduction data from real users.
