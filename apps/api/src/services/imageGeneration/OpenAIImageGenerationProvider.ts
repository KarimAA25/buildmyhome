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

function buildPrompt(spec: DesignSpecification): string {
  const changes = spec.items.map((item) => `- ${item.description} (${item.placement})`).join("\n");

  return `Redesign this room photo to match the following design specification. Preserve the room's real structure — walls, windows, doors, and camera perspective — and only change decor, furniture, materials, and lighting as described.

Style: ${spec.style}
Summary: ${spec.summary}
Color palette: ${spec.colorPalette.join(", ") || "unspecified"}

Changes to make:
${changes || "(none specified)"}
${spec.notes ? `\nNotes: ${spec.notes}` : ""}`;
}

export class OpenAIImageGenerationProvider implements ImageGenerationService {
  private client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  async generate(baseImage: string, designSpecification: DesignSpecification): Promise<string> {
    const { mimeType, buffer } = parseDataUrl(baseImage);
    const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1];
    const file = await toFile(buffer, `room.${extension}`, { type: mimeType });

    const response = await this.client.images.edit({
      model: env.IMAGE_MODEL,
      image: file,
      prompt: buildPrompt(designSpecification),
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
