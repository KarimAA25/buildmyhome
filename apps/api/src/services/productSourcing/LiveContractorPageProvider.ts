import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { z } from "zod";
import { PricingTypeSchema, ConfidenceSchema } from "@buildmyhome/shared";
import { env } from "../../config/env";
import { supabase } from "../supabaseClient";
import type { CatalogProduct } from "../catalog/CatalogService";
import { fetchPageContent, type FetchedPage } from "./fetchPageContent";
import type { ProductSourcingContext, ProductSourcingService } from "./ProductSourcingService";

const MAX_PRODUCTS_PER_PAGE = 20;

const ExtractedProductSchema = z.object({
  name: z.string(),
  category: z.string(),
  description: z.string().nullable(),
  // Never invented — null unless the page actually showed a number.
  price: z.number().nonnegative().nullable(),
  currency: z.string().nullable(),
  unit: z.string().nullable(),
  pricingType: PricingTypeSchema,
  confidence: ConfidenceSchema,
  assumptions: z.string().nullable(),
});
const ExtractionResponseSchema = z.object({ products: z.array(ExtractedProductSchema) });

const SYSTEM_PROMPT = `You are reading a single product or project page from a contractor's own website to build a list of real, purchasable products/materials for use in an interior design quote.

Rules:
- Only list items actually described or shown on this page. Never invent a product that isn't there.
- If the page shows an explicit price for an item, set price to that number, pricingType to "EXACT_PRODUCT", and confidence to "HIGH".
- If the page describes a material or service without a specific line price (e.g. "custom oak paneling", "installation included"), set price to null, pick the pricingType that best fits ("CATALOG_MATERIAL", "ESTIMATED_MATERIAL", "ESTIMATED_LABOR", "ESTIMATED_INSTALLATION", or "CUSTOM_WORK"), and set confidence to "MEDIUM" or "LOW" depending on how well-specified it is. Never invent a plausible-sounding price.
- "unit" should reflect how the item is actually priced if that's stated (e.g. "each", "m²", "linear ft") — otherwise null.
- Use "assumptions" to note anything you inferred rather than read directly (e.g. "price shown is per square meter, quantity assumed 1 unit"). Null if nothing was inferred.
- List each distinct item once. Skip navigation, unrelated site content, and anything not actually a product/material/service being offered.

Respond with a single JSON object and nothing else, matching this exact shape:
{
  "products": [
    {
      "name": string,
      "category": string,
      "description": string or null,
      "price": number or null,
      "currency": string or null,
      "unit": string or null,
      "pricingType": "EXACT_PRODUCT" | "CATALOG_MATERIAL" | "ESTIMATED_MATERIAL" | "ESTIMATED_LABOR" | "ESTIMATED_INSTALLATION" | "CUSTOM_WORK",
      "confidence": "HIGH" | "MEDIUM" | "LOW",
      "assumptions": string or null
    }
  ]
}`;

export class LiveContractorPageProvider implements ProductSourcingService {
  private client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  async getCandidateProducts(contractorId: string, context: ProductSourcingContext): Promise<CatalogProduct[]> {
    const { data: pages, error } = await supabase
      .from("contractor_reference_pages")
      .select()
      .eq("contractor_id", contractorId);
    if (error) throw error;
    if (!pages || pages.length === 0) return [];

    const results = await Promise.allSettled(
      pages.map((page) => this.extractFromPage(page.url, context))
    );

    const products: CatalogProduct[] = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "fulfilled") {
        products.push(...result.value);
      } else {
        // A single bad/unreachable page degrades gracefully — it just
        // contributes nothing — rather than failing the whole generation.
        console.warn(`[LiveContractorPageProvider] failed to read ${pages[i].url}:`, result.reason);
      }
    }
    return products;
  }

  private async extractFromPage(pageUrl: string, context: ProductSourcingContext): Promise<CatalogProduct[]> {
    const page = await fetchPageContent(pageUrl);
    const extracted = await this.extractWithAI(page, context);

    return extracted.products.slice(0, MAX_PRODUCTS_PER_PAGE).map((product) => ({
      id: randomUUID(),
      name: product.name,
      description: product.description ?? undefined,
      category: product.category,
      price: product.price,
      currency: product.currency ?? "USD",
      unit: product.unit,
      sourceUrl: page.url,
      pricingType: product.pricingType,
      confidence: product.confidence,
      assumptions: product.assumptions,
    }));
  }

  private async extractWithAI(
    page: FetchedPage,
    context: ProductSourcingContext
  ): Promise<z.infer<typeof ExtractionResponseSchema>> {
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
              text: `This page is being read for a "${context.roomType}" design request: "${context.requestText}".\n\nPage title: ${page.title}\nPage URL: ${page.url}\n\nPage text:\n${page.text}`,
            },
            ...page.imageUrls.map((url) => ({ type: "image_url" as const, image_url: { url } })),
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("LiveContractorPageProvider: OpenAI returned an empty response");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error(`LiveContractorPageProvider: could not parse OpenAI response as JSON: ${content}`);
    }

    return ExtractionResponseSchema.parse(parsed);
  }
}
