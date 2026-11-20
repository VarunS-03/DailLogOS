# Google Auth Restore Remediation

Date: 2026-11-20

## Root cause addressed

**Confirmed in the Firestore Emulator:** account initialization queries `/users/{uid}/days` before onboarding/profile creation. The previous `allow read` condition also called `isValidDateId(dateId)`. For a collection `list` request, `dateId` is unbound; the emulator rejected the query with `Null value error`. This blocked new and returning accounts before their onboarding/profile restoration and surfaced as the generic restore failure.

The rule now separates document `get` and collection `list`: direct gets and all writes still validate date IDs; collection listing is allowed only when the authenticated UID matches the UID in the user's private day path. No cross-user or anonymous access was added.

The investigation also confirmed an independent resilience bug: IndexedDB outbox reads were required before dashboard readiness. That dependency is now degraded explicitly rather than blocking account initialization.

## Changes implemented

- Split day rule access into owner-only `list` and owner/date-validated `get`; retain date validation on create/update/delete.
- Extracted an explicit Firestore initialization entry point used by the production wrapper and emulator tests.
- Validate existing profile and settings data as account integrity data; invalid documents are not treated as missing or used to silently create a fresh lifecycle.
- Add bounded restore phases and error categories. Diagnostics log only phase, allowlisted category, and Firebase code; raw Firebase messages and credential-bearing fields are excluded.
- Make Firebase module environment access safe for the Node-based emulator test runtime while retaining Vite/browser configuration behavior.
- Let history query Firestore when outbox reads fail. In degraded mode it does not enqueue recovery work or write merged history back to local cache, and marks outbox availability false.
- Allow account readiness after safe cloud account initialization even when outbox access fails. Mark sync unavailable, show an actionable banner/status, pause background workers, and reject day edits until a retry confirms outbox availability.
- Deduplicate same-UID user state updates from popup completion and Auth listener to avoid unnecessary account initialization restarts.
- Add emulator coverage for new-user provisioning, returning-user preservation, owner isolation, permission classification, tombstones, and malformed profile/settings data. Add unit coverage for explicit outbox-unavailable results and safe error diagnostics.

## Files changed

- `firestore.rules`
- `src/App.tsx`
- `src/firebase.ts`
- `src/types.ts`
- `src/components/Navigation.tsx`
- `src/utils/dayHistory.ts`
- `src/services/outboxAccess.ts`
- `tests/day-sync-emulator.test.ts`
- `tests/firestore.rules.test.ts`
- `tests/outbox-access.test.ts`
- `tests/restore-diagnostics.test.ts`
- `package.json`
- `docs/GOOGLE_AUTH_RESTORE_INVESTIGATION.md`
- `docs/ENGINEERING_ROADMAP.md`
- `docs/PRODUCTION_ACCEPTANCE.md`
- `docs/GOOGLE_AUTH_RESTORE_REMEDIATION.md`

## Storage-degraded behavior

When Firestore account ownership, tombstone, onboarding, profile, and settings checks pass but IndexedDB cannot be inspected, the authenticated dashboard can load from cloud history. Existing cache data is preserved; recovery writes and cache replacements are skipped because queued edits cannot be safely enumerated. The UI identifies local sync storage as unavailable, background synchronization stops, and day edits are rejected with an explanation. Retry repeats account/history/outbox initialization. No Firestore day write is attempted without a durable outbox operation.

Cloud history permission or data-integrity failures still fail the relevant load. Network failures retain the existing incomplete cache fallback. Account deletion tombstones continue to block initialization.

## Tests added

- `tests/day-sync-emulator.test.ts`: uses `initializeUserAccountForDatabase`, the production account initialization function, with Firestore Emulator authenticated contexts and the repository rules.
- `tests/firestore.rules.test.ts`: models owner-only collection listing and verifies cross-UID listing is denied.
- `tests/outbox-access.test.ts`: distinguishes an empty queue from unavailable storage without discarding operations.
- `tests/restore-diagnostics.test.ts`: checks structured classifications and ensures raw error text is not logged.

## Validation results

All requested local checks passed:

| Command | Result |
|---|---|
| `npm run lint` | PASS (`tsc --noEmit`) |
| `npm test` | PASS (all configured suites, including outbox degradation and safe diagnostics) |
| `npm run test:firestore-emulator` | PASS (production account initialization plus day-sync/rules cases against demo project `demo-daily-os`) |
| `npm run build` | PASS; Vite reports the existing large-chunk warning for chunks over 500 kB |
| `git diff --check` | PASS; only Git LF-to-CRLF notices remain |

## Remaining limitations

- The Firestore Emulator confirms behavior against the repository rules only. The updated rules have not been deployed and live Firebase behavior remains unverified.
- Google OAuth Authorized Domains, production build-time Firebase config, App Check enforcement, and real mobile browser storage behavior were not inspected in Firebase Console or exercised on a physical device.
- The sync state is in memory for the active app session. A reload will re-probe IndexedDB; the UI does not claim queued edits are absent while storage is unavailable.
- No real-browser test simulates OS/browser storage denial or the popup/Auth listener timing.

## Manual browser tests required

1. In the deployed test environment, sign in with a new Google account and verify first-time onboarding/profile provisioning completes.
2. Sign out and back in, then refresh. Verify onboarding stage, settings, history, and UID remain correct.
3. Repeat on a supported mobile browser. Verify the responsive navigation and restore screen.
4. In a controlled test browser, block or disable IndexedDB before sign-in. Verify cloud account access succeeds, storage-unavailable status is visible, day edits and sync are paused, and no queued edits are cleared. Restore storage and retry.
5. Confirm cloud permission denial displays an access-specific error and does not become a local-storage warning.
6. Confirm a tombstoned test account remains blocked and offers the existing deletion-resume path.
7. Switch between two test accounts and guest mode; verify status and records do not cross UIDs.

## Live verification status

Live Firebase rules, OAuth configuration, App Check enforcement, and production behavior remain **unverified**. No deploy, Console change, account mutation, or data deletion was performed.
