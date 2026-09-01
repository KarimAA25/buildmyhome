import OpenAI from "openai";
import type { DesignSpecification } from "@buildmyhome/shared";
import { env } from "../../config/env";
import {
  ImageValidationResultSchema,
  type ImageValidationResult,
  type ImageValidationService,
} from "./ImageValidationService";

const SYSTEM_PROMPT = `You are a strict quality-control reviewer for AI-generated interior design photos.
Given a generated room image and the design specification it was supposed to follow, decide if the image is acceptable to show a customer.

Reject the image if it has:
- visible rendering artifacts (warped or duplicated objects, garbled text, impossible geometry)
- a room structure that looks nothing like a real, physically plausible room
- none of the requested design elements present at all

Minor stylistic differences from the spec are fine — do not reject for those.

Respond with a single JSON object and nothing else:
{ "valid": boolean, "reason": string or null }
"reason" must be null when valid is true, and a short, specific explanation when valid is false.`;

export class OpenAIImageValidationProvider implements ImageValidationService {
  private client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  async validate(image: string, designSpecification: DesignSpecification): Promise<ImageValidationResult> {
    const expectedItems = designSpecification.items.map((item) => item.description).join("; ") || "(none)";

    const response = await this.client.chat.completions.create({
      model: env.REASONING_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Design specification summary: ${designSpecification.summary}\nStyle: ${designSpecification.style}\nExpected items: ${expectedItems}`,
            },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("ImageValidationService: OpenAI returned an empty response");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error(`ImageValidationService: could not parse OpenAI response as JSON: ${content}`);
    }

    return ImageValidationResultSchema.parse(parsed);
  }
}
