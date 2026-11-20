# Google OAuth and Account Restore Investigation

## Remediation follow-up (2026-11-20)

The original repository-only investigation left the live cause unverified. The emulator integration added during remediation established a local rules defect: `initializeUserAccount` performs `getDocs` on `/users/{uid}/days` before creating onboarding or the profile. The existing `allow read` rule combined owner validation with `isValidDateId(dateId)`. On a collection query, the emulator reported `Null value error` for `dateId`, denying the query even when the collection was empty. This is **CONFIRMED for the repository rules and production initialization path under the Firestore Emulator** and explains why both new and returning users can fail before outbox restoration.

The rules now allow `list` only under the authenticated owner's `/users/{uid}/days` path and retain date validation for direct `get` and all writes. Emulator tests verify new-user provisioning, returning-user preservation, owner-only listing, permission-denied classification, tombstone blocking, and malformed profile/settings rejection. This is not a verification of live Firebase rules or deployed app behavior.

The outbox issue remains an independent confirmed resilience defect and is remediated separately: account readiness no longer depends on IndexedDB, cloud history can load without outbox inspection, and day edits/sync pause visibly when outbox state is unavailable. See [GOOGLE_AUTH_RESTORE_REMEDIATION.md](GOOGLE_AUTH_RESTORE_REMEDIATION.md).

Investigation date: 2026-11-20

Scope: repository-only, read-only investigation of Google sign-in and authenticated account restoration. No application source, Firestore rules, Firebase Console settings, or user data were changed. Existing focused tests and TypeScript checking were run.

## Executive summary

**LIKELY — The displayed “Your account data could not be restored” text does not mean Google OAuth failed.** Google sign-in completion, Auth state delivery, and account restoration are separate stages. The sign-in handler only sets the authenticated user; a later React effect must initialize Firestore account state, load history, and read the IndexedDB outbox before the dashboard becomes ready. Any uncaught failure in this chain keeps the dashboard behind the same generic restore text.

**CONFIRMED — The code has a mobile/browser-sensitive failure path that can block all users, including brand-new users.** `indexedDbDayOutbox.list(uid)` is required by `loadDayHistoryPage` and is awaited before its Firestore error fallback. The outbox rejects when IndexedDB is unavailable or blocked. Account initialization also waits for another outbox read before setting `accountReady`. These errors reach the account-level catch and prevent the dashboard from becoming ready. This is a concrete defect candidate, especially in restrictive/private browser contexts, but the report does not establish that this is the observed runtime failure.

**UNVERIFIED — The deployed Firebase project’s live rules, App Check enforcement, OAuth authorized domains, and actual runtime error were not inspected.** Repository configuration points to the same project name for the CLI alias, `.env` project ID, and default Firebase Auth domain. This does not establish what configuration was compiled into the deployed site, nor what is deployed in Firebase Console.

**No single root cause can be conclusively established from the repository alone.** The smallest safe next step is to capture the sanitized error code and failing phase in the affected browser, and to make outbox initialization failure non-fatal to account/dashboard restoration while surfacing sync as unavailable. Add emulator coverage for new-user provisioning against the actual rules. Do not loosen rules based only on this symptom.

## Login and restore sequence

1. `Navigation` calls `handleSignIn` in `src/App.tsx`.
2. `handleSignIn` calls `signInWithGoogle` in `src/firebase.ts`.
3. `signInWithGoogle` creates `GoogleAuthProvider`, requests account selection, and calls `signInWithPopup`. On success it returns a minimal app `AuthUser`. Firebase Auth state persistence is left at the SDK default; there is no explicit persistence call.
4. `handleSignIn` calls `setUser(authUser)`. Independently, the `onAuthStateChanged` listener invokes the same `setUser` after Firebase emits the new Auth state. The effect sets `authResolved`, clears the auth restore error, and resets account identity/readiness. It does not initialize Firestore itself.
5. A second effect sees the non-null user, resets the account-specific view state, and calls `initializeUserAccount(user)`.
6. `initializeUserAccount` waits for optional App Check initialization, then concurrently reads the profile from server, deletion tombstone from server, settings, and up to one day record. Missing documents are snapshots with `exists() === false`; they are expected and are not errors by themselves.
7. If a tombstone exists, or profile says deletion is in progress, initialization stops with `AccountDeletionError`.
8. The app considers an account legacy-complete if any profile, settings, or day document exists. It starts a transaction on onboarding. An existing onboarding document is validated and returned. If absent, it creates initial onboarding state (`not_started`, stage 1) for a new account or `completed`, stage 6 for legacy data.
9. The function merge-writes the user profile. It restores pending cached settings if present, otherwise normalizes cloud settings if present, otherwise returns null settings or valid cached settings. It does not require a settings document to exist.
10. The React effect sets onboarding state, then calls `loadDayHistoryPage`. That function reads cached days and awaits the IndexedDB outbox before querying cloud history. Network-class Firestore failures fall back to cache; IndexedDB failures do not have that fallback.
11. After history succeeds, the React effect reads the IndexedDB outbox again to derive conflict/recovery/sync status.
12. Only then does it set `accountUserId` and `accountReady`. The dashboard is gated on both. Any rejection in steps 5–11 sets `accountError` and leaves account readiness false.
13. Once ready, other effects can load the selected day (including another outbox read), mark a `not_started` onboarding record `in_progress`, and start the background day-sync worker. Those later failures have separate UI paths, except onboarding write failure can set the account error.

The UI renders the literal generic restore text whenever auth is unresolved or a signed-in account is not ready, even if a more specific message is also shown in the top error banner. This wording collapses failures from profile reads, onboarding transactions, profile writes, history normalization, and IndexedDB restoration into one visual state.

## New-account provisioning

- **CONFIRMED — A new Google user does not need a pre-existing Firestore profile.** The implementation reads the profile; a missing profile contributes `false` to legacy detection. It then creates onboarding in a transaction and creates/merges the profile afterward.
- **CONFIRMED — Missing settings and day documents are handled as normal absence.** They do not cause initialization failure. A missing onboarding document is also explicitly created.
- **CONFIRMED — New accounts use onboarding defaults.** The persisted lifecycle document starts at stage 1 with `not_started`; the UI supplies default answers when no saved answers exist. No new account is assumed complete unless legacy profile/settings/day data already exists.
- **CONFIRMED — New and returning accounts use the same initial path.** Existing onboarding is read and validated; missing onboarding is transactionally created. Existing settings are normalized. New accounts receive a profile write and no settings write at this stage.
- **POSSIBLE — Concurrent initializations can occur.** The explicit `setUser` after popup and the Auth listener can both set the same user. The onboarding transaction should be idempotent; overlapping profile merge writes are possible. No test covers this React-level race.
- **CONFIRMED — The day outbox is an unconditional dashboard prerequisite.** Even a new account with no cloud days must successfully access IndexedDB to complete history/account readiness.

## Firestore operations and rules

Rules inspected: `firestore.rules`. The global rule denies unlisted paths; explicit user-scoped rules authorize only the authenticated owner UID. Firebase documentation notes that Rules evaluate requests and are not filters; missing documents are a normal Firestore result, while reads still require authorization.

| Initialization operation | Path | Rule / expected result | New-user concern |
|---|---|---|---|
| Server profile read | `/users/{uid}` | `allow read: if isOwner(uid)` | Missing profile is allowed as an absent snapshot. Cross-UID/anonymous reads are denied. |
| Server tombstone read | `/accountDeletionTombstones/{uid}` | `allow read: if isOwner(uid)` | Missing tombstone is expected. Existing tombstone blocks restoration intentionally. |
| Settings read | `/users/{uid}/settings/main` | `allow read: if isOwner(uid)` | Missing settings is handled. No settings document is created during ordinary initialization. |
| Existing day query | `/users/{uid}/days` | `allow read: if isOwner(uid) && isValidDateId(dateId)` | Empty query is expected; query is scoped to user. |
| Onboarding transaction get | `/users/{uid}/onboarding/main` | owner read | Missing document is handled by transaction create branch. |
| Onboarding transaction create | `/users/{uid}/onboarding/main` | owner, `accountWritesAllowed`, ID `main`, schema validator | New-account create is structurally allowed if no tombstone/deletion flag exists and deployed rules match the repository. |
| Profile merge write | `/users/{uid}` | owner; create requires `accountWritesAllowed`, valid fields, `uid` match; update has restricted changed fields | New-account create is structurally allowed absent a tombstone. Existing unexpected profile fields could make update fail validation. |
| Optional pending settings retry | `/users/{uid}/settings/main` | owner, `accountWritesAllowed`, validated settings | Only runs if local pending settings exist. Not required for a clean new account. |
| Onboarding in-progress write after ready | `/users/{uid}/onboarding/main` | owner, `accountWritesAllowed`, validated onboarding data | Separate post-restoration write; failure sets `accountError`. |
| History page read | `/users/{uid}/days` | owner read | This query is not a transactional day write and does not need a sync marker. Network errors fall back to cache; permission/data errors fail account readiness. |

No account initialization operation writes a day or sync-state marker. Day record synchronization occurs later; day creation/update requires an atomic `/users/{uid}/daySyncState/{date}` marker via `getAfter`, but that invariant does not explain failure before dashboard readiness unless the post-ready worker runs and fails independently.

Tombstone rules intentionally block account writes after deletion begins. Reads remain owner-only and deletion cleanup is allowed through its separate deletion logic. A stale tombstone for a UID is a possible cause for an account that previously began deletion, but is less consistent with a completely new Google UID.

The rules file allows the expected new-user operations. **This does not prove those rules are deployed.** `firebase.json` points Firebase CLI at this local file, and `.firebaserc` selects the project alias, but no live rules state was accessed.

## Configuration and OAuth

- **CONFIRMED (repository):** Firebase initialization reads Vite variables for API key and project ID, with optional `window.__ENV__` fallback. Auth domain defaults to `<projectId>.firebaseapp.com`. Auth and Firestore are created from the same Firebase app instance, so this code uses one project for both.
- **CONFIRMED (local files):** `.firebaserc` default project name matches `VITE_FIREBASE_PROJECT_ID` in `.env`; the configured Auth domain matches that project’s default Firebase domain. Values were compared without printing credentials.
- **CONFIRMED (repository):** Google uses popup sign-in and sets `prompt=select_account`. Auth errors distinguish unauthorized domain, popup blocked/closed, provider disabled, network failure, and invalid API key.
- **CONFIRMED (repository):** App Check initialization is optional. It is enabled when a site key exists or during development; initialization failures are logged by error name and swallowed. Firestore is initialized before App Check completes, but account initialization awaits the App Check promise before starting its reads.
- **POSSIBLE:** If App Check is enforced for Firestore in the live project but the deployed app lacks a valid production attestation setup, Firestore requests can fail after Google Auth succeeds. The repository cannot establish enforcement status.
- **UNVERIFIED:** Production build-time environment, deployed site's project ID, Firebase Authorized Domains, OAuth redirect/origin configuration, provider enabled state, App Check enforcement, and live deployed rules. No Firebase Console was accessed.

## Error propagation and likely failure classes

- Google popup errors are converted to `AppAuthError`. **Important:** `handleSignIn` only stores that error when it is an `AppAuthError`; the configuration-missing branch throws a plain `Error`, so that case can be silently absent from sign-in UI.
- Auth listener errors are reduced to the error class name in the console and a specific auth-restore message. They do not use the account restore catch.
- Firestore errors in initialization pass through `handleFirestoreError`, which recognizes permission denied and network/unavailable patterns from the message text. It returns a new plain `Error`, discarding Firebase error code and operation metadata. Other Firestore/data errors become “Unable to complete the operation.”
- The account effect logs the resulting error and puts its message in `accountError`, but the main loading area still uses the generic restore text. This creates multiple user-facing messages for one failure.
- Onboarding validation errors can be mapped to a generic database operation error; malformed settings and normalization exceptions can also land in the account-level catch.
- IndexedDB errors from `indexedDbDayOutbox.list` are not Firebase errors and are not classified by `handleFirestoreError`. They are caught by the account-level restoration catch and block dashboard readiness.
- UID mismatch is not apparent in the initialization path: it uses the Auth callback's UID for all user-scoped paths. Local outbox queries are also UID-filtered.
- Missing Firestore documents are not the same as failed reads and are handled correctly in the code.

### Safe error classification proposal

Attach a small phase identifier to each await boundary (`auth_state`, `account_reads`, `onboarding_transaction`, `profile_write`, `history_cloud`, `outbox_open`, `outbox_read`). Preserve only a sanitized allowlisted category/code (`permission-denied`, `unavailable`, `unauthenticated`, `failed-precondition`, `data-invalid`, `storage-unavailable`, `unknown`) for UI/telemetry. Keep UID, tokens, email, document contents, onboarding answers, and raw Firebase messages out of logs. Keep Firebase request code in structured diagnostics without raw error payload. Let history/outbox degradation continue to the dashboard where possible; keep account/profile/onboarding integrity errors blocking and actionable.

## Existing test coverage

Focused checks run during this investigation:

- `npm run lint` — passed (`tsc --noEmit`).
- `npx tsx tests/account-lifecycle.test.ts` — passed. Covers creation defaults and onboarding visibility logic, not Firebase Auth or Firestore provisioning.
- `npx tsx tests/account-deletion.test.ts` — passed. Covers deletion ordering, partial cleanup, tombstone behavior, and retry in an injected service abstraction.
- `npx tsx tests/day-sync.test.ts` — passed. Covers IndexedDB outbox operations, queue behavior, and conflicts using test doubles/fake IndexedDB.

Repository coverage also includes a local Firestore-rules evaluator, Auth-independent account lifecycle tests, account deletion service tests, and Firestore Emulator day-sync tests. The local rules evaluator is a simulation. Emulator tests validate rules and day synchronization, but no test currently exercises `initializeUserAccount` for a first-time authenticated UID against the emulator.

Coverage gaps relevant to this issue:

- No browser integration test runs Google popup sign-in through `onAuthStateChanged` and dashboard readiness.
- No emulator test verifies missing profile/settings/days/onboarding creation for a new authenticated user and subsequent retry/returning-user restoration.
- No test asserts that IndexedDB open/list failure still allows authenticated account and dashboard readiness.
- No targeted test proves that permission-denied, App Check failure, unavailable/network, malformed data, and tombstone conditions produce distinct phase/category outcomes.
- No live Firebase project configuration or deployed rules are validated by tests.

## Root cause assessment

No definitive runtime root cause is established.

1. **LIKELY — Browser IndexedDB/outbox failure is promoted to account restore failure.** This is directly supported by code and particularly relevant on mobile/private/restricted browser storage. A fresh account follows the same path, so absence of account data does not prevent it. Confirmation requires the actual browser error or reproducing with IndexedDB disabled/blocked.
2. **POSSIBLE — Live Firestore rules differ from the local rules or deny an initialization operation.** That would affect new and existing users. The local rules appear to permit owner-scoped new-account initialization, but deployment is unverified.
3. **POSSIBLE — Live App Check enforcement rejects Firestore calls.** Auth can succeed while Firestore is unavailable due to enforcement/configuration. Live enforcement and production attestation are unverified.
4. **POSSIBLE — Deployed build points at a different/misconfigured Firebase project or domain.** Local values are internally consistent; deployed artifacts and Authorized Domains were not inspected.
5. **POSSIBLE — Persisted schema incompatibility or malformed existing account data.** This is plausible for returning accounts, but less consistent with the reported failure for new Google accounts.
6. **POSSIBLE (account-specific) — Existing account deletion tombstone.** Intentional deletion protection blocks account recovery for that UID; unlikely to explain a brand-new UID.
7. **RULED OUT by code inspection — A missing profile, settings, day, or onboarding document alone is treated as a Firestore error.** The code explicitly handles these absent snapshots and creates new onboarding/profile records.

## Smallest safe remediation plan

1. Capture sanitized phase + Firebase error code in the affected browser; do not collect tokens, user content, or raw records. Confirm whether Auth completes and whether the first failed phase is Firestore, outbox, or parsing.
2. Make local outbox availability degrade sync capability rather than account identity/restoration. Ensure outbox read failure cannot strand an authenticated user on the restore screen; provide a clear sync-unavailable state and preserve local data.
3. Add an emulator integration test for first-time account initialization with the repository rules, plus retry/restoration of the created account.
4. Add a browser/service test where IndexedDB open/list rejects and assert dashboard account readiness succeeds while sync reports unavailable.
5. Only if diagnostics show permission denial, compare the live deployed rules and App Check/Auth project settings with the local configuration. Do not broaden rules as a speculative fix.

## Proposed regression tests

- New UID + no documents: owner reads return absent snapshots; onboarding transaction creates `not_started`; profile is created; settings/history can be absent; account becomes ready.
- Second initialization for same UID: onboarding is read without reset; settings and history restore; account becomes ready.
- Anonymous and cross-UID attempts remain denied for profile, onboarding, settings, days, and tombstones.
- Tombstoned UID produces an explicit deletion-pending outcome and does not initialize a new account.
- App Check/Firestore permission and network errors map to distinct sanitized phases/categories.
- IndexedDB unavailable, blocked, and request-error cases do not block authenticated dashboard readiness; outbox/sync is marked unavailable.
- Malformed onboarding/settings remain integrity errors and do not get silently interpreted as missing documents.
- Auth callback plus popup resolution for same UID does not result in a stale initialization overwriting the active account state.

## Risks

- Allowing the dashboard to load while outbox storage is unavailable can hide pending local edits if UI state does not clearly show sync/storage limitations. Do not silently discard queued or cached data.
- Relaxing Firestore rules to address a generic error could expose user data. The current owner-only boundaries should remain until live diagnostics identify a specific incorrect condition.
- Making all account initialization failures non-blocking would risk presenting incomplete or stale account data as restored. Degrade only history/outbox where safe; keep authentication, account ownership, tombstone, and schema-integrity checks explicit.

## External references

- Firebase Google sign-in and authorized domains: https://firebase.google.com/docs/auth/web/google-signin
- Firebase Auth state persistence: https://firebase.google.com/docs/auth/web/auth-state-persistence
- Firestore security rule conditions and owner checks: https://firebase.google.com/docs/firestore/security/rules-conditions
- Firebase App Check web setup and enforcement: https://firebase.google.com/docs/app-check/web/recaptcha-provider

These official docs confirm that Auth session persistence is separate from Firestore access and that App Check enforcement can reject requests independently. Successful Google Authentication therefore does not prove subsequent Firestore reads/writes will succeed.
