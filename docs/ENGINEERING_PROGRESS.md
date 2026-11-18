# Daily OS Engineering Progress

## Phase 9.1 â€” Data integrity remediation

**Status: PASS WITH LIMITATIONS**

- Account deletion now creates an immutable `/accountDeletionTombstones/{uid}` record before cleanup. Firestore rules reject user writes while it exists, including stale writes from other devices.
- Deletion removes the profile and personal subcollections while preserving the tombstone. Cleanup remains retryable; Firebase Authentication deletion is last and still depends on a valid recent-login session.
- Legacy profile deletion markers remain a compatibility deny condition.
- Cache-only and remotely deleted days enter explicit recovery state. Pending edits are preserved; they are not automatically uploaded after a missing cloud document.
- Conflict choices re-read authoritative cloud state. Cross-tab notifications and IndexedDB claims coordinate queue observation and processing.
- Legacy whole-document day writes without a matching sync-state commit are rejected by rules.

**Verification:** `npm run lint`, `npm test`, `npm run build`, `npm run test:firestore-emulator`, and `git diff --check` passed. The emulator uses the `demo-daily-os` demo project and verifies rules behavior, including tombstone persistence after profile deletion. Unit and emulator tests are separate categories; no real multi-device or production Firebase deletion was run.

**Limitations:** The new tombstone rules must be deployed before releasing the client that creates tombstones. Firebase Authentication deletion and reauthentication need manual verification in a configured Firebase project. The current app entry and optional Three.js chunk remain above the 500 kB warning threshold.

## Phase 10 - Backup, restore and account lifecycle correctness

**Status: PASS WITH LIMITATIONS**

- Existing behavior reviewed: plaintext JSON exports day history and user settings; it excludes raw onboarding answers and API credentials. The UI identifies the backup as unencrypted and documents these exclusions.
- Guest Replace replaces the guest day-history scope. Authenticated Replace is disabled because safe cross-device deletion cannot be guaranteed. Merge resolves matching records by timestamp (imported values win ties) and preserves unmentioned records/settings.
- Backup import is validated before application and bounded to 5 MiB / 1,000 day records. Settings persistence can fail after day records have already been applied; the UI reports this as a partial import.
- Account deletion now also removes profile data while a separate tombstone remains. Live Firebase Auth behavior cannot be verified in the demo emulator.

**Decision:** Keep backups plaintext and label them clearly. Do not claim authenticated Replace for cloud accounts until cross-device deletion can be coordinated. Partial persistence failures are surfaced with their scope so the user is not told that the entire import failed or succeeded silently.

## Phase 11 - Firestore security and integration testing

**Status: PASS WITH LIMITATIONS**

- Firestore rules use deny-by-default ownership paths, validate bounded day/settings/onboarding shapes, require a same-commit sync-state marker for day writes, and check the permanent deletion tombstone.
- Emulator tests verify owner settings/day access, unauthenticated and cross-user denials, invalid settings, unknown collection denial, field-level transactional writes, older whole-document write rejection, and tombstone behavior.
- `tests/firestore.rules.test.ts` is a mock-based rules-contract suite; it is reported separately from the actual Firestore Emulator suite.
- `.env` is ignored and is not tracked. `.env.example` is tracked as a placeholder template. The inspected frontend/config/docs contain no service-account private-key markers.
- The emulator command now runs through `scripts/run-firestore-emulator.mjs`, which removes debug flags and secret-like variables from the CLI/test child environment. `tests/emulator-runner.test.mjs` verifies filtering. The emulator rerun passed without the verbose environment dump.

**Limitations:** No live Firebase project or deployed production rules were inspected. Firestore Emulator logs expression-limit denials on intentionally rejected malformed/legacy writes; normal sync cases pass. An earlier verbose CLI run exposed the `STITCH_API_KEY` environment value in tool output. The emulator runner now strips debug switches and secret-like environment variables before launch, with a regression test. Rotate that key in its owning provider; no credential rotation was performed here.

## Phase 12 - Cross-device and offline synchronization

**Status: PASS WITH LIMITATIONS**

- Two independent authenticated Firestore clients in the Emulator cover concurrent independent-field changes, same-field conflicts, stale queued updates after remote deletion, and writes rejected after account deletion starts.
- IndexedDB tests cover persistence after close/reopen, UID queue isolation, atomic enqueue, claims that prevent duplicate processing, and mocked independent-tab notifications.
- The app worker is scoped to the captured UID and checks an active flag before processing/committing UI updates.

**Limitations:** No real Auth switching, browser network interruption, or physical multi-device run was performed. The startup history loader requests all pages, 180 records per page; the total history is currently unbounded.

## Phase 13 - Feature completeness and product integrity

**Status: PASS WITH LIMITATIONS**

- Added [FEATURE_INVENTORY.md](FEATURE_INVENTORY.md) with implementation, navigation, persistence, and verification coverage for dashboard/planning, goals/trackers, routines, workspaces, insights/history, settings, onboarding, AI, backup, authentication, and guest mode.
- Disabled modules are filtered through configuration and do not delete day history.
- Desktop and mobile navigation share module-aware destinations. Insights receives all records loaded by the history service.

**Limitations:** No browser automation or responsive/accessibility audit was available. Long histories are fully downloaded in pages and have no total cap or user-driven pagination; address this if data volume becomes substantial.

## Phase 14 - AI customization and requirements architecture

**Status: PASS WITH LIMITATIONS**

- AI JSON from briefing, reflection, DSA hints, quick logging, onboarding system generation, requirements interpretation, and routine customization is bounded and checked against explicit allowed fields before it can affect persisted data.
- Quick-log output uses a discriminated union rather than `any`; unsupported types fall back to the original user text instead of accepting arbitrary AI data.
- Significant system changes remain a reviewable proposal, stale proposals are rejected, and confirmed onboarding requirements are checked against the original answers before persistence.
- AI SDK loading and request timeouts are deferred to the provider call. The UI and security docs state that request context is sent to Google and user-entered keys remain in browser storage.

**Limitations:** Gemini responses were tested through parser/unit tests, not a live provider. User-entered API keys remain plaintext in browser local storage; `VITE_GEMINI_API_KEY` is client-visible in a built app and must be restricted by the provider.

## Phase 15 - Performance, maintainability and cleanup

**Status: PASS WITH LIMITATIONS**

- Track, Insights, and Settings views are lazy-loaded. Three.js is dynamically imported only when the animated background is used. Gemini's SDK is loaded only on an AI request.
- Production build output changed from one 2.16 MB entry chunk to split chunks: 1.14 MB app entry, 753 kB optional Three.js, 444 kB Gemini SDK, plus smaller route chunks. The main entry gzip is 305 kB. These are measured build outputs.
- The largest-chunk warning remains because the app entry and Three.js chunk exceed 500 kB. The Three.js effect is optional; the app entry remains under review for further justified splitting.
- The full-history loader still fetches all pages for Insights, so memory and reads grow with account history. No physical-device performance or accessibility audit was run.

## Phase 16 - Final production acceptance

**Status: PASS WITH LIMITATIONS**

- [PRODUCTION_ACCEPTANCE.md](PRODUCTION_ACCEPTANCE.md) records architecture, security/configuration review, acceptance classifications, exact final validation results, and the manual release checklist.
- Final local validation passed: `npm run lint`, `npm test` (including emulator environment-filter regression test), `npm run test:firestore-emulator`, `npm run build`, `npm audit --omit=dev`, and `git diff --check`.
- Production dependency audit reports 0 vulnerabilities. Full `npm audit` reports four high findings in development tooling through Vite/fdir/tinyglobby/picomatch; the available fix requires a breaking Vite change.
- Bundle sizes are 1.14 MB app entry (305 kB gzip), 753 kB Three.js (192.67 kB gzip), and 444 kB Gemini SDK (81.16 kB gzip), plus smaller route chunks. Build warning remains for the app entry and Three.js.
- **Release decision: NOT READY.** Live Google Auth, deployed Firestore/tombstone rules, App Check enforcement, account deletion/recent-login, Gemini behavior, and browser/device acceptance remain unverified. Full-history loading remains unbounded.

## Phase 17 â€” Release readiness closeout

**Status: PASS WITH LIMITATIONS locally; release NOT READY.** See [PHASE_17_RELEASE_READINESS.md](PHASE_17_RELEASE_READINESS.md).

- Initial history is bounded to 180 records with explicit older-page and completeness controls; backup export and merge import intentionally load complete history.
- Onboarding/AI UI and configured App Check are deferred. AI errors are sanitized; deletion errors are stage-aware/retryable; emulator runner filters secrets/debug values and has sentinel regression coverage.
- Remaining gates: manually rotate the exposed Stitch key, configure/verify App Check, deploy tombstone-capable Firestore rules before client release, and complete the browser checklist. No deployment or credential rotation occurred.
- Final local checks and bundle evidence are recorded in the Phase 17 report. Full audit retains four high findings in dev dependencies; production-only audit is clean. Main and Three.js chunks retain build warnings.


### Phase 17 correction to earlier performance notes

The unbounded-history statements above describe Phase 16. They are superseded by Phase 17: normal Insights startup now reads a bounded page of 180 records, with explicit older-page loading; complete scans remain only for export and merge import. Current measurements and limits are in [PHASE_17_RELEASE_READINESS.md](PHASE_17_RELEASE_READINESS.md).
