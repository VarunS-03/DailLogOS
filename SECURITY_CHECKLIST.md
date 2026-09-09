# DAILY OS Security Checklist

Use this checklist before publishing or deploying a self-hosted instance.

## Repository

- [ ] `.env`, `.env.local`, Firebase CLI state, debug logs, service-account files, and tracker exports are not tracked.
- [ ] `.env.example` contains only empty placeholders and required variable names.
- [ ] No personal Firebase project ID, Hosting domain, email address, token, or private key is committed.
- [ ] The copyright holder placeholder in `LICENSE` has been replaced.
- [ ] The private security contact placeholder in `SECURITY.md` has been replaced.

## Firebase Authentication

- [ ] Google is enabled under Authentication > Sign-in method.
- [ ] `localhost` and the deployment's own hostnames are listed under Authentication > Settings > Authorized domains.
- [ ] No mock login or fabricated user exists.
- [ ] Popup cancellation and unauthorized-domain errors are handled.

## Firestore

- [ ] The database exists in the selected Firebase project.
- [ ] `firestore.rules` is deployed to the same project as the Web App.
- [ ] Unauthenticated requests are denied.
- [ ] A user can access only `/users/{their-auth-uid}/...`.
- [ ] Unknown paths remain denied by default.
- [ ] Day IDs and key field bounds are validated by the rules.

## App Check

- [ ] A reCAPTCHA v3 site key is configured in `VITE_FIREBASE_RECAPTCHA_SITE_KEY` if App Check is desired.
- [ ] The production hostname is registered for that reCAPTCHA site key.
- [ ] App Check metrics are monitored before enabling enforcement.
- [ ] Any local debug token is kept out of source control.

## Local Data and Backups

- [ ] Local browser storage is treated as readable by anyone with access to the browser profile.
- [ ] Sign-out is tested on a shared device or browser profile.
- [ ] JSON backups are stored privately and are not attached to public issues or commits.
- [ ] Account deletion is tested against the intended Firebase project.
