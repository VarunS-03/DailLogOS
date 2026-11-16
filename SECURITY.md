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

### C. Safe Backup / JSON Import & Export
- **Multi-Phase Sanitization Pipeline**:
  - File size hard limit enforced at `< 5MB`.
  - Structural shape inspection checking for required schema properties before ingestion.
  - Strict type coercion and numeric clamping (e.g. 1–5 ratings, valid date strings matching `YYYY-MM-DD`).
  - XSS neutralizer that strips dangerous scripts, event handlers, and data URIs.
  - Array bounding limiting day imports to a safe maximum (365 records max).
- **User Ownership Scoping**:
  - Imported records are immediately re-keyed to the active user's `uid` and isolated in storage, preventing cross-tenant injection.

### D. Device Sharing & Local Storage Privacy
- **User-Prefixed Keys**:
  - All local cache entries are strictly isolated using `daily_os_day_${uid}_${date}` and `daily_os_settings_${uid}`.
- **Clean Sign-Out Purge**:
  - Triggering Sign-Out automatically wipes all keys associated with that `uid` from `localStorage`, preventing residual information from persisting on shared machines.
- **Complete Account & Data Deletion**:
  - A permanent "Delete Account & Data" action purges all Firestore documents and local caches, followed by immediate Firebase Auth termination.

### E. App Check & Client Integrity
- **Firebase App Check**:
  - Initialized with `ReCaptchaV3Provider` / `ReCaptchaEnterpriseProvider` to prevent unauthorized automated scraping or direct API invocation from non-applet domains.
  - Development debug tokens are strictly isolated to non-production environments.

### F. Privacy-Preserving Error Handling
- **Sanitized Error Messaging**:
  - Raw Firestore internal paths, reflection text, or server tokens are never exposed in UI alerts or unhandled exceptions.
  - The centralized `handleFirestoreError` maps permission and network failures into generic, safe notifications.

---

## 3. Security Maintenance & Incident Response
- **Secret Management**:
  - No secrets or API keys are committed into the repository or client bundles. All environment secrets are declared in `.env.example` and injected via secure environment variables.
- **Dependency Auditing**:
  - Dependencies are continuously monitored using automated dependency checks.
