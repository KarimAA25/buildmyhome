import OpenAI from "openai";
import { DesignSpecificationSchema, type DesignSpecification } from "@buildmyhome/shared";
import { env } from "../../config/env";
import type { CatalogProduct } from "../catalog/CatalogService";
import type {
  DesignGenerationInput,
  DesignModificationInput,
  DesignGenerationService,
} from "./DesignGenerationService";

const RESPONSE_SHAPE = `{
  "roomType": string,
  "style": string,
  "summary": string,
  "colorPalette": string[],
  "items": [
    {
      "id": string (unique within this array),
      "category": string,
      "description": string,
      "catalogProductId": string or null,
      "quantity": number (integer, greater than 0),
      "placement": string
    }
  ],
  "notes": string or null
}`;

const GENERATE_SYSTEM_PROMPT = `You are an interior design assistant. Given a room analysis, a user's request, and a list of candidate products, produce a design specification.
Respond with a single JSON object and nothing else, matching this exact shape:
${RESPONSE_SHAPE}

Rules:
- Only use a catalogProductId that exactly matches an "id" from the candidate products list below. If nothing fits, use null.
- Keep the design grounded in what the room analysis and candidate products actually support — do not invent products that aren't in the candidate list.`;

const MODIFY_SYSTEM_PROMPT = `You are an interior design assistant revising an existing design specification based on a user's change request.
Respond with a single JSON object and nothing else — the FULL updated design specification, matching this exact shape:
${RESPONSE_SHAPE}

Rules:
- Preserve items and details from the current specification that the change request doesn't affect.
- Only use a catalogProductId that exactly matches an "id" from the candidate products list below. If nothing fits, use null.
- Keep the design grounded in what the candidate products actually support — do not invent products that aren't in the candidate list.`;

function formatCandidateList(candidateProducts: CatalogProduct[]): string {
  const list = candidateProducts
    .map(
      (product) =>
        `- id: ${product.id} | name: ${product.name} | category: ${product.category} | price: ${product.price} ${product.currency ?? "USD"}` +
        (product.description ? ` | ${product.description}` : "")
    )
    .join("\n");
  return list || "(none available)";
}

export class OpenAIDesignGenerationProvider implements DesignGenerationService {
  private client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  private async callAndParse(systemPrompt: string, userMessage: string, candidateProducts: CatalogProduct[]) {
    const response = await this.client.chat.completions.create({
      model: env.REASONING_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("DesignGenerationService: OpenAI returned an empty response");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error(`DesignGenerationService: could not parse OpenAI response as JSON: ${content}`);
    }

    const spec = DesignSpecificationSchema.parse(parsed);

    // Guard against a hallucinated catalogProductId that wasn't actually offered —
    // QuotationService already treats null as "unpriced", so this fails safe.
    const validIds = new Set(candidateProducts.map((product) => product.id));
    const items = spec.items.map((item) =>
      item.catalogProductId && !validIds.has(item.catalogProductId) ? { ...item, catalogProductId: null } : item
    );

    return { ...spec, items };
  }

  async generate(input: DesignGenerationInput): Promise<DesignSpecification> {
    const userMessage = `Room analysis:
${JSON.stringify(input.roomAnalysis, null, 2)}

User request: ${input.userPrompt}

Candidate products:
${formatCandidateList(input.candidateProducts)}`;

    return this.callAndParse(GENERATE_SYSTEM_PROMPT, userMessage, input.candidateProducts);
  }

  async modify(input: DesignModificationInput): Promise<DesignSpecification> {
    const userMessage = `Current design specification:
${JSON.stringify(input.currentDesignSpecification, null, 2)}

Change request: ${input.changeRequest}

Candidate products:
${formatCandidateList(input.candidateProducts)}`;

    return this.callAndParse(MODIFY_SYSTEM_PROMPT, userMessage, input.candidateProducts);
  }
}
