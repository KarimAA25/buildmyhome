import OpenAI, { toFile } from "openai";
import type { DesignSpecification } from "@buildmyhome/shared";
import { env } from "../../config/env";
import { parseDataUrl } from "../../lib/dataUrl";
import type { AstraEditModel, AstraImageEditService } from "./AstraImageEditService";

// The orchestration layer already produced a precise, preserve-everything-
// else instruction — this just wraps it with the same "don't touch anything
// unrequested" framing OpenAIImageGenerationProvider uses, rather than
// re-deriving an instruction from the raw user utterance.
function buildPrompt(spec: DesignSpecification, editInstruction: string): string {
  return `Edit this room photo. This is the current state of an ongoing live editing session — edit it in place, never redesign from scratch.

THE CHANGE TO MAKE — apply this precisely and visibly; this is the only thing that should actually change in the image:
"${editInstruction}"

Everything else in the room should remain exactly as it currently appears in the photo — geometry, camera perspective, walls, floor, ceiling, windows, doors, lighting, materials, and every object not part of the requested change. Do not redraw, restyle, or otherwise alter anything else.

Reference only — the room's current full design, NOT a checklist of changes to apply:
Style: ${spec.style}
Summary: ${spec.summary}`;
}

export class OpenAIAstraImageEditProvider implements AstraImageEditService {
  private client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  async edit(
    currentImage: string,
    designSpecification: DesignSpecification,
    editInstruction: string,
    model: AstraEditModel
  ): Promise<string> {
    const { mimeType, buffer } = parseDataUrl(currentImage);
    const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1];
    const file = await toFile(buffer, `room.${extension}`, { type: mimeType });

    const response = await this.client.images.edit({
      model: model === "precise" ? env.OPENAI_IMAGE_EDIT_MODEL_PRECISE : env.OPENAI_IMAGE_EDIT_MODEL_FAST,
      image: file,
      prompt: buildPrompt(designSpecification, editInstruction),
      // Same rationale as OpenAIImageGenerationProvider: kept small since
      // this flows back through a Vercel Route Handler on every turn.
      size: "1024x1024",
      output_format: "jpeg",
      output_compression: 80,
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error("AstraImageEditService: OpenAI returned no image data");
    }

    return `data:image/jpeg;base64,${b64}`;
  }
}
