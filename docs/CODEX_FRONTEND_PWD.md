# MedLoop AI — Codex Frontend Project Work Document

**Document owner:** Codex
**Scope:** React/Vite web UI, Capacitor Android client, frontend state, UX, and client-side tests
**Backend owner:** Claude
**Status:** In progress — visual shell, responsive pass, and local prescription image/OCR workflow are implemented; production cloud wiring still depends on the backend contract.

## 1. Purpose

This document defines the frontend work that Codex will deliver for the MedLoop medication-management network. It is the coordination contract between the frontend and backend workstreams.

The frontend must provide a safe, medication-focused experience for patients and caregivers. Client-side permission checks improve the user experience but are never a security boundary; Firestore Rules and backend functions must enforce all access and data mutations.

### Current implementation checkpoint

- The dashboard and requested Alerts, Appointments, Reports, Emergency Card, Home, and Privacy screens have a completed responsive visual pass.
- The dashboard completion orbit now fits within its focus card and supports reduced-motion-aware entrance/completion animation.
- Prescription records now require an image before saving. Camera, gallery, and file selection are available; Android uses on-device Google ML Kit OCR and treats output as an editable draft.
- A versioned consent gate now appears before a signed-in user can reach medication data. It stores only the consent version/timestamp and pauses cloud sync, push registration, and local reminders until acceptance.
- The remaining dependent work is the backend contract, cloud migration, production role enforcement, and physical-device validation.

## 2. Existing stack to preserve

- React 19 and Vite.
- MUI for the component system and responsive layouts.
- Capacitor Android shell.
- Existing light/dark theme and current navigation patterns.
- Existing offline-first behavior only where it does not conflict with the new cloud source of truth.

Avoid a full rewrite. Existing working medication, reminder, emergency, voice-guide, and theme functionality should be migrated incrementally behind stable UI boundaries.

## 3. Scope boundary

### Codex owns

- Screens, components, forms, navigation, responsive behavior, accessibility, and user feedback.
- Client-side auth flows and auth-state presentation.
- Local-record migration UX and safe local cleanup after confirmed cloud migration.
- Firestore/API client adapters once Claude provides the schema or endpoint contract.
- Dose, adherence, stock, family, emergency, notification, OCR, and AI user interfaces.
- Android client configuration, notification permissions, backup configuration, deep links, and client-side device flows.
- Unit, integration, component, and frontend smoke tests.
- Web build, Android artifact preparation, release documentation, and deployment preparation.

### Claude/backend owns

- Firebase project configuration and service credentials.
- Firestore schema, indexes, Security Rules, App Check enforcement, and production deployment.
- Server-side authorization and family-member ownership checks.
- Atomic dose/stock transactions and duplicate prevention at the data layer.
- Scheduled jobs, notification dispatch, retries, escalation, and token persistence.
- Cloud deletion cascades, storage cleanup, OCR service, AI proxy, rate limits, and server-side AI safety validation.

## 4. Backend contract required before dependent UI work

Claude should provide a versioned contract containing:

1. Firebase Auth behavior, supported providers, verification requirements, and session states.
2. Firestore collections/documents or callable/API endpoints used by the client.
3. Role matrix for patient, Level 1 caregiver, Level 2 caregiver, and emergency contact.
4. Allowed actions for each role: read, confirm dose, edit medicine, edit stock, manage members, and trigger SOS.
5. Dose status model, including `taken`, `not_taken`, `missed`, and any pending state.
6. Idempotency behavior for dose confirmation, SOS, token registration, and notifications.
7. Migration payload and response format, including duplicate/conflict handling.
8. Error codes that the frontend can translate into safe user messages.
9. Prescription image upload constraints and OCR response schema.
10. AI request/response schema, safety status, refusal behavior, and retention policy.

Until this contract exists, Codex can work on isolated UI and local tests but should not invent production document paths or API payloads.

## 5. Work packages

### WP-1 — Privacy, consent, and account foundation

Frontend line items: **6, 26, 27, 28, 29, 30, 31**.

Deliverables:

- Consent screen with versioned consent text, timestamp, and withdraw-consent flow.
- Medical disclaimer shown during onboarding and at relevant AI/OCR entry points.
- Email verification, login confirmation, password reset, expired-link, and invalid-credential states.
- Account deletion, data export, correction, and deletion-control screens.
- Clear explanation of what is stored locally, in the cloud, and in prescription storage.
- Privacy/grievance contact page using a confirmed contact supplied by the product owner.
- No health records written to ordinary `localStorage` after migration, except an explicitly approved offline-cache design.

Acceptance criteria:

- A user cannot enter the cloud-enabled app without seeing and responding to required consent.
- Every destructive action requires confirmation and reports success or failure.
- Auth screens handle loading, offline, expired session, unverified email, and backend errors.
- Account deletion does not show success until the backend confirms completion.

### WP-2 — Local-to-cloud migration experience

Frontend line item: **2**, with backend dependency.

Deliverables:

- Detect legacy local records without exposing their contents in logs.
- Show record count and migration status before upload.
- Support retry, partial-failure reporting, and safe cancellation.
- Do not delete local records until the backend confirms durable migration.
- Prevent duplicate migration on retry through the backend idempotency contract.
- Provide a clear post-migration verification screen.

Acceptance criteria:

- Existing medicines, family members, dose history, settings, and prescription references are either migrated or explicitly reported as failed.
- Interrupted migration can resume without duplicate medicines or doses.
- A user can continue using the app after migration failure without losing local records.

### WP-3 — Dose tracking, stock, and adherence

Frontend line items: **8, 9, 11, 12, 13**.

Deliverables:

- Taken / Not Taken / Missed controls with confirmation feedback.
- Scheduled-dose timeline showing status, scheduled time, patient, and confirming user.
- Duplicate-action protection: disabled pending controls, idempotent client requests, and duplicate-result handling.
- Inventory view with current stock, projected run-out date, low-stock state, and family-member filter.
- Monthly restock view and adherence history.
- Accessible charts and a non-chart text summary for screen readers.

Acceptance criteria:

- The UI never claims stock was reduced until the backend transaction succeeds.
- A dose status can be corrected only through the permitted role and correction flow.
- Caregivers see only the members authorized by their role.
- Empty, stale, offline, and failed-sync states are visible and understandable.

### WP-4 — Family network and emergency experience

Frontend line items: **21, 23, 24, 25** and new features **3, 6**.

Deliverables:

- Family member management with relationship, role, status, and invitation state.
- Separate patient, Level 1, Level 2, and emergency-contact views.
- Level 1 inventory and adherence view for authorized family members.
- Multiple emergency contacts with ordering and enable/disable controls.
- Emergency card derived from the explicitly selected patient/member, never from `members[0]`.
- Emergency state machine in the UI: ready, confirming, sending, sent, partially sent, failed, and already resolved.
- FCM plus direct-call fallback controls without exposing unnecessary medical information.

Acceptance criteria:

- The selected patient is always visible before viewing or confirming their medication status.
- A caregiver cannot access another member’s data through navigation, cached state, or stale route parameters.
- Emergency failures provide a direct-call option and do not falsely report that all contacts were notified.

### WP-5 — Notifications and device management

Frontend line items: **7, 14, 15, 16, 17, 18, 19, 20, 22**.

Deliverables:

- Notification permission onboarding and settings.
- Device list with current device, last-seen state, and remove-device action.
- Logout and device-change flows that request backend token removal.
- Generic notification deep links that fetch details only after authentication.
- Timezone and reminder/escalation settings.
- Notification history/status UI without medicine details in FCM payloads.
- Android reboot, battery-restriction, and exact-alarm guidance screens where required.

Acceptance criteria:

- No FCM payload or client log contains medicine name, dosage, diagnosis, patient name, or prescription text.
- Notification taps handle signed-out, expired-session, deleted-record, and unavailable-network states.
- The UI distinguishes scheduled, delivered, acknowledged, missed, and failed notification states.
- Device removal requires confirmation and visibly updates the device list.

### WP-6 — Prescription image and OCR flow

Frontend new features: **1 and 2**.

Deliverables:

- Mandatory prescription-image capture/upload for prescription medicines.
- OTC/non-prescription exception path.
- Camera/gallery selection, file-type and size validation, preview, replacement, and deletion.
- OCR progress state and editable extracted fields.
- Confidence/uncertainty presentation and explicit user confirmation before saving.
- Privacy notice explaining image storage, OCR processing, retention, and deletion.

Acceptance criteria:

- OCR output is always treated as a draft.
- No medication or dosage is saved solely from OCR output.
- Failed OCR falls back to manual entry without losing the image or form state.
- Replacing or deleting an image updates the visible state only after backend confirmation.

### WP-7 — Medication-focused personal AI assistant

Frontend line items: **32, 33, 34** and new feature **8**.

Deliverables:

- Medication-only assistant entry point and conversation UI.
- Visible educational-information-only warning.
- Structured answer display for medication explanation, adherence summary, inventory, and refill questions.
- Clear refusal UI for diagnosis, dosage modification, prescription creation, or emergency advice.
- Loading, timeout, rate-limit, offline, and unsafe-response states.
- User feedback/reporting control for incorrect or unsafe output.

Acceptance criteria:

- The UI never presents AI text as a prescription or clinical decision.
- Unsafe or invalid backend responses are not rendered as trusted advice.
- AI context is visibly scoped to the selected patient and authorized medication records.
- Conversation history follows the approved retention/deletion policy.

### WP-8 — Android hardening, QA, and release

Frontend/release line items: **5, 36, 37, 38, 39, 40, 42, 43, 44**.

Deliverables:

- Disable Android backup for sensitive app data and verify merged manifest behavior.
- Rebuild the web bundle and Android APK/AAB from the current source.
- Update release hashes and release notes.
- Add frontend tests for migration, role visibility, dose status, duplicate taps, emergency fallback, and AI safety states.
- Prepare physical-device test scripts for reboot, battery restrictions, notification delivery, camera upload, and deep links.
- Prepare production deployment checklist and Play internal-testing handoff.
- Run a final frontend privacy/security pass and document backend items still requiring verification.

Acceptance criteria:

- Web lint, unit tests, and production build pass.
- Android artifact package/version/signature are verified.
- Physical-device tests are recorded separately from emulator or static checks.
- No release is marked ready while P0/P1 privacy, authorization, deletion, or notification issues remain.

## 6. Recommended execution sequence

1. WP-1 privacy/auth foundation and WP-8 Android backup hardening.
2. Backend contract review with Claude.
3. WP-2 migration experience.
4. WP-3 dose, stock, and adherence screens.
5. WP-4 family and emergency flows.
6. WP-5 notification and device-management flows.
7. WP-6 OCR and prescription workflow.
8. WP-7 personal medication assistant.
9. WP-8 release, physical-device testing, and privacy review.

Do not begin production migration, OCR, or AI integration against invented Firestore paths or temporary permission checks.

## 7. Test matrix

### Automated frontend tests

- Auth: verification, reset, expired session, logout.
- Consent: first-run display, version change, withdrawal.
- Migration: success, retry, partial failure, duplicate retry, cancellation.
- Dose tracking: all statuses, duplicate taps, offline state, stale record.
- Roles: patient, Level 1, Level 2, emergency contact, unauthorized member.
- Notifications: generic payload handling, deep links, token removal response.
- Emergency: correct member selection, multiple contacts, FCM failure, call fallback.
- OCR: mandatory image, OTC exception, editable draft, failed OCR.
- AI: safe answer, refusal, malformed output, rate-limit, timeout.

### Manual Android tests

- Fresh install and upgrade from the previous beta.
- Reboot before and after a scheduled reminder.
- Battery saver and restricted-background modes.
- Notification permission denial and re-enable.
- Camera/gallery upload on supported Android versions.
- Signed-out notification tap and expired-session notification tap.
- Caregiver device change and token removal.

## 8. Risks and decisions

- Firestore migration can cause data loss if deletion occurs before server confirmation.
- UI permission gating cannot protect records; backend Rules and functions must be authoritative.
- Mandatory prescription images may block OTC use unless an explicit exception exists.
- AI and OCR may process sensitive medical images or text; retention and consent must be decided before integration.
- Fixed 10 PM scheduling is unsafe for multiple timezones without backend timezone-aware scheduling.
- Keeping D1 and Firestore active at the same time creates dual-write and deletion inconsistency risk.

## 9. Definition of done

The frontend work is complete when:

- All approved flows work on web and supported Android devices.
- All screens have loading, empty, error, success, offline, and permission states where applicable.
- No medical data is placed in FCM payloads, ordinary logs, or unintended browser storage.
- Accessibility and responsive checks pass for the affected screens.
- Backend contract tests and frontend tests pass together.
- Current APK/AAB and web artifacts are generated from the same source revision.
- Privacy, consent, deletion, and medical-safety text has product approval.
- Remaining backend, legal, credential, and Play Console actions are documented explicitly.

## 10. IIT evaluation UI standard

The product will be evaluated by approximately 300 IIT students and professors from multiple countries. The interface must therefore communicate product maturity within seconds, remain understandable across cultures, and make MedLoop’s safety and family-network advantages visible without requiring a walkthrough.

### Product impression target

MedLoop should feel like a trustworthy medication command center for a family—not a generic admin dashboard, a health journal, or a collection of disconnected forms.

The first screen must make these facts immediately legible:

- Who is the active patient.
- What medication action is due next.
- Whether today’s adherence is on track.
- How much stock remains and when it may run out.
- Which caregiver is responsible and what access level they have.
- Whether the system is synced, offline, or waiting for confirmation.

### Visual quality requirements

- Establish a distinctive clinical visual system: deliberate typography, spacing, iconography, colour tokens, card hierarchy, and interaction states.
- Prefer calm, high-trust clinical colours with one memorable accent used for primary actions and meaningful status—not decorative gradients everywhere.
- Make the patient and care-network context persistent so users never confuse whose medication or stock they are viewing.
- Use clear status language and icon-plus-text treatment for Taken, Not Taken, Missed, Pending, Low Stock, and Critical Stock; do not rely on colour alone.
- Give every core action a clear primary action and a visible confirmation or undo path.
- Design loading, empty, error, offline, permission-denied, and success states as intentional product states rather than placeholders.
- Keep medical content scannable: short labels, strong hierarchy, progressive disclosure, and no dense unexplained tables on mobile.
- Avoid fake AI, unexplained confidence, excessive animation, stock imagery, lorem ipsum, and visual patterns that imply a clinical diagnosis.

### Core screen expectations

- Dashboard: next dose, adherence snapshot, stock runway, caregiver status, and one obvious next action.
- Medication workflow: prescription/OCR capture, editable confirmation, schedule, dose status, and stock impact in one coherent journey.
- Family network: patient, Level 1 caregiver, Level 2 caregiver, permissions, escalation order, and selected patient are explicit.
- Emergency card: correct patient selection, multiple contacts, important medication information, FCM state, and direct-call fallback are all understandable.
- AI assistant: clearly medication-focused, educational-only, authenticated, rate-limited, and visually distinct from medical advice.
- Reports/settings: privacy, consent, export, correction, deletion, sync, and device state are easy to find and not buried behind ambiguous labels.

### International and accessibility bar

- Validate the responsive experience at 360x800, 768x1024, and 1440x900.
- Meet WCAG 2.2 AA intent for contrast, focus visibility, keyboard navigation, semantic labels, readable type, and non-colour status communication.
- Use locale-safe dates, times, number formatting, and timezone-aware copy; do not hard-code assumptions about country, family structure, or healthcare terminology.
- Keep layouts ready for longer translations and future RTL support. Never bake user-facing text into images.
- Use touch targets appropriate for Android and test clipped text, long medicine names, large font settings, and screen-reader labels.

### Evaluation gates

Before calling the frontend evaluation-ready, verify:

1. A new evaluator can explain the app’s purpose and current patient state within five seconds.
2. A first-time user can complete the primary dose-confirmation flow without verbal assistance.
3. The patient/caregiver permission model is visible and never ambiguous.
4. The interface has no default-template, placeholder, broken-image, or developer-only surfaces in production builds.
5. The same design language is present across dashboard, medication, family, emergency, AI, and settings flows.
6. Light mode, dark mode, narrow mobile, tablet, and desktop layouts have been reviewed with real content.
7. The demo handles empty, loading, offline, error, denied-permission, and notification-failure states gracefully.
8. Screenshots or a recorded walkthrough have been reviewed before the IIT evaluation, including the complete primary journey.

### Recommended evaluator demo journey

Sign in → select a patient → upload and confirm a prescription → review the generated medication schedule → confirm a dose → show the stock/adherence update → switch to the caregiver view → demonstrate a generic missed-dose alert → open the safe medication assistant → view privacy and consent controls.

The UI release gate in this section is part of the definition of done. A functionally complete screen that fails this visual and comprehension bar is not evaluation-ready.
