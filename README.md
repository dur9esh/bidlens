# BidLens

BidLens is an agentic AI bid evaluator for enterprise procurement teams. It ingests an RFP and multiple vendor bid documents, runs specialized AI evaluators (technical, commercial, compliance) in parallel per vendor, surfaces risks and gaps with citations back to bid text, and produces a comparative scorecard, evaluation memo, and risk register — with full audit trail.

## Status

**PR 1 — Scaffold (complete)**

What's working:

- Next.js 15 (App Router) project on TypeScript strict mode with Tailwind CSS v4
- shadcn/ui initialized with `card` and `button` components
- `@anthropic-ai/sdk` integrated via `lib/claude.ts` wrapper exposing `claude-sonnet-4-6` and `claude-opus-4-7`
- `/api/health` route that calls Claude Sonnet 4.6 with a trivial prompt and returns the response, model, latency, and timestamp
- Landing page renders system status (live call to `/api/health`) and the 10-PR build roadmap

The remaining PRs (rubric through Q&A + audit trail) are not yet built — see Roadmap below.

### PR 2 — Demo data + viewer (complete)

The healthcare procurement scenario lives in `/public/demo-bids/`:

- `rfp.pdf` — Midwest Regional Health RFP for ambient clinical documentation
- `scribeai-bid.pdf` — ScribeAI Health response (premium positioning)
- `clinicalnote-bid.pdf` — ClinicalNote.ai response (aggressive pricing)
- `documind-bid.pdf` — DocuMind Health response (specialty depth)

Document metadata lives in `lib/documents.ts`. The `/documents` route lists all four; `/documents/[id]` renders an inline PDF viewer.

## Tech stack

- **Framework:** Next.js 15 (App Router) on TypeScript strict mode
- **Styling:** Tailwind CSS v4
- **Components:** shadcn/ui (Radix Slot, class-variance-authority, lucide-react)
- **AI SDK:** `@anthropic-ai/sdk`
- **Package manager:** pnpm
- **Node:** 20+
- **Deployment:** Vercel

## Local development

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy the env example and add your Anthropic API key:

   ```bash
   cp .env.example .env.local
   ```

   Then edit `.env.local` and set `ANTHROPIC_API_KEY` (get one at https://console.anthropic.com/settings/keys).

3. Start the dev server:

   ```bash
   pnpm dev
   ```

4. Open http://localhost:3000. The landing page calls `/api/health` on load and shows whether the Claude integration is live.

If `ANTHROPIC_API_KEY` is not set, the page still renders but the system status card will show a clear error explaining what's missing.

## Deployment

BidLens is built to deploy to Vercel:

1. Connect this repo to a Vercel project.
2. Add `ANTHROPIC_API_KEY` to **Project Settings → Environment Variables** (Production, Preview, Development as appropriate).
3. Push to the configured branch — Vercel auto-deploys.

After the deploy, visit the production URL and confirm the system status card shows a green "ok" indicator.

## Roadmap

- [x] **PR 1 — Scaffold** — Next.js, Anthropic SDK, health check
- [x] **PR 2 — Demo data + viewer** — RFP + 3 vendor bid PDFs
- [ ] PR 3 — Rubric configurator (categories, weights, hard requirements)
- [ ] PR 4 — Ingestion agents (RFP and bid parsing to structured JSON)
- [ ] PR 5 — Technical Evaluator (per-vendor technical scoring with citations)
- [ ] PR 6 — Commercial Evaluator (TCO normalization + commercial scoring)
- [ ] PR 7 — Compliance Evaluator (certification + BAA verification)
- [ ] PR 8 — Comparative dashboard (cross-vendor synthesis)
- [ ] PR 9 — Risk register + Evaluation memo (Opus-driven synthesis)
- [ ] PR 10 — Ask the agent + Audit trail (Q&A and defensibility)
