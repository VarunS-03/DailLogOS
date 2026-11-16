# Daily OS — Your AI-Powered Daily Operating System

Daily OS is a personal planning and execution dashboard for schedules, focused work, DSA practice, workouts, habits, and daily reflection. Use its guided setup to generate a starting routine, then adjust it directly or describe changes to the AI command console.

---

## 🌟 Key Features & Psychological Design

### 🧠 Gemini AI Intelligence Layer
* **Smart Morning Briefing**: Generates a personalized daily briefing anchoring 3 high-impact priorities, a mindset quote, and momentum targets based on yesterday’s outcomes.
* **Auto-Synthesizing Reflection**: Removes "blank page paralysis" by reviewing completed schedule blocks, workout logs, and DSA problems to draft comprehensive daily debriefs automatically.
* **Algorithmic DSA Coach**: Suggests patterns, optimal architectural approaches, time/space complexity hints, and edge-case pitfalls without spoiling complete solutions.
* **Weekly Behavioral Trends**: Analyzes 7-day correlation between sleep quality, energy levels, and scheduled completion rates to uncover productivity patterns.
* **AI Command Console**: Describe schedule, habit, or workout changes in plain language, or switch to **Log activity** to record work and accomplishments.
* **Guided AI Onboarding**: Answer a short questionnaire about your goals, working style, focus capacity, and priorities to generate a personalized starting routine. Without a Gemini key, onboarding uses an offline routine generator.
* **Graceful Fallback**: Core planning and tracking work without Gemini; AI-generated features require a Gemini API key.

### 🎨 Human-Centered 4-Hub Navigation
Instead of overwhelming users with 10 separate forms, the application is streamlined into 4 intuitive hubs:
1. **Today**: Morning AI briefing, 1-tap non-negotiables, an editable timeline, live Pomodoro focus timer, and quick workspace access.
2. **Track Work**: Unified sub-tabbed workspace grouping **DSA Practice**, **Academics**, **Workouts**, and **Projects** with zero friction.
3. **Insights & Review**: Daily reflection debrief with 1-click AI auto-fill, weekly biometric/discipline trends, and searchable history.
4. **Settings**: Account management, JSON backup export/import, Gemini API key configuration, and wallpaper appearance controls.

### ✨ Make the plan your own
* Add schedule blocks with a time and title, mark blocks complete, or remove blocks from today's timeline.
* Open **AI Command** and describe a change, such as *"Move my workout to 6 PM and add a 30-minute reading block."* The console can update your schedule, habits, and workout.
* Use **Log activity** to record accomplishments in DSA practice, your schedule, or today's journal.
* Personalize the background with a wallpaper and adjust its blur and dimming in Settings.

Your data is stored in the browser by default. Configure Firebase to enable Google sign-in and cloud sync.

### 🧲 Behavioral Momentum & Micro-Celebrations
* **1-Tap Non-Negotiables**: Log small wins instantly to protect cognitive energy.
* **Progress Ring Feedback**: Dynamic visual completion ring shifting from amber to indigo to emerald as momentum builds.
* **Milestone Celebrations**: Completing reflections or finishing focused sessions triggers rewarding micro-animations.

---

## 🚀 Installation & Prerequisites

### Requirements:
* **Node.js 18+**
* **npm**
* *(Optional)* A Google Gemini API key for AI-generated features
* *(Optional)* A Firebase project for Google Auth and multi-device cloud Firestore sync

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Create a `.env.local` or `.env` file in the root directory (refer to `.env.example`):

```dotenv
# Optional: Gemini key for local development (can also be entered in the app)
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

You can also connect a Gemini key during onboarding or from **AI Command**. The app stores a key entered in the browser in that browser's local storage. Because Gemini requests are made from the client, keys supplied to the frontend are not server-side secrets; do not commit real keys, and apply suitable restrictions and quotas in Google AI Studio. Firebase web configuration is also client-side; secure cloud data with the included Firestore rules.

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
│   │   ├── appCustomization.ts     # Validated natural-language schedule/habit/workout updates
│   │   ├── onboardingPipeline.ts   # Questionnaire-based routine generation and fallback
│   │   └── behavioral.ts           # Functional behavioral state machine & rules
│   ├── constants/
│   │   └── templates.ts            # Master schedules, workout cycles, academic subjects
│   ├── components/
│   │   ├── Navigation.tsx          # 4-hub desktop sidebar and mobile navigation
│   │   ├── TodayDashboard.tsx      # Main daily command center
│   │   ├── TrackView.tsx           # Unified workspace for DSA, Academics, Workout, Projects
│   │   ├── InsightsView.tsx        # Daily reflection, weekly trends, history logs
│   │   ├── TimelineSchedule.tsx    # Editable timeline with add/delete and focus triggers
│   │   ├── AiInsightCard.tsx       # Morning briefing and AI key management card
│   │   ├── AiChatBubble.tsx        # AI customization console and natural-language logger
│   │   ├── OnboardingModal.tsx     # Guided profile and routine setup
│   │   ├── ProgressRing.tsx        # Dynamic circular progress indicator
│   │   └── SettingsView.tsx        # Preferences, JSON backup import/export, auth
│   └── utils/
│       ├── localDate.ts            # Local ISO date calculations
│       └── backupValidation.ts     # Schema validation for JSON imports
├── tests/                          # Security rules and behavioral test suites
├── firestore.rules                 # Cloud Firestore security rules
└── vite.config.ts                  # Vite + Tailwind configuration
```
