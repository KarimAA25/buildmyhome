import type { DesignSpecification } from "@buildmyhome/shared";

// Confirmed via a live 400 from Runway (not documented anywhere Section 2's
// verification could reach): video_to_video's promptText has a hard 1000-
// character cap. Everything below is sized to stay under it even with a
// full item list, with a final hard-truncation safety net regardless.
const RUNWAY_PROMPT_TEXT_MAX_CHARS = 1000;
const MAX_USER_INSTRUCTION_CHARS = 400;

function truncate(text: string, maxChars: number): string {
  if (maxChars <= 0) return "";
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 1)}…`;
}

// Mirrors OpenAIImageGenerationProvider's buildPrompt philosophy (the literal
// instruction is the sole directive; the spec is background reference only),
// adapted for CLAUDE3.md §6's video-specific assertions. Exported (unlike
// buildPrompt, which is private) so it's independently testable — getting
// this instruction right is the crux of §6's "preserve everything but the
// requested change" requirement.
export function buildEditInstruction(spec: DesignSpecification, userInstruction: string): string {
  const change = truncate(userInstruction, MAX_USER_INSTRUCTION_CHARS);

  const core = `Edit this video in place — it is the source to edit, not inspiration for a new generation.

CHANGE (the only thing that should visibly change): "${change}"

Preserve everything else across the whole clip: camera movement/perspective, room geometry, walls, floor, ceiling, windows, doors, lighting, existing objects, composition. Do not add unrelated objects or restyle the room. Keep the change temporally consistent and correctly tracked as the camera moves.`;

  const separator = "\n\n";
  const remainingForReference = RUNWAY_PROMPT_TEXT_MAX_CHARS - core.length - separator.length;

  const itemNames = spec.items.map((item) => item.description).join(", ");
  const referenceFull = `Reference only, not a checklist — Style: ${spec.style}.${itemNames ? ` Items: ${itemNames}.` : ""}`;
  const reference = remainingForReference > 20 ? truncate(referenceFull, remainingForReference) : "";

  const full = reference ? `${core}${separator}${reference}` : core;

  // Absolute safety net — a very long userInstruction (up to the app's
  // MAX_PROMPT_LENGTH=2000) could still push `core` alone past the cap even
  // after the 400-char truncation above.
  return full.length > RUNWAY_PROMPT_TEXT_MAX_CHARS ? full.slice(0, RUNWAY_PROMPT_TEXT_MAX_CHARS) : full;
}
