import OpenAI from "openai";
import { env } from "../../config/env";
import { RoomAnalysisSchema, type RoomAnalysis, type VisionService } from "./VisionService";

const SYSTEM_PROMPT = `You are an interior design assistant analyzing a photo of a room.
Respond with a single JSON object and nothing else, matching this exact shape:
{
  "roomType": string,
  "dimensions": string or null,
  "existingFeatures": string[],
  "lightingNotes": string
}`;

export class OpenAIVisionProvider implements VisionService {
  private client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  async analyzeRoom(image: string): Promise<RoomAnalysis> {
    const response = await this.client.chat.completions.create({
      model: env.REASONING_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze this room photo." },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("VisionService: OpenAI returned an empty response");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error(`VisionService: could not parse OpenAI response as JSON: ${content}`);
    }

    return RoomAnalysisSchema.parse(parsed);
  }
}
