import OpenAI from "openai";
import { z } from "zod";
import { DesignSpecificationItemSchema, type DesignSpecificationItem } from "@buildmyhome/shared";
import { env } from "../../config/env";
import type { CatalogProduct } from "../catalog/CatalogService";
import type { ImageDiffService } from "./ImageDiffService";

const ResponseSchema = z.object({ items: z.array(DesignSpecificationItemSchema) });

const SYSTEM_PROMPT = `You are an interior design auditor. You will be shown two photos of the same room: BEFORE and AFTER a redesign. Produce an accurate, itemized list of every purchasable design item visible in the AFTER photo — this list is used to generate a customer-facing price quote, so accuracy matters far more than completeness of prose.

Rules:
- List every distinct furniture, lighting, textile, material, or decor item visible in the AFTER photo that would need to be purchased or installed (e.g. sofa, rug, lamp, wall paneling, paint, curtains). Do not list structural elements that were not changed (existing walls, windows, doors, ceiling) unless they were visibly altered (e.g. repainted, paneled).
- Each distinct physical item appears exactly ONCE in your output. If an item is visible in multiple parts of the photo (e.g. a rug under both the sofa and coffee table), that is still a single line with quantity 1 — never list the same physical item twice.
- Compare against the BEFORE photo to understand what is new versus what was already there, but list ALL billable items currently visible in the AFTER photo, not only the ones that changed — the goal is a complete, accurate quote for the room as shown in the AFTER photo.
- For each item, estimate a realistic quantity (count of identical fixtures, or area in m² for materials like paint/paneling/flooring if that is how it would typically be priced).
- If an item genuinely matches one of the candidate products below, set catalogProductId to that product's "id" value COPIED EXACTLY, character for character, from the candidate list — never shorten, reformat, or guess at an id. If you are not certain of the exact id string, or nothing matches, set catalogProductId to null. A null value is always safer than a wrong or invented id.
- Do not invent prices. Pricing is computed separately from the catalog using whatever catalogProductId you provide.

Respond with a single JSON object and nothing else, matching this exact shape:
{
  "items": [
    {
      "id": string (unique within this array),
      "category": string,
      "description": string,
      "catalogProductId": string or null,
      "quantity": number (integer, greater than 0),
      "placement": string
    }
  ]
}`;

function formatCatalog(catalog: CatalogProduct[]): string {
  const list = catalog
    .map(
      (product) =>
        `- id: ${product.id} | name: ${product.name} | category: ${product.category} | price: ${product.price} ${product.currency ?? "USD"}` +
        (product.description ? ` | ${product.description}` : "")
    )
    .join("\n");
  return list || "(none available)";
}

export class OpenAIImageDiffProvider implements ImageDiffService {
  private client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  async detectItems(
    beforeImage: string,
    afterImage: string,
    catalog: CatalogProduct[]
  ): Promise<DesignSpecificationItem[]> {
    const response = await this.client.chat.completions.create({
      model: env.REASONING_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: `Candidate products:\n${formatCatalog(catalog)}` },
            { type: "text", text: "BEFORE photo:" },
            { type: "image_url", image_url: { url: beforeImage } },
            { type: "text", text: "AFTER photo:" },
            { type: "image_url", image_url: { url: afterImage } },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("ImageDiffService: OpenAI returned an empty response");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error(`ImageDiffService: could not parse OpenAI response as JSON: ${content}`);
    }

    const { items } = ResponseSchema.parse(parsed);

    // Same grounding safety net used elsewhere: never trust a
    // catalogProductId the model wasn't actually offered.
    const validIds = new Set(catalog.map((product) => product.id));
    return items.map((item) =>
      item.catalogProductId && !validIds.has(item.catalogProductId) ? { ...item, catalogProductId: null } : item
    );
  }
}
