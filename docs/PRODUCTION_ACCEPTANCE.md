# Daily OS Production Acceptance

**Assessment date:** 2026-11-18
**Overall status: NOT READY â€” live project and release checks are unverified.**
This report distinguishes source review and automated checks from actual Firebase, browser, and device acceptance.

## System summary

- React/Vite client with guest-local use and Google sign-in through Firebase Authentication.
- Authenticated profiles, settings, onboarding, and dated records use UID-scoped Firestore paths. Day edits use a durable local outbox and conflict/recovery states; Firestore rules require sync-state commits and deny writes after an account-deletion tombstone is created.
- Account deletion writes an immutable `/accountDeletionTombstones/{uid}` record, removes user data/profile, then requests Firebase Authentication deletion. A recent authenticated session may be required for the final Auth step.
- Backup files are plaintext JSON containing day records and settings. Imports are bounded to 5 MiB and 1,000 records and validated against allowed fields and value limits. Merge is supported; Replace is limited to guest data. Applying day records and settings is not atomic.
- Existing Gemini features run from the browser and use the user-configured Google AI Studio key; those keys remain in browser local storage or are client-visible when configured through Vite. The user-triggered daily reflection summary and signed-in Coach Chat use Firebase AI Logic without a Gemini API key, with limited-use App Check tokens. Only selected user context and the current prompt/history are sent when the user requests a chat reply.
- Track, Insights, and Settings are lazy-loaded. Three.js and the Gemini SDK are dynamically loaded. The build still reports large chunks; history loads all pages and has no total cap.

## Acceptance classification

| Area | Status | Evidence and remaining gate |
|---|---|---|
| Source and type safety | READY WITH LIMITATIONS | TypeScript/lint and tests run locally; code review does not establish runtime behavior on supported browsers. |
| Firestore rules | READY WITH LIMITATIONS | Emulator suite verifies owner access, cross-user and anonymous denial, schema rejection, transactional day writes, and deletion tombstones. Production rules deployment and live-project verification are NOT VERIFIED. |
| Outbox and conflict handling | READY WITH LIMITATIONS | Unit and emulator tests cover persistence/recovery, concurrent clients, conflicts, remote deletion, and tombstone denial. Physical devices, real network interruption, and live accounts are NOT VERIFIED. |
| Account deletion | NOT VERIFIED | Lifecycle ordering is covered by unit tests and tombstone behavior by Emulator. Live Google reauthentication/recent-login, Auth deletion, and deployed rules ordering require manual verification. |
| Backup and restore | READY WITH LIMITATIONS | Validation and merge behavior are covered by tests. Export remains plaintext; settings failure can follow successful day import and is reported as partial. Browser file handling is NOT VERIFIED. |
| AI safety and privacy | READY WITH LIMITATIONS | Provider output parsing and proposal validation have tests. A live Gemini request, quota/restriction settings, and key policy are NOT VERIFIED. |
| Feature coverage | READY WITH LIMITATIONS | Inventory is in [FEATURE_INVENTORY.md](FEATURE_INVENTORY.md). No browser automation, accessibility audit, or real-device responsive run was done. |
| Performance | NOT READY | Final build confirms chunk-size warnings remain; history memory and reads grow with the full account history. |
| Dependencies | READY WITH LIMITATIONS | Production dependency audit found 0 vulnerabilities. Full audit has high-severity dev-tooling advisories in the Vite/picomatch dependency chain; see final recorded output. |
| Overall release | NOT READY | Live Firebase/Auth/rules/App Check and manual acceptance gates below remain. |

## Configuration and security review

- `firestore.rules` is deny-by-default and validates owner-scoped user data. Deploy the tombstone-capable rules before shipping a client that begins account deletion with this lifecycle.
- Firebase web configuration and any Vite-prefixed environment variable are client-visible. Do not place service-account credentials or server secrets in the frontend build.
- App Check initializes with the reCAPTCHA Enterprise provider when `VITE_FIREBASE_RECAPTCHA_ENTERPRISE_SITE_KEY` is configured, or uses the debug-token flow in Vite development. Firebase AI Logic requests fail over to local reflection defaults if App Check is unavailable. Register the production web app/provider and verify Firebase AI Logic enforcement in Firebase Console.
- `.env` is ignored by Git and `.env.example` is a placeholder template. The emulator runner removes debug flags and secret-like variables from the Firebase CLI child environment; a regression test covers this. An earlier verbose emulator run exposed the `STITCH_API_KEY` environment value in tool output. Rotate that key in its owning provider; no credential rotation was performed here.
- The reviewed tracked frontend/config/docs did not contain service-account private-key material. Do not treat that scan as proof that runtime secrets are secure.
- Backups are unencrypted. Users should store exported files accordingly; the application makes no encryption-at-rest claim.

## Validation evidence

Final local validation results:

| Check | Result |
|---|---|
| `npm run lint` | PASS â€” `tsc --noEmit` |
| `npm test` | PASS â€” emulator environment-filter test plus behavioral, mock-rules, lifecycle, backup/history, AI, sync, and outbox suites |
| `npm run test:firestore-emulator` | PASS â€” owner/deny, concurrent edits, conflicts, deletion recovery, revision migration, and tombstones. Intentionally rejected writes log permission errors. |
| `npm run build` | PASS â€” main entry 1.14 MB (305 kB gzip), Three.js 753 kB, Gemini 444 kB; Vite still warns for chunks over 500 kB |
| `npm audit --omit=dev` | PASS â€” 0 vulnerabilities |
| `npm audit` | LIMITATION â€” 4 high findings from the Vite/fdir/tinyglobby/picomatch development-tool chain. Advisory GHSA-fc5q-39xc-vjpf affects resolved picomatch 4.0.7; registry has no patched release available to this dependency tree. `npm audit fix --force` proposes a breaking Vite change. |
| `git diff --check` | PASS â€” no whitespace errors; Git reports expected LF-to-CRLF conversion notices |

## Manual release checklist

1. Sign in with Google, refresh, and confirm the same account and settings return.
2. Complete onboarding, interrupt it midway, resume on another browser, and confirm an existing/legacy account is not asked to onboard again.
3. Switch between two accounts and guest mode; confirm no account's cached records appear in another scope.
4. Edit a day offline, reload, reconnect, and confirm the outbox either syncs or shows a recoverable conflict without losing the local edit.
5. With two independent clients, change different fields and then the same field; verify automatic merge for independent values and an explicit choice for same-field conflict.
6. Delete a day remotely while another client has a pending edit; verify it enters recovery and is not silently re-created.
7. Export a backup; test Merge with matching and unmentioned dates, then test guest Replace. Verify malformed, oversized, and unsupported-field files are rejected. Confirm settings-write failure is shown as partial if it can be safely simulated.
8. Delete an account in the live project; verify tombstone creation blocks writes, user data/profile are removed, recent-login reauthentication is handled, and Firebase Authentication deletion completes. Confirm retry behavior if the Auth deletion step fails.
9. Exercise each Gemini feature with a restricted test key; verify invalid model responses are rejected, proposal changes require review, and privacy disclosure appears before user content is sent.
10. Check desktop and mobile layouts, reduced-motion behavior, keyboard navigation, and the initial route/AI chunk loading on supported browsers.

Mark each step with date, browser/device, project/environment, result, and any issue before calling the release accepted. Unit tests, mocked rules tests, and Emulator tests do not substitute for these live checks.

## Phase 17 â€” Release readiness addendum

**Assessment date:** 2026-11-18
**Local engineering status:** PASS WITH LIMITATIONS
**Release verdict:** NOT READY

This addendum supersedes earlier statements above that Insights startup loads all history. Normal history startup now fetches a bounded first page (180 records); users can load older pages, and export/merge-import explicitly fetch complete history. See [PHASE_17_RELEASE_READINESS.md](PHASE_17_RELEASE_READINESS.md) and the [browser acceptance checklist](BROWSER_ACCEPTANCE_CHECKLIST.md).

- Startup defers onboarding, AI chat, and configured App Check SDK code; Three.js and Gemini remain deferred. Vite still reports large chunks and no physical-device performance run was performed.
- AI/provider failures use sanitized diagnostics. Account deletion reports stage-aware, retryable outcomes. Emulator launch strips debug and secret-like environment values, with a sentinel-output regression test.
- A `STITCH_API_KEY` value appeared in an earlier Firebase CLI debug environment dump. It was not found in Git history or a repository log during the scan. The owner must manually revoke/delete that key and create a replacement in Stitch Settings, then update the secure local secret and reconnect. No rotation was performed. Provider guidance: [Google AI Developers Forum](https://discuss.ai.google.dev/t/stitch-api-keys-disappeared-and-unable-to-recreate/143076).
- Before frontend release, deploy the updated tombstone- and Coach Chat-capable rules to the intended project (`firebase deploy --only firestore:rules --project <project-id>`), configure/verify reCAPTCHA Enterprise App Check in Firebase Console, and only then consider enforcement for Authentication and Cloud Firestore after reviewing metrics. Firebase AI Logic was provisioned for the configured project, and the Firestore database edition was inspected; no rules or application deployment was performed. App Check Console settings remain unverified. See [App Check setup](https://firebase.google.com/docs/app-check/web/recaptcha-provider?hl=en), [enforcement](https://firebase.google.com/docs/app-check/enable-enforcement?hl=en), and [rules deployment](https://firebase.google.com/docs/rules/manage-deploy).
- Browser/Auth, live App Check, Gemini provider, account deletion, cross-device, file export/import, accessibility, and mobile acceptance rows are all BLOCKED / NOT RUN in the checklist. These external/manual gates keep the release NOT READY.

### Phase 17 final local validation

| Check | Final result |
|---|---|
| `npm run lint` | PASS â€” `tsc --noEmit` |
| `npm test` | PASS â€” all configured suites, including 2 emulator runner regressions |
| `npm run test:firestore-emulator` | PASS â€” after clearing an identified orphan emulator JVM from port 8080; demo project only |
| `npm run build` | PASS â€” main 1,055.68 kB / 284.95 kB gzip; Three.js 753.49 kB / 192.67 kB gzip; Gemini 443.45 kB / 81.15 kB gzip; Vite large-chunk warning remains |
| `npm run analyze:bundle` | PASS â€” main rendered module stat 1,055,293 bytes; Onboarding 43,203; AI assistant 22,608; App Check 26,682 |
| `npm audit --omit=dev` | PASS â€” 0 vulnerabilities |
| `npm audit` | PASS WITH LIMITATIONS â€” 4 high dev-toolchain findings; no safe patched version found; forced proposal downgrades Vite |
| `git diff --check` | PASS â€” no whitespace errors; Git reports LF-to-CRLF notices |
| Credential-pattern scan | PASS â€” no matching files in available Git history/current tree; exposed Stitch key still requires manual rotation |

### Firebase AI Logic Coach Chat verification

**Assessment date:** 2026-11-18

| Check | Result |
|---|---|
| `npm run lint` | PASS |
| `npm test` | PASS, including Coach Chat rule-model and account-deletion coverage |
| `npm run test:firestore-emulator` | PASS on an available local port; owner-only, bounded, immutable Coach Chat messages verified |
| `npm run build` | PASS; Vite large-chunk warning remains |
| Live AI response / production App Check | NOT RUN; Console registration and site-key configuration remain external release gates |

The Firestore Emulator's negative assertions intentionally emit permission-denied logs. The emulator runner shut down successfully. A zero-byte emulator debug log was removed.
