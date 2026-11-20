# DAILY OS — MASTER AUTONOMOUS ENGINEERING ROADMAP
## Phases 9.1–16: Reliability, Data Integrity, Security, Feature Completeness and Production Readiness

You are acting as the autonomous senior software engineer responsible for completing the remaining engineering roadmap of Daily OS.

You have permission to independently inspect, plan, implement, test, debug, refactor where necessary, and progress through all phases described below.

**You do not need to request approval between phases.**

However, autonomy does not mean sacrificing reliability. Every phase has acceptance criteria that must be satisfied before proceeding.

Your responsibility is to leave the project in a demonstrably more reliable, maintainable, secure, and complete state than you found it.

---

# PART 1 — OPERATING RULES

## 1.1 Autonomous execution

Follow this execution cycle for every phase:

1. Inspect the existing implementation.
2. Review the relevant architecture and dependencies.
3. Identify existing functionality and known defects.
4. Create a concrete implementation plan.
5. Implement the changes.
6. Run relevant automated tests.
7. Add missing regression tests.
8. Perform an independent code review of your own changes.
9. Fix any issues discovered.
10. Verify the phase acceptance criteria.
11. Record the completed phase in your engineering report.
12. Automatically proceed to the next phase.

Do not stop to request approval after presenting a plan.

Do not ask the user routine implementation questions. Make reasonable engineering decisions based on the existing architecture, project requirements, and established conventions.

If a requirement is ambiguous, prefer the smallest backward-compatible implementation that preserves existing user data.

## 1.2 Mandatory safety boundaries

Autonomous implementation is authorized, but the following actions are NOT authorized:

- Do not deploy to production.
- Do not push changes to remote Git repositories.
- Do not delete production Firestore data.
- Do not execute account deletion against real user accounts.
- Do not expose, print, commit, or transmit secrets.
- Do not replace Firebase projects or credentials.
- Do not remove existing functionality merely to simplify implementation.
- Do not overwrite unrelated user modifications.
- Do not discard existing uncommitted work.
- Do not run destructive migrations against real user data.
- Do not silently change the meaning of existing user records.

You may modify source code, tests, local development configuration, dependencies, documentation, and emulator configuration when necessary.

Do not commit automatically. Leave changes in the working tree for human review.

If a change would require production data migration, external service configuration, credentials, or an irreversible operation, implement the safe code-side preparation and document the remaining manual requirement.

## 1.3 Preserve the existing architecture

Daily OS is an existing application, not a blank-slate project.

Do not perform a wholesale rewrite.

Before replacing any service, component, data structure, or persistence mechanism:

- Understand why it exists.
- Identify its callers.
- Identify its stored-data dependencies.
- Identify its tests.
- Determine whether a smaller modification is sufficient.

Prefer incremental changes.

Maintain backward compatibility wherever reasonably possible.

Do not introduce unnecessary frameworks, databases, services, or architectural abstractions.

## 1.4 Existing project assumptions

The application is a React + TypeScript + Vite application.

It uses:

- Firebase Authentication.
- Google OAuth.
- Cloud Firestore.
- Local persistence and caching.
- Gemini AI integration.
- A centralized application state in App.tsx.
- DayRecord and UserSettings data models.
- An onboarding pipeline.
- A configurable personal planning system.

Relevant existing files include, but are not limited to:

- src/App.tsx
- src/firebase.ts
- src/types.ts
- src/services/dayOutbox.ts
- src/services/daySync.ts
- src/services/ai.ts
- src/services/appCustomization.ts
- src/services/onboardingPipeline.ts
- src/services/behavioral.ts
- src/utils/dayRecord.ts
- src/utils/backupValidation.ts
- src/constants/templates.ts
- src/components/SettingsView.tsx

Inspect the current repository. Do not assume that these files or their implementation are unchanged.

---

# PART 2 — CURRENT ENGINEERING STATE

Phase 9 implemented a durable day synchronization system.

The implementation reportedly includes:

- UID-scoped IndexedDB outbox.
- Persist-before-sync behavior.
- Firestore transaction-based updates.
- Revision tracking.
- Independent field merging.
- Same-field conflict detection.
- Conflict preservation.
- Snapshot reconciliation.
- Retry handling.
- Authentication-scoped synchronization.
- Sync status and retry UI.
- Firestore Emulator tests.

An independent review assessed Phase 9 as PASS WITH CONCERNS.

The following defects remain important:

### H-05: Account deletion can resurrect records

Pending operations can survive incomplete deletion and recreate previously deleted day records.

Other authenticated devices may also retain queued operations.

### H-06: Legacy cache recovery can resurrect deleted records

The application can mistake a stale cached record with no matching Firestore document for a new unsynchronized record.

Remote deletion events are not adequately represented in local state.

### Additional concerns

- Conflict resolution may use an outdated conflict-time cloud snapshot.
- Outbox notifications do not adequately coordinate multiple browser tabs.
- Actual Firebase Auth switching and worker cancellation have not been comprehensively tested.
- Browser restart and IndexedDB recovery need stronger validation.
- Older clients using whole-document writes may undermine the new synchronization model.
- Backup Replace semantics need clarification and correction.
- Account deletion must correctly handle Firebase Authentication, not just Firestore.

Treat these as known issues to investigate, not assumptions that the existing implementation has exactly the same defects today.

---

# PART 3 — PHASE 9.1
# DATA INTEGRITY REMEDIATION

This phase is mandatory and must be completed before Phase 10.

## Objective

Eliminate the possibility of deleted day records being silently recreated by stale caches, pending outbox operations, other devices, or incomplete account deletion.

Preserve the existing outbox and transaction architecture wherever possible.

## 9.1.1 Account deletion safety

Inspect the entire account deletion lifecycle.

Implement a safe deletion state machine.

The design should distinguish states such as:

- Active.
- Deletion pending.
- Deletion in progress.
- Deletion completed.
- Deletion failed and awaiting safe recovery.

Use a server-authoritative mechanism to ensure that once deletion is initiated, stale clients cannot continue writing day records.

Consider a durable account deletion tombstone or equivalent server-side state.

Requirements:

1. Stop accepting new day writes once deletion begins.
2. Stop the normal synchronization worker.
3. Prevent pending operations from being processed during deletion.
4. Prevent other authenticated devices from recreating deleted records.
5. Ensure Firestore security rules enforce the deletion restriction.
6. Do not restart the normal sync worker after partial deletion failure.
7. Make deletion resumable and idempotent.
8. Purge the relevant local outbox only when the deletion workflow has reached the appropriate safe stage.
9. Prevent a failed cleanup from silently returning the account to normal operation.
10. Handle Firebase Authentication account deletion correctly.

Important:

Do not rely exclusively on deleting the current device's IndexedDB queue. Other devices may have their own queues.

Do not assume that signing out one device disables every other device.

If a server-side tombstone is necessary, design it so that removing personal data does not remove the protection against stale clients.

Do not execute actual production deletion operations.

## 9.1.2 Prevent stale cache resurrection

Investigate how the application currently distinguishes:

- Never-synchronized local records.
- Previously synchronized records.
- Records intentionally deleted remotely.
- Records temporarily missing due to connectivity or incomplete loading.

Implement an explicit and reliable distinction.

Potential mechanisms include:

- Sync metadata.
- Known-synced markers.
- Tombstones.
- Server-side deletion metadata.
- Versioned synchronization state.

Choose the smallest robust approach.

Requirements:

1. Never automatically create a cloud document merely because a local cached record exists without a matching cloud document.
2. Preserve legitimate unsynchronized local records.
3. Recognize previously synchronized records that have been remotely deleted.
4. Prevent stale local copies from recreating deleted records.
5. Ensure the behavior survives application restart.
6. Preserve compatibility with legacy DayRecord documents.
7. Avoid silently discarding user-created offline data.

When an ambiguous cache record is encountered, prefer preserving it locally and marking it for recovery or review rather than automatically uploading it.

## 9.1.3 Remote deletion handling

Inspect Firestore listeners and history-loading logic.

Requirements:

- Handle document deletion events.
- Update the local cache appropriately.
- Prevent stale selected-day state from remaining authoritative.
- Preserve deletion metadata when needed.
- Ensure history views do not resurrect deleted records.
- Ensure pending local edits against a deleted remote record are handled explicitly.

Do not treat every missing document as a deletion if the application has not completed a trustworthy server read.

## 9.1.4 Conflict resolution

Improve conflict resolution.

For "Use cloud version":

- Obtain the latest authoritative cloud state.
- Do not blindly restore a potentially outdated conflict-time snapshot.
- Handle the possibility that the cloud document has changed again.
- Ensure the local cache and UI converge on the latest accepted state.

For "Keep my edits":

- Revalidate against the latest cloud state.
- Preserve the user's intended values.
- Do not silently overwrite unrelated fields.
- Requeue the operation safely.

Persist unresolved conflicts across application restarts.

Add tests for both choices.

## 9.1.5 Cross-tab coordination

Inspect the outbox notification mechanism.

Implement suitable cross-tab coordination, using an appropriate mechanism such as BroadcastChannel or another lightweight solution.

Requirements:

- One tab adding an operation should notify other tabs.
- Other tabs should refresh their sync status.
- Avoid duplicate processing.
- Avoid race conditions between tabs.
- Handle unsupported browser APIs gracefully.
- Do not compromise IndexedDB durability.

## 9.1.6 Mixed-version client protection

Review Firestore security rules and legacy client compatibility.

Determine how older application versions performing whole-document writes could undermine transaction-based updates.

Implement a safe versioning or migration strategy.

Do not accidentally lock out valid users without a documented migration path.

## 9.1.7 Required tests

Add tests covering:

1. Account deletion with pending outbox operations.
2. Partial deletion failure.
3. Outbox cleanup failure.
4. Stale operation attempted after deletion begins.
5. Other-device operation attempted after deletion.
6. Restart during deletion.
7. Cache-only record that was never synchronized.
8. Previously synchronized record deleted remotely.
9. Remote deletion followed by application restart.
10. Remote deletion while local edits are pending.
11. Conflict resolution using the latest cloud state.
12. Keep-local conflict resolution.
13. Use-cloud conflict resolution.
14. Multiple tabs observing a new outbox operation.
15. Legacy record migration and recovery.
16. Older-client write protection.

Use Firestore Emulator tests where applicable.

Use realistic mocks for browser and IndexedDB-specific behavior.

Do not claim a multi-device test passed if it only uses a mocked function.

## Phase 9.1 acceptance criteria

Do not proceed until:

- Deleted records cannot be silently recreated by pending operations.
- Stale caches cannot silently recreate remotely deleted records.
- Account deletion cannot restart normal synchronization while deletion is incomplete.
- Other-device stale operations are rejected by authoritative server-side protection.
- Conflict resolution uses current cloud state.
- Regression tests cover the identified defects.
- TypeScript checks pass.
- Lint passes.
- Unit tests pass.
- Emulator tests pass.
- Production build succeeds.
- git diff --check passes.

Document any limitation that cannot be completely verified without a real Firebase project or multiple physical devices.

---

# PART 4 — PHASE 10
# BACKUP, RESTORE AND ACCOUNT LIFECYCLE CORRECTNESS

Begin only after Phase 9.1 acceptance criteria pass.

## Objective

Make backup, restore, import, export, and account deletion truthful, safe, and reliable.

## 10.1 Backup correctness

Inspect all backup and export functionality.

Determine exactly what is included:

- User settings.
- Goals.
- Trackers.
- Routines.
- Day records.
- Historical records.
- Custom configuration.
- Onboarding information.
- AI preferences.
- Relevant schema/version metadata.

Ensure the backup accurately represents the user's recoverable application state.

If some information is intentionally excluded, clearly document it.

## 10.2 Security and encryption claims

The existing audit found that JSON backups were plaintext despite UI/documentation implications of encryption.

Resolve this discrepancy.

Choose one of two approaches:

A. Implement actual encryption using a well-understood browser-compatible cryptographic mechanism, with appropriate key derivation and authenticated encryption.

OR

B. If encryption is not implemented, clearly label the backup as unencrypted and remove misleading security claims.

Do not invent encryption guarantees.

If implementing encryption:

- Use established Web Crypto APIs.
- Never hardcode encryption keys.
- Never store the user's backup password in plaintext.
- Validate incorrect passwords.
- Detect corrupted or tampered backup files.
- Document the limitations of client-side encryption.

## 10.3 Import validation

Inspect backupValidation.ts and every import path.

Requirements:

- Validate the file format.
- Validate schema versions.
- Reject malformed data.
- Handle missing optional fields.
- Prevent invalid dates.
- Prevent invalid numeric values.
- Prevent unexpected object structures.
- Prevent excessively large or malformed inputs from crashing the app.
- Provide meaningful error messages.
- Avoid partially applying invalid imports.

Do not trust imported TypeScript-shaped JSON simply because it resembles a DayRecord.

## 10.4 Merge and Replace semantics

Implement clear, correct import modes.

Merge:
- Preserve existing records not included in the backup.
- Update matching records according to a documented policy.
- Preserve unrelated user settings.
- Avoid duplicate data.

Replace:
- Replace the intended imported scope completely.
- Correctly handle records omitted from the backup.
- Handle deletion semantics safely.
- Ensure the outbox and Firestore remain consistent.
- Avoid resurrecting records through stale queues.

Do not interpret Replace as Merge.

If the current architecture cannot safely implement complete replacement, report and implement the safest clearly defined alternative rather than pretending replacement succeeded.

## 10.5 Account deletion

Verify the complete account deletion workflow:

- Firestore user data.
- Day documents.
- Settings.
- Outbox.
- Local caches.
- Firebase Authentication account.
- Relevant metadata.
- Other application-owned persisted data.

Deletion must be idempotent and safe after interruption.

Authentication reauthorization requirements should be handled appropriately.

Do not claim that an account was deleted when only its Firestore documents were removed.

## Phase 10 acceptance criteria

- Exported backups are complete according to documented scope.
- Backup security claims are accurate.
- Invalid imports are rejected safely.
- Merge and Replace behave distinctly.
- Failed imports do not partially corrupt state.
- Account deletion correctly addresses Firebase Authentication and Firestore.
- Phase 9.1 deletion protections remain intact.
- Tests, lint, typecheck, build, and diff checks pass.

---

# PART 5 — PHASE 11
# FIRESTORE SECURITY AND INTEGRATION TESTING

## Objective

Establish meaningful automated verification of application security and cloud persistence.

## 11.1 Firestore security rules

Inspect firestore.rules.

Verify:

- Users can only access their own data.
- Cross-user reads are denied.
- Cross-user writes are denied.
- Unauthorized collection access is denied.
- Account deletion state is enforced.
- Invalid document structures are rejected where practical.
- Revision and synchronization fields cannot be manipulated unsafely.
- Legacy compatibility does not weaken the new synchronization guarantees.
- Settings writes are appropriately restricted.
- Day-document writes follow the synchronization architecture.

Apply least privilege.

Do not simply allow all authenticated users to read and write arbitrary paths.

## 11.2 Emulator testing

Ensure actual Firestore Emulator tests exist and are correctly configured.

Tests must distinguish:

- Unit tests.
- Mock-based integration tests.
- Firestore Emulator integration tests.
- Manual browser tests.
- Real multi-device tests.

Never label a mocked test as an emulator test.

Test at minimum:

1. User isolation.
2. Unauthorized reads.
3. Unauthorized writes.
4. Day creation.
5. Day update.
6. Transaction retries.
7. Revision conflicts.
8. Same-field conflicts.
9. Independent-field updates.
10. Legacy documents.
11. Account deletion state.
12. Stale-client writes.
13. Settings access.
14. Invalid payloads.
15. Recovery after interrupted operations.

## 11.3 Rules coverage

Ensure that important security rules are exercised by both allowed and denied test cases.

A passing test suite must not merely demonstrate that legitimate operations work.

It must also demonstrate that unauthorized operations fail.

## 11.4 Configuration safety

Inspect Firebase configuration.

- No service account credentials in frontend code.
- No private keys in repository files.
- Environment variables handled correctly.
- Local emulator configuration does not accidentally target production.
- Production and development environments are distinguishable.
- Secrets are not logged.

## Phase 11 acceptance criteria

- Firestore rules have meaningful positive and negative tests.
- Emulator tests run reproducibly.
- Unauthorized access tests fail as expected.
- No obvious cross-user data leakage path remains.
- No secrets are exposed.
- All existing tests continue to pass.

---

# PART 6 — PHASE 12
# CROSS-DEVICE AND OFFLINE SYNCHRONIZATION

## Objective

Make the application behave predictably when the same user accesses it from different devices and under varying network conditions.

## 12.1 Persistence authority

Establish clear source-of-truth rules.

For authenticated users:

- Firestore is authoritative for accepted account data.
- IndexedDB outbox stores pending local mutations.
- Local cache accelerates loading.
- Cache data must not silently override newer authoritative server state.

For guest users:

- Local persistence is intentional.
- Guest data must remain available across ordinary reloads.
- Authentication transitions must not accidentally merge or destroy guest data.

Document the ownership and lifecycle of each storage layer.

## 12.2 Offline behavior

Verify:

- App starts offline when cached state exists.
- Local edits persist before network transmission.
- Pending changes survive reload.
- Reconnection triggers retry.
- Retry backoff is bounded.
- Permanent errors are distinguishable from transient errors.
- Sync status reflects reality.
- User data remains accessible during network failures.

Avoid infinite retry loops.

## 12.3 Cross-device convergence

Test the following scenarios:

A. Device A creates a record, Device B loads it.

B. Device A updates a field, Device B receives it.

C. Both devices update independent fields.

D. Both devices update the same field.

E. Device A edits offline and reconnects after Device B has changed the record.

F. Device A deletes a record while Device B has a stale cache.

G. User signs out on Device A and signs in on Device B.

H. User signs back into Device A.

I. A pending operation remains when the application is closed.

J. A device reconnects after a long period offline.

For each case, document the expected behavior and test what can be automated.

## 12.4 Authentication lifecycle

Verify:

- Sign-in.
- Sign-out.
- Account switching.
- Token refresh.
- Session restoration.
- Interrupted authentication.
- Network loss during authentication.
- Pending writes belonging to a different UID.

A worker must never process one user's queue as another user.

## 12.5 Loading and startup

Review initial loading behavior.

Requirements:

- Do not display false empty states while data is still loading.
- Avoid replacing valid local data with incomplete cloud results.
- Show meaningful sync status.
- Handle missing or unavailable records gracefully.
- Avoid unnecessary repeated full-history downloads.

## Phase 12 acceptance criteria

- Offline edits survive reload.
- Authenticated data remains UID-isolated.
- Cross-device changes converge according to the conflict policy.
- Deleted records remain deleted.
- Sync status is accurate.
- Startup does not silently discard local changes.
- Automated tests cover the important scenarios.

Real multi-device verification should be documented separately if it cannot be automated.

---

# PART 7 — PHASE 13
# FEATURE COMPLETENESS AND PRODUCT INTEGRITY

## Objective

Ensure that Daily OS's existing product promises correspond to actual implemented and usable features.

Do not invent additional features merely to make the application appear more complete.

Inspect the existing implementation, requirements, types, components, and navigation.

## 13.1 Application-wide feature inventory

Create an inventory of:

- Dashboard.
- Daily planning.
- Goals.
- Trackers.
- Routines.
- Historical records.
- Insights.
- Settings.
- Customization.
- Onboarding.
- AI assistant.
- Backup and restore.
- Authentication.
- Guest mode.

For each feature, identify:

- Whether it is implemented.
- Whether it is accessible.
- Whether it persists.
- Whether it is connected to the correct data model.
- Whether it works across sessions.
- Whether it has meaningful empty states.
- Whether it has error handling.
- Whether it is tested.

Identify dead, incomplete, duplicated, and disconnected functionality.

## 13.2 Data-model completeness

Inspect DayRecord, UserSettings, and UserSystemConfiguration.

Verify that every user-facing feature has an appropriate persisted representation.

Do not add duplicate representations of the same concept.

Do not remove historical data when a module is disabled.

A disabled module should not automatically delete its history.

## 13.3 Goals and trackers

Verify:

- Goal creation.
- Goal editing.
- Goal completion.
- Progress tracking.
- Custom goals.
- Tracker creation.
- Tracker configuration.
- Historical tracker values.
- Daily records associated with goals and trackers.
- Persistence and synchronization.

Ensure users can customize the system without requiring code changes.

## 13.4 Dashboard and navigation

Verify:

- Active navigation destinations.
- Widget visibility.
- Empty states.
- Responsive behavior.
- Mobile navigation.
- Desktop navigation.
- Customization persistence.
- Disabled module behavior.

Do not redesign the entire UI.

Improve only areas where functionality is broken, confusing, or incomplete.

## 13.5 Historical data and insights

Ensure historical records are loaded correctly.

Investigate the existing history-loading implementation, especially whether Insights has access to the necessary Firestore history.

Requirements:

- Historical records are not limited to the currently selected date.
- Pagination or bounded loading is used where appropriate.
- Statistics are calculated from valid data.
- Missing days are handled correctly.
- Time zones and date boundaries are consistent.
- Deleted records are not counted.
- Loading and empty states are accurate.

## Phase 13 acceptance criteria

- Every advertised feature has a documented implementation status.
- Important user-facing features are connected to persistent data.
- No major navigation destination is broken or misleading.
- Disabling modules preserves their historical records.
- Insights uses correct historical data.
- No regressions to existing functionality.

---

# PART 8 — PHASE 14
# AI CUSTOMIZATION AND REQUIREMENTS ARCHITECTURE

## Objective

Make Gemini a reliable assistant for configuring the user's personal system without allowing arbitrary code generation or uncontrolled application modifications.

## 14.1 AI architecture

Inspect:

- src/services/ai.ts
- src/services/appCustomization.ts
- src/services/onboardingPipeline.ts
- Relevant onboarding components.
- UserSystemConfiguration.
- Existing AI chat functionality.

Understand the current architecture before modifying it.

## 14.2 Structured requirements

Preserve the distinction between:

1. Raw user responses.
2. Normalized responses.
3. AI interpretation.
4. User-confirmed requirements.
5. Generated configuration proposals.
6. Persisted active configuration.

Do not collapse these into one field or overwrite raw answers with AI-generated interpretations.

## 14.3 Structured AI output

AI should produce validated structured proposals.

It must not generate or execute arbitrary:

- JavaScript.
- TypeScript.
- React components.
- HTML.
- Shell commands.
- Database operations.

Use schema validation and explicit allowed configuration operations.

## 14.4 User approval

Significant configuration changes must be reviewable before application.

Examples:

- Adding or removing modules.
- Changing major dashboard structure.
- Changing tracking behavior.
- Replacing goals or routines.
- Changing important AI behavior preferences.

Small harmless adjustments may be handled according to existing application behavior, but should not silently destroy user customization.

## 14.5 User overrides

Establish clear precedence:

User-confirmed overrides > current active configuration > AI suggestions.

AI must not repeatedly undo user choices.

Disabling a module must not delete its historical records.

## 14.6 AI reliability

Implement:

- Schema validation.
- Error handling.
- Invalid response recovery.
- Missing-field handling.
- Appropriate fallbacks.
- Clear user-facing errors.
- Request limits where practical.
- Safe handling of API key absence.
- No accidental API key logging.
- No silent configuration replacement.

Never claim an AI operation succeeded if its proposed changes failed validation or persistence.

## 14.7 Gemini cost and privacy

Inspect how API keys are stored and used.

Do not introduce unnecessary backend costs or subscriptions.

Avoid sending unnecessary personal data to Gemini.

Clearly distinguish locally stored information from information transmitted to the AI provider.

## Phase 14 acceptance criteria

- AI output is structured and validated.
- AI cannot execute arbitrary application code.
- Raw onboarding responses remain intact.
- User-confirmed configuration is preserved.
- Significant changes are reviewable.
- AI failures do not corrupt configuration.
- API key handling is safe.
- Existing AI functionality continues to work.

---

# PART 9 — PHASE 15
# PERFORMANCE, MAINTAINABILITY AND CLEANUP

## Objective

Improve maintainability and performance without destabilizing the application.

This is not permission for a broad refactor.

## 15.1 Performance

Investigate:

- Large JavaScript bundle warnings.
- Unnecessary React renders.
- Expensive dashboard calculations.
- Large historical record loads.
- Repeated Firestore reads.
- Excessive snapshot listeners.
- Unnecessary AI requests.
- Large localStorage payloads.
- IndexedDB inefficiencies.

Apply only measurable, justified improvements.

Consider lazy loading for substantial views and code splitting where appropriate.

Do not introduce complexity solely to eliminate a build warning.

## 15.2 State management

Inspect App.tsx and the existing state architecture.

Identify:

- Excessive duplicated state.
- State synchronization problems.
- Unnecessary effects.
- Stale closures.
- Race conditions.
- Repeated persistence logic.
- Components with too many responsibilities.

Extract small services or hooks only when they clearly improve reliability or maintainability.

Do not replace the entire state management architecture.

## 15.3 Type safety

Improve TypeScript safety.

Avoid:

- Unnecessary any.
- Unsafe type assertions.
- Suppressed compiler errors.
- Unvalidated external data.
- Inconsistent nullable values.

Ensure external data from Firestore, IndexedDB, JSON imports, and Gemini is validated at appropriate boundaries.

## 15.4 Error handling

Review error handling across the application.

Users should receive meaningful feedback without exposing technical internals or sensitive information.

Developer logs should remain useful but must not leak API keys, tokens, or personal data.

## 15.5 Dead code and dependencies

Identify:

- Unused components.
- Unused utilities.
- Unused dependencies.
- Duplicate implementations.
- Unreachable navigation paths.
- Unmounted features.
- Outdated documentation.

Remove only when you have established that the code is genuinely unused and its removal is safe.

## 15.6 Accessibility and responsive behavior

Check:

- Keyboard navigation.
- Form labels.
- Button semantics.
- Focus visibility.
- Color contrast.
- Mobile layout.
- Overflow.
- Empty states.
- Loading indicators.
- Error messages.

Do not perform an unnecessary visual redesign.

## Phase 15 acceptance criteria

- No important performance regression.
- No major TypeScript safety issues introduced.
- No unnecessary architectural rewrite.
- No accidental removal of active functionality.
- Build warning addressed or documented with justification.
- Accessibility and responsive issues improved.
- All tests continue to pass.

---

# PART 10 — PHASE 16
# FINAL PRODUCTION ACCEPTANCE

## Objective

Perform a complete engineering acceptance review of Daily OS.

Do not add new features in this phase unless required to correct a production-blocking defect.

## 16.1 Full-system audit

Review:

- Authentication.
- Onboarding.
- User data ownership.
- Day records.
- Settings.
- Goals.
- Trackers.
- Routines.
- Historical data.
- Firestore persistence.
- IndexedDB outbox.
- Offline behavior.
- Cross-device synchronization.
- Conflict resolution.
- Account deletion.
- Backup and restore.
- AI customization.
- Security rules.
- Error handling.
- Responsive UI.

## 16.2 Full validation

Run all applicable checks:

- TypeScript.
- Lint.
- Unit tests.
- Integration tests.
- Firestore Emulator tests.
- Production build.
- Dependency/security checks where available.
- git diff --check.

Inspect the final Git diff.

Verify that no unrelated changes were introduced.

Verify that no secrets, debug files, temporary artifacts, or accidental generated files were added.

## 16.3 Production-readiness classification

Classify the project honestly.

Use these categories:

### READY
The requirement is implemented and sufficiently verified.

### READY WITH LIMITATIONS
The implementation is sound, but a clearly identified external or manual verification step remains.

### NOT READY
A defect or missing requirement prevents safe release.

### NOT VERIFIED
The required evidence is unavailable.

Never mark a feature READY merely because its code exists.

## 16.4 Manual verification checklist

Create a concise manual test plan for the developer.

Include:

- Google sign-in.
- New-user onboarding.
- Returning-user restoration.
- Interrupted onboarding.
- Account switching.
- Offline edits.
- Reload with pending edits.
- Cross-device synchronization.
- Same-field conflict.
- Independent-field merge.
- Remote deletion.
- Backup export.
- Backup import.
- Merge behavior.
- Replace behavior.
- Account deletion.
- AI configuration.
- Mobile and desktop layouts.

Clearly identify which scenarios were tested automatically and which still require a human.

## 16.5 Final documentation

Create or update a concise engineering document covering:

- Architecture.
- Persistence layers.
- Authentication lifecycle.
- Synchronization flow.
- Conflict resolution policy.
- Deletion lifecycle.
- Backup format and security.
- Firestore rules.
- AI configuration pipeline.
- Environment configuration.
- Test commands.
- Known limitations.
- Production deployment prerequisites.

Avoid creating excessive documentation that duplicates source code.

---

# PART 11 — GLOBAL ENGINEERING QUALITY GATES

These rules apply to every phase.

## A. Never hide failures

If a test fails:

1. Read the failure.
2. Determine whether it is caused by the implementation or environment.
3. Fix the implementation when appropriate.
4. Retry.
5. Document unresolved failures.

Do not remove or weaken tests simply to obtain a green result.

Do not silently skip tests.

Do not report success when a command failed.

## B. Test the behavior, not just the implementation

A test that checks whether a function was called is not sufficient when the requirement is about actual data safety.

Prefer testing observable behavior.

Examples:

- Verify a deleted record does not reappear.
- Verify User B cannot process User A's queue.
- Verify a stale operation is rejected.
- Verify an imported Replace operation really replaces its intended scope.
- Verify conflicting data is preserved across refresh.

## C. Distinguish verification levels

Every test result must be classified as one of:

- Unit test.
- Mock-based integration test.
- Emulator integration test.
- Browser/manual test.
- Real multi-device test.

Do not exaggerate verification.

## D. Protect existing user data

Whenever modifying a persistence path:

- Inspect the old data format.
- Preserve backward compatibility.
- Add migration tests where necessary.
- Avoid destructive defaults.
- Handle missing fields.
- Handle interrupted writes.
- Validate before applying imported data.

## E. Avoid unnecessary dependencies

Before installing a dependency:

- Determine whether an existing library can solve the problem.
- Assess maintenance and security.
- Prefer small, established packages.
- Avoid adding large dependencies for trivial functionality.

## F. Maintain scope discipline

Do not add unrelated features.

Do not redesign the product.

Do not turn Daily OS into a different application.

The priority is reliability, correctness, completeness, and maintainability.

## G. No fake completion

A phase is not complete because implementation code was written.

It is complete only when:

- The implementation exists.
- Relevant tests exist.
- Tests pass.
- The final diff has been reviewed.
- Acceptance criteria are met.
- Remaining limitations are documented.

---

# PART 12 — AUTONOMOUS EXECUTION AND FAILURE POLICY

You are authorized to run Phases 9.1 through 16 sequentially without asking for user approval.

Use this decision policy:

### Case 1: Normal implementation

Proceed independently.

### Case 2: Minor implementation uncertainty

Choose the smallest safe solution, document the decision, and continue.

### Case 3: Test failure

Investigate and fix it before proceeding.

### Case 4: External service unavailable

Complete all safe local implementation and tests possible.

Document the missing external verification. Continue only if the unverified requirement is not a critical safety or data-integrity gate.

### Case 5: Critical unresolved defect

Do not proceed to dependent phases.

Make reasonable attempts to resolve the defect.

If it cannot be safely resolved, stop and provide an accurate report.

### Case 6: Destructive or irreversible operation

Do not execute it against real user data.

Prepare the implementation and a safe verification procedure instead.

### Case 7: Existing unrelated user changes

Preserve them.

Do not reset the repository or overwrite them.

---

# PART 13 — REQUIRED PHASE REPORTING

At the end of every phase, provide a concise report:

## Phase [number] — [name]

**Status:** PASS / PASS WITH LIMITATIONS / BLOCKED

**Implemented:**
- List meaningful changes.

**Files changed:**
- List important files.

**Tests executed:**
- Name the commands and test categories.

**Results:**
- State actual outcomes.

**Issues discovered:**
- List remaining issues.

**Acceptance criteria:**
- Mark each as satisfied, partially satisfied, or unsatisfied.

**Next phase:**
- State whether progression is safe.

Do not ask for approval before proceeding.

Maintain an engineering progress document in the repository, for example:

docs/ENGINEERING_ROADMAP.md

Update it at the end of every completed phase with:

- Phase status.
- Decisions made.
- Files changed.
- Tests run.
- Known limitations.
- Next phase.

Do not overwrite existing documentation without reviewing it first.

---

# PART 14 — FINAL INSTRUCTION

Start with Phase 9.1.

First inspect the current repository state and the actual implementation.

Do not assume that earlier audit findings are still present exactly as described.

Implement Phase 9.1, verify it, and then proceed sequentially through:

- Phase 10: Backup, restore and account lifecycle correctness.
- Phase 11: Firestore security and integration testing.
- Phase 12: Cross-device and offline synchronization.
- Phase 13: Feature completeness and product integrity.
- Phase 14: AI customization and requirements architecture.
- Phase 15: Performance, maintainability and cleanup.
- Phase 16: Final production acceptance.

You have permission to make implementation decisions independently.

You do not need to ask the user for approval between phases.

Do not stop after producing a plan.

Do not merely describe the work.

Actually implement, test, review, and document it.

However, never sacrifice data integrity or security just to finish the roadmap.

If a critical acceptance criterion cannot be satisfied, stop at that phase, explain exactly what remains unresolved, and do not falsely claim that later phases are complete.

**The final objective is not to maximize the number of completed phases. It is to deliver a reliable, secure, maintainable Daily OS application while preserving existing user data and functionality.**
## Phase 17 — Release readiness closeout (2026-11-18)

- Status: local engineering PASS WITH LIMITATIONS; release NOT READY pending external configuration, manual key rotation, and browser acceptance.
- Read [docs/PHASE_17_RELEASE_READINESS.md](PHASE_17_RELEASE_READINESS.md) and [docs/BROWSER_ACCEPTANCE_CHECKLIST.md](BROWSER_ACCEPTANCE_CHECKLIST.md) for details.
- Do not deploy frontend until the tombstone-capable `firestore.rules` are deployed to the intended project and App Check is configured/verified. No deployment or credential rotation was performed.
# Account restore reliability follow-up (2026-11-20)

- Fixed owner-scoped `/users/{uid}/days` collection listing in Firestore rules; date validation remains on direct document reads and writes. The emulator had shown empty day queries were denied because `dateId` is unbound for collection listing.
- Decoupled authenticated dashboard readiness from IndexedDB outbox availability. When the outbox cannot be read, history may use cloud data without recovery/cache writes, sync is shown unavailable, and day edits and background sync are paused.
- Added production account initialization coverage against the Firestore Emulator for new and returning users, permission denial, tombstones, and malformed profile/settings data.
- Live Firebase rules/App Check configuration and real-browser storage behavior still require manual acceptance.
