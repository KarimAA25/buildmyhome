import type { DesignSpecification, GenerationStatus, MediaType, Quote, QuoteLineItem } from "@buildmyhome/shared";
import { supabase } from "../supabaseClient";
import type { Database } from "../../types/supabase";
import type {
  AttachQuoteInput,
  CreateDesignInput,
  CreateVersionInput,
  GetLatestVersionOptions,
  LookupCredentials,
  PersistedDesign,
  PersistedVersion,
  PersistenceService,
  UpdateVersionStatusInput,
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
    mediaType: row.media_type as MediaType,
    astraFinishedAt: row.astra_finished_at,
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

function toVersion(versionRow: VersionRow, quote: Quote | null): PersistedVersion {
  return {
    id: versionRow.id,
    designId: versionRow.design_id,
    versionNumber: versionRow.version_number,
    parentVersionId: versionRow.parent_version_id,
    generatedImagePath: versionRow.generated_image_url ?? "",
    designSpecification: versionRow.design_specification as unknown as DesignSpecification,
    sourceUrls: Array.isArray(versionRow.source_urls) ? (versionRow.source_urls as string[]) : [],
    quote,
    generationStatus: versionRow.generation_status as GenerationStatus,
    generatedVideoPath: versionRow.generated_video_url,
    videoDurationSeconds: versionRow.video_duration_seconds,
    generationError: versionRow.generation_error,
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
          media_type: input.mediaType,
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

  async getLatestVersion(designId: string, opts?: GetLatestVersionOptions): Promise<PersistedVersion | null> {
    const { data: versionRow, error } = await supabase
      .from("design_versions")
      .select()
      .eq("design_id", designId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!versionRow) return null;

    return this.attachQuote(versionRow, { quoteOptional: opts?.quoteOptional ?? false });
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
        // Omitted entirely (not passed as undefined) when not provided, so
        // image call sites get the DB's 'COMPLETED' default unchanged.
        ...(input.generationStatus ? { generation_status: input.generationStatus } : {}),
      })
      .select()
      .single();
    if (versionError) throw versionError;

    // No quote row for an in-progress Astra edit-turn — quote is computed
    // once, at session finish, and attached via attachQuoteToVersion instead
    // (Stage 3.5 §4/§11 rule 4).
    if (!input.quote) {
      return toVersion(versionRow, null);
    }

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

  async attachQuoteToVersion(input: AttachQuoteInput): Promise<void> {
    const { data: quoteRow, error: quoteError } = await supabase
      .from("quotes")
      .insert({
        design_version_id: input.versionId,
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
  }

  async markAstraFinished(designId: string): Promise<void> {
    const { error } = await supabase.from("designs").update({ astra_finished_at: new Date().toISOString() }).eq("id", designId);
    if (error) throw error;
  }

  async updateVersionStatus(input: UpdateVersionStatusInput): Promise<void> {
    const { error } = await supabase
      .from("design_versions")
      .update({
        generation_status: input.status,
        generated_video_url: input.generatedVideoPath ?? null,
        // video_duration_seconds is `int` in the schema — ffprobe's duration
        // (the value flowing in here) is a float (e.g. 2.56699), so it must
        // be rounded, not passed through raw.
        video_duration_seconds: input.videoDurationSeconds != null ? Math.round(input.videoDurationSeconds) : null,
        generation_error: input.generationError ?? null,
      })
      .eq("id", input.versionId);
    if (error) throw error;
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

    const mediaType = designRow.media_type as MediaType;
    // Astra threads have no version concept — always the latest. Image/video
    // now also default to latest when no version number is given
    // (Stage 3.5 §5 rule 8, extended beyond astra).
    const useLatest = mediaType === "astra" || credentials.versionNumber == null;

    const baseQuery = supabase.from("design_versions").select().eq("design_id", designRow.id);
    const { data: versionRow, error: versionError } = useLatest
      ? await baseQuery.order("version_number", { ascending: false }).limit(1).maybeSingle()
      : await baseQuery.eq("version_number", credentials.versionNumber as number).maybeSingle();
    if (versionError) throw versionError;
    if (!versionRow) return null;

    const version = await this.attachQuote(versionRow, { quoteOptional: mediaType === "astra" });
    if (!version) return null;

    return { design: toDesign(designRow), version };
  }

  private async attachQuote(versionRow: VersionRow, opts: { quoteOptional: boolean }): Promise<PersistedVersion | null> {
    const { data: quoteRow, error: quoteError } = await supabase
      .from("quotes")
      .select()
      .eq("design_version_id", versionRow.id)
      .maybeSingle();
    if (quoteError) throw quoteError;
    if (!quoteRow) {
      // A missing quote row is legitimate for an in-progress Astra
      // edit-turn — NOT "version not found." For image/video, createVersion()
      // always inserts a quote row, so a missing one there means corrupted/
      // legacy data — the existing generic-404 behavior (CLAUDE2 §1 rule 4)
      // is preserved by still returning null in that case.
      return opts.quoteOptional ? toVersion(versionRow, null) : null;
    }

    const { data: itemRows, error: itemsError } = await supabase
      .from("quote_items")
      .select()
      .eq("quote_id", quoteRow.id);
    if (itemsError) throw itemsError;

    return toVersion(versionRow, toQuote(quoteRow, itemRows ?? []));
  }
}
