# Security Policy

## Supported Versions

Security fixes are applied to the latest version on the default branch. Older commits and personal deployments are not maintained as supported releases.

Because DAILY OS is self-hosted, each operator is responsible for keeping dependencies, Firebase configuration, authentication settings, and deployed rules current.

## Reporting a Vulnerability

Please report suspected vulnerabilities privately to the repository maintainer before disclosing them publicly.

Maintainer contact: `[VarunS-03]`

Replace the placeholder above with a monitored contact method before publishing the repository. If no private contact has been configured yet, do not post sensitive details in a public issue; contact the maintainer through the repository hosting provider's private reporting feature if available.

Include a concise description, affected file or behavior, reproduction steps that do not contain personal data, and a suggested severity. Allow time for investigation and remediation before public disclosure.

## Do Not Include

- Firebase service-account JSON, private keys, or other credentials
- Firebase Authentication tokens or browser session data
- Personal tracker records, journal entries, or exported backups
- Unredacted production URLs or private configuration when they are not needed to reproduce the issue

The public repository contains Firebase Web App variable names and empty placeholders only. Each deployment must use its own Firebase project and should protect its own environment files.

## Scope Notes

Firestore authorization is enforced by `firestore.rules`, which restricts reads and writes to the authenticated user's UID subtree. Client-side checks and localStorage namespacing are not substitutes for server-side rules. Report any way to bypass the rules, access another user's data, expose credentials, or weaken authentication.
