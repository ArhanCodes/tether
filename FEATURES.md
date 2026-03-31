### Auth

- login / signup with role selection (doctor or patient)
- passwords hashed with SHA-256 (expo-crypto)
- session persistence — reopening the app skips login
- terms/privacy consent on signup

### Doctor Workspace

- create/edit patient recovery plans (diagnosis, vitals, meds, instructions, red flags, follow-up)
- set AI tone (calm, direct, reassuring)
- publish plans to a specific patient email (validates account exists)
- draft auto-saves locally
- view and reply to patient messages

### Patient Companion

- view the recovery plan assigned to your email
- vitals summary, daily instructions, red flags
- AI chat powered by [Groq](https://groq.com/) with keyword-matching fallback
- quick prompt buttons ("What should I do today?", "When should I call?", etc.)
- voice input via speech recognition
- voice output (text-to-speech on AI replies, toggleable)
- urgency badges on AI responses (routine / contact clinician / urgent)
- handoff suggestion when AI can't fully answer
- direct messaging to doctor
- voice biomarker analysis (breathing rate, cough detection, vocal tremor, voice energy)
- biomarker status levels (normal / monitor / alert) with alert popup

### Onboarding

- 5-step tutorial on first launch (welcome, doctors, patients, voice biomarkers, safety)
- skip button and dot indicators
- only shows once (stored in AsyncStorage)

### Infrastructure

- Cloudflare Worker proxy — API key stays server-side, never ships in the app
- Rust WASM biomarker engine runs at the edge inside the worker
- AI requests routed through worker, falls back to direct Groq, then keyword matching


<!--
- react Navigation with 3 screens
- error boundary catching crashes
- try/catch on all storage operations
- modular component architecture (7 components, 3 screens)
