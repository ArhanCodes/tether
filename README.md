# tether

[Tether](https://joinlaunchpad.com/#/projects/6672/tether-bio-acoustic-vocal-biomarker-monitoring-system-1) is a React Native + TypeScript mobile app built with Expo

Doctors publish personalized recovery plans. Patients receive AI powered guidance via text or voice, grounded in what their doctor documented


## Features

- Role-based auth with hashed passwords (SHA-256 via expo-crypto)
- React Navigation stack with automatic session restore
- Doctor workspace: create/edit/publish recovery plans to specific patients
- Patient companion: view plan, ask AI questions, voice input/output
- Claude API integration for intelligent responses (falls back to keyword matching)
- In-app doctor-patient messaging
- Error boundary and try/catch on all async storage operations

## Starter accounts

- Doctor: `doctor@tether.app` / `password123`
- Patient: `patient@tether.app` / `password123`

## AI setup

To enable Claude-powered AI responses:

1. Copy `src/lib/config.template.ts` to `src/lib/config.ts`
2. Add your Anthropic API key to `config.ts`
3. The app falls back to keyword matching if no API key is set

## Run it

```bash
npm install
npm run ios
```

Or:

```bash
npm run android
```

For the full voice flow, use a native build rather than Expo web

