# BidLens

BidLens is an agentic AI bid evaluator for enterprise procurement teams. It ingests an RFP and multiple vendor bid documents, runs specialized AI evaluators (technical, commercial, compliance) in parallel per vendor, surfaces risks and gaps with citations back to bid text, and produces a comparative scorecard, evaluation memo, and risk register — with full audit trail.

## Status

**PR 1 — Scaffold (complete)**

What's working:

- Next.js 15 (App Router) project on TypeScript strict mode with Tailwind CSS v4
- shadcn/ui initialized with `card` and `button` components
- `@google/genai` integrated via `lib/ai.ts` wrapper exposing `gemini-2.5-flash` (workhorse) and `gemini-2.5-pro` (reserved for later synthesis PRs)
- `/api/health` route that calls Gemini 2.5 Flash with a trivial prompt and returns the response, model, latency, and timestamp
- Landing page renders system status (live call to `/api/health`) and the 10-PR build roadmap

The remaining PRs (ingestion through Q&A + audit trail) are not yet built — see Roadmap below.

### PR 2 — Demo data + viewer (complete)

The healthcare procurement scenario lives in `/public/demo-bids/`:

- `rfp.pdf` — Midwest Regional Health RFP for ambient clinical documentation
- `scribeai-bid.pdf` — ScribeAI Health response (premium positioning)
- `clinicalnote-bid.pdf` — ClinicalNote.ai response (aggressive pricing)
- `documind-bid.pdf` — DocuMind Health response (specialty depth)

Document metadata lives in `lib/documents.ts`. The `/documents` route lists all four; `/documents/[id]` renders an inline PDF viewer.

### PR 3 — Rubric configurator (complete)

The rubric defines how BidLens scores vendor bids: weighted categories with nested criteria, plus binary hard requirements. The default rubric is matched to MRH-RFP-2026-014 and seeds on first load.

- Schema: Neon Postgres via Vercel Marketplace, `rubrics` table with JSONB content column
- ORM: Drizzle (`drizzle-orm/neon-serverless`)
- Page: `/rubric` lets you adjust category weights, criterion weights within each category, and hard requirement toggles
- Persistence: GET/PUT `/api/rubric`
- Default rubric content: `lib/rubric/defaults.ts`

### PR 4 — Document ingestion (complete)

BidLens reads each PDF and extracts structured data with citations back to source text. Two specialized agents:

- **RFP parser** — extracts buyer name, scope, criteria summary, hard requirements, commercial/contract/data expectations
- **Bid parser** — extracts vendor identity, technical capabilities, pricing breakdown, contract terms, compliance posture, references, notable clauses

Each ingestion is a single Gemini 2.5 Flash call using PDF input (`inlineData`) plus a constrained JSON `responseSchema` for structured output. Every claim carries at least one citation (verbatim excerpt + page number). Zod validates the response at runtime — if the model drifts from schema, the ingestion errors cleanly rather than corrupting downstream agents.

- Page: `/ingestions` lets you trigger ingestion per document and inspect the structured JSON output
- Persistence: `ingestions` table (`status`, `model`, token counts, latency, `result` JSONB)
- Endpoints: `GET /api/ingestions`, `GET /api/ingestions/[id]`, `POST /api/ingestions/[id]`
- Schema types: `lib/ingestion/types.ts` (Zod schema is the runtime contract)

## Tech stack

- **Framework:** Next.js 15 (App Router) on TypeScript strict mode
- **Styling:** Tailwind CSS v4
- **Components:** shadcn/ui (Radix Slot, class-variance-authority, lucide-react)
- **AI:** Google Gemini via `@google/genai` SDK — `gemini-2.5-flash` workhorse, `gemini-2.5-pro` for synthesis (later PRs)
- **Database:** Neon Postgres (via Vercel Marketplace) with Drizzle ORM
- **Package manager:** pnpm
- **Node:** 20+
- **Deployment:** Vercel

## Local development

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy the env example and add your Gemini API key:

   ```bash
   cp .env.example .env.local
   ```

   Then edit `.env.local` and set `GEMINI_API_KEY` (get one at https://aistudio.google.com).

3. Start the dev server:

   ```bash
   pnpm dev
   ```

4. Open http://localhost:3000. The landing page calls `/api/health` on load and shows whether the Gemini integration is live.

If `GEMINI_API_KEY` is not set, the page still renders but the system status card will show a clear error explaining what's missing.

### Database setup (one-time, local dev)

1. The Neon database is provisioned via the Vercel Marketplace integration. Env vars are auto-injected into Vercel deployments.
2. For local development: `vercel env pull .env.local` to populate `DATABASE_URL` (or set it manually in `.env.local`).
3. Run `pnpm db:push` to sync the schema to Neon. The default rubric seeds itself on first GET to `/api/rubric`.

## Deployment

BidLens is built to deploy to Vercel:

1. Connect this repo to a Vercel project.
2. Add `GEMINI_API_KEY` to **Project Settings → Environment Variables** (Production, Preview, Development as appropriate).
3. The Neon integration auto-injects `DATABASE_URL`; if you provisioned Neon separately, add it manually.
4. Push to the configured branch — Vercel auto-deploys.

After the deploy, visit the production URL and confirm the system status card shows a green "ok" indicator.

## Roadmap

- [x] **PR 1 — Scaffold** — Next.js, Gemini SDK, health check
- [x] **PR 2 — Demo data + viewer** — RFP + 3 vendor bid PDFs
- [x] **PR 3 — Rubric configurator** — categories, weights, hard requirements (Neon + Drizzle)
- [x] **PR 4 — Ingestion agents** — RFP and bid parsing to structured JSON with citations
- [ ] PR 5 — Technical Evaluator (per-vendor technical scoring with citations)
- [ ] PR 6 — Commercial Evaluator (TCO normalization + commercial scoring)
- [ ] PR 7 — Compliance Evaluator (certification + BAA verification)
- [ ] PR 8 — Comparative dashboard (cross-vendor synthesis)
- [ ] PR 9 — Risk register + Evaluation memo (Opus-driven synthesis)
- [ ] PR 10 — Ask the agent + Audit trail (Q&A and defensibility)
