import OpenAI, { toFile } from "openai";
import type { DesignSpecification } from "@buildmyhome/shared";
import { env } from "../../config/env";
import type { ImageGenerationService } from "./ImageGenerationService";

function parseDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
  if (!match) {
    throw new Error("ImageGenerationService: expected a base64 image data URL");
  }
  return { mimeType: match[1], buffer: Buffer.from(match[2], "base64") };
}

function buildPrompt(spec: DesignSpecification, userInstruction: string): string {
  // Note: spec.items is the FULL current/target item list, not a list of
  // deltas — on a modify call it's mostly a description of what's already in
  // the photo. Framing all of it as "changes to make" told the model there
  // were many things to change when almost none of them actually were,
  // diluting the one real edit (sometimes to the point of no visible change
  // at all). The literal instruction is now the sole directive for what
  // changes; the item list is explicitly just background reference.
  const items = spec.items.map((item) => `- ${item.description} (${item.placement})`).join("\n");

  return `Edit this room photo. Preserve the room's real structure — walls, windows, doors, and camera perspective — unless the change below specifically calls for altering them.

THE CHANGE TO MAKE — apply this precisely and visibly; this is the only thing that should actually change in the image:
"${userInstruction}"

Everything else in the room should remain as it currently appears in the photo. Do not redraw, restyle, or otherwise alter anything that isn't part of the requested change.

Reference only — the room's full intended design, NOT a checklist of changes to apply:
Style: ${spec.style}
Summary: ${spec.summary}
Color palette: ${spec.colorPalette.join(", ") || "unspecified"}
Items:
${items || "(none specified)"}
${spec.notes ? `\nNotes: ${spec.notes}` : ""}`;
}

export class OpenAIImageGenerationProvider implements ImageGenerationService {
  private client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  async generate(baseImage: string, designSpecification: DesignSpecification, userInstruction: string): Promise<string> {
    const { mimeType, buffer } = parseDataUrl(baseImage);
    const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1];
    const file = await toFile(buffer, `room.${extension}`, { type: mimeType });

    const response = await this.client.images.edit({
      model: env.IMAGE_MODEL,
      image: file,
      prompt: buildPrompt(designSpecification, userInstruction),
      // Keep the output small — this image flows back through a Vercel
      // Route Handler on every subsequent modify call, which caps request
      // and response bodies at 4.5MB regardless of plan.
      size: "1024x1024",
      output_format: "jpeg",
      output_compression: 80,
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error("ImageGenerationService: OpenAI returned no image data");
    }

    return `data:image/jpeg;base64,${b64}`;
  }
}
