# Daily OS — Intelligent Behavioral Life Operating System

Daily OS is a personal life coach and execution dashboard. It synthesizes daily schedules, academic deep work, DSA/LeetCode practice, workouts, habits, and evening reflections into a cohesive experience powered by Google Gemini AI and behavioral psychology.

---

## 🌟 Key Features & Psychological Design

### 🧠 Gemini AI Intelligence Layer
* **Smart Morning Briefing**: Generates a personalized daily briefing anchoring 3 high-impact priorities, a mindset quote, and momentum targets based on yesterday’s outcomes.
* **Auto-Synthesizing Reflection**: Removes "blank page paralysis" by reviewing completed schedule blocks, workout logs, and DSA problems to draft comprehensive daily debriefs automatically.
* **Algorithmic DSA Coach**: Suggests patterns, optimal architectural approaches, time/space complexity hints, and edge-case pitfalls without spoiling complete solutions.
* **Weekly Behavioral Trends**: Analyzes 7-day correlation between sleep quality, energy levels, and scheduled completion rates to uncover productivity patterns.
* **Floating AI Omni-Logger**: Log accomplishments anywhere via natural language (*"Solved LeetCode 3Sum in medium with two pointers"*).
* **Graceful Fallback**: Fully functional offline or without an API key using built-in heuristic intelligence.

### 🎨 Human-Centered 4-Hub Navigation
Instead of overwhelming users with 10 separate forms, the application is streamlined into 4 intuitive hubs:
1. **Today**: Morning AI briefing, 1-tap non-negotiables, interactive vertical timeline schedule, live Pomodoro focus timer, and quick workspace access.
2. **Track Work**: Unified sub-tabbed workspace grouping **DSA Practice**, **Academics**, **Workouts**, and **Projects** with zero friction.
3. **Insights & Review**: Daily reflection debrief with 1-click AI auto-fill, weekly biometric/discipline trends, and searchable history.
4. **Settings**: Account management, JSON backup export/import, and Gemini API key configuration.

### 🧲 Behavioral Momentum & Micro-Celebrations
* **1-Tap Non-Negotiables**: Log small wins instantly to protect cognitive energy.
* **Progress Ring Feedback**: Dynamic visual completion ring shifting from amber to indigo to emerald as momentum builds.
* **Milestone Celebrations**: Completing reflections or finishing focused sessions triggers rewarding micro-animations.

---

## 🚀 Installation & Prerequisites

### Requirements:
* **Node.js 18+**
* **npm**
* *(Optional)* A Google Gemini API key for live AI synthesis
* *(Optional)* A Firebase project for Google Auth and multi-device cloud Firestore sync

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Create a `.env.local` or `.env` file in the root directory (refer to `.env.example`):

```dotenv
# Optional: Google Gemini AI (can also be configured in-app via Settings)
VITE_GEMINI_API_KEY=your-gemini-api-key

# Optional: Firebase Client Web Configuration (runs in local browser storage if omitted)
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_RECAPTCHA_SITE_KEY=your-recaptcha-site-key
```

---

## 💻 Development & Useful Commands

Start the local Vite development server:
```bash
npm run dev
```
Open your browser at `http://localhost:3000`.

### Key Commands:
```bash
npm run build    # Compile and create an optimized production build
npm run test     # Run the behavioral contracts and Firestore security test suites
npm run preview  # Serve the production build locally
npm run lint     # Run the TypeScript compiler type-check
```

---

## 📁 Architecture Overview

```text
.
├── src/
│   ├── App.tsx                     # Core state, tab routing, debounced auto-sync
│   ├── firebase.ts                 # Firebase Auth, Firestore CRUD, security & offline storage
│   ├── types.ts                    # Shared TypeScript domain contracts
│   ├── index.css                   # Design system, theme variables, glassmorphism layers
│   ├── services/
│   │   ├── ai.ts                   # Gemini API client (briefings, DSA coach, auto-reflections)
│   │   └── behavioral.ts           # Functional behavioral state machine & rules
│   ├── constants/
│   │   └── templates.ts            # Master schedules, workout cycles, academic subjects
│   ├── components/
│   │   ├── Navigation.tsx          # 4-hub desktop sidebar and mobile navigation
│   │   ├── TodayDashboard.tsx      # Main daily command center
│   │   ├── TrackView.tsx           # Unified workspace for DSA, Academics, Workout, Projects
│   │   ├── InsightsView.tsx        # Daily reflection, weekly trends, history logs
│   │   ├── TimelineSchedule.tsx    # Vertical schedule timeline with focus triggers
│   │   ├── AiInsightCard.tsx       # Morning briefing and AI key management card
│   │   ├── AiChatBubble.tsx        # Floating natural language quick-logger
│   │   ├── ProgressRing.tsx        # Dynamic circular progress indicator
│   │   └── SettingsView.tsx        # Preferences, JSON backup import/export, auth
│   └── utils/
│       ├── localDate.ts            # Local ISO date calculations
│       └── backupValidation.ts     # Schema validation for JSON imports
├── tests/                          # Security rules and behavioral test suites
├── firestore.rules                 # Cloud Firestore security rules
└── vite.config.ts                  # Vite + Tailwind configuration
```
