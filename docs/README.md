# MedLoop AI documentation

This directory is the canonical operational and technical documentation for MedLoop AI `1.1.0-beta.11`.

## Read by role

| Role | Start here | Then read |
| --- | --- | --- |
| User or tester | [User guide](USER_GUIDE.md) | [Testing and QA](TESTING.md) |
| Developer | [Developer guide](DEVELOPMENT.md) | [Architecture and data](ARCHITECTURE.md) |
| Security/privacy reviewer | [Security and privacy](SECURITY.md) | [Architecture and data](ARCHITECTURE.md) |
| Release engineer | [Android release guide](ANDROID_RELEASE.md) | [Testing and QA](TESTING.md) |
| Product/release reviewer | [Project README](../README.md) | [Beta release record](../BETA_RELEASE.md) |

## Document set

- [USER_GUIDE.md](USER_GUIDE.md): complete end-user workflows and behavior.
- [ARCHITECTURE.md](ARCHITECTURE.md): components, navigation, storage, data records, and flows.
- [SECURITY.md](SECURITY.md): security controls, privacy behavior, permissions, risks, and incident notes.
- [DEVELOPMENT.md](DEVELOPMENT.md): local setup, commands, structure, implementation conventions, and debugging.
- [TESTING.md](TESTING.md): automated suites, manual tests, device smoke testing, and acceptance gates.
- [ANDROID_RELEASE.md](ANDROID_RELEASE.md): Android configuration, signing, build artifacts, installation, and distribution.

## Authoritative project facts

| Item | Value |
| --- | --- |
| Package version | `1.1.0-beta.11` |
| Android version code | `15` |
| Android application ID | `com.medloop.ai` |
| Android SDK range | min 24, target/compile 36 |
| Web development origin | `http://127.0.0.1:5174` |
| Web build directory | `dist/` |
| Android artifact directory | `artifacts/` |
| Backend | None |
| Required environment variables | None |
| Primary record storage | Capacitor Secure Storage |
| Local media storage | IndexedDB, database `medloop-local-media` |
| Backup extension | `.medloop` |

## Scope and known boundaries

The repository contains the React application, generated Capacitor Android project, native resource assets, automated tests, release scripts, legal static pages, and existing Android release artifacts. It does not contain a server, remote database, cloud deployment, billing integration, analytics, crash reporting, CI pipeline, or automated Play Store publishing.

Documentation describes the current source implementation. Historical claims and prior physical-device results remain in [BETA_RELEASE.md](../BETA_RELEASE.md); they should not be interpreted as a fresh verification after later source changes unless the verification suite is rerun.
