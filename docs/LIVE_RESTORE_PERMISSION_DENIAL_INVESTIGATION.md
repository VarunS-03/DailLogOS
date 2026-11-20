# Live Restore Permission Denial Investigation

Assessment date: 2026-11-20

## Executive summary

**CONFIRMED — The public site currently serves a client bundle older than the account-restore remediation in commit `fd1fd30`.** A read-only GET of `https://dailylogos.web.app/` returned HTTP 200 and referenced `/assets/index-DES61NSN.js`. That bundle contains the old literal `Access denied: You do not have permission to perform this action.` and the generic restore copy, but lacks the current bundle's account-read error wording and `Local sync storage unavailable` state. The locally built `dist` contains the newer markers and not the old access-denied literal.

**LIKELY — The live failure is still the old day-collection query/rules mismatch.** The user reports that neither the updated app nor rules has been deployed. The pre-remediation local rule matched day `read` with `isValidDateId(dateId)`; the emulator proved that the initialization query on `/users/{uid}/days` was denied because `dateId` is unbound for a collection list. That is the first account initialization query after profile, tombstone, and settings reads and occurs before account readiness. It explains both an access-denied banner and the generic account-restore screen.

**UNVERIFIED — The live Firestore rules were not inspected.** The report does not claim they currently equal the pre-remediation repository rules. The public bundle observation proves the served client is old; it does not prove which ruleset is deployed or which individual Firestore request returned permission denied.

No Firebase Console, live database, or Firebase deployment operation was used. Only public Hosting HTML and its referenced JavaScript asset were fetched with HTTP GET/HEAD.

## Confirmed facts

- Local commit `fd1fd30` contains the rules and client remediation; local `main` and `origin/main` point to that commit at inspection time.
- The public HTML currently references `/assets/index-DES61NSN.js`. The locally built output from this checkout uses different entry assets (`index-LcunahAS.js` and `index-z0dV159i.js`).
- The live JavaScript contains the pre-remediation access-denied message. The local built JavaScript contains `Cloud access was denied while checking this account.`, `Local sync storage unavailable`, and the `outboxAvailable` marker; those markers were not found in the live JavaScript.
- The live HTML response was cacheable with `Cache-Control: max-age=3600`. A browser or intermediary cache can therefore continue to show a previously fetched index page for a period after a later deployment. The public response observed during this investigation still referenced the old entry bundle.
- The local expected Firebase project ID is `dailylogos`: `.firebaserc` default alias, `.env` `VITE_FIREBASE_PROJECT_ID`, and the project ID field in the local Firebase config agree. Only project IDs and presence checks were read; API keys and other credentials were not printed.
- `dailylogos.web.app` corresponds to the expected local project name. This hostname match does not verify the site's live Firebase client configuration or live rules.
- `firebase.json` maps Firestore rules to `firestore.rules` and Hosting output to `dist`. It rewrites application routes to `/index.html`.
- The repository has no package script that specifies a different deploy project. The `.firebaserc` default alias is `dailylogos`; a Firebase CLI `--project` override or external CI configuration could still select another project. No CI/deployment command or live target history was inspected.
- In the pre-remediation source, `handleFirestoreError` converted Firestore permission errors to the exact access-denied string found in the public bundle. The account initialization catch stored that message in `accountError`; while readiness remained false, the main area displayed the generic restore message. Thus both screenshot messages are consistent with the same failing account-restore promise.
- That UI consistency does not identify the individual Firestore operation. The old handler was shared by account reads, onboarding, profile/settings writes, and history reads.

## Likely cause versus confirmed cause

The changed local rule fixes the failure established by the emulator:

```text
Before: allow read if isOwner(uid) && isValidDateId(dateId)
After:  allow get if isOwner(uid) && isValidDateId(dateId)
        allow list if isOwner(uid)
```

The new list permission remains confined to `/users/{uid}/days` and `isOwner(uid)`; direct document gets and every write retain date validation. The emulator verified that the production initialization function succeeds for new and returning users with these rules, and denies anonymous/cross-user access.

Since the user reports that the rule change has not been deployed, the live rule is expected to lack this fix. Combined with the observed old client bundle and the emulator reproduction, the old `/users/{uid}/days` list denial is the **most likely** cause. It is not a verified statement about the currently deployed rule source.

## Ordered permission map

The account effect calls `initializeUserAccount(user)`, then loads the first history page and reads outbox state. It sets `accountReady` only after these steps complete. The following Firestore operations can reject the restore promise before that state transition.

| Order | Operation | Path | Required rule in current local rules | Before account ready? | Could match screenshot? | Fixed by local rules remediation? |
|---|---|---|---|---|---|---|
| 1a | Server profile read | `/users/{uid}` | `allow read: if isOwner(uid)` | Yes | Yes; grouped initial read can reject the restore | No change needed; owner-only path already exists |
| 1b | Server deletion-tombstone read | `/accountDeletionTombstones/{uid}` | `allow read: if isOwner(uid)` | Yes | Yes; grouped initial read can reject the restore | No change needed; owner-only path already exists |
| 1c | Settings read | `/users/{uid}/settings/main` | `allow read: if isOwner(uid)` | Yes | Yes; grouped initial read can reject the restore | No change needed; owner-only path already exists |
| 1d | Legacy day existence query (`limit(1)`) | `/users/{uid}/days` | `allow list: if isOwner(uid)` | Yes | **Yes. This is the operation implicated by the emulator reproduction.** | **Yes.** This is the collection-list rule change. |
| 2 | Onboarding transaction read | `/users/{uid}/onboarding/main` | owner read, ID `main` | Yes | Yes; transaction failure rejects initialization | No change needed for read |
| 3 | Create missing onboarding state | `/users/{uid}/onboarding/main` | owner, `accountWritesAllowed(uid)`, ID `main`, valid progress | Yes | Yes; new-user transaction failure rejects initialization | No change needed; local rule already permits valid owner creation absent a deletion tombstone |
| 4 | Create/update profile | `/users/{uid}` | owner, `accountWritesAllowed(uid)`, profile schema; update limits changed keys | Yes | Yes; profile write failure rejects initialization | No change needed; current local rule already permits valid owner writes |
| 5 (conditional) | Persist pending cached settings | `/users/{uid}/settings/main` | owner, `accountWritesAllowed(uid)`, setting ID `main`, settings validator | Yes | Yes, only if this browser has pending settings | No change needed; current local rule already permits valid owner writes |
| 6 | First cloud history page | `/users/{uid}/days` | `allow list: if isOwner(uid)` | Yes | **Yes.** It is awaited before `accountReady`; permission errors do not use the network-only cache fallback | **Yes**, same list permission as step 1d |
| 7 | IndexedDB outbox list | Local IndexedDB, no Firestore path | Not applicable | Yes | It can block older client restore, but cannot itself yield Firestore permission-denied | Client resilience fix only; live bundle does not contain it |

The current app then sets `accountUserId` and `accountReady`. After readiness, `markOnboardingInProgress` may read/write `/users/{uid}/onboarding/main`, and the selected-day loader may get `/users/{uid}/days/{date}` (owner plus valid date ID). Those can produce separate later alerts, but do not hold the account-readiness gate. Day sync writes use `/users/{uid}/daySyncState/{date}` and `/users/{uid}/days/{date}` atomically with the required sync-state marker; those are post-readiness operations.

## Error correlation

For the old client currently served, both screenshot strings can arise from one failure: a Firestore permission error is converted to the exact access-denied banner text, the account effect catches it and leaves `accountReady` false, and the gated main area renders the generic restore text. This is a strong match, not proof of which request failed. Other operations in the same account restore/history chain use the same old error mapper.

The latest local code logs a sanitized `phase`, allowlisted category, and safe Firebase error code, without a UID, email, document contents, onboarding answers, or raw Firebase payload. Its first parallel reads previously shared `account_reads`, which was too coarse to distinguish the rules issue. This investigation adds per-operation phases: `account_profile_read`, `account_tombstone_read`, `account_settings_read`, and `account_days_list`. `tests/restore-diagnostics.test.ts` verifies the phase is retained without logging the raw message. These diagnostics will only be available once a build containing them is served.

## Local deployment configuration

- Expected project ID: **`dailylogos`**.
- `.firebaserc`: default Firebase CLI project alias is `dailylogos`.
- `firebase.json`: rules source is `firestore.rules`; Hosting serves `dist`.
- `.env`: `VITE_FIREBASE_PROJECT_ID` matches `dailylogos`; the Firebase auth domain also matches the project's default domain. Values were checked without printing keys.
- `firebase-config.json`: project ID is `dailylogos`; credential fields were not displayed. The source search found no application reference to this file, so it is not established as the production build's config source.
- Live public site: `https://dailylogos.web.app/`, observed HTML references the old asset `/assets/index-DES61NSN.js`.
- No rules/app deployment was performed. No live ruleset or live Firebase Console project selection was inspected.

The default local deployment target is therefore consistent with the production Hosting hostname. A CLI `--project` override or external pipeline configuration can override that default; this checkout contains no deploy script that does so.

## Smallest safe next action

After separate deployment authorization, deploy the current `firestore.rules` to the intended `dailylogos` project first, then deploy the built Hosting app from commit `fd1fd30` to the same project. The rules change is owner-scoped and does not weaken cross-user isolation. Verify the served HTML references the new local build's entry asset and that a new and returning Google account reach readiness. If permission denial remains, inspect the sanitized phase/category from the new client; `account_days_list` would confirm the collection rule path, while other phase names direct investigation to the corresponding rule.

Because the public HTML is cacheable for one hour, confirm in a fresh browser session or after the cache window that the new asset is loaded. Do not loosen other rules or modify account data to address this symptom.

## Remaining uncertainty

- The production Firestore rules were not read and their exact current contents are unknown.
- The public app's Firebase Auth/Firestore runtime project ID was not extracted from the bundle; a project ID string appearing in a minified bundle is not reliable proof of the configured SDK instance.
- A public Hosting request may be served from an HTTP cache. The current observed response is old, but this alone does not reveal deployment timestamps or origin cache state.
- The screenshot does not expose a Firebase error code or request path, so it cannot prove which operation failed.
- App Check enforcement and production Authorized Domains were not inspected. Google sign-in appearing successful makes Auth domain failure less likely, but does not establish Firestore access.
