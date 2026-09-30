# CLAUDE3.5.md — Stage 3.5 Addendum: "Generate using Astra" (Voice-Interactive Image Editing)

This is an addendum to CLAUDE.md, CLAUDE2.md, and CLAUDE3.md. Read all three first — this file only adds a fourth tab and does not change anything about Generate Image, Generate Video, or the underlying contractor/identity/quote architecture except where explicitly stated below.

## Revision note

Karim's request: add a fourth tab, **"Generate using Astra"** — the user uploads/takes a photo of a room and then has a live **voice conversation** with an AI that edits that photo interactively, turn by turn, based on OpenAI's own Realtime + reasoning + image-editing model stack. Unlike Generate Image and Generate Video, this flow has **no version cap and no version picker** — it's a continuous conversation, not a discrete request/response with a version number attached. Retrieve Old must be extended to support looking this up too, but only ever returns the *latest* Astra result — there is no version number to ask for.

This addendum also documents several decisions I made to turn "continuous voice editing" into something that fits the existing contractor/quote/email backbone without contradicting anything you said. Each one is called out explicitly below so you can push back before this goes to Claude Code.

---

## 1. Locked decisions (from your message + the attached planning doc)

1. New tab, exact label: **"Generate using Astra"**. Tab order: Generate Image, Generate Video, Generate using Astra, Retrieve Old.
2. Flow: user uploads/takes a room photo → starts a live voice conversation → says what they want changed → the AI edits the *existing* image (never a from-scratch redesign) → updated image displays → conversation continues indefinitely until the user stops.
3. Three-layer architecture, all OpenAI, same `OPENAI_API_KEY` already in the project — no new secret needed:
   - **Voice/conversation layer** — an OpenAI Realtime model. Handles speech in, speech out, transcription. It does NOT do the reasoning or image editing itself.
   - **Reasoning/orchestration layer** ("Astra" in your doc) — decides what actually needs to change in the image, prepares the edit instruction, invokes the image editor. Receives the current image as context every turn.
   - **Image editing layer** — edits the existing image, never regenerates from scratch. Fast model for interactive turns, a higher-fidelity model available for a final/precise pass.
4. **No versions, no version cap, no "request new" for Astra.** This is architecturally different from Generate Image/Generate Video on purpose — see §5.
5. New, separate Supabase Storage bucket: `design-astra`. You're creating this bucket yourself and will tell Claude Code it exists — Claude Code does not need to create it.
6. Retrieve Old must also work for Astra threads, but for those it always returns the latest (and only meaningful) result — no version number field applies.
7. Everything else already locked in CLAUDE.md/CLAUDE2.md/CLAUDE3.md (contractor scoping via `contractor_token`, identification via email + prompt_number, live contractor reference pages for pricing, deterministic quote math, Gmail-based notification emails, never-block-on-email-failure) stays exactly as is and is **reused**, not rebuilt, for Astra.

---

## 2. Mandatory model verification — do this before wiring anything

**"GPT-6", "Astra", "GPT Image 2.5 Flare", "GPT Image 2.5 Sunburst", and the OpenAI Realtime model name in the planning doc are treated as unverified.** They come from a planning document, not from a confirmed check of OpenAI's live API documentation. This is the exact situation that caught the Sora/video shutdown earlier in this project (CLAUDE3.md §2) — a planning document turned out to be wrong about what OpenAI actually offered. Do not assume these names are correct.

Before writing any Astra integration code, Claude Code must:

1. Check OpenAI's current live documentation for the actual Realtime API model identifier, its session/auth mechanism, and its current transport (WebRTC vs WebSocket).
2. Check OpenAI's current live documentation for the actual reasoning/orchestration-capable model available via the API (the model that will play the "Astra" role — function/tool-calling capable, can be given the current image as context).
3. Check OpenAI's current live documentation for the actual image-editing model(s) available via the API today, and confirm they support **edit-an-existing-image** (image-in, image-out) rather than only text-to-image.
4. If any of the three don't exist as named, or work differently than the planning doc assumes (e.g., no direct image-editing endpoint, different auth flow for Realtime), stop and report back before proceeding — same rule as the Sora case.

Once confirmed, the real identifiers go into the env vars below (placeholders only for now).

---

## 3. Why no version cap — the architectural reasoning

Generate Image and Generate Video are **discrete**: one request in, one result out, capped at 3, each one addressable by version number. Astra is **continuous**: a single live conversation that can apply an arbitrary number of small edits ("make it beige" → "no, darker" → "add a plant" → "move it left"...) until the user decides to stop. Capping that at 3 edits would break the entire premise of the feature, and there's no natural version-picker UI for a live conversation.

So, concretely:

- No `max_versions` enforcement applies to Astra threads. `canCreateAnotherVersion()` is simply never called for this media type.
- Internally, each edit still gets its own row (reusing the existing `design_versions` table and its `version_number` auto-increment — no new table needed), purely as an audit trail. This is **never exposed to the user** as a version, never selectable, never shown in any UI.
- "The last result" that Retrieve Old returns is just the highest `version_number` row for that design — which is exactly what "no versions" looks like from the user's side, while still giving you an internal edit history if you ever need to debug a session.

---

## 4. Session lifecycle: start → edit loop → finish

A discrete "finish" moment is necessary because quote computation and email notification are inherently discrete events (per CLAUDE2.md §4, every successful generation triggers one email to the contractor and one to the end user, containing quote + identifiers, never the image). Firing that on every single voice turn would mean dozens of emails per conversation — clearly not what you want. So:

- **Start**: user uploads/takes the photo, backend creates the `designs` row (`media_type = 'astra'`, own `prompt_number`, contractor scoped as usual), original photo goes into `design-astra`. No quote, no email yet.
- **Edit loop**: each voice-driven edit updates the current image and the structured `design_specification` (reusing the same JSON shape already used by Generate Image/Video, so the existing `QuotationService` and live-reference-page pricing logic work unchanged). New internal `design_versions` row per edit, image goes into `design-astra`. Still no quote, no email — the frontend just shows the updated image as it comes in.
- **Finish**: triggered by an explicit "End session" action in the UI, OR automatically after a configurable idle timeout (see §8) if the user just closes the tab or walks away without explicitly ending it — added so a session is never silently lost and no one has to remember to click a button for the quote/email to actually go out. At finish: quote is computed from the final `design_specification` (identical pipeline to Image/Video), the two notification emails fire (contractor + end user, quote + prompt_number, no version number since it doesn't apply, no image), and `designs.astra_finished_at` is set.

This is the one place I made a real design call beyond what either of you wrote: **quote + email is tied to session finish, not to every edit**, and a finish can happen implicitly via idle timeout so an abandoned session still resolves cleanly instead of leaving the contractor and end user with nothing.

---

## 5. Retrieve Old — extension

Same three fields as today (email, prompt number, version number) plus the same Retrieve button. Version number becomes **optional**:

- If the located design is `media_type = 'image'` or `'video'`, behavior is unchanged from CLAUDE2.md/CLAUDE3.md — version number is used if given, otherwise defaults to the latest version for that thread.
- If the located design is `media_type = 'astra'`, version number is ignored entirely (even if the user typed something into it) and the response is always the latest state:
  - If `astra_finished_at` is set: final image + quote, same shape as an Image/Video result.
  - If `astra_finished_at` is null (session never finished — shouldn't normally happen once the idle-timeout auto-finish is in place, but handled honestly anyway): latest image + design specification, with a status flag indicating the session was never finished and no quote/email was sent.
- Same generic-404-on-any-mismatch rule as before (CLAUDE2.md) — retrieval never reveals which field was wrong.

---

## 6. Security

- `OPENAI_API_KEY` never reaches the frontend, same as every other stage of this project.
- The OpenAI Realtime layer specifically requires the browser to talk directly to OpenAI for low-latency audio — this means the backend must mint a **short-lived ephemeral/session token** server-side and hand only that to the frontend, never the real API key. Confirm the exact current mechanism for this against OpenAI's live docs per §2 — this pattern has changed before across providers in this project and must not be assumed.
- The image-edit and orchestration calls still go browser → BuildMyHome backend → OpenAI, same as the rest of the app. Only the realtime audio stream is the exception, and only via a minted ephemeral token.

---

## 7. Storage

- New bucket: `design-astra` (private, signed URLs, same short-expiry pattern as `design-images` — you are creating this bucket yourself).
- Original uploaded photo and every interim edit image are stored here, path-prefixed by design id, same convention as the existing image bucket.

---

## 8. Database migration

```sql
-- widen the existing media_type constraint to add 'astra'
alter table designs
  drop constraint if exists designs_media_type_check;

alter table designs
  add constraint designs_media_type_check
    check (media_type in ('image', 'video', 'astra'));

-- track whether an Astra session has been explicitly (or auto-) finished
alter table designs
  add column astra_finished_at timestamptz;
```

No other schema changes. `design_versions`, `quotes`, and `quote_items` are reused exactly as they already exist — Astra just writes into them the same way Image/Video do, with `max_versions`/version-cap logic skipped for this media type.

---

## 9. Environment variables (additions only)

`apps/api/.env`:

```
SUPABASE_STORAGE_BUCKET_ASTRA=design-astra

# Fill these in only after live-doc verification per §2 — do not guess:
OPENAI_REALTIME_MODEL=
OPENAI_ASTRA_ORCHESTRATION_MODEL=
OPENAI_IMAGE_EDIT_MODEL_FAST=
OPENAI_IMAGE_EDIT_MODEL_PRECISE=

# Safety guard — auto-finish an abandoned Astra session after this many
# seconds of inactivity (mints the quote + sends notification emails
# using whatever the latest image was). Recommended default: 600 (10 min).
ASTRA_SESSION_IDLE_TIMEOUT_SECONDS=600
```

No new frontend-exposed env vars — the frontend only ever receives the ephemeral realtime token issued per-session, never a raw key or model identifier it doesn't need.

---

## 10. API contract

```
POST /design/astra/start
  body: { contractorToken, endUserEmail, promptNumber, originalImage }
  → { designId, promptNumber, mediaType: 'astra', realtimeSession: { token, expiresAt, ...whatever the confirmed Realtime auth shape requires } }
  (no quote, no email — session has just begun)

# Edit-loop transport (WebSocket/SSE/etc. for pushing updated images to the
# frontend as the conversation produces them) is left to Claude Code to
# design after inspecting the existing codebase — same "inspect first,
# don't rebuild what exists" instruction as CLAUDE3.md §10. The contract
# requirement is only: the frontend must see each updated image promptly
# during the live conversation, and each edit persists a design_versions
# row + design-astra upload server-side.

POST /design/astra/finish
  body: { designId }
  → { designId, promptNumber, mediaType: 'astra', designSpecification, quote, sourceUrls }
  (computes quote from final design_specification, fires both notification
  emails exactly as CLAUDE2.md §4 describes, sets astra_finished_at)
  — also invoked internally, with the same effect, when
  ASTRA_SESSION_IDLE_TIMEOUT_SECONDS is exceeded with no activity.

GET /design/lookup   (existing endpoint, reused — see §5 for the astra-specific behavior)
```

---

## 11. Non-negotiable rules

1. Edit the existing image — never redesign from scratch. Every edit instruction sent to the image model must explicitly preserve everything not requested to change (room geometry, camera perspective, lighting, materials, unrelated furniture), mirroring CLAUDE3.md §6's video equivalent.
2. The current/latest image is always the source of truth for the next edit — never branch back to the original unless the user explicitly asks to reset/revert.
3. No version cap, no version picker, no "request new" anywhere in the Astra UI.
4. Quote computation and email notification happen once, at session finish (explicit or idle-timeout), never per-edit.
5. `OPENAI_API_KEY` never reaches the frontend; the Realtime layer gets a minted ephemeral token only, with a confirmed expiry.
6. Model identifiers (`OPENAI_REALTIME_MODEL`, `OPENAI_ASTRA_ORCHESTRATION_MODEL`, `OPENAI_IMAGE_EDIT_MODEL_FAST/PRECISE`) are filled in only after live-doc verification per §2 — never left as the planning doc's names on faith.
7. `design-astra` is a separate bucket from the image/video bucket(s) — do not mix them.
8. Retrieve Old's version-number field is optional for all media types now, and is ignored entirely for `astra` threads — always return the latest.
9. Every other rule already locked in CLAUDE.md/CLAUDE2.md/CLAUDE3.md (deterministic quote math, never-invented prices, contractor scoping via `contractor_token`, generic 404 on retrieval mismatch, email never blocks generation, source-URL attribution) applies identically here.

---

## 12. Implementation order

1. Inspect the existing codebase first: current Supabase Storage usage, current `design_versions`/quote pipeline, current API structure, current frontend tab components (Generate Image/Video, Retrieve Old) — do not rebuild what already exists.
2. Complete the live-doc verification in §2 for all three OpenAI model roles. Stop and report back if any assumption from the planning doc doesn't hold.
3. Apply the DB migration in §8.
4. Add the `SUPABASE_STORAGE_BUCKET_ASTRA` env var and wire uploads/downloads for the new bucket (bucket itself is created manually by Karim).
5. Implement `POST /design/astra/start`, including ephemeral Realtime token minting.
6. Implement the edit-loop transport and the orchestration → image-edit → storage → push-to-frontend chain, reusing the existing `design_specification` JSON shape so `QuotationService` needs no changes.
7. Implement `POST /design/astra/finish`, including the idle-timeout auto-finish path.
8. Extend `GET /design/lookup` for the `astra` media type per §5.
9. Build the "Generate using Astra" tab UI: photo capture/upload, live voice conversation UI, streaming image updates, an explicit "End session" action.
10. Update the Retrieve Old tab: make the version-number field optional, confirm astra-type results display correctly with no version UI.
