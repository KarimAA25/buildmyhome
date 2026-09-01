# DEVELOPMENT ENVIRONMENT OVERRIDES (READ FIRST — SUPERSEDES CONFLICTING SECTIONS BELOW)

These overrides take precedence over anything in §1–§60 that conflicts with them.
Everything below this block remains the long-term product vision and must not be discarded.

---

## A. ARCHITECTURE: SEPARATE FRONTEND AND BACKEND FROM DAY ONE

This project is a monorepo containing two independently deployable applications plus one shared package.

```
buildmyhome/
├── apps/
│   ├── web/            Next.js 15 + React + TypeScript + Tailwind (App Router)
│   │                   Deploys to Vercel. Contains NO business logic and NO AI calls.
│   └── api/            Fastify + TypeScript backend
│                       Deploys to Railway. Contains ALL business logic and ALL AI calls.
├── packages/
│   └── shared/         Zod schemas + inferred TypeScript types used by BOTH apps.
│                       This is the API contract. Neither app may define its own copy.
└── CLAUDE.md
```

### Hard rules for the split

1. `apps/web` communicates with `apps/api` **only** over HTTP, only through a single typed
   client module (`apps/web/lib/apiClient.ts`). No component or page may call `fetch` directly.
2. `apps/web` must never import from `apps/api`. Ever. The only shared code is `packages/shared`.
3. `OPENAI_API_KEY` exists only in `apps/api`'s environment. It must never appear in
   `apps/web`, in any `NEXT_PUBLIC_*` variable, or in any client bundle.
4. Every request body and response body crossing the boundary must be defined as a Zod
   schema in `packages/shared` and validated on **both** sides.
5. `apps/api` enables CORS for the web origin only, not `*`.

---

## B. NO DATABASE — CLIENT-HELD STATE, STATELESS BACKEND

There is no database in this phase. Do not install Prisma, Drizzle, Postgres, SQLite, or any ORM.

### The state model

The **browser** is the state holder. The **backend is a pure function** that remembers nothing
between requests.

```
Browser holds in React state:
  - original uploaded image
  - current generated image
  - current DesignSpecification
  - current Quote
  - array of previous versions (in-memory only, lost on refresh)

Each request to the API sends everything needed:
  POST /design/create   { originalImage, userPrompt }
                        → { designSpecification, generatedImage, quote, version: 1 }

  POST /design/modify   { currentImage, currentDesignSpecification, changeRequest, versionNumber }
                        → { designSpecification, generatedImage, quote, version: n+1 }
```

The backend never looks anything up. If it needs prior context, the client supplied it.
This satisfies §8 and §28 (current image + current spec are the primary references for
iterative editing) without any persistence.

### Persistence must still be an interface, not an absence

Define a `PersistenceService` interface covering the operations a real database would serve
(save design version, load design version, list project history, record AI usage).
Implement `NoOpPersistenceProvider` — methods satisfy the interface and do nothing / return empty.

Business logic calls the interface. When a database is added later, only the provider changes.
Do **not** scatter "we have no DB" assumptions through the service layer.

### Catalog without a database

The product catalog (§19) ships as a static JSON file in `apps/api/data/catalog.json`,
loaded into memory on boot. Embeddings are precomputed by a build-time script
(`apps/api/scripts/embed-catalog.ts`) and stored in that same JSON file.

Product search (§20) is implemented as `InMemoryCosineSimilaritySearchProvider` behind the
`ProductSearchService` interface. Brute-force cosine similarity over the in-memory array is
acceptable for a catalog of dozens of products. Leave a `PgVectorSearchProvider` stub.

### Image storage without object storage

Images move as base64 data URLs in request/response bodies. No filesystem writes, no R2, no
signed URLs in this phase. Implement `StorageService` with an `InlineBase64StorageProvider`;
leave a `CloudflareR2StorageProvider` stub.

Set generous body size limits on the Fastify server (images are 1–3 MB, base64 inflates ~33%).

### What is explicitly deferred and must be stubbed, not faked

- §39 design history → exists only for the current browser session, in React state
- §44 cost tracking → `AIUsageService` interface with a console-logging provider
- §49 quote versioning → versions held client-side; prior quotes are never recalculated
- §33 async job queue → **not** a job table. Use Server-Sent Events to stream progress states
  (ANALYZING, SEARCHING_PRODUCTS, CREATING_DESIGN, CALCULATING_QUOTE, GENERATING_IMAGE,
  VALIDATING, COMPLETED, FAILED) over a single long-lived request. Business logic must still
  be fully separated from request handling so a real queue can be added later.

Do not silently drop any of these. Each gets a real interface and a deliberate no-op provider.

---

## C. AI MODEL IDENTIFIERS — CONFIRM BEFORE WIRING

§3, §4 and §5 name "GPT-5.6 Terra," "GPT-5.6 Luna," and "GPT Image 1.5." These are
placeholder names, not confirmed live OpenAI API model identifiers.

**Before wiring any provider, stop and ask the user to confirm the exact model strings.**
Do not guess, and do not invent a plausible-looking identifier.

Keep `REASONING_MODEL`, `CHEAP_MODEL`, `IMAGE_MODEL`, `EMBEDDING_MODEL` env-configurable
per §45 regardless.

---

## D. SECURITY FOR A PUBLIC API

Because `apps/api` is publicly reachable and holds the OpenAI key, implement from day one:

- A shared secret: `apps/web` sends `X-API-Secret`; `apps/api` rejects requests without it.
  (This is deterrence for a prototype, not real auth — real auth arrives with persistence.)
- IP-based rate limiting on all generation endpoints (`@fastify/rate-limit`).
- Image MIME type and size validation before any AI call.
- Prompt length limits.
- CORS restricted to the known web origin.

---

## E. REVISED PHASE PLAN (REPLACES §57)

**Phase 1 — Foundation**
Monorepo scaffold, `apps/web` + `apps/api` + `packages/shared`, all service interfaces from §24
defined with no-op or stub providers, Zod contract schemas, health-check endpoint, CORS,
rate limiting, shared-secret middleware, both apps running locally and talking to each other.

**Phase 2 — Workspace UI**
Upload, camera capture, preview, prompt input, generate button. Wired to a mocked API response.

**Phase 3 — Room analysis** (first real AI call, behind `VisionService`)

**Phase 4 — Static catalog JSON + embedding script**

**Phase 5 — In-memory semantic product search**

**Phase 6 — DesignSpecification generation + Zod validation**

**Phase 7 — Deterministic quotation engine** (all arithmetic in code, per §14)

**Phase 8 — Image generation** (`ImageGenerationService`)

**Phase 9 — Image validation + retry policy** (§31, §32)

**Phase 10 — Iterative modify flow** (client-held versions, §6–§11)

**Phase 11 — Before/after UI + results panel**

**Phase 12 — SSE progress streaming**

**Later (not now):** persistence, auth, object storage, hosted Postgres + pgvector,
real job queue, contractor ingestion.

---

## F. ENVIRONMENT VARIABLES FOR THIS PHASE

`apps/api/.env`
```
PORT=4000
NODE_ENV=development
OPENAI_API_KEY=
REASONING_MODEL=
CHEAP_MODEL=
IMAGE_MODEL=
EMBEDDING_MODEL=
MAX_IMAGE_GENERATION_RETRIES=2
API_SHARED_SECRET=
ALLOWED_ORIGIN=http://localhost:3000
MAX_UPLOAD_BYTES=10485760
MAX_PROMPT_LENGTH=2000
```

`apps/web/.env.local`
```
NEXT_PUBLIC_API_URL=http://localhost:4000
API_SHARED_SECRET=
```

No `DATABASE_URL`. No `R2_*`. No auth secrets. Those arrive with the persistence phase.

Note: `API_SHARED_SECRET` in `apps/web` must be used only in server-side route handlers or
server actions that proxy to the API — never in a client component, never prefixed
`NEXT_PUBLIC_`.

---

## G. WORKING AGREEMENT

- Plan before coding. Present architecture for approval before writing implementation files.
- Implement one phase at a time and stop for review at each phase boundary.
- Never break the boundary rules in section A for convenience. If a rule feels like it's in the
  way, stop and raise it instead of working around it.
- Never invent an OpenAI model identifier, a product price (§51), or a catalog entry.
