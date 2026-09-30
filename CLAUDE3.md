# BUILD MY HOME — STAGE 3: VIDEO GENERATION (RUNWAY / ALEPH 2.0)

This file is an addendum to CLAUDE.md and CLAUDE2.md. Read all three. CLAUDE2.md is
unchanged and remains complete for everything about Generate Image and Retrieve Old
that isn't touched here. Where this file adds or modifies behavior, THIS FILE WINS.

**Revision note:** an earlier draft of this file targeted OpenAI for video and was
marked BLOCKED after confirming OpenAI's Sora API was discontinued September 24,
2026 with no replacement. This version replaces that draft entirely: video runs on
**Runway (Aleph 2.0)** instead, chosen specifically because it edits an existing
video rather than generating a new one from text, matching this product's core
"preserve everything except what was asked to change" requirement. This is not a
premature departure from CLAUDE.md §25/§26's single-provider rule — it's the only
way this feature can exist, since OpenAI has nothing in this space. Document it as
a deliberate, acknowledged exception, not an accident.

---

# 1. LOCKED DECISIONS

1. The existing "Generate New" tab is **renamed to "Generate Image"** — label only.
2. A new tab, **"Generate Video,"** sits alongside "Generate Image" and
   "Retrieve Old."
3. Video rendering uses **Runway, model `aleph2` (Aleph 2.0)**, via
   `@runwayml/sdk`, authenticated with a new server-side-only secret,
   `RUNWAYML_API_SECRET`. This is a second provider alongside OpenAI, by necessity
   — see the revision note above.
4. Target duration: **2–5 seconds** (not 1–5 — see section 2 on why the minimum
   changed and why it still needs live verification, not just this document's say-so).
5. Generate Video reuses the **full existing pipeline** — contractor token scoping,
   the prompt-number identity model, live product sourcing from the contractor's
   reference pages, the deterministic quotation engine, the 3-version cap, and the
   email notifications — exactly as CLAUDE2.md specifies for images. It is NOT a
   separate, simpler feature, and it does NOT get its own independent versioning
   model outside the existing `designs`/`design_versions` tables.
6. A video design thread is its **own independent thread** — its own prompt number,
   its own 3-version cap — never mixed with an image thread.
7. Modifying a video (V1 → V2 → V3) edits the **most recently generated video**, not
   the original upload and not a fresh text-to-video generation. Runway is given the
   current video as the source asset on every modify call.
8. Generated videos are **stored and retrievable** via the existing Retrieve Old tab
   (email + prompt number + version number). Runway's result URLs are **temporary**
   — the backend must download the rendered video and persist it in Supabase
   Storage before returning anything to the frontend. A Runway URL must never be
   handed to the client or stored as a permanent reference.
9. **Video generation is asynchronous and must not block the request/response
   cycle** the way image generation does. See section 4.

---

# 2. PROVIDER CONFIRMATION — VERIFY, DON'T TRUST THIS DOCUMENT BLINDLY

The specifics below (duration range, resolution, FPS, input format) come from a
planning document, not from Claude Code independently checking Runway's live API
docs. The same discipline that caught the OpenAI Sora shutdown applies here: a
written spec can be outdated or simply wrong.

**Before wiring anything, Claude Code must:**
1. Check Runway's current, official API documentation directly for the `aleph2`
   model's actual constraints (accepted input duration range, max resolution, max
   FPS, accepted formats/codecs, input delivery mechanism, current task-status
   polling shape).
2. Confirm the exact model identifier and API shape match what's assumed here. If
   anything below is stale (a duration limit, an endpoint shape, the SDK's current
   method names), correct it and note the correction — don't silently code against
   what's written here if the live docs disagree.
3. If Aleph 2.0 specifically is unavailable or superseded, stop and report back
   rather than silently substituting a different Runway model.

```
RUNWAYML_API_SECRET=
RUNWAY_VIDEO_MODEL=aleph2
MIN_VIDEO_DURATION_SECONDS=2
MAX_VIDEO_DURATION_SECONDS=5
MAX_VIDEO_FPS=30
MAX_VIDEO_RESOLUTION=1080p
```

These numbers are starting assumptions from the planning document, to be corrected
in step 1–2 above before anything is built against them.

---

# 3. WHAT HAPPENS AT GENERATION TIME

The pipeline up through the DesignSpecification and quote is **identical** to image
generation (CLAUDE.md §10–17, CLAUDE2.md section 3) and, importantly, **does not
depend on the video render finishing** — the quote is computed deterministically
from the DesignSpecification the same way for both media types. This matters
because it's what lets the async video render (section 4) happen without delaying
the quote or the email notification.

1. Room video (or photo, for the initial creation) and prompt are interpreted into
   structured ADD/REMOVE/MODIFY operations, matched against the contractor's live
   reference pages, exactly as for images.
2. The deterministic quote is calculated and the `design_versions` row is created
   immediately, with `generation_status = 'PROCESSING'` and no video URL yet.
3. The notification emails (CLAUDE2.md section 4) fire at this point — they contain
   the quote, prompt number, and version number, none of which depend on the
   rendered video existing yet.
4. Separately, the backend submits the edit task to Runway with the current video
   (V1: the original upload; V2/V3: the previous version's generated video) as the
   source asset, plus a structured edit instruction (section 6).
5. Once Runway's task completes, the backend downloads the result, uploads it to
   Supabase Storage, and updates that `design_versions` row: `generation_status =
   'COMPLETED'`, `generated_video_url` set.
6. If the Runway task fails, `generation_status = 'FAILED'` and the row records what
   went wrong — never a fabricated success.

Build this behind the existing `ImageGenerationService`/`VideoGenerationService`
abstraction from CLAUDE.md §24 — a `RunwayVideoGenerationProvider`. No route handler
calls the Runway SDK directly.

---

# 4. ASYNCHRONOUS HANDLING

Video generation is slower than image generation and must be treated as its own
asynchronous flow, not forced into the same latency expectations (matches CLAUDE.md
§33's `GenerationJob` philosophy, applied here without needing a whole separate job
table — the status lives directly on `design_versions`, see section 5).

- `POST /design/create` and `POST /design/modify`, when `mediaType: 'video'`,
  return quickly once the design/quote work is done — they do NOT wait for Runway.
  The response carries `generation_status: 'PROCESSING'` and no video URL yet.
- The frontend then polls `GET /design/lookup` (the same endpoint already used for
  retrieval — see section 7) using the email/prompt number/version number it
  already has from the create/modify response, until `generation_status` flips to
  `COMPLETED` or `FAILED`.
- No new polling endpoint is introduced. Reuse `GET /design/lookup` for this — it
  already returns the right shape, it just needs `generation_status` added to it.
- The UI must show a clear processing state while polling (CLAUDE.md §37's
  generation-progress pattern extends naturally here), and must not appear frozen
  or imply the video is ready before it is.

---

# 5. DATABASE CHANGES

Extends CLAUDE2.md section 5 — still no new tables.

```sql
alter table designs
  add column media_type text not null default 'image'
    check (media_type in ('image', 'video'));

alter table design_versions
  add column generated_video_url text,
  add column video_duration_seconds int,
  add column generation_status text not null default 'COMPLETED'
    check (generation_status in ('PROCESSING', 'COMPLETED', 'FAILED')),
  add column generation_error text;
```

- `designs.media_type` is set once, at creation, never changes.
- `generation_status` defaults to `'COMPLETED'` so existing/image rows (which are
  synchronous) need no special handling — only video rows are created as
  `'PROCESSING'` and updated afterward.
- `generation_error` stays null unless `generation_status = 'FAILED'`, and should
  hold enough detail to debug without exposing anything sensitive to the end user.
- Storage path convention unchanged from CLAUDE2.md section 6:
  `{contractor_id}/{design_id}/v{version_number}.mp4` in the same private
  `design-images` bucket, same signed-URL pattern.

---

# 6. INPUT VALIDATION AND EDIT INSTRUCTION

**Validate before ever sending to Runway:**
- File type / container
- Duration (clamped to `MIN_VIDEO_DURATION_SECONDS`–`MAX_VIDEO_DURATION_SECONDS`)
- FPS (≤ `MAX_VIDEO_FPS`)
- Resolution (≤ `MAX_VIDEO_RESOLUTION`)
- File size
- Codec support

Reject with a clear error before spending a Runway call on something that will fail
anyway.

**The edit instruction sent to Runway must always assert**, dynamically built from
the structured change request (same ADD/REMOVE/MODIFY structure as images,
CLAUDE.md §10–11):
- The supplied video is the source to edit, not a reference to loosely inspire a
  new generation.
- Preserve: camera movement, camera perspective, room geometry, walls, floor,
  ceiling, windows, doors, lighting, existing objects, composition — unless
  explicitly part of the requested change.
- Apply only the requested modification.
- Do not introduce unrelated objects or restyle the room.
- Keep the change temporally consistent across the whole clip, correctly positioned
  as the camera moves.

This mirrors CLAUDE.md §9's image-edit instruction almost exactly — same
philosophy, adapted for the temporal dimension video adds.

---

# 7. API CONTRACT CHANGES

```
POST /design/create
  body: { originalVideo or originalImage (base64), userPrompt, endUserEmail,
          promptNumber, mediaType }   -- 'image' | 'video'
  → 200 (mediaType: 'video'):
      { designId, promptNumber, versionNumber: 1, mediaType: 'video',
        generationStatus: 'PROCESSING', designSpecification, quote, sourceUrls }
      (no generatedVideo yet — poll GET /design/lookup)
  → 200 (mediaType: 'image'): unchanged, synchronous, from CLAUDE2.md section 9

POST /design/modify
  body: { designId, changeRequest }
  → 200: same shape as create, keyed by the design's existing mediaType
  → 403: VERSION_LIMIT_REACHED — unchanged, applies identically to video

GET /design/lookup
  query: { email, promptNumber, versionNumber }
  → 200: { mediaType, generationStatus, designSpecification, quote, sourceUrls,
           generatedImage? or generatedVideo? }
    generatedVideo present only once generationStatus is 'COMPLETED'. While
    'PROCESSING', the frontend keeps polling. If 'FAILED', surface that plainly —
    never a broken/empty video pretending to be ready.
  → 404: same generic "no such record" response, unchanged
```

Update the Zod schemas in `packages/shared` — `mediaType` and `generationStatus`
become part of the shared contract.

---

# 8. FRONTEND CHANGES

- Tab bar: **Generate Image** | **Generate Video** | **Retrieve Old**, all visible
  at all times (CLAUDE2.md section 2d, extended to three tabs).
- "Generate Video" reuses the Generate Image page structure (upload/record, prompt,
  auto-generated prompt number, required email) — functional difference is
  `mediaType` and the resulting async processing state.
- After submitting, show a clear "processing" state and poll `GET /design/lookup`
  until `generationStatus` resolves — don't block the UI, don't imply readiness
  early.
- "Retrieve Old" stays exactly as specified in CLAUDE2.md — same three fields, same
  button. Its results view must branch on `mediaType` (video player vs image) and
  handle `generationStatus` if someone retrieves a still-processing or failed video
  — show that state honestly rather than a broken player.

---

# 9. NON-NEGOTIABLE ADDITIONS FOR THIS STAGE

1. Runway result URLs are temporary — always download and persist to Supabase
   Storage before returning anything to the frontend. Never store or expose a raw
   Runway URL as a permanent asset reference.
2. `RUNWAYML_API_SECRET` never leaves `apps/api`.
3. Video generation never blocks the create/modify response — always asynchronous,
   status tracked on `design_versions.generation_status`.
4. A video modify call always uses the most recently generated video as the source
   for Runway — never the original upload alone (except on V1), never a fresh
   from-scratch generation.
5. `designs.media_type` is immutable after creation. A thread never mixes image and
   video versions.
6. Video duration, FPS, and resolution are always validated and clamped before
   sending to Runway — never send unvalidated input.
7. All of CLAUDE2.md's non-negotiable rules (contractor scoping, generic 404s,
   source-URL attribution, the version cap mechanism, email firing independent of
   render completion) apply identically to video threads.
8. Section 2's live-documentation verification is mandatory before wiring — this
   file's specific numbers are a starting point, not a substitute for checking.

---

# 10. IMPLEMENTATION ORDER FOR THIS STAGE

1. Inspect the existing codebase first: current Supabase Storage implementation,
   existing `designs`/`design_versions` structure, current API/route architecture,
   existing environment variable conventions. Reuse what's there — don't rebuild
   working infrastructure.
2. Complete section 2's Runway documentation verification. Do not proceed past this
   until the model identifier and constraints are confirmed against Runway's actual
   current docs.
3. Add the `media_type`, `generated_video_url`, `video_duration_seconds`,
   `generation_status`, and `generation_error` columns via Supabase MCP.
4. Build `RunwayVideoGenerationProvider` behind the existing service abstraction,
   including input validation (section 6) and the dynamic edit-instruction builder.
5. Update `POST /design/create` and `POST /design/modify` for the async flow —
   return immediately with `PROCESSING`, submit the Runway task in the background,
   update the row on completion/failure.
6. Update `GET /design/lookup` to return `mediaType` and `generationStatus` and
   serve as the polling endpoint.
7. Update `packages/shared` schemas.
8. Update `apps/web`: add the "Generate Video" tab, rename "Generate New" to
   "Generate Image," build the processing/polling UI, update Retrieve Old's
   results view to handle both media types and all three generation statuses.
9. Confirm email notifications fire correctly at quote-calculation time for video,
   independent of whether the render has finished.
10. Test end-to-end: create a video design, confirm the email arrives before the
    video finishes rendering, modify it twice (confirming continuity from the
    previous video, not the original upload), confirm the 4th attempt is rejected,
    confirm a still-processing retrieval is handled honestly, confirm a failed
    render is surfaced clearly, and confirm image and video threads never
    cross-contaminate version counts or content.
