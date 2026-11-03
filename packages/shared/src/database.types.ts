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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      availability_rules: {
        Row: {
          end_time: string
          id: string
          spot_id: string
          start_time: string
          weekday: number
        }
        Insert: {
          end_time: string
          id?: string
          spot_id: string
          start_time: string
          weekday: number
        }
        Update: {
          end_time?: string
          id?: string
          spot_id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "availability_rules_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "spots"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          cancel_reason: string | null
          cancelled_by: string | null
          checked_in_at: string | null
          checked_out_at: string | null
          checkin_code: string
          created_at: string
          driver_id: string
          during: unknown
          expires_at: string | null
          hourly_rate_paise: number
          id: string
          kind: Database["public"]["Enums"]["booking_kind"]
          overstay_paise: number
          spot_id: string
          status: Database["public"]["Enums"]["booking_status"]
          total_paise: number
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_by?: string | null
          checked_in_at?: string | null
          checked_out_at?: string | null
          checkin_code: string
          created_at?: string
          driver_id: string
          during: unknown
          expires_at?: string | null
          hourly_rate_paise: number
          id?: string
          kind: Database["public"]["Enums"]["booking_kind"]
          overstay_paise?: number
          spot_id: string
          status: Database["public"]["Enums"]["booking_status"]
          total_paise: number
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          cancel_reason?: string | null
          cancelled_by?: string | null
          checked_in_at?: string | null
          checked_out_at?: string | null
          checkin_code?: string
          created_at?: string
          driver_id?: string
          during?: unknown
          expires_at?: string | null
          hourly_rate_paise?: number
          id?: string
          kind?: Database["public"]["Enums"]["booking_kind"]
          overstay_paise?: number
          spot_id?: string
          status?: Database["public"]["Enums"]["booking_status"]
          total_paise?: number
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "spots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          author_id: string
          booking_id: string
          comment: string | null
          created_at: string
          id: string
          rating: number
          subject_id: string
        }
        Insert: {
          author_id: string
          booking_id: string
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          subject_id: string
        }
        Update: {
          author_id?: string
          booking_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      spot_access: {
        Row: {
          access_instructions: string | null
          address: string
          location: unknown
          spot_id: string
          updated_at: string
        }
        Insert: {
          access_instructions?: string | null
          address: string
          location: unknown
          spot_id: string
          updated_at?: string
        }
        Update: {
          access_instructions?: string | null
          address?: string
          location?: unknown
          spot_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spot_access_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: true
            referencedRelation: "spots"
            referencedColumns: ["id"]
          },
        ]
      }
      spot_photos: {
        Row: {
          created_at: string
          id: string
          sort_order: number
          spot_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          sort_order?: number
          spot_id: string
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          sort_order?: number
          spot_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "spot_photos_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "spots"
            referencedColumns: ["id"]
          },
        ]
      }
      spots: {
        Row: {
          area_label: string | null
          created_at: string
          description: string | null
          has_cctv: boolean
          has_ev_charging: boolean
          has_security_guard: boolean
          host_id: string
          hourly_rate_paise: number
          id: string
          instant_book: boolean
          is_covered: boolean
          max_height_cm: number | null
          public_location: unknown
          rating_avg: number | null
          rating_count: number
          status: Database["public"]["Enums"]["spot_status"]
          timezone: string
          title: string
          updated_at: string
          vehicle_types: Database["public"]["Enums"]["vehicle_type"][]
        }
        Insert: {
          area_label?: string | null
          created_at?: string
          description?: string | null
          has_cctv?: boolean
          has_ev_charging?: boolean
          has_security_guard?: boolean
          host_id: string
          hourly_rate_paise: number
          id?: string
          instant_book?: boolean
          is_covered?: boolean
          max_height_cm?: number | null
          public_location?: unknown
          rating_avg?: number | null
          rating_count?: number
          status?: Database["public"]["Enums"]["spot_status"]
          timezone?: string
          title: string
          updated_at?: string
          vehicle_types?: Database["public"]["Enums"]["vehicle_type"][]
        }
        Update: {
          area_label?: string | null
          created_at?: string
          description?: string | null
          has_cctv?: boolean
          has_ev_charging?: boolean
          has_security_guard?: boolean
          host_id?: string
          hourly_rate_paise?: number
          id?: string
          instant_book?: boolean
          is_covered?: boolean
          max_height_cm?: number | null
          public_location?: unknown
          rating_avg?: number | null
          rating_count?: number
          status?: Database["public"]["Enums"]["spot_status"]
          timezone?: string
          title?: string
          updated_at?: string
          vehicle_types?: Database["public"]["Enums"]["vehicle_type"][]
        }
        Relationships: [
          {
            foreignKeyName: "spots_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          created_at: string
          id: string
          make_model: string | null
          owner_id: string
          plate_number: string
          type: Database["public"]["Enums"]["vehicle_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          make_model?: string | null
          owner_id: string
          plate_number: string
          type: Database["public"]["Enums"]["vehicle_type"]
        }
        Update: {
          created_at?: string
          id?: string
          make_model?: string | null
          owner_id?: string
          plate_number?: string
          type?: Database["public"]["Enums"]["vehicle_type"]
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_booking: {
        Args: { p_booking_id: string; p_reason?: string }
        Returns: {
          cancel_reason: string | null
          cancelled_by: string | null
          checked_in_at: string | null
          checked_out_at: string | null
          checkin_code: string
          created_at: string
          driver_id: string
          during: unknown
          expires_at: string | null
          hourly_rate_paise: number
          id: string
          kind: Database["public"]["Enums"]["booking_kind"]
          overstay_paise: number
          spot_id: string
          status: Database["public"]["Enums"]["booking_status"]
          total_paise: number
          updated_at: string
          vehicle_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      check_in: {
        Args: { p_booking_id: string }
        Returns: {
          cancel_reason: string | null
          cancelled_by: string | null
          checked_in_at: string | null
          checked_out_at: string | null
          checkin_code: string
          created_at: string
          driver_id: string
          during: unknown
          expires_at: string | null
          hourly_rate_paise: number
          id: string
          kind: Database["public"]["Enums"]["booking_kind"]
          overstay_paise: number
          spot_id: string
          status: Database["public"]["Enums"]["booking_status"]
          total_paise: number
          updated_at: string
          vehicle_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      check_out: {
        Args: { p_booking_id: string }
        Returns: {
          cancel_reason: string | null
          cancelled_by: string | null
          checked_in_at: string | null
          checked_out_at: string | null
          checkin_code: string
          created_at: string
          driver_id: string
          during: unknown
          expires_at: string | null
          hourly_rate_paise: number
          id: string
          kind: Database["public"]["Enums"]["booking_kind"]
          overstay_paise: number
          spot_id: string
          status: Database["public"]["Enums"]["booking_status"]
          total_paise: number
          updated_at: string
          vehicle_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_spot: {
        Args: {
          p_access_instructions: string
          p_address: string
          p_area_label: string
          p_availability?: Json
          p_description: string
          p_has_cctv: boolean
          p_has_ev_charging: boolean
          p_has_security_guard: boolean
          p_hourly_rate_paise: number
          p_instant_book: boolean
          p_is_covered: boolean
          p_lat: number
          p_lng: number
          p_max_height_cm: number
          p_title: string
          p_vehicle_types: Database["public"]["Enums"]["vehicle_type"][]
        }
        Returns: string
      }
      expire_stale_bookings: { Args: never; Returns: undefined }
      generate_checkin_code: { Args: never; Returns: string }
      get_my_spot: {
        Args: { p_spot_id: string }
        Returns: {
          access_instructions: string
          address: string
          area_label: string
          availability: Json
          description: string
          has_cctv: boolean
          has_ev_charging: boolean
          has_security_guard: boolean
          hourly_rate_paise: number
          id: string
          instant_book: boolean
          is_covered: boolean
          lat: number
          lng: number
          max_height_cm: number
          photos: Json
          rating_avg: number
          rating_count: number
          status: Database["public"]["Enums"]["spot_status"]
          title: string
          vehicle_types: Database["public"]["Enums"]["vehicle_type"][]
        }[]
      }
      is_spot_host: { Args: { p_spot_id: string }; Returns: boolean }
      is_within_availability: {
        Args: { p_range: unknown; p_spot_id: string }
        Returns: boolean
      }
      nearby_spots: {
        Args: {
          p_ends_at?: string
          p_lat: number
          p_limit?: number
          p_lng: number
          p_radius_m?: number
          p_starts_at?: string
          p_vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
        }
        Returns: {
          area_label: string
          distance_m: number
          has_cctv: boolean
          has_ev_charging: boolean
          has_security_guard: boolean
          hourly_rate_paise: number
          id: string
          instant_book: boolean
          is_covered: boolean
          lat: number
          lng: number
          rating_avg: number
          rating_count: number
          title: string
          vehicle_types: Database["public"]["Enums"]["vehicle_type"][]
        }[]
      }
      replace_availability: {
        Args: { p_availability: Json; p_spot_id: string }
        Returns: undefined
      }
      request_booking: {
        Args: {
          p_ends_at: string
          p_offered_rate_paise?: number
          p_spot_id: string
          p_starts_at: string
          p_vehicle_id: string
        }
        Returns: {
          cancel_reason: string | null
          cancelled_by: string | null
          checked_in_at: string | null
          checked_out_at: string | null
          checkin_code: string
          created_at: string
          driver_id: string
          during: unknown
          expires_at: string | null
          hourly_rate_paise: number
          id: string
          kind: Database["public"]["Enums"]["booking_kind"]
          overstay_paise: number
          spot_id: string
          status: Database["public"]["Enums"]["booking_status"]
          total_paise: number
          updated_at: string
          vehicle_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      respond_to_booking: {
        Args: { p_accept: boolean; p_booking_id: string }
        Returns: {
          cancel_reason: string | null
          cancelled_by: string | null
          checked_in_at: string | null
          checked_out_at: string | null
          checkin_code: string
          created_at: string
          driver_id: string
          during: unknown
          expires_at: string | null
          hourly_rate_paise: number
          id: string
          kind: Database["public"]["Enums"]["booking_kind"]
          overstay_paise: number
          spot_id: string
          status: Database["public"]["Enums"]["booking_status"]
          total_paise: number
          updated_at: string
          vehicle_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_review: {
        Args: { p_booking_id: string; p_comment?: string; p_rating: number }
        Returns: {
          author_id: string
          booking_id: string
          comment: string | null
          created_at: string
          id: string
          rating: number
          subject_id: string
        }
        SetofOptions: {
          from: "*"
          to: "reviews"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_spot: {
        Args: {
          p_access_instructions: string
          p_address: string
          p_area_label: string
          p_availability?: Json
          p_description: string
          p_has_cctv: boolean
          p_has_ev_charging: boolean
          p_has_security_guard: boolean
          p_hourly_rate_paise: number
          p_instant_book: boolean
          p_is_covered: boolean
          p_lat: number
          p_lng: number
          p_max_height_cm: number
          p_spot_id: string
          p_title: string
          p_vehicle_types: Database["public"]["Enums"]["vehicle_type"][]
        }
        Returns: undefined
      }
    }
    Enums: {
      booking_kind: "instant" | "offer"
      booking_status:
        | "requested"
        | "confirmed"
        | "checked_in"
        | "completed"
        | "rejected"
        | "expired"
        | "cancelled"
        | "no_show"
      spot_status: "draft" | "active" | "paused" | "suspended"
      vehicle_type: "two_wheeler" | "car" | "suv"
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
    Enums: {
      booking_kind: ["instant", "offer"],
      booking_status: [
        "requested",
        "confirmed",
        "checked_in",
        "completed",
        "rejected",
        "expired",
        "cancelled",
        "no_show",
      ],
      spot_status: ["draft", "active", "paused", "suspended"],
      vehicle_type: ["two_wheeler", "car", "suv"],
    },
  },
} as const
