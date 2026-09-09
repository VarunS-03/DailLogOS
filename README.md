# Daily OS

Daily OS is a personal dashboard for planning and reviewing each day. It brings schedules, academics, data structures practice, projects, workouts, habits, and daily reflection into one React application.

## Installation & Prerequisites

Requirements:

- Node.js 18 or newer
- npm
- A Firebase project if cloud authentication and Firestore sync are needed

Install the dependencies:

```bash
npm install
```

For Firebase sync, create a `.env.local` file with the client configuration used by `src/firebase.ts`:

```dotenv
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_RECAPTCHA_SITE_KEY=your-recaptcha-site-key
```

The app can run without Firebase configuration using local browser storage. Do not commit `.env.local` or other files containing credentials.

## Usage / Getting Started

Start the Vite development server:

```bash
npm run dev
```

Open the local URL shown by Vite, normally `http://localhost:3000`.

Useful commands:

```bash
npm run build    # Create a production build
npm run preview  # Serve the production build locally
npm run lint     # Run the TypeScript compiler without emitting files
```

Sign in with Google to enable Firebase-backed records. Without an authenticated Firebase session, records and settings are stored in the browser. The app supports direct routes for the main views, including `/today`, `/academics`, `/dsa`, `/projects`, `/workout`, `/schedule`, `/calendar`, `/review`, `/history`, and `/settings`.

## Project Architecture / Folder Overview

```text
.
├── public/                 Static assets
├── src/
│   ├── App.tsx             Application state, routing, sync, and view composition
│   ├── firebase.ts         Firebase Auth, Firestore, local storage, and error handling
│   ├── types.ts            Shared TypeScript models
│   ├── index.css           Global styles and Tailwind layers
│   ├── constants/
│   │   └── templates.ts    Default settings, records, and completion calculations
│   ├── components/         Top-level views and shared navigation
│   │   └── today/           Sections used by the Today dashboard
│   └── utils/               Focused helpers such as schedule-time and backup validation
├── tests/
│   └── firestore.rules.test.ts  Firestore rules coverage
├── firestore.rules         Firestore access rules
├── firebase.json            Firebase project configuration
├── firebase-blueprint.json  Firestore data model reference
├── index.html               Vite HTML entry point
├── package.json             Scripts and dependencies
└── vite.config.ts           Vite configuration
```

The main data flow is centered in `App.tsx`: the selected date determines the current day record, view components receive that record through props, and updates are debounced before being saved locally or to Firestore.
