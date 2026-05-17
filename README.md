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

### PR 5 — Technical Evaluator (complete)

The first per-vendor scoring agent. For each vendor, the Technical Evaluator scores the rubric's technical criteria (EHR integration, ambient capture, note quality, language support, mobile/identity) on a 1–10 scale, checks the technical hard requirements (Epic integration, English+Spanish capture), surfaces technical gaps as flags, and computes a weighted technical score.

- Agent: `lib/evaluation/technical.ts`, built on shared evaluator helpers in `lib/evaluation/shared.ts`
- Inputs: RFP ingestion + bid ingestion + rubric technical category
- The weighted category score is recomputed server-side as an integrity check — the agent's arithmetic is not trusted blindly
- Page: `/evaluations` — one card per vendor, run the technical evaluation, inspect the scorecard with hard-requirement checks, criterion scores, citations, and flags
- Persistence: `evaluations` table, one row per (vendor, category)
- Endpoints: `GET /api/evaluations`, `GET|POST /api/evaluations/[vendorId]/[category]`
- Commercial and Compliance evaluators (PRs 6–7) follow the same pattern

### PR 6 — Commercial Evaluator (complete)

The second per-vendor scoring agent. Scores the rubric's commercial criteria (3-year TCO, contract flexibility, implementation cost transparency, pricing model fit), checks the commercial hard requirement (auto-renewal capped at one year), and surfaces commercial risks as flags.

- **Deterministic TCO normalizer** (`lib/evaluation/tco.ts`) — pure code, not an LLM call — recomputes each vendor's 3-year total cost on consistent assumptions (3,500 providers, 3-year horizon, escalation applied to years 2–3) so vendors are comparable apples-to-apples. The agent reasons about the normalized numbers; it does not do the arithmetic.
- Agent: `lib/evaluation/commercial.ts`, reusing the shared evaluator scaffolding
- The TCO breakdown is stored in the evaluation result (`tco_breakdown` field) and displayed in the commercial scorecard
- Same `evaluations` table, same output contract as the Technical Evaluator; `EVALUATION_RESPONSE_SCHEMA` extracted into `lib/evaluation/shared.ts` so both evaluators share it

### PR 7 — Compliance Evaluator (complete)

The third per-vendor scoring agent — and the last one in the per-vendor scoring layer. Scores the rubric's compliance criteria (HIPAA + BAA terms, SOC 2 + HITRUST status, data residency, model training data terms, audit + incident response), checks the five compliance hard requirements, and surfaces compliance risks as flags.

- **Deterministic hard-requirement pre-checks** (`lib/evaluation/compliance-checks.ts`) inferred directly from the bid's typed ingestion enums (`baa_template_acceptance`, `soc2_type_ii_status`, `model_training_data_handling`, etc.). The agent uses these as the basis and refines with rationale + citation — code does the deterministic inference; the LLM owns the final judgment with evidence.
- Agent: `lib/evaluation/compliance.ts`, reusing the shared evaluator scaffolding
- Three places code now does deterministic work instead of the LLM: weighted-score recompute (PR 5), TCO normalization (PR 6), compliance hard-requirement pre-checks (PR 7). Same principle: code does deterministic math/inference; the LLM does judgment.
- After PR 7, every vendor has scores in all three categories — PR 8 (cross-vendor synthesis) can begin

### PR 8 — Comparative Dashboard (complete)

The first cross-vendor synthesis agent. Reads all 9 per-vendor evaluations plus the 3 bid ingestions and produces:

- Side-by-side scorecard summaries (overall weighted score, per-category sub-scores, hard-requirement failure status)
- Sortable per-criterion comparison across vendors
- Cross-vendor insights: common gaps, standout strengths, standout weaknesses, cross-vendor risks
- Recommended ranking with rationale, with hard-requirement-failure caveats surfaced explicitly
- Clarification questions to send back to specific vendors (with copy-to-clipboard)
- Executive summary

Uses the synthesis model chain (`pro → flash → flash-lite`) per the routing policy — highest reasoning for the lowest-volume, highest-stakes step.

- Page: `/compare`
- Agent: `lib/synthesis/comparative.ts` (single agent that sees everything, by deliberate design — synthesis is about connections, not parallel decomposition)
- Pre-computed vendor score summaries (deterministic; agent's arithmetic is overridden server-side)
- Persistence: `syntheses` table (one row per kind: `comparative` | `memo` | `risk_register`)

### PR 9 — Evaluation Memo + Risk Register (complete)

Two synthesis agents producing the deliverable artifacts procurement teams archive.

- **Memo** (`lib/synthesis/memo.ts`) — long-form prose document at `/memo`. The artifact the VP of Procurement reads and signs. Includes executive summary, recommendation with caveats, per-vendor analysis, open questions, signatures block. Markdown export.
- **Risk Register** (`lib/synthesis/risk-register.ts`) — structured risk table at `/risk-register`. Each risk has category, severity, likelihood, affected vendors, citations, recommended mitigation, and suggested owner team. Filterable by severity / category / vendor and CSV-exportable.

Both use the synthesis model chain (`pro → flash → flash-lite`) for highest reasoning quality.

### PR 10 — Ask the agent + Audit trail (complete)

The final PR closes the demo loop with two features:

- **Ask the agent** (`/ask`) — open-ended Q&A grounded in the full BidLens corpus (RFP, bids, evaluations, comparative synthesis, memo, risk register). Every answer is cited to its source. Routes through the `qa` model chain (flash-lite-led for low interactive latency). Session state is per-visit; clicking "New session" resets the thread.
- **Audit trail** (`/audit`) — chronological log of every state-changing agent action (ingestions, evaluations, synthesis runs, Q&A turns, rubric edits). Each event records model, token usage, latency, status, and metadata. JSON-exportable.

After PR 10, BidLens has every surface a procurement team needs: RFP/bid review → rubric configuration → ingestion → per-vendor scoring → cross-vendor synthesis → memo → risk register → interactive Q&A → audit.

### PR 5.5 — AI fallback chain

All Gemini calls go through `generateWithFallback()` in `lib/ai.ts`, which degrades gracefully on rate-limit (429) or transient server errors (5xx). Non-retryable errors (400 / 401 / 403, schema failures) surface immediately rather than burning the chain. Each ingestion and evaluation record stores the model that actually served it, so fallbacks are visible and attribution stays honest.

### PR 5.6 — Task-aware model routing

`generateWithFallback(taskType, args)` routes each call through a model chain chosen for that task type, defined in `MODEL_CHAINS` (`lib/ai.ts`):

- **Ingestion** — `flash-lite → flash → pro`. Extraction; low reasoning demand, high volume, so the cheapest high-quota model leads.
- **Evaluation** — `flash → flash-lite → pro`. Judgment; the stronger model leads, flash-lite is an acceptable degradation.
- **Synthesis** — `pro → flash → flash-lite`. Highest reasoning demand, lowest volume (~2 calls), so the strongest model leads.
- **Q&A** — `flash-lite → flash → pro`. Interactive and latency-sensitive.

Two principles: capability matching (model strength to task demand) and quota-aware ordering (high-volume tasks lead with the high-quota model). Every chain has full fallback coverage. Rationale lives in `lib/ai-routing-policy.ts` and is surfaced on the landing page.

## Tech stack

- **Framework:** Next.js 15 (App Router) on TypeScript strict mode
- **Styling:** Tailwind CSS v4
- **Components:** shadcn/ui (Radix Slot, class-variance-authority, lucide-react)
- **AI:** Google Gemini via `@google/genai` SDK — fallback chain `gemini-2.5-flash-lite` → `gemini-2.5-flash` → `gemini-2.5-pro` (graceful degradation on rate limits / transient 5xx)
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
- [x] **PR 5 — Technical Evaluator** — per-vendor technical scoring with citations
- [x] **PR 6 — Commercial Evaluator** — TCO normalization + commercial scoring
- [x] **PR 7 — Compliance Evaluator** — certification + BAA verification (deterministic pre-checks + agent rationale)
- [x] **PR 8 — Comparative dashboard** — cross-vendor synthesis (`/compare`)
- [x] **PR 9 — Evaluation memo + Risk register** — formal deliverable artifacts (`/memo`, `/risk-register`)
- [x] **PR 10 — Ask the agent + Audit trail** — interactive Q&A (`/ask`) and defensibility log (`/audit`)

**BidLens v1.0 — all 10 PRs shipped.**
