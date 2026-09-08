# Debrief — Visit Feedback App (Prototype)

A mobile-first web application where a real estate agent sees property viewings waiting for feedback, dictates the answer out loud in ~30 seconds, lets AI place what was said into the right fields, reviews, confirms, and is done.

Prototype built against the Hi Folks Studio brief. Deviations from the production brief, on purpose:

- Hosted on **Railway** (brief mandates Supabase + Vercel for production; the code is standard Next.js + Postgres and ports over directly).
- **Zoho is mocked** with seeded viewings (the brief's Zoho read-only sync is out of demo scope).
- The agency's feedback endpoint is **mocked inside this app** (`POST /api/agent-feedback`) and enforces the exact contract from the brief, including bearer auth and idempotency.
- WhatsApp reminders and outbound webhooks are out of demo scope.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- PostgreSQL + Prisma
- Auth: email/password (bcrypt) with long-lived iron-session cookies, roles `AGENT` / `ADMIN`
- AI on OpenAI: Whisper-family speech-to-text plus a chat model for structuring, both switchable by env var; full mock mode for offline demos

## Running locally

```bash
npm install
createdb visit_feedback_dev          # or point DATABASE_URL elsewhere
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Demo accounts (password `demo1234`):

| Email | Role |
|---|---|
| `marie.laurent@demo.agency` | Agent (Uccle) |
| `koen.devos@demo.agency` | Agent (Woluwe) |
| `admin@demo.agency` | Administrator |

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `SESSION_SECRET` | 32+ char secret for session cookies |
| `OPENAI_API_KEY` | OpenAI key — the only key the app needs |
| `TRANSCRIPTION_MODEL` | Speech-to-text model, default `gpt-transcribe` (`gpt-4o-transcribe` and `whisper-1` also verified) |
| `ANALYSIS_MODEL` | Chat model that structures the transcript, default `gpt-5` |
| `MOCK_AI` | `true` = canned AI output, no keys needed (also the automatic fallback when no key is set) |
| `FEEDBACK_ENDPOINT_URL` | Where confirmed feedback is POSTed; defaults to this app's own mock endpoint |
| `FEEDBACK_ENDPOINT_TOKEN` | Bearer token the mock endpoint requires |

## Deploying to Railway

1. Create a Railway project and add a **PostgreSQL** service.
2. Add a service from this repository. `railway.json` selects the Nixpacks builder and starts the app with `npm run start:prod`, which applies migrations and seeds the demo data before serving (both are idempotent, so restarts are safe).
3. Set variables on the app service: `DATABASE_URL` (reference the Postgres service as `${{Postgres.DATABASE_URL}}`), `SESSION_SECRET`, `FEEDBACK_ENDPOINT_TOKEN`, `OPENAI_API_KEY`, and `MOCK_AI=false`.
4. Generate a public domain. `FEEDBACK_ENDPOINT_URL` can stay unset: the app derives the mock endpoint from `RAILWAY_PUBLIC_DOMAIN`.

Node is pinned to 22 via `.nvmrc` and `engines`; the Prisma client is generated on `postinstall`.

**The AI key is optional to start.** With `OPENAI_API_KEY` empty the app automatically serves the canned analysis, so the whole flow stays demonstrable. Paste a real key and the next recording goes through the configured models — no redeploy, no other variable to change.

Measured on a 70-second French dictation: 3.9 s to transcribe, 8.5 s to structure, 12.5 s from the end of the recording to filled fields — inside the brief's 20-second target for 90 seconds of audio.

## Demo script (mirrors the brief, section 4.4)

1. Sign in as an agent; the list shows viewings in **To do / Done / Expired**, with how long each feedback has been waiting.
2. Open a viewing. The criteria to cover are listed at the top. Tap the big **Record feedback** button and talk freely, e.g.: *"Well, yeah, it went pretty well. I'm not sure she's ready to buy… she had doubts, but she asked a lot of questions, so I think she's interested."*
3. Tap **Confirm my recording**. Ready-to-buy and enjoyed-the-viewing fill in the agent's own words; price perception and objections stay empty, flagged *"Not mentioned, please complete"* — nothing is invented.
4. Tap the small mic **on the price field** and add one sentence — only that field updates.
5. Edit any field with the pencil; confirm fields individually or hit **Confirm all and submit**. The payload goes to the endpoint in one call with an idempotency key; the viewing moves to Done and is never offered again.
6. Sign in as the admin: response rate per agent, every viewing's status, failed submissions, CSV export. Admin access is written to an audit log.
7. **Reset demo data** at the bottom of the admin view clears every draft and submission and restores the viewings with fresh timestamps, so the demo can be run as many times as you like.

Design system: see [docs/DESIGN_KIT.md](docs/DESIGN_KIT.md).
