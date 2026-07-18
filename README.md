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
| Evolution instance→tenant routing | **Fixed** — webhook now matches `integrations.credentials->>'instanceName'` against the inbound payload, not "first row" |
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

1. `git clone https://github.com/Naha1981/smart-card.git && cd smart-card && npm install`
2. `cp .env.example .env.local` and set:
   - `DATABASE_URL` — your Neon connection string
   - `BETTER_AUTH_SECRET` — `openssl rand -base64 32`
   - `AI_DEFAULT_PROVIDER` + the matching API key (`OPENAI_API_KEY` by default; set to `groq` + `GROQ_API_KEY` if you'd rather use your usual Groq setup)
3. **Run migrations by hand in the Neon console** (SQL Editor → paste → run), in order:
   - `drizzle/0000_init.sql` — creates every table, enables `pgvector`
   - `drizzle/0001_seed_demo.sql` — optional, adds a demo tenant `naha-fresh` with 4 products so you have something to talk to immediately

   These are hand-written to exactly match `src/lib/db/schema.ts`. I couldn't run `drizzle-kit migrate` myself — my sandbox's network allowlist doesn't include `neon.tech`, only npm/GitHub/PyPI-type domains — so this is the one step I can't do for you. Once a schema change is needed later, run `npm run db:generate` locally (no network needed, just reads `schema.ts`) and apply the resulting SQL the same way, or connect `drizzle-kit migrate` directly since your machine *can* reach Neon.
4. `npm run dev`, then visit `/widget/naha-fresh` to talk to the demo tenant, or `/dashboard?tenant=<tenant-id-from-the-tenants-table>` for the ROI view.

Note: I'd rotate the Neon database password after setup, since it was shared in this chat in plain text.

## Getting WhatsApp actually talking to the AI

Your Evolution instance (`smartcart-my-evolution-api.onrender.com`) and its credentials are already wired into `drizzle/0002_seed_evolution_integration.sql` (run it after `0000` and `0001`) and `.env.example`. What's still missing is the last mile:

1. **A public URL.** Evolution needs to POST inbound WhatsApp messages to `app/api/webhooks/evolution`, and it can't reach `localhost:3000`. Either deploy to Vercel first (`vercel deploy`, then set env vars in the Vercel dashboard), or use a tunnel like `ngrok http 3000` for local testing. This is separate from your Evolution instance's own URL (`smartcart-my-evolution-api.onrender.com`) — that one already being public lets your app call *out* to Evolution; this step is about Evolution calling *into* your app.
2. **Register the webhook** — set `ADMIN_SETUP_SECRET` in `.env.local`, then:
   ```bash
   curl -X POST http://localhost:3000/api/admin/setup-evolution-webhook \
     -H "Content-Type: application/json" \
     -H "x-admin-secret: <your ADMIN_SETUP_SECRET>" \
     -d '{"tenantSlug":"naha-fresh","publicWebhookUrl":"https://<your-public-url>/api/webhooks/evolution"}'
   ```
   This is a one-off setup route (`app/api/admin/setup-evolution-webhook`), not part of the product — re-run it any time your public URL changes (every new ngrok session, for instance). Consider deleting the route once you're deployed for real and don't need to re-register webhooks by hand.
3. **Send a WhatsApp message** to the number tied to your Evolution instance and check your server logs / the `messages` table for the round trip.

I can't test any of this myself — `onrender.com` isn't on my sandbox's network allowlist, so I've wired it from the code side but the live connectivity check is on you.

Everything else in `.env.example` (Evolution, PayFast, YOCO, Shopify) is only needed once you're testing those specific paths.

## What I need from you to keep going

1. **GitHub repo + token** (as you mentioned) — I'll push this scaffold once you share them.
2. **Which of the stubbed items above matters first** — my instinct is: Shopify/WooCommerce connector, then onboarding UI, then vision/voice for WhatsApp, since that's the shortest path to a real pilot per the PRD's M1–M3 milestones.
3. **Provider decision**: confirm OpenAI vs. Groq vs. Anthropic as the default — this changes nothing structurally (that's the point of the abstraction in `lib/ai/provider.ts`), just tell me the env values to set.
4. **A real Neon project** (or say the word and I'll switch everything to Supabase Postgres instead — the schema and Drizzle layer don't care, only `lib/db/client.ts` and the connection driver would change).
