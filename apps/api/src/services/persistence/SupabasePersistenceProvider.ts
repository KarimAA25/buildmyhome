import type { DesignSpecification, Quote, QuoteLineItem } from "@buildmyhome/shared";
import { supabase } from "../supabaseClient";
import type { Database } from "../../types/supabase";
import type {
  CreateDesignInput,
  CreateVersionInput,
  LookupCredentials,
  PersistedDesign,
  PersistedVersion,
  PersistenceService,
} from "./PersistenceService";

type DesignRow = Database["public"]["Tables"]["designs"]["Row"];
type VersionRow = Database["public"]["Tables"]["design_versions"]["Row"];
type QuoteRow = Database["public"]["Tables"]["quotes"]["Row"];
type QuoteItemRow = Database["public"]["Tables"]["quote_items"]["Row"];

const UNIQUE_VIOLATION = "23505";
const PROMPT_NUMBER_COLLISION_RETRIES = 5;

function randomPromptNumber(): string {
  return String(Math.floor(100_000 + Math.random() * 900_000));
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toDesign(row: DesignRow): PersistedDesign {
  return {
    id: row.id,
    contractorId: row.contractor_id,
    endUserEmail: row.end_user_email,
    promptNumber: row.prompt_number,
    originalImagePath: row.original_image_url,
    maxVersions: row.max_versions,
  };
}

function toQuote(quoteRow: QuoteRow, itemRows: QuoteItemRow[]): Quote {
  const lineItems: QuoteLineItem[] = itemRows.map((item) => ({
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    unit: item.unit,
    unitPrice: item.unit_price,
    lineTotal: item.total_price,
    pricingType: item.pricing_type as QuoteLineItem["pricingType"],
    confidence: item.confidence as QuoteLineItem["confidence"],
    sourceUrl: item.source_url,
    assumptions: item.assumptions,
  }));

  return {
    lineItems,
    currency: quoteRow.currency as Quote["currency"],
    totalLow: quoteRow.total_low,
    totalHigh: quoteRow.total_high,
  };
}

function toVersion(versionRow: VersionRow, quote: Quote): PersistedVersion {
  return {
    id: versionRow.id,
    designId: versionRow.design_id,
    versionNumber: versionRow.version_number,
    parentVersionId: versionRow.parent_version_id,
    generatedImagePath: versionRow.generated_image_url ?? "",
    designSpecification: versionRow.design_specification as unknown as DesignSpecification,
    sourceUrls: Array.isArray(versionRow.source_urls) ? (versionRow.source_urls as string[]) : [],
    quote,
  };
}

export class SupabasePersistenceProvider implements PersistenceService {
  async createDesign(input: CreateDesignInput): Promise<PersistedDesign> {
    let promptNumber = input.promptNumber;

    for (let attempt = 0; attempt <= PROMPT_NUMBER_COLLISION_RETRIES; attempt++) {
      const { data, error } = await supabase
        .from("designs")
        .insert({
          id: input.id,
          contractor_id: input.contractorId,
          end_user_email: normalizeEmail(input.endUserEmail),
          prompt_number: promptNumber,
          original_image_url: input.originalImagePath,
        })
        .select()
        .single();

      if (!error) return toDesign(data);

      // (contractor_id, prompt_number) collision — mint a fresh number and
      // retry, per CLAUDE2 §2b. Any other error is a real failure.
      if (error.code !== UNIQUE_VIOLATION) throw error;
      promptNumber = randomPromptNumber();
    }

    throw new Error("SupabasePersistenceProvider: exhausted prompt_number collision retries");
  }

  async getDesign(designId: string): Promise<PersistedDesign | null> {
    const { data, error } = await supabase.from("designs").select().eq("id", designId).maybeSingle();
    if (error) throw error;
    return data ? toDesign(data) : null;
  }

  async getLatestVersion(designId: string): Promise<PersistedVersion | null> {
    const { data: versionRow, error } = await supabase
      .from("design_versions")
      .select()
      .eq("design_id", designId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!versionRow) return null;

    return this.attachQuote(versionRow);
  }

  async getVersionCount(designId: string): Promise<number> {
    const { count, error } = await supabase
      .from("design_versions")
      .select("id", { count: "exact", head: true })
      .eq("design_id", designId);
    if (error) throw error;
    return count ?? 0;
  }

  async createVersion(input: CreateVersionInput): Promise<PersistedVersion> {
    // No cross-table transaction here — supabase-js doesn't expose one
    // without a bespoke Postgres function, and at this project's scale
    // (dozens of requests, not thousands) the risk of a partial write
    // between these three inserts is accepted rather than engineered around.
    const { data: versionRow, error: versionError } = await supabase
      .from("design_versions")
      .insert({
        design_id: input.designId,
        version_number: input.versionNumber,
        parent_version_id: input.parentVersionId,
        generated_image_url: input.generatedImagePath,
        design_specification: input.designSpecification as unknown as Database["public"]["Tables"]["design_versions"]["Insert"]["design_specification"],
        user_instruction: input.userInstruction,
        source_urls: input.sourceUrls,
        ai_model: input.aiModel,
      })
      .select()
      .single();
    if (versionError) throw versionError;

    const { data: quoteRow, error: quoteError } = await supabase
      .from("quotes")
      .insert({
        design_version_id: versionRow.id,
        currency: input.quote.currency,
        total_low: input.quote.totalLow,
        total_high: input.quote.totalHigh,
      })
      .select()
      .single();
    if (quoteError) throw quoteError;

    if (input.quote.lineItems.length > 0) {
      const { error: itemsError } = await supabase.from("quote_items").insert(
        input.quote.lineItems.map((item) => ({
          quote_id: quoteRow.id,
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unitPrice,
          total_price: item.lineTotal,
          pricing_type: item.pricingType,
          confidence: item.confidence,
          source_url: item.sourceUrl,
          assumptions: item.assumptions,
        }))
      );
      if (itemsError) throw itemsError;
    }

    return toVersion(versionRow, input.quote);
  }

  async lookup(credentials: LookupCredentials): Promise<{ design: PersistedDesign; version: PersistedVersion } | null> {
    const { data: designRow, error: designError } = await supabase
      .from("designs")
      .select()
      .eq("contractor_id", credentials.contractorId)
      .eq("prompt_number", credentials.promptNumber)
      .eq("end_user_email", normalizeEmail(credentials.email))
      .maybeSingle();
    if (designError) throw designError;
    if (!designRow) return null;

    const { data: versionRow, error: versionError } = await supabase
      .from("design_versions")
      .select()
      .eq("design_id", designRow.id)
      .eq("version_number", credentials.versionNumber)
      .maybeSingle();
    if (versionError) throw versionError;
    if (!versionRow) return null;

    const version = await this.attachQuote(versionRow);
    if (!version) return null;

    return { design: toDesign(designRow), version };
  }

  private async attachQuote(versionRow: VersionRow): Promise<PersistedVersion | null> {
    const { data: quoteRow, error: quoteError } = await supabase
      .from("quotes")
      .select()
      .eq("design_version_id", versionRow.id)
      .maybeSingle();
    if (quoteError) throw quoteError;
    if (!quoteRow) return null;

    const { data: itemRows, error: itemsError } = await supabase
      .from("quote_items")
      .select()
      .eq("quote_id", quoteRow.id);
    if (itemsError) throw itemsError;

    return toVersion(versionRow, toQuote(quoteRow, itemRows ?? []));
  }
}
