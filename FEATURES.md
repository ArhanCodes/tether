### Auth

- login / signup with role selection (doctor or patient)
- passwords hashed with SHA-256 server-side (Cloudflare Worker)
- session persistence — reopening the app skips login
- terms/privacy consent on signup
- all accounts stored in Durable Objects (shared across devices)

### Doctor Workspace

- create/edit patient recovery plans (diagnosis, vitals, meds, instructions, red flags, follow-up)
- set AI tone (calm, direct, reassuring)
- publish plans to a specific patient email (server validates account exists)
- draft auto-saves locally
- view and reply to patient messages (real-time via Durable Objects)

### Patient Companion

- view the recovery plan assigned to your email
- vitals summary, daily instructions, red flags
- AI chat powered by [Groq](https://groq.com/) with keyword-matching fallback
- quick prompt buttons ("What should I do today?", "When should I call?", etc.)
- voice input via speech recognition
- voice output (text-to-speech on AI replies, toggleable)
- urgency badges on AI responses (routine / contact clinician / urgent)
- Flesch-Kincaid readability score on every AI response (grade level badge)
- handoff suggestion when AI can't fully answer
- direct messaging to doctor (real-time via Durable Objects)
- multilingual support (English, Spanish, Hindi, Mandarin, French, Arabic)
- voice biomarker analysis (breathing rate, cough detection, vocal tremor, voice energy)
- biomarker status levels (normal / monitor / alert) with alert popup
- biomarker trending — historical chart showing breathing, energy, and cough trends over time

### Engine Connection

- NLP engine and Bio-Acoustic engine share context automatically
- latest biomarker results are injected into the AI system prompt
- AI references biomarker data when answering health questions
- if biomarkers are in "alert" status, AI proactively warns the patient

### Onboarding

- 5-step tutorial on first launch (welcome, doctors, patients, voice biomarkers, safety)
- skip button and dot indicators
- only shows once (stored in AsyncStorage)

### Infrastructure

- Cloudflare Worker proxy — API key stays server-side, never ships in the app
- Durable Objects backend — accounts, plans, messages, and biomarker history persist across devices with strong consistency
- Rust WASM biomarker engine runs at the edge inside the worker
- AI requests routed through worker, falls back to direct Groq, then keyword matching
- React Navigation with 3 screens
- error boundary catching crashes
- modular component architecture
