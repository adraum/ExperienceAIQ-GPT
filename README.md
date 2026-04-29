<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/0be35d7b-c26b-4c1b-ba48-5b2b2ae3f17a

## Run Locally

**Prerequisites:** Node.js, [Vercel CLI](https://vercel.com/docs/cli) (`npm i -g vercel`)

The app uses an Azure OpenAI deployment via a Vercel serverless function (`api/ai.ts`).
The API key is **never** sent to the browser — keep it server-side only.

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and fill in your Azure OpenAI values:
   - `AZURE_OPENAI_ENDPOINT` (e.g. `https://franceki.openai.azure.com/`)
   - `AZURE_OPENAI_API_KEY`
   - `AZURE_OPENAI_DEPLOYMENT` (e.g. `gpt-5-nano`)
   - `AZURE_OPENAI_API_VERSION` (e.g. `2024-12-01-preview`)
3. Run locally with `vercel dev` (this serves the Vite frontend **and** the `/api/ai` function together).
   `npm run dev` alone starts only the Vite frontend and the AI calls will fail because `/api/ai` isn't running.

## Deploy

Push to GitHub and import the repo in Vercel. Add the four `AZURE_OPENAI_*` variables under
**Project → Settings → Environment Variables** for the Production (and optionally Preview/Development) environments.
Vercel auto-detects Vite and deploys `api/ai.ts` as a Node serverless function.
