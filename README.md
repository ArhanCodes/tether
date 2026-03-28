# Tether

Tether is a React Native + TypeScript mobile app built with Expo.

Doctors publish personalized recovery plans. Patients receive AI-powered guidance via text or voice, grounded in what their doctor documented.

## Architecture

```
App.tsx                          # Entry point with error boundary
src/
  navigation/AppNavigator.tsx    # React Navigation stack (Auth, Doctor, Patient)
  screens/
    AuthScreen.tsx               # Login / signup with role selection
    DoctorScreen.tsx             # Doctor workspace: create, edit, publish plans
    PatientScreen.tsx            # Patient companion: AI chat, voice, doctor messaging
  components/
    CheckboxRow.tsx              # Reusable checkbox with label
    ErrorBoundary.tsx            # App-level error boundary
    FieldLabel.tsx               # Styled form label
    InputField.tsx               # Text input with label
    MessageBubble.tsx            # Chat message bubble with urgency badge
    SectionCard.tsx              # Rounded card container
    SummaryPill.tsx              # Key-value display pill
  lib/
    ai.ts                        # Claude API integration (falls back to keyword matching)
    appData.ts                   # AsyncStorage persistence, auth with hashed passwords
    config.ts                    # API key config (gitignored)
    config.template.ts           # Template for config.ts
    crypto.ts                    # SHA-256 password hashing via expo-crypto
    showcase.ts                  # Care plan model, keyword-based fallback AI
```

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

For the full voice flow, use a native build rather than Expo web.

## Stack

- Expo SDK 55
- React Native
- TypeScript (strict)
- React Navigation (native stack)
- expo-crypto (password hashing)
- expo-speech + expo-speech-recognition (voice I/O)
- @react-native-async-storage/async-storage
- Claude API (optional, for AI responses)

## Production notes

This is structured like a real app, but for a true App Store release you would still want to replace local on-device auth and storage with a secure backend, proper authentication, encrypted data handling, and compliant clinical infrastructure.
