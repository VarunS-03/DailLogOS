# Daily OS Browser Acceptance Checklist

**Manual status:** All rows are **BLOCKED / NOT RUN** in this Phase 17 review. No live Firebase project or browser/device acceptance run was available. Do not mark a row PASS without executing it and recording evidence.

For each test, fill in the date, browser/device, Firebase project/environment, actual result, status, and evidence. Use a non-production test account for account deletion and never use real user data.

| ID | Test and steps | Expected result | Date | Browser/device | Firebase project/environment | Actual result | PASS / FAIL / BLOCKED | Evidence or notes |
|---|---|---|---|---|---|---|---|---|
| AUTH-01 | First-time Google sign-in. Sign in with a test account. | Auth resolves to the stable UID and account initialization completes. | | | | | BLOCKED | |
| AUTH-02 | Returning user. Sign out, sign in again, refresh. | Settings and account data restore; completed onboarding does not restart. | | | | | BLOCKED | |
| AUTH-03 | Account switching. Switch between two test accounts. | Each account sees only its UID-scoped records and settings. | | | | | BLOCKED | |
| AUTH-04 | Guest mode. Use the app signed out, reload, then sign in. | Guest data persists locally and does not appear in the authenticated account unless explicitly imported. | | | | | BLOCKED | |
| AUTH-05 | Cross-account cache isolation. Alternate accounts in the same browser. | No cached day, settings, or onboarding data crosses account boundaries. | | | | | BLOCKED | |
| ONBOARD-01 | New user. Complete each onboarding step and confirm the generated configuration. | Drafts persist and completion occurs only after confirmed requirements/configuration are saved. | | | | | BLOCKED | |
| ONBOARD-02 | Interrupted onboarding. Stop midway, reload, and resume. | The account resumes at its saved stage with answers intact. | | | | | BLOCKED | |
| ONBOARD-03 | Cross-browser onboarding. Resume the same incomplete account in a second browser. | Saved answers and stage restore without overwriting newer edits. | | | | | BLOCKED | |
| ONBOARD-04 | Legacy account. Sign into an account with existing profile/settings/day records and no onboarding document. | It is recognized as an existing completed account; onboarding does not repeat. | | | | | BLOCKED | |
| SYNC-01 | Offline edit. Disconnect network, edit a saved day, close the tab. | Edit is persisted to the UID-scoped outbox before sync and remains pending. | | | | | BLOCKED | |
| SYNC-02 | Offline reload. Keep network disconnected and reload. | Cached data and pending edits remain visible; history is labeled incomplete/cache-backed. | | | | | BLOCKED | |
| SYNC-03 | Reconnect. Restore network after an offline edit. | Outbox retries and acknowledged operations clear; errors remain recoverable. | | | | | BLOCKED | |
| SYNC-04 | Two sessions, independent fields. Edit study on one session and workout on another. | Both field changes converge without losing either value. | | | | | BLOCKED | |
| SYNC-05 | Two sessions, same field. Change the same field differently. | The conflict is visible and requires an explicit resolution. | | | | | BLOCKED | |
| SYNC-06 | Remote deletion with pending local edit. Delete a day remotely while another session has a queued change. | The local edit enters recovery and does not recreate the remote day automatically. | | | | | BLOCKED | |
| SYNC-07 | Account switch with queued work. Leave pending edits, switch accounts, then return. | Operations remain UID-isolated and are processed only for their owner. | | | | | BLOCKED | |
| HISTORY-01 | Long history. Open Insights, load multiple pages, and compare page boundaries. | Newest-first order is stable; no date is duplicated or skipped; each click loads a bounded page. | | | | | BLOCKED | |
| HISTORY-02 | Cached history failure. Go offline during a history page request. | Cached records remain visible, coverage says incomplete, and retry can fetch cloud history after reconnect. | | | | | BLOCKED | |
| HISTORY-03 | Insights coverage. Inspect trends before and after loading all history. | Partial history is labeled as loaded-only; complete is shown only after the final page; trends are described with the right scope. | | | | | BLOCKED | |
| BACKUP-01 | Export. Export after only one Insights page is loaded. | Backup explicitly fetches complete history and reports the complete record count; file remains labeled plaintext. | | | | | BLOCKED | |
| BACKUP-02 | Merge import. Import matching and unmentioned dates/settings. | Matching records use the documented timestamp rule; unmentioned history/settings remain. | | | | | BLOCKED | |
| BACKUP-03 | Guest Replace. Replace guest history from a valid backup. | Guest history is replaced by the backup scope, with no stale guest cache records left behind. | | | | | BLOCKED | |
| BACKUP-04 | Malformed backup. Import invalid JSON and invalid record shapes. | Validation rejects the file before persistence and leaves existing data unchanged. | | | | | BLOCKED | |
| BACKUP-05 | Oversized backup. Import a file above 5 MiB. | It is rejected before parsing or persistence with a clear error. | | | | | BLOCKED | |
| BACKUP-06 | Unsupported fields. Import extra root/day/settings properties. | Import rejects unknown structure instead of silently dropping it. | | | | | BLOCKED | |
| BACKUP-07 | Partial settings failure. In a safe test environment, let day writes succeed and settings persistence fail. | UI clearly reports which days were applied and that settings were not; no full-success message appears. | | | | | BLOCKED | |
| DELETE-01 | Test-account deletion. Begin deletion and inspect server state. | Tombstone is created first and subsequent owner writes are denied. | | | | | BLOCKED | |
| DELETE-02 | Firestore cleanup. Continue deletion for the test account. | Days, sync state, settings, onboarding, and profile are removed; tombstone remains. | | | | | BLOCKED | |
| DELETE-03 | Recent login. Complete Auth deletion after reauthentication. | Firebase Authentication account is deleted last; UI reports success only after it completes. | | | | | BLOCKED | |
| DELETE-04 | Cleanup interruption. In a disposable test project, interrupt cleanup and resume. | Account remains tombstoned and retry resumes idempotently without restarting normal sync. | | | | | BLOCKED | |
| DELETE-05 | Stale device. Keep a second session/outbox alive through deletion. | Writes from the old session are denied; stale operations cannot recreate data. | | | | | BLOCKED | |
| AI-01 | Restricted test key. Add a dedicated restricted key and run each AI feature. | Requests work only within intended provider restrictions/quotas; no personal key is used. | | | | | BLOCKED | |
| AI-02 | Invalid model response. Exercise malformed/unsupported output using a test harness. | Parser rejects it; no invalid configuration or day update is persisted. | | | | | BLOCKED | |
| AI-03 | Proposal review. Ask for a significant routine/module change. | The proposal is shown for review and changes only after explicit apply. | | | | | BLOCKED | |
| AI-04 | Stale proposal. Change day/settings after a proposal appears, then apply it. | Stale proposal is rejected and current user edits remain intact. | | | | | BLOCKED | |
| AI-05 | Privacy disclosure. Start Gemini onboarding, quick logging, and customization. | The user sees what context is sent to Google before the request path; API keys are not displayed or logged. | | | | | BLOCKED | |
| UI-01 | Desktop layout. Exercise Today, Track, Insights, Settings at supported desktop width. | Navigation and content remain usable with no overflow or obscured controls. | | | | | BLOCKED | |
| UI-02 | Mobile layout. Exercise the same views at supported mobile widths. | Mobile navigation, forms, modals, and history rows remain usable. | | | | | BLOCKED | |
| UI-03 | Keyboard navigation. Navigate dialogs/forms/buttons without a pointer. | Focus is visible, labels are announced, and controls have semantic names. | | | | | BLOCKED | |
| UI-04 | Reduced motion. Enable OS/browser reduced-motion preference. | Background animation is not initialized and transitions remain usable. | | | | | BLOCKED | |
| UI-05 | Initial route. Load Today as a returning user. | The page renders without waiting for unused feature chunks; core account restoration remains correct. | | | | | BLOCKED | |
| UI-06 | Lazy features. Open Insights, Settings, onboarding, and AI assistant individually. | Each deferred chunk loads on demand and the feature behaves as before. | | | | | BLOCKED | |
| UI-07 | Long history. Load many pages and inspect search/trend behavior and memory. | Older history remains retrievable; incomplete coverage is visible; loading does not freeze the interface. | | | | | BLOCKED | |
