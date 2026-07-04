export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      benefit_card_tiers: {
        Row: {
          benefit_id: string
          card_brand: string
          card_level: string
        }
        Insert: {
          benefit_id: string
          card_brand: string
          card_level: string
        }
        Update: {
          benefit_id?: string
          card_brand?: string
          card_level?: string
        }
        Relationships: [
          {
            foreignKeyName: "benefit_card_tiers_benefit_id_fkey"
            columns: ["benefit_id"]
            isOneToOne: false
            referencedRelation: "benefits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "benefit_card_tiers_benefit_id_fkey"
            columns: ["benefit_id"]
            isOneToOne: false
            referencedRelation: "my_benefits"
            referencedColumns: ["id"]
          },
        ]
      }
      benefit_locations: {
        Row: {
          active: boolean
          address: string | null
          airport_code: string | null
          benefit_id: string
          city: string | null
          country: string | null
          geolocation_status:
            | Database["public"]["Enums"]["geolocation_status"]
            | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          radius_m: number | null
          region: string | null
          scope: Database["public"]["Enums"]["location_scope"] | null
          terminal: string | null
          uf: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          airport_code?: string | null
          benefit_id: string
          city?: string | null
          country?: string | null
          geolocation_status?:
            | Database["public"]["Enums"]["geolocation_status"]
            | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          radius_m?: number | null
          region?: string | null
          scope?: Database["public"]["Enums"]["location_scope"] | null
          terminal?: string | null
          uf?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          airport_code?: string | null
          benefit_id?: string
          city?: string | null
          country?: string | null
          geolocation_status?:
            | Database["public"]["Enums"]["geolocation_status"]
            | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          radius_m?: number | null
          region?: string | null
          scope?: Database["public"]["Enums"]["location_scope"] | null
          terminal?: string | null
          uf?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "benefit_locations_benefit_id_fkey"
            columns: ["benefit_id"]
            isOneToOne: false
            referencedRelation: "benefits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "benefit_locations_benefit_id_fkey"
            columns: ["benefit_id"]
            isOneToOne: false
            referencedRelation: "my_benefits"
            referencedColumns: ["id"]
          },
        ]
      }
      benefit_sources: {
        Row: {
          benefit_id: string
          source_item_id: string
        }
        Insert: {
          benefit_id: string
          source_item_id: string
        }
        Update: {
          benefit_id?: string
          source_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "benefit_sources_benefit_id_fkey"
            columns: ["benefit_id"]
            isOneToOne: false
            referencedRelation: "benefits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "benefit_sources_benefit_id_fkey"
            columns: ["benefit_id"]
            isOneToOne: false
            referencedRelation: "my_benefits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "benefit_sources_source_item_id_fkey"
            columns: ["source_item_id"]
            isOneToOne: false
            referencedRelation: "source_items"
            referencedColumns: ["id"]
          },
        ]
      }
      benefits: {
        Row: {
          action_label: string | null
          action_url: string | null
          active: boolean
          benefit_source:
            | Database["public"]["Enums"]["benefit_source_kind"]
            | null
          category: Database["public"]["Enums"]["benefit_category"]
          created_at: string
          id: string
          image_url: string | null
          limits_description: string | null
          long_description: string | null
          notes: string | null
          observed_at: string | null
          partner_name: string | null
          program: string | null
          redemption_type: Database["public"]["Enums"]["redemption_type"] | null
          requires_activation: boolean
          requires_certificate: boolean
          requires_eligible_card: boolean
          scope: Database["public"]["Enums"]["benefit_scope"]
          slug: string | null
          source_name: string | null
          source_url: string | null
          steps: string | null
          summary: string
          title: string
          uf: string | null
          valid_until: string | null
          verification_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Insert: {
          action_label?: string | null
          action_url?: string | null
          active?: boolean
          benefit_source?:
            | Database["public"]["Enums"]["benefit_source_kind"]
            | null
          category: Database["public"]["Enums"]["benefit_category"]
          created_at?: string
          id?: string
          image_url?: string | null
          limits_description?: string | null
          long_description?: string | null
          notes?: string | null
          observed_at?: string | null
          partner_name?: string | null
          program?: string | null
          redemption_type?:
            | Database["public"]["Enums"]["redemption_type"]
            | null
          requires_activation?: boolean
          requires_certificate?: boolean
          requires_eligible_card?: boolean
          scope?: Database["public"]["Enums"]["benefit_scope"]
          slug?: string | null
          source_name?: string | null
          source_url?: string | null
          steps?: string | null
          summary: string
          title: string
          uf?: string | null
          valid_until?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Update: {
          action_label?: string | null
          action_url?: string | null
          active?: boolean
          benefit_source?:
            | Database["public"]["Enums"]["benefit_source_kind"]
            | null
          category?: Database["public"]["Enums"]["benefit_category"]
          created_at?: string
          id?: string
          image_url?: string | null
          limits_description?: string | null
          long_description?: string | null
          notes?: string | null
          observed_at?: string | null
          partner_name?: string | null
          program?: string | null
          redemption_type?:
            | Database["public"]["Enums"]["redemption_type"]
            | null
          requires_activation?: boolean
          requires_certificate?: boolean
          requires_eligible_card?: boolean
          scope?: Database["public"]["Enums"]["benefit_scope"]
          slug?: string | null
          source_name?: string | null
          source_url?: string | null
          steps?: string | null
          summary?: string
          title?: string
          uf?: string | null
          valid_until?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Relationships: []
      }
      discovery_candidates: {
        Row: {
          created_at: string
          entity_type: Database["public"]["Enums"]["discovery_entity_type"]
          fingerprint: string
          id: string
          job_id: string
          match_status: Database["public"]["Enums"]["discovery_match_status"]
          matched_id: string | null
          parent_fingerprint: string | null
          payload: Json
          promoted_at: string | null
          promoted_id: string | null
          provenance: Json
          review_status: Database["public"]["Enums"]["discovery_review_status"]
          reviewed_by: string | null
        }
        Insert: {
          created_at?: string
          entity_type: Database["public"]["Enums"]["discovery_entity_type"]
          fingerprint: string
          id?: string
          job_id: string
          match_status?: Database["public"]["Enums"]["discovery_match_status"]
          matched_id?: string | null
          parent_fingerprint?: string | null
          payload?: Json
          promoted_at?: string | null
          promoted_id?: string | null
          provenance?: Json
          review_status?: Database["public"]["Enums"]["discovery_review_status"]
          reviewed_by?: string | null
        }
        Update: {
          created_at?: string
          entity_type?: Database["public"]["Enums"]["discovery_entity_type"]
          fingerprint?: string
          id?: string
          job_id?: string
          match_status?: Database["public"]["Enums"]["discovery_match_status"]
          matched_id?: string | null
          parent_fingerprint?: string | null
          payload?: Json
          promoted_at?: string | null
          promoted_id?: string | null
          provenance?: Json
          review_status?: Database["public"]["Enums"]["discovery_review_status"]
          reviewed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discovery_candidates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "discovery_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_jobs: {
        Row: {
          brief: string
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          status: Database["public"]["Enums"]["discovery_job_status"]
        }
        Insert: {
          brief: string
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          status?: Database["public"]["Enums"]["discovery_job_status"]
        }
        Update: {
          brief?: string
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          status?: Database["public"]["Enums"]["discovery_job_status"]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          is_admin: boolean
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          is_admin?: boolean
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          is_admin?: boolean
        }
        Relationships: []
      }
      source_items: {
        Row: {
          card_brand: string | null
          card_level: string | null
          cashback_rule: string | null
          display_name: string | null
          eligibility_description: string | null
          id: string
          label: string
          min_income: number | null
          min_investment: number | null
          min_monthly_spend: number | null
          pluggy_product: string | null
          points_rule: string | null
          product_type: string | null
          slug: string | null
          sort_order: number
          source_id: string
          source_url: string | null
          verification_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Insert: {
          card_brand?: string | null
          card_level?: string | null
          cashback_rule?: string | null
          display_name?: string | null
          eligibility_description?: string | null
          id?: string
          label: string
          min_income?: number | null
          min_investment?: number | null
          min_monthly_spend?: number | null
          pluggy_product?: string | null
          points_rule?: string | null
          product_type?: string | null
          slug?: string | null
          sort_order?: number
          source_id: string
          source_url?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Update: {
          card_brand?: string | null
          card_level?: string | null
          cashback_rule?: string | null
          display_name?: string | null
          eligibility_description?: string | null
          id?: string
          label?: string
          min_income?: number | null
          min_investment?: number | null
          min_monthly_spend?: number | null
          pluggy_product?: string | null
          points_rule?: string | null
          product_type?: string | null
          slug?: string | null
          sort_order?: number
          source_id?: string
          source_url?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "source_items_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      source_requests: {
        Row: {
          created_at: string
          id: string
          source_category: Database["public"]["Enums"]["source_category"]
          text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          source_category: Database["public"]["Enums"]["source_category"]
          text: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          source_category?: Database["public"]["Enums"]["source_category"]
          text?: string
          user_id?: string
        }
        Relationships: []
      }
      sources: {
        Row: {
          active: boolean
          connector_type: string | null
          country: string
          id: string
          institution_url: string | null
          kind: Database["public"]["Enums"]["source_kind"]
          logo_url: string | null
          name: string
          pluggy_connector_id: number | null
          primary_color: string | null
          slug: string | null
          sort_order: number
          source_category: Database["public"]["Enums"]["source_category"]
        }
        Insert: {
          active?: boolean
          connector_type?: string | null
          country?: string
          id?: string
          institution_url?: string | null
          kind: Database["public"]["Enums"]["source_kind"]
          logo_url?: string | null
          name: string
          pluggy_connector_id?: number | null
          primary_color?: string | null
          slug?: string | null
          sort_order?: number
          source_category?: Database["public"]["Enums"]["source_category"]
        }
        Update: {
          active?: boolean
          connector_type?: string | null
          country?: string
          id?: string
          institution_url?: string | null
          kind?: Database["public"]["Enums"]["source_kind"]
          logo_url?: string | null
          name?: string
          pluggy_connector_id?: number | null
          primary_color?: string | null
          slug?: string | null
          sort_order?: number
          source_category?: Database["public"]["Enums"]["source_category"]
        }
        Relationships: []
      }
      user_sources: {
        Row: {
          source_item_id: string
          user_id: string
        }
        Insert: {
          source_item_id: string
          user_id: string
        }
        Update: {
          source_item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sources_source_item_id_fkey"
            columns: ["source_item_id"]
            isOneToOne: false
            referencedRelation: "source_items"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      my_benefits: {
        Row: {
          action_label: string | null
          action_url: string | null
          benefit_source:
            | Database["public"]["Enums"]["benefit_source_kind"]
            | null
          category: Database["public"]["Enums"]["benefit_category"] | null
          created_at: string | null
          id: string | null
          image_url: string | null
          networks: Json | null
          observed_at: string | null
          origins: Json | null
          partner_name: string | null
          scope: Database["public"]["Enums"]["benefit_scope"] | null
          source_name: string | null
          source_url: string | null
          steps: string | null
          summary: string | null
          title: string | null
          uf: string | null
          valid_until: string | null
          via: string[] | null
        }
        Relationships: []
      }
    }
    Functions: {
      claim_discovery_job: {
        Args: { worker: string }
        Returns: {
          brief: string
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          status: Database["public"]["Enums"]["discovery_job_status"]
        }[]
        SetofOptions: {
          from: "*"
          to: "discovery_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      is_admin: { Args: never; Returns: boolean }
      replace_user_sources: { Args: { item_ids: string[] }; Returns: undefined }
    }
    Enums: {
      benefit_category:
        | "travel"
        | "insurance"
        | "cashback"
        | "investback"
        | "points"
        | "miles"
        | "shopping"
        | "restaurant"
        | "airport"
        | "concierge"
        | "investment"
        | "security"
        | "account_service"
        | "international_purchase"
        | "experience"
        | "other"
      benefit_scope: "nacional" | "regional" | "pontual"
      benefit_source_kind: "issuer" | "card_network" | "partner" | "mixed"
      discovery_entity_type: "source" | "source_item" | "benefit"
      discovery_job_status: "pending" | "processing" | "done" | "error"
      discovery_match_status: "new" | "update" | "duplicate"
      discovery_review_status: "pending" | "approved" | "rejected"
      geolocation_status:
        | "exact"
        | "approximate"
        | "needs_geocoding"
        | "not_applicable"
      location_scope:
        | "online"
        | "physical"
        | "global_network"
        | "countrywide"
        | "airport"
        | "city"
        | "regional"
        | "unknown"
      redemption_type:
        | "automatic"
        | "app"
        | "coupon"
        | "partner_portal"
        | "insurance_claim"
        | "certificate"
        | "concierge"
        | "physical_access"
        | "points_exchange"
        | "statement_credit"
        | "other"
      source_category:
        | "bank_card"
        | "carrier"
        | "health"
        | "corporate_benefits"
        | "loyalty"
        | "retail"
        | "mall"
      source_kind: "card" | "carrier" | "loyalty" | "cpf"
      verification_status:
        | "official_confirmed"
        | "official_needs_regulation_check"
        | "partner_network"
        | "inferred_from_card_network"
        | "needs_manual_validation"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      benefit_category: [
        "travel",
        "insurance",
        "cashback",
        "investback",
        "points",
        "miles",
        "shopping",
        "restaurant",
        "airport",
        "concierge",
        "investment",
        "security",
        "account_service",
        "international_purchase",
        "experience",
        "other",
      ],
      benefit_scope: ["nacional", "regional", "pontual"],
      benefit_source_kind: ["issuer", "card_network", "partner", "mixed"],
      discovery_entity_type: ["source", "source_item", "benefit"],
      discovery_job_status: ["pending", "processing", "done", "error"],
      discovery_match_status: ["new", "update", "duplicate"],
      discovery_review_status: ["pending", "approved", "rejected"],
      geolocation_status: [
        "exact",
        "approximate",
        "needs_geocoding",
        "not_applicable",
      ],
      location_scope: [
        "online",
        "physical",
        "global_network",
        "countrywide",
        "airport",
        "city",
        "regional",
        "unknown",
      ],
      redemption_type: [
        "automatic",
        "app",
        "coupon",
        "partner_portal",
        "insurance_claim",
        "certificate",
        "concierge",
        "physical_access",
        "points_exchange",
        "statement_credit",
        "other",
      ],
      source_category: [
        "bank_card",
        "carrier",
        "health",
        "corporate_benefits",
        "loyalty",
        "retail",
        "mall",
      ],
      source_kind: ["card", "carrier", "loyalty", "cpf"],
      verification_status: [
        "official_confirmed",
        "official_needs_regulation_check",
        "partner_network",
        "inferred_from_card_network",
        "needs_manual_validation",
      ],
    },
  },
} as const

