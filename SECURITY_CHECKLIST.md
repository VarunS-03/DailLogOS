# DAILY OS — Security Audit & Hardening Checklist

This checklist verifies the security posture of the DAILY OS application. Use this document during audits, pre-deployment reviews, and continuous security maintenance.

---

## 1. Authentication & Authorization
- [x] **Google Sign-In**: Uses official Firebase Authentication SDK popup flow (`signInWithPopup`, `GoogleAuthProvider`).
- [x] **No Hardcoded Credentials**: No fake users, bypass tokens, or test credentials present in source code.
- [x] **Client-Side Authoritative State**: Subscriptions to `onAuthStateChanged` update the React state machine directly.
- [x] **Explicit Sign-Out**: `signOutUser` signs out of Firebase Auth and purges local storage cache keys.

## 2. Firestore Security Rules
- [x] **Global Deny-by-Default**: `match /{document=**} { allow read, write: if false; }` at root level.
- [x] **Strict Ownership Verification**: All operations on `/users/{uid}/**` require `request.auth.uid == uid`.
- [x] **Document ID Integrity**: For `/users/{uid}/days/{dateId}`, the rule requires `data.date == dateId` and `dateId.matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$')`.
- [x] **Field Bounds Validation**: Numeric fields (`mood`, `energy`, `sleep`, `completionPercentage`) constrained to valid ranges.
- [x] **String Length Limits**: Top-level notes and text fields bounded to prevent volumetric abuse.
- [x] **Collection Size Limits**: Arrays (`schedule`, `habits`, `dsa`) restricted to ≤ 50 elements.

## 3. Client-Side Input Hardening
- [x] **Academics View**: `maxLength` enforced on subject, objective, topics, and study notes.
- [x] **DSA View**: `maxLength` enforced on problem titles, URLs, time/space complexity, and code/mistake notes.
- [x] **Workout View**: `maxLength` enforced on custom exercise names, target schemes, weights, reps, and workout debriefs.
- [x] **Schedule View**: `maxLength` enforced on times, block titles, and block notes.
- [x] **Daily Review View**: `maxLength` enforced on tomorrow's first action, learned notes, retrieval notes, and journal entries.
- [x] **Today Dashboard**: `maxLength` enforced on quick-action prompts and inline notes.

## 4. Backup, Import & Export Security
- [x] **File Size Barrier**: Reject uploaded JSON files exceeding 5MB.
- [x] **Schema Validation**: Validates JSON structure using `backupValidation.ts` before parsing or hydrating into application state.
- [x] **Content Sanitization**: Neutralizes `<script>`, `javascript:`, and unsafe inline handlers in text strings.
- [x] **User Re-Scoping**: Imported data is assigned to the current user's authenticated UID, preventing multi-tenant data leaks.
- [x] **Clean Export**: JSON export structures only the current authenticated user's records and settings.

## 5. Local Device Privacy & Multi-User Protection
- [x] **Isolated Key Namespaces**: Keys prefixed by `daily_os_day_${uid}_${date}`.
- [x] **Sign-Out Cache Wipe**: Removes all stored day records and settings for the user on logout.
- [x] **Permanent Purge**: "Delete Account & Data" deletes both Cloud Firestore documents and device caches.

## 6. App Check & Client Integrity
- [x] **reCAPTCHA Provider**: Integrated with Firebase App Check (`ReCaptchaV3Provider`).
- [x] **Safe Fallback**: App remains functional if App Check is not configured in local development, while enforcing token checks when deployed.

## 7. Error Handling & Information Leakage
- [x] **Sanitized Error Logging**: `handleFirestoreError` prevents leaking PII, private thoughts, or sensitive internal paths into browser logs.
- [x] **Friendly User Messages**: Generic, helpful feedback presented to users during permission denials or network drops.
