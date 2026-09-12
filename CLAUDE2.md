# BUILD MY HOME — STAGE 2: DATABASE, STORAGE, MULTI-TENANT CONTRACTORS

This file is an addendum to CLAUDE.md. It does not replace CLAUDE.md — read both.
Where this file conflicts with CLAUDE.md's original DEVELOPMENT ENVIRONMENT OVERRIDES
(no-database, stateless backend), THIS FILE WINS. CLAUDE.md sections 1-60 (the long-term
product vision) remain in force except where explicitly overridden below.

**This is the final, complete version of this file.** It supersedes all earlier drafts
in full — earlier versions assumed a stored `catalog_products` table (wrong — see
section 3), an unconfirmed version cap (now confirmed — see section 2c), and had no
retrieval UI or email notification spec (now added — sections 2d and 4). Read this
file top to bottom as the single source of truth for this stage; don't reconstruct
anything from older copies.

This stage fulfills the stub providers deferred in CLAUDE.md section B:
- `NoOpPersistenceProvider` → replaced by `SupabasePersistenceProvider`
- `InMemoryCosineSimilaritySearchProvider` → replaced by `LiveContractorPageProvider`
  (NOT database-backed — see section 3. There is no stored product catalog anywhere
  in this project.)
- `InlineBase64StorageProvider` → replaced by `SupabaseStorageProvider`

Do not delete the old stub providers' code — keep them behind the same interfaces in case
we ever need a fully offline/local demo mode again. Just switch which provider is wired
into `container.ts` by default.

---

# 1. LOCKED ARCHITECTURAL DECISIONS

These were negotiated and are final for this stage. Do not deviate without asking.

1. **Contractor identification is by a generated token, not by the contractor's raw
   website URL.** The website URL is stored purely as a display/reference field.
2. **There is no product catalog table.** Each contractor supplies one or more
   specific product/project page URLs on their own website (never their homepage).
   At generation time, the AI reads those pages live and extracts what it needs.
   Nothing about a contractor's products is manually entered or pre-stored. See
   section 3 for the full mechanism and reasoning.
3. **Email + prompt number has no expiry and no additional protection.** Intentional
   simplicity for this stage. Do not add rate-limiting, expiry, or verification to
   the retrieval flow unless explicitly asked later.
4. **The retrieval flow returns a single generic "no such record" response for any
   mismatch** — wrong email, wrong prompt number, or a version number that was never
   generated all produce the exact same response. Never reveal which field was wrong.
5. **Every generated design and every quote line item carries the source URL(s)** of
   the contractor page(s) it was drawn from. The generated picture and its quote must
   always be traceable back to the contractor's own website.
6. **A design thread is capped at 3 versions (V1–V3) for now.** This is a free-tier
   limit, not a permanent rule — a paid "buy tokens to continue past V3" feature is
   planned later. See section 2c for how this is built so that feature doesn't
   require a schema change when it arrives.
7. **Every successful generation triggers two notification emails** — one to the
   contractor, one to the end user — each containing the quotation, prompt number,
   and version number, and never the generated image. See section 4 for the full
   mechanism. Email failures must never block or fail the generation itself.

---

# 2. THE IDENTITY MODEL (REPLACES "USER" ENTIRELY)

There is no login, no registration, no password, no session cookie tied to a person.
Two separate identity concepts exist, and they must not be conflated:

## 2a. Contractor identity (who owns this frontend deployment)

- Each contractor is a row in `contractors`, created via an internal script (see
  section 8), never via a public form.
- At creation, the contractor is issued a `contractor_token` — a random, URL-safe,
  unguessable string (minimum 24 characters, e.g. nanoid). This token is the ONLY
  thing that identifies which contractor a given `apps/web` deployment belongs to.
- The contractor's `website_url` is stored for display/reference only and must never
  be used to look up or authenticate a contractor.

## 2b. End-user identity — the "prompt number" (not "PIN")

Call this field `prompt_number` everywhere — in the schema, the API, and the UI copy.
Not "PIN."

**Timing:**

- The prompt number is generated **client-side, the moment the page loads** —
  before the user has uploaded a photo, written a prompt, or entered an email. It's
  a random 6-digit number shown on screen from the start (near the email field), with
  a note: "Save this prompt number — you'll need it with your email to find this
  design again."
- It stays fixed for the entire page session. If the user generates V1, then modifies
  to V2, then V3, all without reloading, every version is stored under that same
  prompt number.
- It only changes if the user reloads the page, or a different visitor loads a fresh
  page. Reload = new number. No reload = same number, no matter how many versions
  they generate.
- The user cannot generate without entering an email — the email field is required
  before the first "Generate" action is enabled.

**How it becomes authoritative:**

- The client-generated number is sent along with the first `POST /design/create`
  call. The backend attempts to save it as-is.
- Collision handling: if `(contractor_id, prompt_number)` already exists (rare, but
  must be handled), the backend generates a fresh number, saves that instead, and
  returns it in the response. The frontend must detect when the returned number
  differs from what it displayed and update the on-screen number accordingly.
- Later versions of the same design thread (`POST /design/modify`) don't re-send or
  re-check the prompt number — the frontend already holds `designId` from the create
  response and uses that directly.

**Retrieval:**

- The end user provides: email + prompt number + version number. All three must
  match a single `designs`/`design_versions` row scoped to the requesting frontend's
  `contractor_id`, or the response is a generic "no such record" (rule 4, section 1).
- A design under Contractor A must never resolve via Contractor B's frontend, even
  with an identical combination — uniqueness and every lookup are scoped by
  `contractor_id`, never global.
- Retrieval returns the full record: design specification, generated image (fresh
  signed URL), and that version's quote and quote items.

## 2c. Version limit (free tier now, paid extension later — build for both)

- Every design is limited to 3 versions (V1, V2, V3). On any `POST /design/modify`
  call where the design already has 3 versions, the backend must reject the request
  rather than create a 4th.
- **This limit must not be a number hardcoded inline in the route handler.** Two
  things make it swappable later without a schema migration:
  1. An env var, `MAX_VERSIONS_PER_DESIGN` (default `3`), is the global default.
  2. The `designs` table has a nullable `max_versions` column (section 5). When
     null, the global env default applies. When set, that design's own value wins —
     this is the hook for the future paid feature (raising one design's cap after a
     token purchase), with no new table or schema change needed later.
- The limit check itself should live in one small, clearly-named function (e.g.
  `canCreateAnotherVersion(design)`), not inlined ad hoc.
- **Do not build the token/payment system now.** Just leave the `max_versions`
  column and the single-function check in place for later.
- Rejection response: a clear, structured error (section 9) so the frontend can show
  a plain "you've reached the maximum number of versions for this design" message.
  Do not build any upsell/payment UI yet.

## 2d. Frontend structure — two tabs

The tool has two tabs, both visible from the top of the page at all times — not
something surfaced only after generating something:

- **"Generate New"** — the existing page. Photo upload, prompt input, the
  auto-generated prompt number displayed per 2b, and the required email field.
- **"Retrieve Old"** — a new page with exactly three fields — email, prompt number,
  version number — and a single button labeled **Retrieve**.

On a successful retrieval, show the result using the exact same results view used by
Generate New — same components, same layout (image, design specification summary,
quote, source URL attribution) — not a separate or reduced display. On failure, show
the generic message backing `GET /design/lookup`'s 404 (rule 4, section 1) — never
indicate which of the three fields was wrong.

---

# 3. PRODUCT SOURCING — LIVE FROM CONTRACTOR PAGES, NOT A DATABASE

## 3a. What gets stored

For each contractor, you add one or more specific URLs — a product page or a project
page on that contractor's own website. Never the homepage. Each URL is one row in
`contractor_reference_pages` (section 5). Nothing about the products themselves —
name, price, description, image — is entered manually or stored ahead of time. The
URL is the only thing that's stored.

## 3b. What happens at generation time

1. The backend loads that contractor's `contractor_reference_pages` rows.
2. For each page (or the ones judged relevant to the specific room request), the
   backend fetches the page's live content server-side.
3. That content — text and any product images found on the page — is passed to the
   reasoning/vision AI alongside the user's room photo and prompt, so the AI can
   identify which real products/materials from that page fit the request.
4. From there, the pipeline is unchanged from CLAUDE.md: structured ADD/REMOVE/MODIFY
   operations (§11), a DesignSpecification (§12), and a deterministically-calculated
   quote (§14). The arithmetic is still done in code, never by the LLM. A price is
   still never invented — if the fetched page doesn't show one, that line item gets
   `confidence: LOW` and an appropriate `pricing_type`, exactly per §16/§51, never a
   fabricated number.

## 3c. Why there's no catalog table

This isn't a shortcut — it's the actual requirement. You explicitly do not want
contractor product data manually entered or pre-populated. The AI reading the live
page IS the catalog. A stored table would mean either redundant manual re-entry of
what's already on the page, or an automated scrape-and-cache step that could drift
out of sync with the real page — neither of which you asked for. So: no table, no
embeddings, no vector index for this. `LiveContractorPageProvider` fetches and reads
on demand, every time.

## 3d. Practical consequences — informational, not a request for a redesign

- Each generation now includes a page-fetch-and-read step: modest added latency and
  AI cost versus reading a pre-stored row. Fine for a handful of pages per contractor.
- If a contractor's page is down, restructured, or removed, that generation should
  degrade gracefully (use what's available, mark affected items appropriately) rather
  than crash outright.
- If a contractor accumulates many reference pages over time, fetching all of them on
  every generation could get slow eventually. Not a Phase-1 concern.

## 3e. Attribution

Every `design_versions` row stores `source_urls` — the exact contractor page URL(s)
actually used for that version. Every `quote_items` row stores its own `source_url`,
since different line items in the same quote may come from different pages.

---

# 4. EMAIL NOTIFICATIONS

## 4a. What triggers it

After every successful generation — `POST /design/create` (version 1) and every
successful `POST /design/modify` (version 2, version 3) — two emails are sent. This
fires on every version, not just the first.

## 4b. Recipients and content

**To the contractor** (their `contact_email` from the `contractors` row, resolved
via the request's contractor token):
- The end user's email address
- The prompt number
- The version number
- The full quotation (line items and total)

**To the end user** (the email they supplied on that request):
- The prompt number
- The version number
- The full quotation

Neither email includes the generated room image — quotation and identifiers only,
as explicitly decided. This is a receipt/notification, not a marketing email.

## 4c. Sending mechanism

Send via a single, fixed Gmail account using SMTP (`nodemailer`), authenticated with
a Gmail **App Password** (not the account's real login password — requires 2-Step
Verification enabled on that Google account). The display name on the From header is
configurable (`EMAIL_FROM_NAME`); the underlying Gmail address is not fully hidden
from a recipient who inspects headers — that's an SMTP/Gmail limitation, not
something to try to engineer around.

This is one sender account for every email to every contractor and every end user,
across all contractor deployments — it is not per-contractor.

## 4d. Failure handling

If sending either email fails for any reason (bad address, Gmail rate limit, network
error), the generation itself must still succeed and still be returned to the user
normally. Email is best-effort: log the failure, do not retry indefinitely, and
never block or fail the request it's attached to.

---

# 5. DATABASE SCHEMA (SUPABASE / POSTGRES)

Use Supabase's MCP connection to create these directly. No ORM migration tool is
required unless Claude Code has a strong reason to prefer one — raw SQL via the MCP
tools is acceptable and simpler to audit. Note: pgvector is NOT needed for this
project — there is no embedding-based search, since there is no stored catalog.

```sql
-- Contractors: who this platform is sold to
create table contractors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_email text not null,
  phone text,
  website_url text,
  contractor_token text not null unique,
  created_at timestamptz not null default now()
);

-- Reference pages: the ONLY source of contractor product/material data (section 3)
create table contractor_reference_pages (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references contractors(id),
  url text not null,
  label text,
  added_at timestamptz not null default now()
);

-- Designs: one row per design "thread"
create table designs (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references contractors(id),
  end_user_email text not null,
  prompt_number text not null,
  original_image_url text not null,
  max_versions int,           -- null = use MAX_VERSIONS_PER_DESIGN env default.
                               -- set explicitly once the future paid-tokens feature
                               -- exists, to raise the cap for that design only.
  created_at timestamptz not null default now(),
  unique (contractor_id, prompt_number)
);

-- Design versions: every iteration, never overwritten (CLAUDE.md §7)
create table design_versions (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references designs(id),
  version_number int not null,
  parent_version_id uuid references design_versions(id),
  generated_image_url text,
  design_specification jsonb not null,
  user_instruction text,
  changed_items jsonb,
  preserved_items jsonb,
  source_urls jsonb,          -- contractor reference page URL(s) actually used
  ai_model text,
  created_at timestamptz not null default now(),
  unique (design_id, version_number)
);

-- Quotes: one per version, never recalculated retroactively (CLAUDE.md §49)
create table quotes (
  id uuid primary key default gen_random_uuid(),
  design_version_id uuid not null unique references design_versions(id),
  currency text not null default 'USD',
  total_low numeric,
  total_high numeric,
  created_at timestamptz not null default now()
);

-- Quote line items (CLAUDE.md §15, §16, §51)
create table quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id),
  name text not null,
  category text not null,
  quantity numeric not null,
  unit text,
  unit_price numeric,        -- nullable: never invent a price (§51)
  total_price numeric,       -- nullable for the same reason
  pricing_type text not null check (pricing_type in
    ('EXACT_PRODUCT','CATALOG_MATERIAL','ESTIMATED_MATERIAL',
     'ESTIMATED_LABOR','ESTIMATED_INSTALLATION','CUSTOM_WORK')),
  confidence text not null check (confidence in ('HIGH','MEDIUM','LOW')),
  source_url text,           -- the exact contractor page this item came from
  assumptions text
);
```

Recommended but not required this stage — flag it, don't build it unless asked:

```sql
-- AI usage tracking (CLAUDE.md §44) — real cost per external contractor's traffic.
create table ai_usage (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid references contractors(id),
  design_version_id uuid references design_versions(id),
  operation text,
  model text,
  input_tokens int,
  output_tokens int,
  image_generation_cost numeric,
  created_at timestamptz not null default now()
);
```

---

# 6. IMAGE STORAGE (SUPABASE STORAGE)

- One private bucket: `design-images`, for ROOM photos only — the original upload
  and each generated version. This bucket has nothing to do with contractor product
  images; those are read transiently from the contractor's page during generation
  and are not copied or cached anywhere.
- Path convention: `{contractor_id}/{design_id}/original.jpg` and
  `{contractor_id}/{design_id}/v{version_number}.jpg`.
- The bucket is PRIVATE. Signed URLs are generated server-side by `apps/api` with a
  short expiry (e.g. 1 hour). The database stores the storage PATH, not a permanent
  public URL.
- `SUPABASE_SERVICE_ROLE_KEY` lives only in `apps/api`. `apps/web` never talks to
  Supabase directly — it still only talks to `apps/api`, per CLAUDE.md section A.

---

# 7. ENVIRONMENT VARIABLES

`apps/web/.env.local` (per-contractor-deployment values):
```
NEXT_PUBLIC_API_URL=<shared apps/api URL, same for every contractor deployment>
API_SHARED_SECRET=<same for every contractor deployment>
CONTRACTOR_TOKEN=<UNIQUE per contractor deployment>
```

`CONTRACTOR_TOKEN` must NOT be prefixed `NEXT_PUBLIC_`. It's read only inside
server-side route handlers / server actions in `apps/web` that proxy to `apps/api`
(same pattern as `API_SHARED_SECRET`) and attached as a header, e.g.
`X-Contractor-Token`. It must never reach client-side JS.

`apps/api/.env` additions:
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=design-images
MAX_VERSIONS_PER_DESIGN=3
GMAIL_SENDER_ADDRESS=
GMAIL_APP_PASSWORD=
EMAIL_FROM_NAME=BuildMyHome
```

`GMAIL_APP_PASSWORD` is a Gmail App Password (myaccount.google.com/apppasswords),
not the real account login password, and requires 2-Step Verification enabled on
that Google account first.

No embedding-model env var is needed for product search — there is no catalog to
search with embeddings.

---

# 8. CONTRACTOR ONBOARDING (INTERNAL TOOLS, NOT PUBLIC)

Two small internal scripts, neither reachable from any deployed frontend, both run
manually by you:

**`apps/api/scripts/create-contractor.ts`**
- Takes name, contact email, phone, website_url.
- Generates `contractor_token` (nanoid, 24+ chars, URL-safe).
- Inserts the row.
- Prints the token so it can be copied into that contractor's Vercel env vars.

**`apps/api/scripts/add-reference-page.ts`**
- Takes a contractor identifier (token or id) plus a URL and optional label.
- Inserts a row into `contractor_reference_pages`.
- Run this once per product/project page you want that contractor's AI to draw
  from. A contractor can have several.

---

# 9. API CONTRACT CHANGES

Every request from `apps/web` to `apps/api` that touches a design carries
`X-Contractor-Token`. `apps/api` resolves this to a `contractor_id` before doing
anything else and rejects the request (401) if the token doesn't match.

```
POST /design/create
  headers: X-Contractor-Token
  body:    { originalImage (base64), userPrompt, endUserEmail, promptNumber }
  → 200: { designId, promptNumber, versionNumber: 1, designSpecification,
           generatedImage, quote, sourceUrls }
           (triggers both notification emails per section 4 — best-effort)

POST /design/modify
  headers: X-Contractor-Token
  body:    { designId, changeRequest }
  → 200: { versionNumber: n+1, designSpecification, generatedImage, quote, sourceUrls }
           (triggers both notification emails per section 4 — best-effort)
  → 403: { error: "VERSION_LIMIT_REACHED", maxVersions: N, currentVersionCount: N }
    when the design has already reached its version limit (section 2c). Do not
    create a new version row, and do not send notification emails, in this case.

GET /design/lookup
  headers: X-Contractor-Token
  query:   { email, promptNumber, versionNumber }
  → 200: { designSpecification, generatedImage, quote, sourceUrls }
    (no notification emails triggered — retrieval is read-only)
  → 404: one generic "no such record" body, identical regardless of which field
    (email / promptNumber / versionNumber) was the mismatch.
```

`sourceUrls` in every success response is what the frontend uses to show "designed
using [contractor]'s [product/project page]" with a working link, per §53.

Update the Zod schemas in `packages/shared` accordingly.

---

# 10. NON-NEGOTIABLE ADDITIONS FOR THIS STAGE

1. Retrieval and prompt-number uniqueness are always scoped by `contractor_id`.
2. `contractor_token` is the only contractor-identifying credential.
3. No public endpoint may create a `contractors` row or a
   `contractor_reference_pages` row. Both are manual/internal only.
4. `SUPABASE_SERVICE_ROLE_KEY` never leaves `apps/api`.
5. There is no product catalog table. Do not reintroduce one, cache extracted
   product data across requests, or store embeddings, without this being explicitly
   requested again.
6. A generation must never cross contractor boundaries — pages fetched, images
   generated, and quotes produced for Contractor A must never draw from Contractor
   B's reference pages.
7. `GET /design/lookup` must never distinguish, in its response, which field caused
   a failed lookup.
8. Every successful generation response and every stored `design_versions` /
   `quote_items` row must carry the real source URL(s) actually used. Never fabricate
   a source URL for a line item that wasn't actually sourced from a fetched page.
9. If a contractor page fetch fails, degrade gracefully — do not crash the request,
   and do not silently fabricate product data to compensate.
10. The version cap must be enforced via `designs.max_versions` (falling back to
    `MAX_VERSIONS_PER_DESIGN`), checked through one single function — never a number
    hardcoded directly in a route handler.
11. Email sending failures must never fail or block a generation request. Log and
    move on — never retry synchronously in a way that delays the response.
12. The generated room image must never be attached to or embedded in either
    notification email — quotation and identifiers only.
13. `GET /design/lookup` never triggers notification emails — only successful
    create/modify calls do.

---

# 11. IMPLEMENTATION ORDER FOR THIS STAGE

1. Create the schema in Supabase via MCP (section 5). Confirm all tables exist
   before writing any application code.
2. Create the `design-images` private bucket.
3. Build `SupabasePersistenceProvider` behind the existing `PersistenceService`
   interface. Wire it into `container.ts` in place of the no-op.
4. Build `SupabaseStorageProvider` behind `StorageService`, replacing the inline
   base64 provider, for room images only.
5. Build `LiveContractorPageProvider` behind `ProductSearchService`/`CatalogService`:
   given a contractor_id, load its reference pages, fetch relevant ones live, extract
   candidate products/materials via the reasoning/vision AI, and return them in the
   same shape the rest of the pipeline already expects.
6. Build `apps/api/scripts/create-contractor.ts` and
   `apps/api/scripts/add-reference-page.ts`.
7. Add the `X-Contractor-Token` middleware to `apps/api`.
8. Update `POST /design/create`, `POST /design/modify`, and add `GET /design/lookup`
   per section 9, including `sourceUrls` in every response.
9. Build the `canCreateAnotherVersion(design)` check per section 2c and wire it into
   `POST /design/modify` before any generation work begins for that request.
10. Build the email notification service per section 4 (`nodemailer` + Gmail App
    Password) and trigger it after every successful create/modify — never on a
    failed or version-limit-rejected request, never on retrieval.
11. Update `packages/shared` schemas for all of the above.
12. Update `apps/web`: split into "Generate New" and "Retrieve Old" tabs per section
    2d, generate/display the prompt number on page load, show the "maximum versions
    reached" message on `VERSION_LIMIT_REACHED`, show source URL attribution, and
    route the contractor token server-side.
13. Test end-to-end with two fake contractors, each with at least one real reference
    page: confirm zero data leakage between them, confirm graceful handling of a
    contractor with zero reference pages, confirm accurate source URLs throughout,
    confirm a 4th version attempt is cleanly rejected, and confirm both notification
    emails actually arrive for a real create call and a real modify call.
