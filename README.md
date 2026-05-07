<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/0be35d7b-c26b-4c1b-ba48-5b2b2ae3f17a

## Run Locally

**Prerequisites:** Node.js, [Vercel CLI](https://vercel.com/docs/cli) (`npm i -g vercel`)

The app talks to [meinGPT](https://app.meingpt.com) via a Vercel serverless function (`api/ai.ts`)
using meinGPT's OpenAI-compatible REST API. The API key stays server-side only — the browser
never sees it.

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and fill in your meinGPT values:
   - `MEINGPT_API_KEY` — bearer token from meinGPT (Settings → API & Schlüssel)
   - `MEINGPT_BASE_URL` — defaults to `https://app.meingpt.com/api/external/openai/v1`
   - `MEINGPT_MODEL` — e.g. `gemini-2.5-flash`, `gpt-5`, depending on what your workspace exposes
3. Run locally with `vercel dev` (this serves the Vite frontend **and** the `/api/ai` function together).
   `npm run dev` alone starts only the Vite frontend and the AI calls will fail because `/api/ai` isn't running.

## Deploy

Push to GitHub and import the repo in Vercel. Add the `MEINGPT_*` variables under
**Project → Settings → Environment Variables** for the Production (and optionally Preview/Development) environments.
Vercel auto-detects Vite and deploys `api/ai.ts` as a Node serverless function.
