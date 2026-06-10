# LehnAR

Prototype built for the **StartMiUp Hackathon** (Lehnert GmbH challenge).

Web AR app for on-site room consultations: configure partition walls, place them in a real room at 1:1 scale with WebXR, then generate a photorealistic result with Gemini AI.

**Live demo:** [startmiup.vercel.app](https://startmiup.vercel.app/)

## Run

```bash
npm install
npm run dev
```

Dev server runs over HTTPS on your LAN. Connect phone and PC to the **same Wi-Fi**, then open the **Network** URL from the terminal on your phone (**Android**, WebXR-capable browser — usually Chrome).

## Setup

Get a key from [Google AI Studio](https://aistudio.google.com/app/apikey), then:

**Local** — create `.env.local`:

```
GEMINI_API_KEY=your_key
```

**Production** — set the same `GEMINI_API_KEY` env var on your host (never in the client bundle).

The app calls `/api/render`; the key is read server-side only.

## Stack

Vite · React · TypeScript · Tailwind · Three.js · Zustand
