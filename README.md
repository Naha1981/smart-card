# SmartCart — AI Commerce Operating System

Scaffolded per `CommerceOS AI PRD v2.0` and `AI-Native Enterprise Full-Stack Architecture Standard v4.1`.
Stack: **Next.js App Router (monolith) · Neon Postgres + Drizzle + pgvector · Better Auth · Vercel AI SDK · Evolution API · PayFast/YOCO**.

## What's actually wired end-to-end

- **Multi-tenant schema** (`src/lib/db/schema.ts`) — every business table carries `tenant_id`.
- **Tenant isolation enforcement** (`src/lib/db/tenant-scope.ts`) — `scoped()` helper + `TenantContext` resolved from session (`src/lib/auth/tenant-context.ts`), never from client input.
- **AI conversation engine** (`src/modules/ai/engine.ts`) — provider-agnostic model routing, full tool registry (search, price, stock, promos, cart, loyalty, checkout, order status, escalate, save list, plan meals), grounded-by-construction system prompt.
- **WhatsApp path**: Evolution client → shared webhook (`app/api/webhooks/evolution`) → AI engine → reply sent back. Instance-to-tenant routing is a `TODO` (see below).
- **Web widget path**: `app/api/v1/chat` → AI engine, streamed into `app/widget/[tenantSlug]` (rendered in an iframe), loaded via `public/embed.js` — the single `<script>` tag retailers paste.
- **Payments**: PayFast client with correct field-order signing + ITN validation stub, YOCO client, provider abstraction. Webhooks are the only path that confirms an order (`app/api/webhooks/payfast`, `/yoco`).
- **Catalog CSV import** (`app/api/v1/catalog/import`) — the universal fallback connector.
- **Meal planning** (`src/modules/workflows/service.ts`) — LLM proposes a plan, every ingredient is re-grounded against the real catalog via `searchProducts` before a price is shown.
- **Attribution + executive dashboard** (`src/modules/attribution/service.ts`, `app/(app)/dashboard`) — AI-influenced revenue and basket uplift computed from real `orders` rows.
- **Event bus** (`src/lib/events/bus.ts`) — the extraction seam; every module emits through it.

## What's intentionally stubbed (per your "scaffold everything" call)

| Area | Status |
|---|---|
| Shopify / WooCommerce connectors | Not started — only CSV import is real |
| Evolution instance→tenant routing | Webhook picks the first `evolution` integration row; needs an `instanceName` column + lookup once you have >1 tenant |
| Loyalty **write** (earning points) | Read/apply only, per PRD open question #3 |
| Cart persistence | Cart lives on the `orders` row in `pending` status, not a separate `carts` table (per Architecture Standard §11 — don't extract until metrics demand it) |
| Onboarding wizard UI | Page stub only (`app/(app)/onboarding`) — service functions in `modules/tenants/service.ts` are real |
| Notifications dispatch | Rows are queued (`modules/notifications/service.ts`), nothing actually sends yet |
| Analytics (missed sales, substitutions) | Stub — needs search-miss logging before it's meaningful |
| Auth UI (sign in/up pages) | Not built — `src/lib/auth/config.ts` (Better Auth) is wired, just no forms yet |
| Vision (photo-to-basket), voice (STT), OCR (handwritten list) | Not started — J2/J4/J5 journeys need Whisper/vision model wiring in the Evolution message handler |
| Tests, CI, eval harness | Not started (Architecture Standard §9, §3.6) |
| Cross-tenant leak tests | Not started — the `scoped()` helper is the enforcement point to test against |

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL at minimum to run anything
npm run db:generate          # generate SQL migrations from schema.ts
npm run db:migrate           # apply them to your Neon database
npm run dev
```

You'll need, at minimum, to get past a blank screen:
1. A **Neon Postgres** database (free tier is fine) → `DATABASE_URL`
2. `pgvector` extension enabled on that database (`CREATE EXTENSION vector;`)
3. `BETTER_AUTH_SECRET` (`openssl rand -base64 32`)
4. One AI provider key (`OPENAI_API_KEY` is the path of least resistance given the default config; Groq works too, just point `AI_DEFAULT_PROVIDER=groq` and use Groq model names)

Everything else in `.env.example` (Evolution, PayFast, YOCO, Shopify) is only needed once you're testing those specific paths.

## What I need from you to keep going

1. **GitHub repo + token** (as you mentioned) — I'll push this scaffold once you share them.
2. **Which of the stubbed items above matters first** — my instinct is: Shopify/WooCommerce connector, then onboarding UI, then vision/voice for WhatsApp, since that's the shortest path to a real pilot per the PRD's M1–M3 milestones.
3. **Provider decision**: confirm OpenAI vs. Groq vs. Anthropic as the default — this changes nothing structurally (that's the point of the abstraction in `lib/ai/provider.ts`), just tell me the env values to set.
4. **A real Neon project** (or say the word and I'll switch everything to Supabase Postgres instead — the schema and Drizzle layer don't care, only `lib/db/client.ts` and the connection driver would change).
