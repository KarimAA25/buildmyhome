import OpenAI from "openai";
import { env } from "../../config/env";
import type { CatalogProduct } from "../catalog/CatalogService";
import {
  AstraOrchestrationResultSchema,
  type AstraOrchestrationInput,
  type AstraOrchestrationResult,
  type AstraOrchestrationService,
} from "./AstraOrchestrationService";

const RESPONSE_SHAPE = `{
  "editInstruction": string (a precise, self-contained instruction for an image-editing model — describe exactly what visual change to make, phrased so that everything else in the photo should stay untouched),
  "updatedDesignSpecification": {
    "roomType": string,
    "style": string,
    "summary": string,
    "colorPalette": string[],
    "items": [
      { "id": string, "category": string, "description": string, "catalogProductId": string or null, "quantity": number, "placement": string }
    ],
    "notes": string or null
  },
  "modelChoice": "fast" or "precise",
  "acknowledgement": string (a short, natural spoken confirmation of what you just changed, one sentence)
}`;

const CATALOG_PRODUCT_ID_GUIDANCE = `The candidate products are real items/materials drawn from the contractor's own reference pages — treat them as strong style and material inspiration, not a strict catalog every item must identically match. Whenever an item is reasonably similar in spirit to a candidate product, set its catalogProductId to that candidate's "id" (copied exactly, character for character); use null only when nothing plausibly relates.`;

const SYSTEM_PROMPT = `You are the reasoning layer behind a live voice-driven room-photo editor. You receive the current photo, the current design specification, and what the user just asked for. You never generate or edit images yourself — you decide what should change and produce a precise instruction for a separate image-editing model.

Respond with a single JSON object and nothing else, matching this exact shape:
${RESPONSE_SHAPE}

Rules:
- Apply ONLY the user's requested change. Everything else in the room — geometry, camera perspective, walls, floor, ceiling, windows, doors, lighting, materials, and every piece of furniture/decor not mentioned — must be explicitly preserved in editInstruction, mirroring how an existing video-edit instruction in this system asserts "preserve everything else."
- "updatedDesignSpecification" is the FULL specification after the change, not a diff — carry forward every item from the current specification unchanged unless the request specifically affects it.
- ${CATALOG_PRODUCT_ID_GUIDANCE}
- Choose "modelChoice": "precise" for edits needing fine detail or accuracy (text, faces, small/intricate objects, exact color matching); "fast" for everything else (typical furniture/color/material swaps).
- "acknowledgement" should sound like something a helpful assistant would say out loud right after making the change — brief, natural, no JSON or technical language.`;

function formatCandidateList(candidateProducts: CatalogProduct[]): string {
  const list = candidateProducts
    .map(
      (product) =>
        `- id: ${product.id} | name: ${product.name} | category: ${product.category} | price: ${product.price != null ? `${product.price} ${product.currency ?? "USD"}` : "unknown"}` +
        (product.description ? ` | ${product.description}` : "")
    )
    .join("\n");
  return list || "(none available)";
}

export class OpenAIAstraOrchestrationProvider implements AstraOrchestrationService {
  private client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  async proposeEdit(input: AstraOrchestrationInput): Promise<AstraOrchestrationResult> {
    const textContent = `Current design specification:
${JSON.stringify(input.currentDesignSpecification, null, 2)}

User's requested change (spoken, transcribed): ${input.userUtterance}

Candidate products:
${formatCandidateList(input.candidateProducts)}`;

    const response = await this.client.chat.completions.create({
      model: env.OPENAI_ASTRA_ORCHESTRATION_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: textContent },
            { type: "image_url", image_url: { url: input.currentImage } },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("AstraOrchestrationService: OpenAI returned an empty response");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error(`AstraOrchestrationService: could not parse OpenAI response as JSON: ${content}`);
    }

    const result = AstraOrchestrationResultSchema.parse(parsed);

    // Guard against a hallucinated catalogProductId, same as DesignGenerationService.
    const validIds = new Set(input.candidateProducts.map((product) => product.id));
    const items = result.updatedDesignSpecification.items.map((item) =>
      item.catalogProductId && !validIds.has(item.catalogProductId) ? { ...item, catalogProductId: null } : item
    );

    return { ...result, updatedDesignSpecification: { ...result.updatedDesignSpecification, items } };
  }
}
