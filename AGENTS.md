# Tether - React Native / Expo App

This is a React Native app built with Expo SDK 55. It is NOT a Next.js or web project.

## Key conventions
- Entry point: `index.ts` -> `App.tsx`
- Navigation: `@react-navigation/native` with native stack
- State: React hooks (no external state library)
- Storage: `@react-native-async-storage/async-storage`
- Voice: `expo-speech` + `expo-speech-recognition`
- AI: Claude API via fetch (API key stored in `src/lib/config.ts`, gitignored)
- Passwords are hashed with `expo-crypto` before storage
