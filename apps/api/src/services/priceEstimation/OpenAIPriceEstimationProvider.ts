import OpenAI from "openai";
import { z } from "zod";
import { env } from "../../config/env";
import type { PriceEstimationInput, PriceEstimationResult, PriceEstimationService } from "./PriceEstimationService";

const EstimateSchema = z.object({
  index: z.number().int().nonnegative(),
  unitPrice: z.number().positive(),
  assumptions: z.string(),
});
const ResponseSchema = z.object({ estimates: z.array(EstimateSchema) });

const SYSTEM_PROMPT = `You estimate realistic market prices (USD) for interior design/furnishing items, for a customer-facing quote. None of these items had a price available from the contractor's own reference pages, so this is explicitly a rough estimate, not a sourced number.

Rules:
- For each item, give a single realistic unit price based on typical retail or typical installed cost for an item of that description/category — a plausible market-rate number, not a placeholder or round guess.
- "assumptions" should briefly state what the estimate is based on (e.g. "typical retail price for a mid-range 3-seat fabric sofa" or "typical installed cost per m² for ceramic tile flooring").
- If an item is genuinely too vague or unusual to estimate at all, omit it from your output entirely — do not include a wild guess.
- Respond with a single JSON object and nothing else, matching this exact shape:
{ "estimates": [ { "index": number (the item's position in the input list, 0-based), "unitPrice": number, "assumptions": string } ] }`;

function formatItems(items: PriceEstimationInput[], roomType: string): string {
  const list = items
    .map((item, i) => `${i}. ${item.name} (category: ${item.category}, qty: ${item.quantity}${item.unit ? ` ${item.unit}` : ""})`)
    .join("\n");
  return `Room type: ${roomType}\n\nItems needing a price estimate:\n${list}`;
}

export class OpenAIPriceEstimationProvider implements PriceEstimationService {
  private client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  async estimate(items: PriceEstimationInput[], context: { roomType: string }): Promise<(PriceEstimationResult | null)[]> {
    if (items.length === 0) return [];

    const response = await this.client.chat.completions.create({
      model: env.REASONING_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: formatItems(items, context.roomType) },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("PriceEstimationService: OpenAI returned an empty response");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error(`PriceEstimationService: could not parse OpenAI response as JSON: ${content}`);
    }

    const { estimates } = ResponseSchema.parse(parsed);
    const byIndex = new Map(estimates.map((e) => [e.index, e]));

    return items.map((_, i) => {
      const estimate = byIndex.get(i);
      return estimate ? { unitPrice: estimate.unitPrice, assumptions: estimate.assumptions } : null;
    });
  }
}
