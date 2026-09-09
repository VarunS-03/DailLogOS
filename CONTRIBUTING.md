# Contributing

Thanks for helping improve DAILY OS.

## Development Setup

1. Install Node.js 18 or newer.
2. Copy `.env.example` to `.env.local` and use a Firebase project you control.
3. Install dependencies with `npm install`.
4. Start the app with `npm run dev`.

Before opening a pull request, run:

```bash
npm run lint
npx tsx tests/firestore.rules.test.ts
npm run build
```

## Pull Requests

Keep changes focused, describe the user-visible or security impact, and include validation results. Do not commit `.env`, `.env.local`, Firebase CLI state, service-account files, exported tracker data, or personal screenshots.

Do not weaken Firebase Authentication requirements or Firestore Security Rules. Changes affecting data paths, localStorage scoping, backup import, or account deletion should include focused tests or a clear explanation of the validation performed.
