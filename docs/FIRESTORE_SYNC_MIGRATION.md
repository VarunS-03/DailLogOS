# Firestore Day Sync Migration

The current day writer commits each `/users/{uid}/days/{date}` record with a
matching `/users/{uid}/daySyncState/{date}` revision marker in one Firestore
transaction. The Firestore rules require this paired write. Legacy day records
without a revision remain editable; the current client creates their marker on
the first successful edit.

## Older client behavior

Clients that write a whole day document without the matching marker are denied
by the current rules. Their local data is not a supported cloud-write fallback.
If an older tab receives a permission error, stop editing in that tab and
reload the current application. Export its local data first if it contains
changes that have not appeared in the cloud. Import those records through the
current application and resolve any resulting recovery prompts.

## Release procedure

1. Release the current client and communicate that users should reload open
   tabs before the rules are tightened.
2. Verify the current client can create and edit both new and legacy days
   against a non-production Firebase project with the Firestore Emulator suite.
3. Deploy the matching Firestore rules only as part of the same planned
   release. Do not deploy the paired-marker rules independently of the client.
4. Older tabs will be read-only for day writes after the rules change until
   refreshed. Do not weaken the rules to restore whole-document writes; that
   would reintroduce lost-update risk.
5. If users have unsubmitted edits in an older tab, have them export or
   otherwise preserve those edits before refreshing, then import them using
   the current client.

No production rules or data migration has been performed as part of this work.
