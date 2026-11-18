# Phase 17 Release Readiness

**Assessment date:** 2026-11-18
**Local engineering outcome:** PASS WITH LIMITATIONS
**Release recommendation:** NOT READY

## Initial repository state

The workspace contained extensive uncommitted implementation and documentation from Phases 9.1–16. Phase 17 preserved those changes and made no commit, push, production Firebase change, account deletion, credential rotation, live Gemini call, or deployment. The full starting state and local modifications remain in the shared worktree.

## Baseline validation and findings

Baseline checks before Phase 17 edits: lint, unit suite, Firestore Emulator suite, production build, production-only audit, and `git diff --check` passed. Full `npm audit` reported four high-severity findings through the Vite/fdir/tinyglobby/picomatch development dependency chain. Resolved picomatch was 4.0.7, with no patched version available in registry/advisory data at review time. `npm audit fix --force` would require a breaking Vite upgrade and was not applied. Production-only audit reported zero findings.

| Finding | Classification | Evidence / limitation |
|---|---|---|
| Production release acceptance | BLOCKED | Live Firebase project, deployed rules, browser, device, and external provider acceptance were unavailable. |
| Local type/unit/emulator/build checks | PASS | Baseline and final command results are recorded below. Emulator runs against the demo project only. |
| Firestore history startup | PASS WITH LIMITATIONS | Normal loading is now page-bounded; explicit backup/export and merge-import load the complete history. No browser-scale profile was run. |
| Bundle size | PASS WITH LIMITATIONS | Onboarding/AI/App Check are deferred; main and optional Three.js bundles still exceed Vite's 500 kB warning threshold. |
| Runtime dependency exposure | PASS | `npm audit --omit=dev` reports zero vulnerabilities. |
| Development dependency advisory | PASS WITH LIMITATIONS | Four high findings remain in dev tooling; no patched version was available and no breaking override was introduced. |
| Credential exposure | BLOCKED | An earlier verbose Firebase CLI environment dump displayed the value of `STITCH_API_KEY`. It was absent from the scanned Git history and repository log; manual owner rotation is still required. |
| Firebase security configuration | NOT VERIFIED | Rules/App Check setup and enforcement state in the real project were not inspected or changed. |
| Browser/device acceptance | BLOCKED | See [BROWSER_ACCEPTANCE_CHECKLIST.md](BROWSER_ACCEPTANCE_CHECKLIST.md); all manual rows remain BLOCKED / NOT RUN. |

## Changes made

- Replaced unbounded initial history loading with a descending, date-key cursor page (default 180, capped at 500), local/cache fallback, explicit coverage status, and a load-older action. Export and merge-import use complete history intentionally.
- Deferred onboarding UI, AI assistant UI, and configured App Check SDK loading. Added a bundle composition report script and `npm run analyze:bundle`.
- Added fixed safe AI failure diagnostics; provider exception objects and their potentially sensitive response content are not written to logs.
- Made account-deletion errors stage-aware and sanitized, with tested tombstone-first ordering and retry semantics.
- Added emulator runner output regression coverage proving sentinel secret/debug environment values are not emitted by the filtered child process.
- Created a manual browser acceptance checklist with 43 rows. No manual tests were marked as passed.

## Files changed for Phase 17

Key source changes: `src/App.tsx`, `src/firebase.ts`, `src/components/InsightsView.tsx`, `src/components/SettingsView.tsx`, `src/components/AiChatBubble.tsx`, `src/components/OnboardingModal.tsx`, `src/services/ai.ts`, `src/services/onboardingPipeline.ts`, `src/services/aiDiagnostics.ts`, `src/services/accountDeletion.ts`, `src/utils/dayHistory.ts`.

Tooling and tests: `scripts/analyze-bundle.mjs`, `scripts/run-firestore-emulator.mjs`, `tests/emulator-runner.test.mjs`, `tests/day-history.test.ts`, `tests/account-deletion.test.ts`, `tests/ai-response-validation.test.ts`, and `package.json`.

Documentation: this report, `docs/BROWSER_ACCEPTANCE_CHECKLIST.md`, `docs/PRODUCTION_ACCEPTANCE.md`, `docs/ENGINEERING_PROGRESS.md`, `docs/ENGINEERING_ROADMAP.md`, and `docs/FEATURE_INVENTORY.md`.

## Final checks

Final Phase 17 run: type checks, unit suites, Emulator tests, production build, production-only audit, bundle analysis, and whitespace check completed. The Emulator initially could not bind port 8080 because an orphan Firestore Emulator JVM from an earlier run still held it; after verifying the process command identified it as the Emulator and stopping that process, the Emulator suite passed.

| Check | Result |
|---|---|
| `npm run lint` | PASS — `tsc --noEmit` |
| `npm test` | PASS — emulator runner, behavioral, mock rules, lifecycle/deletion, history, onboarding, AI, sync, and outbox suites |
| `npm run test:firestore-emulator` | PASS — demo project `demo-daily-os`; owner/deny, sync, conflicts, revisions, deletion recovery, and tombstones. Expected permission-denied logs appear for negative cases. |
| `npm run build` | PASS — main entry 1,055.68 kB (284.95 kB gzip); Three.js 753.49 kB (192.67 kB gzip); Gemini 443.45 kB (81.15 kB gzip); Vite warns above 500 kB. |
| `npm run analyze:bundle` | PASS — main rendered module stat 1,055,293 bytes; onboarding 43,203, AI assistant 22,608, and App Check 26,682 bytes in deferred chunks. |
| `npm audit --omit=dev` | PASS — 0 vulnerabilities |
| `npm audit` | PASS WITH LIMITATIONS — 4 high findings, all through dev tooling including picomatch 4.0.7; recommended forced fix downgrades Vite to 6.2.7 and was not applied. |
| `git diff --check` | PASS — no whitespace errors; expected LF-to-CRLF notices. |
| Credential-pattern scan over current tree and Git history | PASS — no matching files; this does not undo the prior tool-output disclosure or replace manual key rotation. |

## Bundle review

Baseline analyzer measured main entry at 1,142,698 rendered bytes before lazy-loading changes. Final build reports 1,055.68 kB main entry / 284.95 kB gzip; final analyzer rendered-module stat is 1,055,293 bytes. Onboarding is 43,203 bytes, AI assistant 22,608 bytes, and App Check 26,682 bytes in separate chunks. Gemini is 443.45 kB / 81.15 kB gzip and Three.js is 753.49 kB / 192.67 kB gzip. Vite still warns above 500 kB; no claim of meeting a strict performance budget is made.

## Firebase and provider requirements

1. Rotate the `STITCH_API_KEY` manually in its owning Google account: open Stitch Settings/API Keys, delete/revoke the exposed key, generate a replacement, update the local secure `STITCH_API_KEY`/MCP secret store, then restart/reconnect and verify without printing the key. If the API-key controls are absent, use the provider's linked Cloud Console credentials workflow. No rotation was attempted. Provider guidance: [Google AI Developers Forum](https://discuss.ai.google.dev/t/stitch-api-keys-disappeared-and-unable-to-recreate/143076).
2. Inspect the intended Firebase project. Register the web app for reCAPTCHA Enterprise App Check, keep the secret in Firebase Console, put only the site key in client configuration, and verify client initialization. Review metrics, then consider Authentication and Cloud Firestore enforcement. This app's direct Gemini requests are not protected by Firebase App Check. Sources: [App Check web setup](https://firebase.google.com/docs/app-check/web/recaptcha-provider?hl=en), [enforcement](https://firebase.google.com/docs/app-check/enable-enforcement?hl=en).
3. After selecting the correct project and validating `firestore.rules`, deploy tombstone-capable rules before the client release using `firebase deploy --only firestore:rules --project <project-id>`. No deploy was run. Source: [manage and deploy rules](https://firebase.google.com/docs/rules/manage-deploy).
4. Use disposable test identities and finish the manual acceptance checklist, including Google sign-in/reauthentication, deletion recovery, real offline/network transitions, exports/imports, Gemini privacy/provider restrictions, supported browsers, keyboard and reduced-motion behavior, and mobile layouts.

## Secret scan

The current tracked tree and all available Git commits were scanned for common Firebase/API key, private-key header, `STITCH_API_KEY`, and `GEMINI_API_KEY` literal patterns. No matching credential-bearing file was found in scanned history. This does not make the earlier tool-output disclosure harmless: revoke the exposed key. The key value is intentionally not repeated here. No credential value was written to a repository file during this review; a zero-byte `firestore-debug.log` left by the emulator run was removed.

## Outstanding acceptance and recommendation

`BROWSER_ACCEPTANCE_CHECKLIST.md` contains 43 explicit checks; every row is BLOCKED / NOT RUN, with date/browser/project/result/evidence fields. No live project configuration or live provider behavior was verified. Do not release until the exposed key is rotated, rules are deployed and verified, App Check is configured appropriately, the browser checklist is executed, and the owner accepts the remaining dev-tool advisory/performance warning.

**Final recommendation: NOT READY.** Local engineering changes and local checks can pass, but required credential and external/browser release gates remain outstanding.
