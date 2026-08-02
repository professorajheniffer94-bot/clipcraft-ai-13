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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          key_prefix: string
          label: string
          last_used_at: string | null
          revoked_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          key_prefix: string
          label: string
          last_used_at?: string | null
          revoked_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      brand_kits: {
        Row: {
          created_at: string
          font_family: string | null
          id: string
          intro_url: string | null
          logo_url: string | null
          name: string
          outro_url: string | null
          primary_color: string | null
          secondary_color: string | null
          updated_at: string
          user_id: string
          watermark_url: string | null
        }
        Insert: {
          created_at?: string
          font_family?: string | null
          id?: string
          intro_url?: string | null
          logo_url?: string | null
          name?: string
          outro_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
          user_id: string
          watermark_url?: string | null
        }
        Update: {
          created_at?: string
          font_family?: string | null
          id?: string
          intro_url?: string | null
          logo_url?: string | null
          name?: string
          outro_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
          user_id?: string
          watermark_url?: string | null
        }
        Relationships: []
      }
      clips: {
        Row: {
          aspect_ratio: string
          category: string | null
          created_at: string
          curiosity_score: number | null
          duration_seconds: number | null
          editor_state: Json
          emotion_score: number | null
          end_seconds: number
          engagement_score: number | null
          hook_text: string | null
          id: string
          predicted_watch_time: number | null
          preview_path: string | null
          retention_score: number | null
          sentiment: string | null
          share_probability: number | null
          social_copy: Json
          start_seconds: number
          subtitle_style: Json
          thumbnail_url: string | null
          title: string | null
          transcript_excerpt: string | null
          updated_at: string
          user_id: string
          video_id: string
          virality_score: number | null
        }
        Insert: {
          aspect_ratio?: string
          category?: string | null
          created_at?: string
          curiosity_score?: number | null
          duration_seconds?: number | null
          editor_state?: Json
          emotion_score?: number | null
          end_seconds?: number
          engagement_score?: number | null
          hook_text?: string | null
          id?: string
          predicted_watch_time?: number | null
          preview_path?: string | null
          retention_score?: number | null
          sentiment?: string | null
          share_probability?: number | null
          social_copy?: Json
          start_seconds?: number
          subtitle_style?: Json
          thumbnail_url?: string | null
          title?: string | null
          transcript_excerpt?: string | null
          updated_at?: string
          user_id: string
          video_id: string
          virality_score?: number | null
        }
        Update: {
          aspect_ratio?: string
          category?: string | null
          created_at?: string
          curiosity_score?: number | null
          duration_seconds?: number | null
          editor_state?: Json
          emotion_score?: number | null
          end_seconds?: number
          engagement_score?: number | null
          hook_text?: string | null
          id?: string
          predicted_watch_time?: number | null
          preview_path?: string | null
          retention_score?: number | null
          sentiment?: string | null
          share_probability?: number | null
          social_copy?: Json
          start_seconds?: number
          subtitle_style?: Json
          thumbnail_url?: string | null
          title?: string | null
          transcript_excerpt?: string | null
          updated_at?: string
          user_id?: string
          video_id?: string
          virality_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clips_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      exports: {
        Row: {
          clip_id: string
          created_at: string
          error: string | null
          file_path: string | null
          format: string
          fps: number
          height: number
          id: string
          quality: string
          size_bytes: number | null
          status: Database["public"]["Enums"]["export_status"]
          updated_at: string
          user_id: string
          width: number
        }
        Insert: {
          clip_id: string
          created_at?: string
          error?: string | null
          file_path?: string | null
          format?: string
          fps?: number
          height?: number
          id?: string
          quality?: string
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["export_status"]
          updated_at?: string
          user_id: string
          width?: number
        }
        Update: {
          clip_id?: string
          created_at?: string
          error?: string | null
          file_path?: string | null
          format?: string
          fps?: number
          height?: number
          id?: string
          quality?: string
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["export_status"]
          updated_at?: string
          user_id?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "exports_clip_id_fkey"
            columns: ["clip_id"]
            isOneToOne: false
            referencedRelation: "clips"
            referencedColumns: ["id"]
          },
        ]
      }
      processing_jobs: {
        Row: {
          attempts: number
          clip_id: string | null
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          payload: Json
          progress: number
          provider: string | null
          result: Json | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          type: Database["public"]["Enums"]["job_type"]
          updated_at: string
          user_id: string
          video_id: string | null
        }
        Insert: {
          attempts?: number
          clip_id?: string | null
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          payload?: Json
          progress?: number
          provider?: string | null
          result?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          type: Database["public"]["Enums"]["job_type"]
          updated_at?: string
          user_id: string
          video_id?: string | null
        }
        Update: {
          attempts?: number
          clip_id?: string | null
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          payload?: Json
          progress?: number
          provider?: string | null
          result?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          type?: Database["public"]["Enums"]["job_type"]
          updated_at?: string
          user_id?: string
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processing_jobs_clip_id_fkey"
            columns: ["clip_id"]
            isOneToOne: false
            referencedRelation: "clips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processing_jobs_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          credits_remaining: number
          default_clip_length: number
          default_export_quality: string
          email: string | null
          full_name: string | null
          id: string
          language: string
          onboarded: boolean
          plan: Database["public"]["Enums"]["plan_tier"]
          storage_limit_bytes: number
          storage_used_bytes: number
          subtitle_preferences: Json
          theme: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          credits_remaining?: number
          default_clip_length?: number
          default_export_quality?: string
          email?: string | null
          full_name?: string | null
          id: string
          language?: string
          onboarded?: boolean
          plan?: Database["public"]["Enums"]["plan_tier"]
          storage_limit_bytes?: number
          storage_used_bytes?: number
          subtitle_preferences?: Json
          theme?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          credits_remaining?: number
          default_clip_length?: number
          default_export_quality?: string
          email?: string | null
          full_name?: string | null
          id?: string
          language?: string
          onboarded?: boolean
          plan?: Database["public"]["Enums"]["plan_tier"]
          storage_limit_bytes?: number
          storage_used_bytes?: number
          subtitle_preferences?: Json
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          external_customer_id: string | null
          external_subscription_id: string | null
          id: string
          plan: Database["public"]["Enums"]["plan_tier"]
          provider: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          external_customer_id?: string | null
          external_subscription_id?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          provider?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          external_customer_id?: string | null
          external_subscription_id?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          provider?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transcriptions: {
        Row: {
          confidence: number | null
          created_at: string
          id: string
          language: string | null
          provider: string
          segments: Json
          speakers: Json
          text: string | null
          updated_at: string
          user_id: string
          video_id: string
          words: Json
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          id?: string
          language?: string | null
          provider: string
          segments?: Json
          speakers?: Json
          text?: string | null
          updated_at?: string
          user_id: string
          video_id: string
          words?: Json
        }
        Update: {
          confidence?: number | null
          created_at?: string
          id?: string
          language?: string | null
          provider?: string
          segments?: Json
          speakers?: Json
          text?: string | null
          updated_at?: string
          user_id?: string
          video_id?: string
          words?: Json
        }
        Relationships: [
          {
            foreignKeyName: "transcriptions_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      usage: {
        Row: {
          created_at: string
          credits_used: number
          event_type: string
          id: string
          metadata: Json
          user_id: string
          video_id: string | null
        }
        Insert: {
          created_at?: string
          credits_used?: number
          event_type: string
          id?: string
          metadata?: Json
          user_id: string
          video_id?: string | null
        }
        Update: {
          created_at?: string
          credits_used?: number
          event_type?: string
          id?: string
          metadata?: Json
          user_id?: string
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          channel: string | null
          created_at: string
          description: string | null
          duration_seconds: number | null
          error: string | null
          height: number | null
          id: string
          language: string | null
          metadata: Json
          project_id: string | null
          size_bytes: number | null
          source: Database["public"]["Enums"]["video_source"]
          source_url: string | null
          status: Database["public"]["Enums"]["video_status"]
          storage_path: string | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          user_id: string
          view_count: number | null
          width: number | null
        }
        Insert: {
          channel?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          error?: string | null
          height?: number | null
          id?: string
          language?: string | null
          metadata?: Json
          project_id?: string | null
          size_bytes?: number | null
          source: Database["public"]["Enums"]["video_source"]
          source_url?: string | null
          status?: Database["public"]["Enums"]["video_status"]
          storage_path?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
          view_count?: number | null
          width?: number | null
        }
        Update: {
          channel?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          error?: string | null
          height?: number | null
          id?: string
          language?: string | null
          metadata?: Json
          project_id?: string | null
          size_bytes?: number | null
          source?: Database["public"]["Enums"]["video_source"]
          source_url?: string | null
          status?: Database["public"]["Enums"]["video_status"]
          storage_path?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
          view_count?: number | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      export_status: "queued" | "rendering" | "ready" | "failed"
      job_status: "queued" | "running" | "succeeded" | "failed" | "cancelled"
      job_type:
        | "download"
        | "transcription"
        | "ai_analysis"
        | "clip_generation"
        | "subtitle_render"
        | "video_render"
        | "export"
      plan_tier: "free" | "pro" | "business" | "enterprise"
      project_status: "active" | "archived"
      video_source:
        | "upload"
        | "youtube"
        | "google_drive"
        | "dropbox"
        | "onedrive"
        | "url"
      video_status:
        | "pending"
        | "downloading"
        | "ready"
        | "processing"
        | "failed"
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
      export_status: ["queued", "rendering", "ready", "failed"],
      job_status: ["queued", "running", "succeeded", "failed", "cancelled"],
      job_type: [
        "download",
        "transcription",
        "ai_analysis",
        "clip_generation",
        "subtitle_render",
        "video_render",
        "export",
      ],
      plan_tier: ["free", "pro", "business", "enterprise"],
      project_status: ["active", "archived"],
      video_source: [
        "upload",
        "youtube",
        "google_drive",
        "dropbox",
        "onedrive",
        "url",
      ],
      video_status: ["pending", "downloading", "ready", "processing", "failed"],
    },
  },
} as const
