# Firebase AI Logic

Daily OS uses Firebase AI Logic for the user-triggered **Auto-Fill Reflection** action in Insights and the signed-in user's personal **Coach Chat**. Auto-Fill sends a bounded JSON selection of the current day's date, completion, mood, energy, sleep, completed schedule blocks, habits, focus sessions, academic subject, DSA problem names/patterns, and workout status. Coach Chat sends the user's configured goals and coaching preferences, selected details from the current day, the current message, and recent conversation turns. The chat UI discloses this before use; its history is stored under that user's Firestore path and can be cleared in the UI. Account deletion removes chat history. If Firebase AI Logic or App Check is unavailable, Auto-Fill keeps the local reflection fallback and Coach Chat shows an error for retry.

The integration uses `getAI(app, { backend: new GoogleAIBackend(), useLimitedUseAppCheckTokens: true })` with the currently supported `gemini-4-hydrogen` model. The Firebase Web SDK already includes `firebase/ai`; no separate package or Gemini API key is needed for this action. Other existing Gemini actions still use the Google AI Studio key path.

## Required project configuration

1. Firebase AI Logic was provisioned for the configured `dailylogos` project and its web app using `firebase init ailogic`. The Firestore rules and static app were deployed to `dailylogos` on 2026-11-18. These deployments are separate from App Check provider registration.
2. In Firebase Console, register the web app under **Security > App Check** with **reCAPTCHA Enterprise**. Keep the provider secret in the Console. Set the corresponding public site key as `VITE_FIREBASE_RECAPTCHA_ENTERPRISE_SITE_KEY` in the local build environment (or inject it through the supported runtime `window.__ENV__` configuration). Never commit the secret or a debug token. The current production build was deployed without this site key, so AI Logic requests use fallback/error handling until it is configured and redeployed.
3. In Vite development, the client sets `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` before App Check initialization. Run `npm run dev`, open the app, and find the generated debug token in that browser's developer console. Register it under **Security > App Check > Apps > Manage debug tokens**. Keep that token private and out of source control.
4. Check **Security → App Check → APIs → Firebase AI Logic**. Firebase began automatically enforcing App Check for Firebase AI Logic on November 2, 2026. Confirm the enforcement state and monitor metrics. Limited-use tokens are enabled in code; only enable replay protection in Console after confirming the desired enforcement mode.
5. Rebuild the client after setting the site key. The site key is public and is embedded in the client bundle; the secret remains server-side in Firebase Console.

The implementation initializes Enterprise App Check when the site key is available and waits for initialization before AI Logic is used. In development it initializes the debug-token flow. Firebase Console App Check registration/enforcement, the local site key, and a live AI request have not been verified in this repository.

Coach Chat requires Firebase Authentication sign-in to load or save history. Firestore rules scope messages to their owner, reject updates, and bound message text. Guest users can access existing local AI actions but must sign in to use this personalized chat.

References: [Firebase AI Logic setup](https://firebase.google.com/docs/ai-logic/get-started?platform=web), [App Check for Firebase AI Logic](https://firebase.google.com/docs/ai-logic/app-check), [supported models](https://firebase.google.com/docs/ai-logic/models).
