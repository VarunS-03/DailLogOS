# DAILY OS — Security Architecture & Threat Model Documentation

## Executive Summary
DAILY OS is a personal, private, responsive daily-life operating system designed for tracking schedules, habits, academic studies, algorithmic problem solving (DSA), workouts, and end-of-day introspections. Because the system stores highly personal thoughts, routines, and learning weaknesses, privacy and data security are core design constraints.

This document outlines the security architecture, threat model, authorization invariants, data validation boundaries, and incident defense strategies implemented across the application.

---

## 1. Threat Model & Adversary Assumptions

We assume a zero-trust model where an attacker can:
1. **Unauthenticated Access**: Access the public URL without an active Firebase session.
2. **Authenticated Adversary**: Create their own valid Firebase Authentication account with Google credentials.
3. **Modified Client / Scripting**: Tamper with client-side JavaScript, forge arbitrary WebSocket or HTTP payloads to Cloud Firestore, or use Firebase SDKs directly via DevTools with forged user IDs.
4. **Shared Device / Hardware Access**: Access the browser or local cache of a shared workstation or mobile device after a session has finished.
5. **Malicious Backup Injection**: Craft custom JSON files containing oversized payloads, prototype pollution keys, malicious HTML/scripts, or cross-user identifiers to attempt client-side or server-side compromise via import features.

---

## 2. Core Security Invariants & Defenses

### A. Authorization & Data Isolation (Cloud Firestore)
- **Deny-by-Default Architecture**: The root rule (`match /{document=**} { allow read, write: if false; }`) denies all operations globally unless explicitly authorized in subpaths.
- **Strict User-Scoped Subtrees**: All user data resides under `/users/{uid}/*` (`/users/{uid}/days/{dateId}` and `/users/{uid}/settings/main`).
- **Cryptographic UID Binding**: Every read, create, update, and delete operation requires `request.auth != null` and `request.auth.uid == uid`. No user can query, list, or mutate another user's day records, settings, or profile.
- **Path-to-Payload Invariant**: A day record's date attribute must strictly match the Firestore document ID (`dateId == request.resource.data.date`), and must strictly follow the ISO format `YYYY-MM-DD`. This prevents ID spoofing or index corruption.

### B. Defense Against Data Abuse & Volumetric Inflation
- **Firestore Server-Side Field Constraints**:
  - `mood`, `energy`, and `sleep` are constrained to integer scales between `1` and `5`.
  - `completionPercentage` is constrained to `0 <= x <= 100`.
  - Free-form reflection notes are strictly capped to prevent document size exhaustion.
  - Subcollections and array collections (schedule, habits, dsa) are restricted to a maximum of 50 items each.
- **Client-Side Form Constraints**:
  - Every input field, textarea, and select element across all views (`AcademicsView`, `DsaView`, `WorkoutView`, `ScheduleView`, `DailyReviewView`, `TodayDashboard`, `ProjectsView`) enforces physical `maxLength` attributes (ranging from 50 to 10,000 characters).

### C. Backup / JSON Import & Export
- Backups are plaintext JSON. They contain day history and user settings (including a custom wallpaper if present); they do not contain raw onboarding answers or Gemini credentials. Treat exported files as sensitive.
- Import enforces a 5 MiB file limit, supported schema version, at most 1,000 days, real calendar-date keys, allowed object fields, bounded values, and validated custom tracker and behavioral data before application.
- Imported text remains data rendered by React; the importer does not claim to remove all HTML or event-handler syntax. It does not import user IDs or credentials.
- Merge retains records absent from the backup and applies matching records by timestamp (backup wins ties). Guest Replace replaces guest day history. Replace for authenticated cloud history is disabled because stale operations on other devices cannot be safely coordinated.
- Settings are imported separately from day history. If settings persistence fails after days are applied, the UI reports that partial result and keeps the import available for retry.

### D. Device Sharing & Local Storage Privacy
- Day and settings cache keys are scoped by user ID. Sign-out removes the current user's day and settings cache keys. Guest data and the separately stored Gemini key are not user-scoped and remain in the browser.
- Account deletion writes an immutable Firestore tombstone, blocks further writes, removes account documents and local UID-scoped data, then deletes the Firebase Authentication user. The tombstone remains to reject stale clients. If cleanup is interrupted, deletion stays blocked and can be retried.
### E. App Check & Client Integrity
- **Firebase App Check and Firebase AI Logic**:
  - The client initializes `ReCaptchaEnterpriseProvider` when `VITE_FIREBASE_RECAPTCHA_ENTERPRISE_SITE_KEY` is configured. In Vite development builds it uses the App Check debug-token flow instead. Keep the Enterprise site key public/client-side and its secret in the Firebase Console.
  - The user-triggered daily reflection summary and signed-in Coach Chat use Firebase AI Logic with limited-use App Check tokens. Auto-Fill falls back locally if App Check is unavailable; Coach Chat shows a retryable error.
  - Coach Chat sends the current message, selected current-day progress, configured user goals/preferences, and recent conversation history to Google. Saved history is owner-scoped in Firestore and cleared during account deletion.
  - Client initialization does not configure project-side enforcement or register an attestation provider. Configure the web app and verify Firebase AI Logic App Check in the Firebase Console before production use. This repository has not inspected the live project settings.

### F. Privacy-Preserving Error Handling
- **Sanitized Error Messaging**:
  - Raw Firestore internal paths, reflection text, or server tokens are never exposed in UI alerts or unhandled exceptions.
  - The centralized `handleFirestoreError` maps permission and network failures into generic, safe notifications.

---

## 3. Security Maintenance & Incident Response
- **Client-visible keys**:
  - Firebase web configuration and Gemini API keys are client-visible values, not server-side secrets. A `VITE_GEMINI_API_KEY` is embedded in the built client; a key entered in the UI is stored in browser local storage and used for direct browser-to-Gemini requests. Do not commit real keys; apply provider-side restrictions and quotas, or route production AI requests through a trusted server if keys must remain secret.
  - `.env.example` contains placeholders only. Keep real local environment files out of version control and verify their ignore status before publishing.
- **Dependency Auditing**:
  - Run the package manager's dependency audit as part of release preparation; automated monitoring is not guaranteed by this repository configuration.
