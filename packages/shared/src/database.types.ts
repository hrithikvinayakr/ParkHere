// Supabase database types.
// Hand-written to match supabase/migrations until the local stack is running;
// regenerate from the real schema with `pnpm db:types` (this file is overwritten).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type VehicleType = 'two_wheeler' | 'car' | 'suv';

type BookingRow = {
  id: string;
  spot_id: string;
  driver_id: string;
  vehicle_id: string;
  kind: 'instant' | 'offer';
  status:
    | 'requested'
    | 'confirmed'
    | 'checked_in'
    | 'completed'
    | 'rejected'
    | 'expired'
    | 'cancelled'
    | 'no_show';
  during: string;
  hourly_rate_paise: number;
  total_paise: number;
  overstay_paise: number;
  checkin_code: string;
  expires_at: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
};

type ReviewRow = {
  id: string;
  booking_id: string;
  author_id: string;
  subject_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

type SpotInsert = {
  id?: string;
  host_id: string;
  title: string;
  description?: string | null;
  area_label?: string | null;
  vehicle_types?: VehicleType[];
  is_covered?: boolean;
  has_cctv?: boolean;
  has_ev_charging?: boolean;
  has_security_guard?: boolean;
  max_height_cm?: number | null;
  hourly_rate_paise: number;
  instant_book?: boolean;
  timezone?: string;
  status?: 'draft' | 'active' | 'paused' | 'suspended';
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: { full_name?: string | null; avatar_url?: string | null };
        Relationships: [];
      };
      vehicles: {
        Row: {
          id: string;
          owner_id: string;
          plate_number: string;
          type: VehicleType;
          make_model: string | null;
          created_at: string;
        };
        Insert: {
          owner_id: string;
          plate_number: string;
          type: VehicleType;
          make_model?: string | null;
        };
        Update: { plate_number?: string; type?: VehicleType; make_model?: string | null };
        Relationships: [];
      };
      spots: {
        Row: Required<Omit<SpotInsert, 'description' | 'area_label' | 'max_height_cm'>> & {
          description: string | null;
          area_label: string | null;
          max_height_cm: number | null;
          public_location: unknown;
          rating_avg: number | null;
          rating_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: SpotInsert;
        Update: Partial<Omit<SpotInsert, 'id' | 'host_id'>>;
        Relationships: [];
      };
      spot_access: {
        Row: {
          spot_id: string;
          location: unknown;
          address: string;
          access_instructions: string | null;
          updated_at: string;
        };
        Insert: {
          spot_id: string;
          location: unknown;
          address: string;
          access_instructions?: string | null;
        };
        Update: { location?: unknown; address?: string; access_instructions?: string | null };
        Relationships: [];
      };
      spot_photos: {
        Row: {
          id: string;
          spot_id: string;
          storage_path: string;
          sort_order: number;
          created_at: string;
        };
        Insert: { spot_id: string; storage_path: string; sort_order?: number };
        Update: never;
        Relationships: [];
      };
      availability_rules: {
        Row: {
          id: string;
          spot_id: string;
          weekday: number;
          start_time: string;
          end_time: string;
        };
        Insert: { spot_id: string; weekday: number; start_time: string; end_time: string };
        Update: { weekday?: number; start_time?: string; end_time?: string };
        Relationships: [];
      };
      bookings: {
        Row: BookingRow;
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'bookings_spot_id_fkey';
            columns: ['spot_id'];
            isOneToOne: false;
            referencedRelation: 'spots';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_vehicle_id_fkey';
            columns: ['vehicle_id'];
            isOneToOne: false;
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
        ];
      };
      reviews: {
        Row: ReviewRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      nearby_spots: {
        Args: {
          p_lat: number;
          p_lng: number;
          p_radius_m?: number;
          p_starts_at?: string;
          p_ends_at?: string;
          p_vehicle_type?: VehicleType;
          p_limit?: number;
        };
        Returns: {
          id: string;
          title: string;
          area_label: string | null;
          hourly_rate_paise: number;
          instant_book: boolean;
          vehicle_types: VehicleType[];
          is_covered: boolean;
          has_cctv: boolean;
          has_ev_charging: boolean;
          has_security_guard: boolean;
          rating_avg: number | null;
          rating_count: number;
          lat: number;
          lng: number;
          distance_m: number;
        }[];
      };
      request_booking: {
        Args: {
          p_spot_id: string;
          p_vehicle_id: string;
          p_starts_at: string;
          p_ends_at: string;
          p_offered_rate_paise?: number;
        };
        Returns: BookingRow;
      };
      respond_to_booking: { Args: { p_booking_id: string; p_accept: boolean }; Returns: BookingRow };
      cancel_booking: { Args: { p_booking_id: string; p_reason?: string }; Returns: BookingRow };
      check_in: { Args: { p_booking_id: string }; Returns: BookingRow };
      check_out: { Args: { p_booking_id: string }; Returns: BookingRow };
      submit_review: {
        Args: { p_booking_id: string; p_rating: number; p_comment?: string };
        Returns: ReviewRow;
      };
      is_spot_host: { Args: { p_spot_id: string }; Returns: boolean };
    };
    Enums: {
      booking_kind: BookingRow['kind'];
      booking_status: BookingRow['status'];
      spot_status: NonNullable<SpotInsert['status']>;
      vehicle_type: VehicleType;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database['public'];

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update'];
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T];
