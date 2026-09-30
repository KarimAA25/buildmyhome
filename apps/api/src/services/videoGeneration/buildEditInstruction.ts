import type { DesignSpecification } from "@buildmyhome/shared";

// Mirrors OpenAIImageGenerationProvider's buildPrompt philosophy (the literal
// instruction is the sole directive; the spec is background reference only),
// adapted for CLAUDE3.md §6's video-specific assertions. Exported (unlike
// buildPrompt, which is private) so it's independently testable — getting
// this instruction right is the crux of §6's "preserve everything but the
// requested change" requirement.
export function buildEditInstruction(spec: DesignSpecification, userInstruction: string): string {
  const items = spec.items.map((item) => `- ${item.description} (${item.placement})`).join("\n");

  return `Edit this video. The supplied video is the source to edit, not a reference to loosely inspire a new generation.

THE CHANGE TO MAKE — apply this precisely and visibly; this is the only thing that should actually change in the video:
"${userInstruction}"

Preserve everything else exactly as it appears across the whole clip: camera movement, camera perspective, room geometry, walls, floor, ceiling, windows, doors, lighting, existing objects, and composition — unless the change above specifically calls for altering them. Do not introduce unrelated objects or restyle the room. Keep the change temporally consistent across the entire clip, correctly positioned and tracked as the camera moves.

Reference only — the room's full intended design, NOT a checklist of changes to apply:
Style: ${spec.style}
Summary: ${spec.summary}
Color palette: ${spec.colorPalette.join(", ") || "unspecified"}
Items:
${items || "(none specified)"}
${spec.notes ? `\nNotes: ${spec.notes}` : ""}`;
}
