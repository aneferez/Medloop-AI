# User guide

## What MedLoop does

MedLoop coordinates medicine routines on one device. It supports personal and family profiles, scheduled doses, stock, adherence history, appointments, prescription records/images, family message drafts, notifications, and encrypted backups.

It does not diagnose conditions, recommend treatment, verify a prescription, monitor emergencies, automatically call contacts, or synchronize across devices.

## First-time setup

1. Launch MedLoop and choose sign up.
2. Enter a valid email, a display name, and a password of at least eight characters.
3. Keep the password safe. Local-only mode cannot email a reset link.
4. Add a family profile if medicines belong to another person or family alerts are needed.
5. Add at least one medicine and select one or more dose periods.
6. Allow Android notification access. For best timing, also allow **Alarms & reminders** when Android opens that setting.
7. In Settings, use **Test sound in 10 seconds** to confirm notification sound and delivery.

The email is an on-device account identifier. Creating the same account on another device does not restore data; use an encrypted backup to transfer records.

## Navigation

| Screen | Use |
| --- | --- |
| Home | Setup checklist and feature entry points |
| Dashboard | Today's doses, next dose, progress, alerts, and fast dose actions |
| Family | Family/caregiver profiles, health-card fields, and refill alert preparation |
| Medicines | Medicine schedules, dose periods, stock, refill state, and status actions |
| Prescriptions | Prescriber/clinic notes and a local image per saved prescription |
| Alerts | Automatic missed-dose, refill, and low-stock alerts plus saved alerts |
| Appointments | Doctor/clinic date and time records |
| Reports | Today's adherence and up to 30 recent events from the 200-entry dose log |
| Emergency Card | First family profile's blood group, allergies, and up to five medicines |
| Settings | Profile, dashboard, notification/message options, backup, and deletion |
| Privacy & Safety | Privacy statement, medical disclaimer, and account-deletion guidance |

## Family profiles

Enter a name and optionally relationship, age, blood group, allergies, SMS phone, and WhatsApp number. Phone numbers must use international E.164 format, such as `+919876543210`.

Alert levels are Level 1, Level 2, and Level 3. Only one profile can be Level 1; assigning a new Level 1 profile automatically changes the previous one to Level 2. A Level 1 contact must have a valid SMS or WhatsApp number because refill reminders use that contact.

Deleting a family profile does not delete its medicines. Those medicines become unassigned.

## Medicines and schedules

Each medicine contains:

- name and dosage;
- optional assigned family profile;
- any combination of morning, afternoon, and night dose periods;
- a time for each selected period;
- refill state (`On track`, `Running low`, or `Refill needed`);
- optional remaining stock, units consumed per dose, buffer days, and unit label.

At least one dose period and a medicine name are required. If stock is supplied, it is normalized to a non-negative whole number. Default dose usage is 1, default refill buffer is 7 days, and the default unit label is `tablets`.

Saving a medicine asks for notification permission if reminders are not enabled. Browser development mode saves the medicine but cannot provide native Android reminders.

## Dose tracking and stock

A selected dose period can be marked Taken, Missed, or returned to Pending. Status belongs to the device's local calendar day; a new day shows doses as Pending while prior Taken/Missed events remain in history.

When a tracked dose changes to Taken, configured units per dose are subtracted without allowing stock below zero. If Taken is changed to Pending or Missed, that deduction is restored. Each Taken or Missed action creates a timestamped log; the newest 200 events are retained.

Low stock means remaining stock is at or below:

`enabled doses per day × units per dose × buffer days`

## Android reminders

When reminders and permissions are enabled, MedLoop schedules:

- one daily notification for every selected medicine period, adjusted earlier by the configured lead time (0–240 minutes);
- Taken and Missed action buttons on dose reminders;
- an end-of-day review at 9:30 PM;
- stock-buffer reminders for medicines with tracked stock;
- a monthly stock review on day 25 at 8:30 PM;
- when a valid Level 1 contact exists, refill checks daily at 10:00 PM and monthly on day 20 at 10:00 PM.

Notification schedules are rebuilt whenever medicines, family profiles, or settings change. Android notification permission is mandatory. Exact alarm access is strongly recommended; without it, delivery can be delayed by the operating system.

## Family SMS and WhatsApp drafts

Enable SMS and/or WhatsApp drafts in Settings. When a dose is marked Missed, MedLoop can ask whether to open a draft for a suitable contact. WhatsApp is preferred when enabled and available; otherwise SMS is used. Refill notifications can also open a draft for the Level 1 contact.

MedLoop does not send the message. Review the recipient and contents in the messaging app and tap Send yourself. These drafts explicitly state that they are not emergency alerts.

## Prescriptions and photos

Save a prescription record before adding an image. Doctor name is required; clinic defaults to `Clinic`. Use Camera or Photo Library on the saved record.

Accepted types are JPG/JPEG, PNG, and WebP, up to 10 MB. Camera images are requested at quality 85 and at most 2048 × 2048. Each prescription has one current local image. Replacing or deleting the record updates its image accordingly.

## Profile photo

Settings accepts JPG/JPEG, PNG, or WebP up to 10 MB. The image is local to the device and included in encrypted backups.

## Dashboard styles

Choose Halo, Timeline, or Companion on the dashboard. The selection is saved for the local account. All styles use the same live medicine and dose data.

## Guided assistance

Medicine, family, and prescription forms include step-by-step guidance with validation and review. Optional voice guidance uses audio bundled with the app. It does not send entered health details to a voice service.

## Encrypted backup and restore

### Export

1. Open Settings and enter a backup password of at least eight characters.
2. Select **Export encrypted backup**.
3. Save/share the generated `MedLoop-backup-YYYY-MM-DD.medloop` file.
4. Store the file and password separately in safe locations.

The backup contains account display information, all structured records/settings, the profile photo, and prescription images. It does not contain the login password or create an account on another device.

### Restore

1. Create or sign in to the destination device's local account.
2. Enter the backup password in Settings.
3. Select **Restore backup** and choose the `.medloop` file (maximum 100 MB).
4. Confirm replacement.

Restore replaces the signed-in account's current records and images; it does not merge them. The backup's records are attached to the currently signed-in local account. A wrong password or modified file fails authentication.

## Sign out, forgotten password, and deletion

Signing out removes the active session but retains the local account, records, and images.

There is no password-reset email in local-only mode. If the password is lost, the account cannot be recovered through the app. If accessible, export a backup before signing out. Otherwise Android app-data removal/uninstallation removes the inaccessible local data.

To delete an accessible account, open Settings, enter the current password, select **Delete my account**, and confirm. This removes credentials, structured records, profile photo, and prescription images for that account from the device. The action cannot be undone unless a previously exported encrypted backup is restored into an account.

## Troubleshooting

- **Reminder missing:** verify notifications are enabled in both MedLoop and Android, enable Alarms & reminders, remove battery restrictions if the device vendor delays alarms, and run the 10-second test.
- **No family draft:** add a valid E.164 number, select a Level 1 contact for refills, and enable the desired channel in Settings.
- **Image rejected:** use JPG/JPEG, PNG, or WebP and keep the file at or below 10 MB.
- **Backup rejected:** confirm the password, choose the original unmodified file, and keep the file at or below 100 MB.
- **Data is absent on another device:** MedLoop has no cloud sync; export on the source device and restore on the destination.
