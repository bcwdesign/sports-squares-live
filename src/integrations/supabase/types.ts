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
      game_players: {
        Row: {
          avatar_url: string | null
          display_name: string
          game_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          display_name: string
          game_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          display_name?: string
          game_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_players_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          auto_sync_enabled: boolean
          away_axis: number[]
          away_score: number
          away_team: string
          clock: string
          created_at: string
          entry_amount_label: string | null
          external_away_team_id: string | null
          external_away_team_name: string | null
          external_game_id: string | null
          external_home_team_id: string | null
          external_home_team_name: string | null
          external_provider: string | null
          game_clock: string | null
          game_date_time: string | null
          game_status: string | null
          home_axis: number[]
          home_score: number
          home_team: string
          host_id: string
          id: string
          invite_code: string
          last_score_sync_at: string | null
          last_score_sync_error: string | null
          max_squares_per_user: number
          name: string
          period: number | null
          quarter: number
          score_source: string
          share_token: string
          sport: string
          status: Database["public"]["Enums"]["game_status"]
        }
        Insert: {
          auto_sync_enabled?: boolean
          away_axis?: number[]
          away_score?: number
          away_team: string
          clock?: string
          created_at?: string
          entry_amount_label?: string | null
          external_away_team_id?: string | null
          external_away_team_name?: string | null
          external_game_id?: string | null
          external_home_team_id?: string | null
          external_home_team_name?: string | null
          external_provider?: string | null
          game_clock?: string | null
          game_date_time?: string | null
          game_status?: string | null
          home_axis?: number[]
          home_score?: number
          home_team: string
          host_id: string
          id?: string
          invite_code: string
          last_score_sync_at?: string | null
          last_score_sync_error?: string | null
          max_squares_per_user?: number
          name: string
          period?: number | null
          quarter?: number
          score_source?: string
          share_token?: string
          sport?: string
          status?: Database["public"]["Enums"]["game_status"]
        }
        Update: {
          auto_sync_enabled?: boolean
          away_axis?: number[]
          away_score?: number
          away_team?: string
          clock?: string
          created_at?: string
          entry_amount_label?: string | null
          external_away_team_id?: string | null
          external_away_team_name?: string | null
          external_game_id?: string | null
          external_home_team_id?: string | null
          external_home_team_name?: string | null
          external_provider?: string | null
          game_clock?: string | null
          game_date_time?: string | null
          game_status?: string | null
          home_axis?: number[]
          home_score?: number
          home_team?: string
          host_id?: string
          id?: string
          invite_code?: string
          last_score_sync_at?: string | null
          last_score_sync_error?: string | null
          max_squares_per_user?: number
          name?: string
          period?: number | null
          quarter?: number
          score_source?: string
          share_token?: string
          sport?: string
          status?: Database["public"]["Enums"]["game_status"]
        }
        Relationships: []
      }
      messages: {
        Row: {
          created_at: string
          display_name: string
          game_id: string
          id: string
          text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          game_id: string
          id?: string
          text: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          game_id?: string
          id?: string
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          is_guest: boolean
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
          is_guest?: boolean
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_guest?: boolean
        }
        Relationships: []
      }
      score_drafts: {
        Row: {
          away: string
          clock: string
          game_id: string
          home: string
          id: string
          quarter: number
          updated_at: string
          user_id: string
        }
        Insert: {
          away?: string
          clock?: string
          game_id: string
          home?: string
          id?: string
          quarter: number
          updated_at?: string
          user_id: string
        }
        Update: {
          away?: string
          clock?: string
          game_id?: string
          home?: string
          id?: string
          quarter?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "score_drafts_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      score_events: {
        Row: {
          away_score: number | null
          created_at: string
          external_game_id: string | null
          game_clock: string | null
          game_id: string
          game_status: string | null
          home_score: number | null
          id: string
          period: number | null
          provider: string
          raw_payload: Json | null
          score_source: string
        }
        Insert: {
          away_score?: number | null
          created_at?: string
          external_game_id?: string | null
          game_clock?: string | null
          game_id: string
          game_status?: string | null
          home_score?: number | null
          id?: string
          period?: number | null
          provider: string
          raw_payload?: Json | null
          score_source?: string
        }
        Update: {
          away_score?: number | null
          created_at?: string
          external_game_id?: string | null
          game_clock?: string | null
          game_id?: string
          game_status?: string | null
          home_score?: number | null
          id?: string
          period?: number | null
          provider?: string
          raw_payload?: Json | null
          score_source?: string
        }
        Relationships: [
          {
            foreignKeyName: "score_events_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      squares: {
        Row: {
          col: number
          created_at: string
          game_id: string
          id: string
          owner_id: string | null
          owner_name: string | null
          row: number
        }
        Insert: {
          col: number
          created_at?: string
          game_id: string
          id?: string
          owner_id?: string | null
          owner_name?: string | null
          row: number
        }
        Update: {
          col?: number
          created_at?: string
          game_id?: string
          id?: string
          owner_id?: string | null
          owner_name?: string | null
          row?: number
        }
        Relationships: [
          {
            foreignKeyName: "squares_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
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
      venues: {
        Row: {
          active: boolean
          created_at: string
          founder_edge: boolean
          founder_edge_position: number | null
          id: string
          monthly_price: number
          owner_user_id: string
          plan_name: string
          venue_name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          founder_edge?: boolean
          founder_edge_position?: number | null
          id?: string
          monthly_price?: number
          owner_user_id: string
          plan_name?: string
          venue_name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          founder_edge?: boolean
          founder_edge_position?: number | null
          id?: string
          monthly_price?: number
          owner_user_id?: string
          plan_name?: string
          venue_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_recent_winners: { Args: never; Returns: Json }
      admin_stats: { Args: never; Returns: Json }
      can_claim_square: {
        Args: { _game_id: string; _user_id: string }
        Returns: boolean
      }
      get_overlay_by_token: { Args: { _token: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_game_host: {
        Args: { _game_id: string; _user_id: string }
        Returns: boolean
      }
      is_game_member: {
        Args: { _game_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "user"
      game_status: "lobby" | "locked" | "live" | "completed"
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
      app_role: ["super_admin", "admin", "user"],
      game_status: ["lobby", "locked", "live", "completed"],
    },
  },
} as const
