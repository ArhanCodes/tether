# tether

[Tether](https://joinlaunchpad.com/#/projects/6672/tether-bio-acoustic-vocal-biomarker-monitoring-system-1) is a React Native + TypeScript mobile app built with Expo using Cloudflare Workers

Open https://tether-web-did.pages.dev on your phone to run it

Doctors publish personalized recovery plans. Patients receive AI powered guidance via text or voice, grounded in what their doctor documented.

## Architecture

- **Mobile app**: React Native + Expo (TypeScript)
- **Backend**: Cloudflare Worker with Durable Objects (strong consistency across devices)
- **AI**: Groq LLM (NLP literacy engine) with keyword-matching fallback
- **Biomarkers**: Rust WASM bio-acoustic engine running at the edge
- **Engine connection**: biomarker results are automatically injected into AI context so the two engines inform each other

## Starter accounts

- Doctor: `doctor@tether.app` / `password123`
- Patient: `patient@tether.app` / `password123`

## Docs
https://tether-docs.pages.dev
