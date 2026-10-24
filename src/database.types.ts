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
      companion_preferences: {
        Row: { user_id: string; enabled: boolean; allow_activity_notes: boolean; time_zone: string }
        Insert: { user_id: string; enabled?: boolean; allow_activity_notes?: boolean; time_zone?: string }
        Update: { enabled?: boolean; allow_activity_notes?: boolean; time_zone?: string }
        Relationships: []
      }
      companion_feedback: {
        Row: {
          user_id: string; post_id: string; output_generated_at: string;
          content_type: "weekly_thought"; rating: "yes" | "not_really";
          comment: string | null; updated_at: string;
        }
        Insert: never
        Update: never
        Relationships: []
      }
      companion_posts: {
        Row: {
          id: string; user_id: string; week_start: string; week_end: string; time_zone: string;
          status: string; thought: string | null; sources: Json; includes_activity_notes: boolean;
          user_reflection: string | null; created_at: string; generated_at: string | null;
        }
        Insert: never
        Update: { user_reflection?: string | null }
        Relationships: []
      }
      activities: {
        Row: {
          created_at: string | null
          date: string
          distance_km: number | null
          duration_min: number | null
          effort: number | null
          external_id: string | null
          external_source: string | null
          feeling: number | null
          feeling_after: string | null
          feeling_during: string | null
          id: string
          imported_at: string | null
          last_synced_at: string | null
          note_image_url: string | null
          note_thumb_image_url: string | null
          note_updated_at: string | null
          notes: string | null
          raw_sport_type: string | null
          raw_type: string | null
          source: string
          started_at: string | null
          title: string | null
          type: string
          user_enrichment_status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          distance_km?: number | null
          duration_min?: number | null
          effort?: number | null
          external_id?: string | null
          external_source?: string | null
          feeling?: number | null
          feeling_after?: string | null
          feeling_during?: string | null
          id?: string
          imported_at?: string | null
          last_synced_at?: string | null
          note_image_url?: string | null
          note_thumb_image_url?: string | null
          note_updated_at?: string | null
          notes?: string | null
          raw_sport_type?: string | null
          raw_type?: string | null
          source?: string
          started_at?: string | null
          title?: string | null
          type: string
          user_enrichment_status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          distance_km?: number | null
          duration_min?: number | null
          effort?: number | null
          external_id?: string | null
          external_source?: string | null
          feeling?: number | null
          feeling_after?: string | null
          feeling_during?: string | null
          id?: string
          imported_at?: string | null
          last_synced_at?: string | null
          note_image_url?: string | null
          note_thumb_image_url?: string | null
          note_updated_at?: string | null
          notes?: string | null
          raw_sport_type?: string | null
          raw_type?: string | null
          source?: string
          started_at?: string | null
          title?: string | null
          type?: string
          user_enrichment_status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      activity_equipment: {
        Row: {
          activity_id: string
          equipment_id: string
        }
        Insert: {
          activity_id: string
          equipment_id: string
        }
        Update: {
          activity_id?: string
          equipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_equipment_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_equipment_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_photos: {
        Row: {
          activity_id: string
          created_at: string
          id: string
          image_path: string
          lat: number | null
          lng: number | null
          sort_order: number
          thumb_path: string
          user_id: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          id?: string
          image_path: string
          lat?: number | null
          lng?: number | null
          sort_order?: number
          thumb_path: string
          user_id: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          id?: string
          image_path?: string
          lat?: number | null
          lng?: number | null
          sort_order?: number
          thumb_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_photos_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_preferences: {
        Row: {
          activity_type: string
          created_at: string
          default_metric: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          default_metric: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          default_metric?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      activity_share_photos: {
        Row: {
          activity_share_id: string
          created_at: string
          id: string
          image_path: string
          sort_order: number
          thumb_path: string | null
        }
        Insert: {
          activity_share_id: string
          created_at?: string
          id?: string
          image_path: string
          sort_order?: number
          thumb_path?: string | null
        }
        Update: {
          activity_share_id?: string
          created_at?: string
          id?: string
          image_path?: string
          sort_order?: number
          thumb_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_share_photos_activity_share_id_fkey"
            columns: ["activity_share_id"]
            isOneToOne: false
            referencedRelation: "activity_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_share_reactions: {
        Row: {
          activity_share_id: string
          created_at: string
          id: string
          reaction_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_share_id: string
          created_at?: string
          id?: string
          reaction_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_share_id?: string
          created_at?: string
          id?: string
          reaction_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_share_reactions_activity_share_id_fkey"
            columns: ["activity_share_id"]
            isOneToOne: false
            referencedRelation: "activity_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_share_recipients: {
        Row: {
          activity_share_id: string
          created_at: string
          hidden_at: string | null
          id: string
          recipient_user_id: string
          seen_at: string | null
          shared_at: string
        }
        Insert: {
          activity_share_id: string
          created_at?: string
          hidden_at?: string | null
          id?: string
          recipient_user_id: string
          seen_at?: string | null
          shared_at: string
        }
        Update: {
          activity_share_id?: string
          created_at?: string
          hidden_at?: string | null
          id?: string
          recipient_user_id?: string
          seen_at?: string | null
          shared_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_share_recipients_activity_share_id_fkey"
            columns: ["activity_share_id"]
            isOneToOne: false
            referencedRelation: "activity_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_share_tags: {
        Row: {
          activity_share_id: string
          created_at: string
          id: string
          metadata: Json
          source: string | null
          type: string
          value: string
        }
        Insert: {
          activity_share_id: string
          created_at?: string
          id?: string
          metadata?: Json
          source?: string | null
          type: string
          value: string
        }
        Update: {
          activity_share_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          source?: string | null
          type?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_share_tags_activity_share_id_fkey"
            columns: ["activity_share_id"]
            isOneToOne: false
            referencedRelation: "activity_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_shares: {
        Row: {
          activity_id: string
          activity_type: string
          author_user_id: string
          deleted_at: string | null
          distance_km: number | null
          duration_min: number | null
          expires_at: string
          id: string
          occurred_on: string
          shared_at: string
          shared_photo_url: string | null
          shared_thumb_photo_url: string | null
          summary_text: string | null
          title: string | null
          visibility: string
        }
        Insert: {
          activity_id: string
          activity_type: string
          author_user_id: string
          deleted_at?: string | null
          distance_km?: number | null
          duration_min?: number | null
          expires_at?: string
          id?: string
          occurred_on: string
          shared_at?: string
          shared_photo_url?: string | null
          shared_thumb_photo_url?: string | null
          summary_text?: string | null
          title?: string | null
          visibility?: string
        }
        Update: {
          activity_id?: string
          activity_type?: string
          author_user_id?: string
          deleted_at?: string | null
          distance_km?: number | null
          duration_min?: number | null
          expires_at?: string
          id?: string
          occurred_on?: string
          shared_at?: string
          shared_photo_url?: string | null
          shared_thumb_photo_url?: string | null
          summary_text?: string | null
          title?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_shares_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: true
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_tags: {
        Row: {
          activity_id: string
          created_at: string | null
          id: string
          metadata: Json
          source: string | null
          type: string
          value: string
        }
        Insert: {
          activity_id: string
          created_at?: string | null
          id?: string
          metadata?: Json
          source?: string | null
          type: string
          value: string
        }
        Update: {
          activity_id?: string
          created_at?: string | null
          id?: string
          metadata?: Json
          source?: string | null
          type?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_tags_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_invite_links: {
        Row: {
          accepted_at: string | null
          accepted_by_user_id: string | null
          created_at: string
          expires_at: string
          id: string
          inviter_user_id: string
          revoked_at: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          inviter_user_id: string
          revoked_at?: string | null
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          inviter_user_id?: string
          revoked_at?: string | null
          token?: string
        }
        Relationships: []
      }
      equipment: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      goal_preferences: {
        Row: {
          goal_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          goal_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          goal_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goal_preferences_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          activity_type: string
          effective_from: string
          id: string
          metric: string
          name: string | null
          period: string
          target: number
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          activity_type: string
          effective_from: string
          id?: string
          metric?: string
          name?: string | null
          period: string
          target?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          activity_type?: string
          effective_from?: string
          id?: string
          metric?: string
          name?: string | null
          period?: string
          target?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          created_at: string
          entry_type: string
          id: string
          metadata: Json | null
          related_activity_id: string | null
          related_tiny_tweak_id: string | null
          text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_type: string
          id?: string
          metadata?: Json | null
          related_activity_id?: string | null
          related_tiny_tweak_id?: string | null
          text: string
          user_id: string
        }
        Update: {
          created_at?: string
          entry_type?: string
          id?: string
          metadata?: Json | null
          related_activity_id?: string | null
          related_tiny_tweak_id?: string | null
          text?: string
          user_id?: string
        }
        Relationships: []
      }
      location_cache: {
        Row: {
          created_at: string | null
          key: string
          lat: number | null
          lng: number | null
          name: string | null
          type: string | null
        }
        Insert: {
          created_at?: string | null
          key: string
          lat?: number | null
          lng?: number | null
          name?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string | null
          key?: string
          lat?: number | null
          lng?: number | null
          name?: string | null
          type?: string | null
        }
        Relationships: []
      }
      micro_adjustment_suggestion_events: {
        Row: {
          event_at: string
          event_type: string
          id: string
          metadata: Json
          session_id: string | null
          suggestion_id: string
          surface: string | null
          user_id: string
        }
        Insert: {
          event_at?: string
          event_type: string
          id?: string
          metadata?: Json
          session_id?: string | null
          suggestion_id: string
          surface?: string | null
          user_id: string
        }
        Update: {
          event_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          session_id?: string | null
          suggestion_id?: string
          surface?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "micro_adjustment_suggestion_events_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "micro_adjustment_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      micro_adjustment_suggestions: {
        Row: {
          category: string
          created_at: string
          id: string
          is_active: boolean
          short_text: string | null
          text: string
          updated_at: string
          weight: number
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          is_active?: boolean
          short_text?: string | null
          text: string
          updated_at?: string
          weight?: number
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          short_text?: string | null
          text?: string
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      micro_adjustments: {
        Row: {
          category: string | null
          created_at: string
          end_flow_state: string
          ended_at: string | null
          id: string
          source: string
          started_at: string
          status: string
          suggestion_id: string | null
          text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          end_flow_state?: string
          ended_at?: string | null
          id?: string
          source?: string
          started_at?: string
          status?: string
          suggestion_id?: string | null
          text: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          end_flow_state?: string
          ended_at?: string | null
          id?: string
          source?: string
          started_at?: string
          status?: string
          suggestion_id?: string | null
          text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "micro_adjustments_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "micro_adjustment_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      preset_equipment: {
        Row: {
          equipment_id: string
          preset_id: string
        }
        Insert: {
          equipment_id: string
          preset_id: string
        }
        Update: {
          equipment_id?: string
          preset_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "preset_equipment_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preset_equipment_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "presets"
            referencedColumns: ["id"]
          },
        ]
      }
      presets: {
        Row: {
          created_at: string | null
          distance_km: number | null
          duration_min: number | null
          effort: number | null
          id: string
          last_used_at: string | null
          name: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          distance_km?: number | null
          duration_min?: number | null
          effort?: number | null
          id?: string
          last_used_at?: string | null
          name: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          distance_km?: number | null
          duration_min?: number | null
          effort?: number | null
          id?: string
          last_used_at?: string | null
          name?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_activity_types: {
        Row: {
          activity_type: string
          created_at: string
          is_enabled: boolean
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          is_enabled?: boolean
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          is_enabled?: boolean
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_connections: {
        Row: {
          addressee_user_id: string
          created_at: string
          id: string
          requester_user_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          addressee_user_id: string
          created_at?: string
          id?: string
          requester_user_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          addressee_user_id?: string
          created_at?: string
          id?: string
          requester_user_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: []
      }
      user_consents: {
        Row: {
          accepted_privacy_policy: boolean
          accepted_terms: boolean
          created_at: string
          id: string
          newsletter_opt_in: boolean | null
          privacy_policy_version: string
          terms_version: string
          user_id: string
        }
        Insert: {
          accepted_privacy_policy?: boolean
          accepted_terms?: boolean
          created_at?: string
          id?: string
          newsletter_opt_in?: boolean | null
          privacy_policy_version?: string
          terms_version?: string
          user_id: string
        }
        Update: {
          accepted_privacy_policy?: boolean
          accepted_terms?: boolean
          created_at?: string
          id?: string
          newsletter_opt_in?: boolean | null
          privacy_policy_version?: string
          terms_version?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          circle_last_seen_at: string | null
          created_at: string | null
          login_email: string | null
          social_display_name: string | null
          social_profile_image_path: string | null
          social_profile_thumb_path: string | null
          unit_system: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          circle_last_seen_at?: string | null
          created_at?: string | null
          login_email?: string | null
          social_display_name?: string | null
          social_profile_image_path?: string | null
          social_profile_thumb_path?: string | null
          unit_system?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          circle_last_seen_at?: string | null
          created_at?: string | null
          login_email?: string | null
          social_display_name?: string | null
          social_profile_image_path?: string | null
          social_profile_thumb_path?: string | null
          unit_system?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_polar_connections: {
        Row: {
          access_token: string
          created_at: string
          last_synced_at: string | null
          refresh_token: string
          token_expires_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          last_synced_at?: string | null
          refresh_token: string
          token_expires_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          last_synced_at?: string | null
          refresh_token?: string
          token_expires_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_strava_connections: {
        Row: {
          access_token: string
          created_at: string | null
          last_synced_at: string | null
          refresh_token: string
          strava_athlete_id: number
          token_expires_at: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          last_synced_at?: string | null
          refresh_token: string
          strava_athlete_id: number
          token_expires_at: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          last_synced_at?: string | null
          refresh_token?: string
          strava_athlete_id?: number
          token_expires_at?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      memory_archive: { Args: Record<string, never>; Returns: Json }
      memory_archive_v2: { Args: Record<string, never>; Returns: Json }
      memory_page_v2: { Args: { p_start: string; p_end: string; p_before?: Json; p_selected?: boolean }; Returns: Json }
      memory_neighbors_v2: { Args: { p_id: string; p_start: string; p_end: string; p_selected?: boolean; p_include?: string }; Returns: Json }
      memory_page: { Args: { p_start: string; p_end: string; p_before?: Json }; Returns: Json }
      memory_neighbors: { Args: { p_id: string; p_start: string; p_end: string }; Returns: Json }
      memory_feature: { Args: { p_timezone: string }; Returns: Json }
      memory_feature_action: { Args: { p_day: string; p_id: string; p_hide: boolean }; Returns: undefined }
      accept_circle_invite: {
        Args: { p_token: string; p_user_id: string }
        Returns: string
      }
      admin_activities_by_type: {
        Args: never
        Returns: {
          total: number
          type: string
        }[]
      }
      admin_activities_per_week: {
        Args: never
        Returns: {
          activities: number
          week: string
        }[]
      }
      admin_activities_this_week: { Args: never; Returns: number }
      admin_assert_owner: { Args: never; Returns: undefined }
      admin_new_users_this_week: { Args: never; Returns: number }
      admin_top_photo_users: {
        Args: never
        Returns: {
          email: string
          photos: number
        }[]
      }
      admin_total_activities: { Args: never; Returns: number }
      admin_total_users: { Args: never; Returns: number }
      admin_users_over_50_photos: {
        Args: never
        Returns: {
          email: string
          photos: number
        }[]
      }
      admin_users_per_week: {
        Args: never
        Returns: {
          new_users: number
          week: string
        }[]
      }
      can_access_circle_share: {
        Args: { p_activity_share_id: string; p_user_id: string }
        Returns: boolean
      }
      cleanup_circle_invite_links: {
        Args: { p_expired_retention?: string; p_used_retention?: string }
        Returns: number
      }
      create_circle_invite_link: {
        Args: { p_user_id: string }
        Returns: string
      }
      ensure_user_activity_types_seeded: { Args: never; Returns: undefined }
      get_circle_connected_friends: {
        Args: { p_user_id: string }
        Returns: {
          friend_user_id: string
          label: string
          profile_image_path: string
          profile_thumb_path: string
        }[]
      }
      get_circle_feed: {
        Args: {
          p_before_occurred_on?: string
          p_before_recipient_id?: string
          p_before_shared_at?: string
          p_limit?: number
          p_user_id: string
        }
        Returns: {
          activity_share_id: string
          activity_type: string
          author_display_name: string
          author_profile_image_path: string
          author_profile_thumb_path: string
          author_user_id: string
          current_user_reaction: string
          distance_km: number
          duration_min: number
          has_new_reactions: boolean
          occurred_on: string
          photos: Json
          reaction_groups: Json
          recipient_id: string
          seen_at: string
          shared_at: string
          shared_photo_url: string
          shared_thumb_photo_url: string
          tags: Json
          title: string
        }[]
      }
      get_circle_invite_preview: {
        Args: { p_token: string }
        Returns: {
          account_email: string
          friendly_name: string
          invite_status: string
          inviter_user_id: string
          profile_image_path: string
          profile_thumb_path: string
        }[]
      }
      get_goal_history_dots: {
        Args: { max_periods?: number; user_id: string }
        Returns: {
          dot_state: number
          goal_id: string
          period_end: string
          period_start: string
          period_value: number
        }[]
      }
      get_journal_feed_page: {
        Args: { p_limit: number; p_offset?: number }
        Returns: {
          created_at: string
          date: string
          day: string
          distance_km: number
          duration_min: number
          effort: number
          entry_kind: string
          entry_text: string
          entry_type: string
          equipment: Json
          feeling: number
          id: string
          journal_created_at: string
          metadata: Json
          note_image_url: string
          note_thumb_image_url: string
          note_updated_at: string
          notes: string
          title: string
          type: string
          user_id: string
          within_day_ts: string
        }[]
      }
      get_journal_feed_page_v2: {
        Args: { p_limit: number; p_offset: number }
        Returns: {
          created_at: string
          date: string
          day: string
          distance_km: number
          duration_min: number
          effort: number
          entry_kind: string
          entry_text: string
          entry_type: string
          equipment: Json
          external_id: string
          external_source: string
          feeling: number
          feeling_after: string
          feeling_during: string
          id: string
          journal_created_at: string
          metadata: Json
          note_image_url: string
          note_thumb_image_url: string
          note_updated_at: string
          notes: string
          photos: Json
          raw_sport_type: string
          raw_type: string
          source: string
          started_at: string
          title: string
          type: string
          user_id: string
          within_day_ts: string
        }[]
      }
      get_micro_adjustment_suggestions_rotating: {
        Args: {
          exclude_selected_days?: number
          exclude_shown_days?: number
          n?: number
          user_id: string
        }
        Returns: {
          category: string
          id: string
          short_text: string
          text: string
        }[]
      }
      has_circle_access: { Args: { p_user_id: string }; Returns: boolean }
      has_companion_access: { Args: Record<string, never>; Returns: boolean }
      delete_companion_post: { Args: { p_post_id: string; p_generated_at: string | null }; Returns: undefined }
      save_companion_feedback: {
        Args: { p_post_id: string; p_output_generated_at: string; p_rating: string; p_comment?: string | null; p_save_comment?: boolean }
        Returns: Database["public"]["Tables"]["companion_feedback"]["Row"]
      }
      recent_companion_feedback: {
        Args: { p_content_type?: string }
        Returns: { comment: string }[]
      }
      has_circle_new_reactions: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      hide_circle_feed_item: {
        Args: { p_recipient_id: string; p_user_id: string }
        Returns: boolean
      }
      mark_circle_feed_item_seen: {
        Args: { p_recipient_id: string; p_user_id: string }
        Returns: boolean
      }
      mark_circle_feed_visited: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      refresh_shared_activity: {
        Args: { p_activity_id: string; p_user_id: string }
        Returns: boolean
      }
      remove_circle_activity_reaction: {
        Args: { p_activity_share_id: string; p_user_id: string }
        Returns: boolean
      }
      reorder_user_activity_types: {
        Args: { new_order: string[] }
        Returns: undefined
      }
      set_user_activity_type_enabled: {
        Args: { p_activity_type: string; p_is_enabled: boolean }
        Returns: undefined
      }
      share_activity_with_connections: {
        Args: { p_activity_id: string; p_user_id: string }
        Returns: string
      }
      stats_activity_trend_meta: {
        Args: { target_user: string; weeks_back?: number }
        Returns: {
          activity_type: string
          default_metric: string
          has_distance: boolean
          has_duration: boolean
        }[]
      }
      stats_activity_trend_series: {
        Args: {
          activity_type: string
          metric: string
          target_user: string
          weeks_back?: number
        }
        Returns: {
          value: number
          week_start: string
        }[]
      }
      stats_goal_progress: {
        Args: { user_id: string }
        Returns: {
          activity_type: string
          comparison_pct: number
          current_value: number
          goal_id: string
          metric: string
          name: string
          period: string
          progress_ratio: number
          target: number
          unit: string
        }[]
      }
      stats_trends_90_days: {
        Args: { user_id: string }
        Returns: {
          activity_type: string
          avg_feeling: number
          total_distance: number
          trend_pct: number
          weekly_avg_distance: number
        }[]
      }
      unshare_activity: {
        Args: { p_activity_id: string; p_user_id: string }
        Returns: boolean
      }
      upsert_circle_activity_reaction: {
        Args: {
          p_activity_share_id: string
          p_reaction_type: string
          p_user_id: string
        }
        Returns: string
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
