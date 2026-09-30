export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      contractor_reference_pages: {
        Row: {
          added_at: string
          contractor_id: string
          id: string
          label: string | null
          url: string
        }
        Insert: {
          added_at?: string
          contractor_id: string
          id?: string
          label?: string | null
          url: string
        }
        Update: {
          added_at?: string
          contractor_id?: string
          id?: string
          label?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "contractor_reference_pages_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      contractors: {
        Row: {
          contact_email: string
          contractor_token: string
          created_at: string
          id: string
          name: string
          phone: string | null
          website_url: string | null
        }
        Insert: {
          contact_email: string
          contractor_token: string
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          website_url?: string | null
        }
        Update: {
          contact_email?: string
          contractor_token?: string
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      design_versions: {
        Row: {
          ai_model: string | null
          changed_items: Json | null
          created_at: string
          design_id: string
          design_specification: Json
          generated_image_url: string | null
          generated_video_url: string | null
          generation_error: string | null
          generation_status: string
          id: string
          parent_version_id: string | null
          preserved_items: Json | null
          source_urls: Json | null
          user_instruction: string | null
          version_number: number
          video_duration_seconds: number | null
        }
        Insert: {
          ai_model?: string | null
          changed_items?: Json | null
          created_at?: string
          design_id: string
          design_specification: Json
          generated_image_url?: string | null
          generated_video_url?: string | null
          generation_error?: string | null
          generation_status?: string
          id?: string
          parent_version_id?: string | null
          preserved_items?: Json | null
          source_urls?: Json | null
          user_instruction?: string | null
          version_number: number
          video_duration_seconds?: number | null
        }
        Update: {
          ai_model?: string | null
          changed_items?: Json | null
          created_at?: string
          design_id?: string
          design_specification?: Json
          generated_image_url?: string | null
          generated_video_url?: string | null
          generation_error?: string | null
          generation_status?: string
          id?: string
          parent_version_id?: string | null
          preserved_items?: Json | null
          source_urls?: Json | null
          user_instruction?: string | null
          version_number?: number
          video_duration_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "design_versions_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "designs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_versions_parent_version_id_fkey"
            columns: ["parent_version_id"]
            isOneToOne: false
            referencedRelation: "design_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      designs: {
        Row: {
          contractor_id: string
          created_at: string
          end_user_email: string
          id: string
          max_versions: number | null
          media_type: string
          original_image_url: string
          prompt_number: string
        }
        Insert: {
          contractor_id: string
          created_at?: string
          end_user_email: string
          id?: string
          max_versions?: number | null
          media_type?: string
          original_image_url: string
          prompt_number: string
        }
        Update: {
          contractor_id?: string
          created_at?: string
          end_user_email?: string
          id?: string
          max_versions?: number | null
          media_type?: string
          original_image_url?: string
          prompt_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "designs_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          assumptions: string | null
          category: string
          confidence: string
          id: string
          name: string
          pricing_type: string
          quantity: number
          quote_id: string
          source_url: string | null
          total_price: number | null
          unit: string | null
          unit_price: number | null
        }
        Insert: {
          assumptions?: string | null
          category: string
          confidence: string
          id?: string
          name: string
          pricing_type: string
          quantity: number
          quote_id: string
          source_url?: string | null
          total_price?: number | null
          unit?: string | null
          unit_price?: number | null
        }
        Update: {
          assumptions?: string | null
          category?: string
          confidence?: string
          id?: string
          name?: string
          pricing_type?: string
          quantity?: number
          quote_id?: string
          source_url?: string | null
          total_price?: number | null
          unit?: string | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          created_at: string
          currency: string
          design_version_id: string
          id: string
          total_high: number | null
          total_low: number | null
        }
        Insert: {
          created_at?: string
          currency?: string
          design_version_id: string
          id?: string
          total_high?: number | null
          total_low?: number | null
        }
        Update: {
          created_at?: string
          currency?: string
          design_version_id?: string
          id?: string
          total_high?: number | null
          total_low?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_design_version_id_fkey"
            columns: ["design_version_id"]
            isOneToOne: true
            referencedRelation: "design_versions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
