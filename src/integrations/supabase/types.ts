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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      facilities: {
        Row: {
          address: string | null
          city: string | null
          code: string | null
          country: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          code?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      license_keys: {
        Row: {
          activated_at: string
          activated_by: string | null
          created_at: string
          expires_at: string
          facility_id: string | null
          facility_name: string
          id: string
          license_key: string
          max_users: number
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          activated_at?: string
          activated_by?: string | null
          created_at?: string
          expires_at: string
          facility_id?: string | null
          facility_name: string
          id?: string
          license_key: string
          max_users?: number
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          activated_at?: string
          activated_by?: string | null
          created_at?: string
          expires_at?: string
          facility_id?: string | null
          facility_name?: string
          id?: string
          license_key?: string
          max_users?: number
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "license_keys_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_visits: {
        Row: {
          created_at: string
          facility_id: string | null
          id: string
          notes: string | null
          patient_id: string
          reason: string
          recorded_by: string
          visit_date: string
        }
        Insert: {
          created_at?: string
          facility_id?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          reason: string
          recorded_by: string
          visit_date?: string
        }
        Update: {
          created_at?: string
          facility_id?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          reason?: string
          recorded_by?: string
          visit_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_visits_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_visits_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address: string | null
          alcohol_use: string | null
          allergies: string | null
          blood_group: string | null
          city: string | null
          country: string | null
          country_of_birth: string | null
          created_at: string
          current_medications: string | null
          date_of_birth: string
          disability_status: string | null
          email: string | null
          employer: string | null
          ethnicity: string | null
          facility_id: string | null
          fingerprint_captured: boolean
          fingerprint_template: string | null
          fingerprints: Json | null
          first_name: string
          gender: string
          id: string
          id_document_type: string | null
          id_expiry_date: string | null
          id_issue_date: string | null
          id_number: string | null
          insurance_policy_number: string | null
          insurance_provider: string | null
          last_name: string
          marital_status: string | null
          medical_conditions: string | null
          middle_name: string | null
          nationality: string | null
          nok_address: string | null
          nok_city: string | null
          nok_country: string | null
          nok_email: string | null
          nok_name: string | null
          nok_phone: string | null
          nok_relationship: string | null
          nok_secondary_phone: string | null
          nok2: Json | null
          occupation: string | null
          past_surgeries: string | null
          patient_code: string
          photo_url: string | null
          place_of_birth: string | null
          postal_code: string | null
          primary_doctor: string | null
          primary_phone: string
          referring_institution: string | null
          region: string | null
          registered_by: string | null
          religion: string | null
          secondary_phone: string | null
          signature_url: string | null
          smoking_status: string | null
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          alcohol_use?: string | null
          allergies?: string | null
          blood_group?: string | null
          city?: string | null
          country?: string | null
          country_of_birth?: string | null
          created_at?: string
          current_medications?: string | null
          date_of_birth: string
          disability_status?: string | null
          email?: string | null
          employer?: string | null
          ethnicity?: string | null
          facility_id?: string | null
          fingerprint_captured?: boolean
          fingerprint_template?: string | null
          fingerprints?: Json | null
          first_name: string
          gender: string
          id?: string
          id_document_type?: string | null
          id_expiry_date?: string | null
          id_issue_date?: string | null
          id_number?: string | null
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          last_name: string
          marital_status?: string | null
          medical_conditions?: string | null
          middle_name?: string | null
          nationality?: string | null
          nok_address?: string | null
          nok_city?: string | null
          nok_country?: string | null
          nok_email?: string | null
          nok_name?: string | null
          nok_phone?: string | null
          nok_relationship?: string | null
          nok_secondary_phone?: string | null
          nok2?: Json | null
          occupation?: string | null
          past_surgeries?: string | null
          patient_code: string
          photo_url?: string | null
          place_of_birth?: string | null
          postal_code?: string | null
          primary_doctor?: string | null
          primary_phone: string
          referring_institution?: string | null
          region?: string | null
          registered_by?: string | null
          religion?: string | null
          secondary_phone?: string | null
          signature_url?: string | null
          smoking_status?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          alcohol_use?: string | null
          allergies?: string | null
          blood_group?: string | null
          city?: string | null
          country?: string | null
          country_of_birth?: string | null
          created_at?: string
          current_medications?: string | null
          date_of_birth?: string
          disability_status?: string | null
          email?: string | null
          employer?: string | null
          ethnicity?: string | null
          facility_id?: string | null
          fingerprint_captured?: boolean
          fingerprint_template?: string | null
          fingerprints?: Json | null
          first_name?: string
          gender?: string
          id?: string
          id_document_type?: string | null
          id_expiry_date?: string | null
          id_issue_date?: string | null
          id_number?: string | null
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          last_name?: string
          marital_status?: string | null
          medical_conditions?: string | null
          middle_name?: string | null
          nationality?: string | null
          nok_address?: string | null
          nok_city?: string | null
          nok_country?: string | null
          nok_email?: string | null
          nok_name?: string | null
          nok_phone?: string | null
          nok_relationship?: string | null
          nok_secondary_phone?: string | null
          nok2?: Json | null
          occupation?: string | null
          past_surgeries?: string | null
          patient_code?: string
          photo_url?: string | null
          place_of_birth?: string | null
          postal_code?: string | null
          primary_doctor?: string | null
          primary_phone?: string
          referring_institution?: string | null
          region?: string | null
          registered_by?: string | null
          religion?: string | null
          secondary_phone?: string | null
          signature_url?: string | null
          smoking_status?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          facility_id: string | null
          full_name: string
          id: string
          last_login: string | null
          phone: string | null
          photo_url: string | null
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          facility_id?: string | null
          full_name?: string
          id: string
          last_login?: string | null
          phone?: string | null
          photo_url?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          facility_id?: string | null
          full_name?: string
          id?: string
          last_login?: string | null
          phone?: string | null
          photo_url?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_patient_code: { Args: never; Returns: string }
      get_user_facility_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "registrar" | "supervisor" | "super_admin" | "nurse"
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
  public: {
    Enums: {
      app_role: ["admin", "registrar", "supervisor", "super_admin", "nurse"],
    },
  },
} as const
