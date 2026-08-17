# Developer guide

## Prerequisites

For web development:

- Node.js compatible with Vite 8 and npm
- A modern browser with Web Crypto and IndexedDB

For Android development:

- JDK 21 (the current Capacitor Android sources compile with Java source release 21)
- Android SDK with platform/compile SDK 36
- Android platform-tools/ADB for device testing
- PowerShell on Windows for the repository's build helpers

No `.env` file, backend, Firebase project, database, API key, or paid service is required. maybe in future

## Install and run

```powershell
npm install
npm run dev
```

The development server binds to `127.0.0.1:5174`. Native-only features such as Android notification scheduling and native camera behavior return a no-op or require an Android build.

Use the production preview after building:

```powershell
npm run build
npm run preview
```

Vite preview uses Vite's default preview port unless overridden on the command line.

## npm scripts

| Command | Action |
| --- | --- |
| `npm run dev` | Start Vite on `127.0.0.1:5174` |
| `npm run lint` | Run Oxlint |
| `npm test` | Run all Vitest suites once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run build` | Generate icons through `prebuild`, then create `dist/` |
| `npm run preview` | Serve the production web build locally |
| `npm run generate:icons` | Generate public web/app icon assets from `public/icon.jpg` |
| `npm run generate:android-assets` | Generate Android launcher/splash assets |
| `npm run build:android` | Generate icons and build Vite in Android mode |
| `npm run android:sync` | Build web assets, generate Android assets, and run `cap sync android` |
| `npm run android:apk` | Sync and generate `artifacts/MedLoop-AI-debug.apk` |
| `npm run android:release` | Sync, build signed APK/AAB, and copy versioned/current artifacts |

`npm run build` invokes the `prebuild` lifecycle script automatically. Do not confuse it with `npm run build:android`, which uses Vite's Android mode.

## Repository layout

```text
MedLoop AI/
├── android/                 Capacitor Android/Gradle project
├── artifacts/               Local APK/AAB and QA outputs (gitignored)
├── docs/                    Canonical project documentation
├── public/                  Copied static assets, legal pages, and audio
├── scripts/                 Icon, Android build, and device-test helpers
├── src/
│   ├── components/          Shared shell, assistant, splash, record actions
│   ├── lib/                 Auth, storage, scheduling, backup, media, domain logic
│   ├── pages/               Route-level React screens
│   ├── App.jsx              Main state/orchestration layer
│   ├── App.css              Application component/layout styles
│   ├── index.css            Global styles
│   ├── navigation.js        Route metadata
│   ├── theme.js             Material UI theme
│   └── main.jsx             React entry point
├── tests/                   Vitest unit and integration suites
├── capacitor.config.ts      Capacitor app/plugin configuration
├── package.json             Node dependencies and scripts
└── vite.config.js           Vite React configuration
```

## Implementation conventions

- Keep domain/platform logic in `src/lib/` so it can be tested without rendering pages.
- Keep route pages lazy-loaded in `src/App.jsx` to control the initial JavaScript chunk.
- Normalize all restored/legacy structured state before use.
- Preserve local calendar semantics for medicine statuses; do not use UTC slicing for date keys.
- Route all image access through the IndexedDB modules and revoke object URLs after use.
- Keep native APIs guarded with `Capacitor.isNativePlatform()` or platform checks.
- Rebuild notification schedules after changes that affect doses, stock, settings, or the Level 1 contact.
- Confirm destructive operations and keep restore replacement semantics explicit.
- Keep phone validation in E.164 format because SMS/WhatsApp URI behavior depends on it.
- Do not add placeholder medical data to the shipped initial state.

## Adding a page

1. Create the route-level component in `src/pages/`.
2. Add it to `src/navigation.js`.
3. Add a lazy import and render case in `src/App.jsx`.
4. Pass only the state/actions required by the page.
5. Add responsive and accessible styling.
6. Test direct navigation, browser Back/Forward, unauthenticated redirect, mobile layout, empty state, and error state.

Because navigation is History-API based, any external web host must rewrite unknown application routes to `index.html`. Static legal HTML pages should remain directly addressable.

## Changing persisted data

There is no formal schema migration framework. `normalizeState`, `normalizeMedicineSchedule`, stock normalization, and settings sanitization form the compatibility layer. When adding a field:

1. define a safe default;
2. normalize missing/malformed legacy values;
3. update backup/restore only if the value is not already inside `state`;
4. update account deletion if new storage is introduced;
5. test old-state loading and round-trip backup;
6. update `ARCHITECTURE.md` and `SECURITY.md`.

If adding an IndexedDB store, increment the database version in both media modules and ensure both modules create the complete store list during upgrades.

## Dependency and configuration notes

- Versions are locked in `package-lock.json`.
- Capacitor app ID/name and web directory are in `capacitor.config.ts`.
- Android version name/code and signing selection are in `android/app/build.gradle`.
- SDK versions are in `android/variables.gradle`.
- Manifest permissions/components are in `android/app/src/main/AndroidManifest.xml`.
- Release secrets are intentionally ignored by Git.

After changing Capacitor plugins or native configuration, run:

```powershell
npm run android:sync
```

Review generated changes before committing; do not overwrite intentional Android customizations such as backup rules, notification sound, launcher assets, FileProvider, versioning, or signing configuration.

## Troubleshooting

- **Secure Web Crypto unavailable:** use a secure modern browser or the native app. Account and backup cryptography require `crypto.subtle`.
- **Android SDK not found:** set `ANDROID_HOME` or install it at `%LOCALAPPDATA%\Android\Sdk`.
- **Java not found/incompatible:** install JDK 21. JDK 17 fails with `invalid source release: 21` for the current Capacitor Android sources.
- **`dexBuilderDebug` MethodHandle failure:** stop Gradle and clean native outputs with `Set-Location android; .\gradlew.bat --stop; .\gradlew.bat clean`, then return to the repository root and rerun the Android build with JDK 21.
- **Release signing missing:** create the ignored keystore files described in `ANDROID_RELEASE.md`.
- **Gradle cache/daemon issue:** run the failing Gradle command from `android/` with `--no-daemon --stacktrace`; preserve the first complete error when diagnosing.
- **Native changes absent:** rerun `npm run android:sync`, then rebuild/reinstall the APK.
- **Browser route 404 on hosting:** configure a history fallback to `index.html`.

## Documentation maintenance

Update documentation in the same change when modifying routes, stored fields, permissions, external data flows, build requirements, version numbers, backup format, or release commands. Treat `docs/` as canonical and keep the root README concise.
