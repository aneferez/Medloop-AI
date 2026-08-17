# Native push (FCM) setup

The app captures a device FCM token and sends it to the backend so alerts (and
the emergency SOS broadcast) can reach the phone as push. The **software is
already wired** — `src/lib/cloud/pushToken.js` + `usePushRegistration` request
permission on sign-in, register with FCM, and `PATCH /auth/device` with the
token. What remains is the **Firebase project setup**, which only you can do.

Until the steps below are done, everything degrades gracefully: the JS is a
no-op on web / without the plugin, the current Android build keeps working, and
the Worker records push attempts as `skipped`.

## 1. Firebase project → `google-services.json`

1. In the [Firebase console](https://console.firebase.google.com/), create (or
   open) a project.
2. Add an **Android app** with package name **`com.medloop.ai`**.
3. Download **`google-services.json`** and place it at
   **`android/app/google-services.json`**. (Do not commit it if the project is
   public — it identifies your Firebase app.)

## 2. Apply the Google Services Gradle plugin

> Only after `google-services.json` exists — the plugin fails the build if the
> file is missing, which is why these edits are documented here rather than
> pre-applied.

In `android/build.gradle`, add the classpath to `buildscript.dependencies`:

```gradle
classpath 'com.google.gms:google-services:4.4.2'
```

At the **bottom** of `android/app/build.gradle`, add:

```gradle
apply plugin: 'com.google.gms.google-services'
```

## 3. Sync the native project

```bash
npm run android:sync
```

This runs `cap sync android`, which registers `@capacitor/push-notifications`
(already installed) into the native project and adds the `POST_NOTIFICATIONS`
permission (Android 13+). The plugin's `requestPermissions()` shows the prompt.

## 4. Let the Worker send push (backend secrets)

The Worker sends via FCM HTTP v1 using a **service account** (Firebase console →
Project settings → Service accounts → Generate new private key). Set:

```bash
cd worker
wrangler secret put FCM_PROJECT_ID
wrangler secret put FCM_CLIENT_EMAIL
wrangler secret put FCM_PRIVATE_KEY
```

(For local `wrangler dev`, put the same values in `worker/.dev.vars`.)

## Token flow, end to end

```
app sign-in
  -> usePushRegistration -> initPushNotifications
     -> PushNotifications.requestPermissions() / register()
     -> 'registration' event { value: <FCM token> }
     -> PATCH /v1/auth/device { fcmToken }   (device.fcm_token in D1)
alert / SOS
  -> planNotifications includes this device
  -> Worker signs a service-account JWT -> FCM HTTP v1 -> phone
```

## Verifying

- `GET /v1/auth/session` should show `device.hasFcmToken: true` after sign-in on
  a configured device.
- Trigger an alert (e.g. `POST /v1/jobs/daily-check` or an SOS confirm) and check
  `GET /v1/notifications` — push rows should be `sent` rather than `skipped`.
