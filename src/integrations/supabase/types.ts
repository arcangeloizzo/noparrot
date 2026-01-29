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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_usage_logs: {
        Row: {
          cache_hit: boolean
          created_at: string
          error_code: string | null
          function_name: string
          id: string
          input_chars: number
          latency_ms: number
          model: string
          output_chars: number
          provider_latency_ms: number | null
          source_domain: string | null
          success: boolean
          user_hash: string | null
        }
        Insert: {
          cache_hit?: boolean
          created_at?: string
          error_code?: string | null
          function_name: string
          id?: string
          input_chars: number
          latency_ms: number
          model: string
          output_chars: number
          provider_latency_ms?: number | null
          source_domain?: string | null
          success?: boolean
          user_hash?: string | null
        }
        Update: {
          cache_hit?: boolean
          created_at?: string
          error_code?: string | null
          function_name?: string
          id?: string
          input_chars?: number
          latency_ms?: number
          model?: string
          output_chars?: number
          provider_latency_ms?: number | null
          source_domain?: string | null
          success?: boolean
          user_hash?: string | null
        }
        Relationships: []
      }
      comment_media: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          media_id: string
          order_idx: number
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          media_id: string
          order_idx?: number
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          media_id?: string
          order_idx?: number
        }
        Relationships: [
          {
            foreignKeyName: "comment_media_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_media_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_reactions: {
        Row: {
          comment_id: string
          created_at: string | null
          id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string | null
          id?: string
          reaction_type?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string | null
          id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          content: string
          created_at: string | null
          id: string
          level: number
          parent_id: string | null
          passed_gate: boolean
          post_category: string | null
          post_id: string
          user_density_before_comment: Json | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string | null
          id?: string
          level?: number
          parent_id?: string | null
          passed_gate?: boolean
          post_category?: string | null
          post_id: string
          user_density_before_comment?: Json | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string | null
          id?: string
          level?: number
          parent_id?: string | null
          passed_gate?: boolean
          post_category?: string | null
          post_id?: string
          user_density_before_comment?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      content_cache: {
        Row: {
          content_text: string
          created_at: string | null
          expires_at: string | null
          id: string
          source_type: string
          source_url: string
          title: string | null
        }
        Insert: {
          content_text: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          source_type: string
          source_url: string
          title?: string | null
        }
        Update: {
          content_text?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          source_type?: string
          source_url?: string
          title?: string | null
        }
        Relationships: []
      }
      daily_focus: {
        Row: {
          angle_tag: string | null
          category: string | null
          created_at: string | null
          deep_content: string | null
          edition_time: string | null
          event_fingerprint: string | null
          expires_at: string | null
          id: string
          image_url: string | null
          raw_title: string | null
          reactions: Json | null
          skip_reason: string | null
          sources: Json
          summary: string
          title: string
          topic_cluster: string | null
          trust_score: string | null
        }
        Insert: {
          angle_tag?: string | null
          category?: string | null
          created_at?: string | null
          deep_content?: string | null
          edition_time?: string | null
          event_fingerprint?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          raw_title?: string | null
          reactions?: Json | null
          skip_reason?: string | null
          sources: Json
          summary: string
          title: string
          topic_cluster?: string | null
          trust_score?: string | null
        }
        Update: {
          angle_tag?: string | null
          category?: string | null
          created_at?: string | null
          deep_content?: string | null
          edition_time?: string | null
          event_fingerprint?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          raw_title?: string | null
          reactions?: Json | null
          skip_reason?: string | null
          sources?: Json
          summary?: string
          title?: string
          topic_cluster?: string | null
          trust_score?: string | null
        }
        Relationships: []
      }
      export_requests: {
        Row: {
          last_export_at: string
          user_id: string
        }
        Insert: {
          last_export_at?: string
          user_id: string
        }
        Update: {
          last_export_at?: string
          user_id?: string
        }
        Relationships: []
      }
      focus_bookmarks: {
        Row: {
          created_at: string
          focus_id: string
          focus_type: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          focus_id: string
          focus_type: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          focus_id?: string
          focus_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      focus_comment_reactions: {
        Row: {
          created_at: string | null
          focus_comment_id: string
          id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          focus_comment_id: string
          id?: string
          reaction_type?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          focus_comment_id?: string
          id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "focus_comment_reactions_focus_comment_id_fkey"
            columns: ["focus_comment_id"]
            isOneToOne: false
            referencedRelation: "focus_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      focus_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string | null
          focus_id: string
          focus_type: string
          id: string
          is_editorial: boolean | null
          is_pinned: boolean | null
          is_verified: boolean | null
          level: number
          parent_id: string | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string | null
          focus_id: string
          focus_type: string
          id?: string
          is_editorial?: boolean | null
          is_pinned?: boolean | null
          is_verified?: boolean | null
          level?: number
          parent_id?: string | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string | null
          focus_id?: string
          focus_type?: string
          id?: string
          is_editorial?: boolean | null
          is_pinned?: boolean | null
          is_verified?: boolean | null
          level?: number
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "focus_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "focus_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "focus_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "focus_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      focus_reactions: {
        Row: {
          created_at: string | null
          focus_id: string
          focus_type: string
          id: string
          reaction_type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          focus_id: string
          focus_type: string
          id?: string
          reaction_type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          focus_id?: string
          focus_type?: string
          id?: string
          reaction_type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      followers: {
        Row: {
          created_at: string | null
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string | null
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string | null
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "followers_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followers_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followers_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followers_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      interest_focus: {
        Row: {
          category: string
          created_at: string | null
          deep_content: string | null
          expires_at: string | null
          id: string
          image_url: string | null
          reactions: Json | null
          sources: Json
          summary: string
          title: string
          trust_score: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          deep_content?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          reactions?: Json | null
          sources: Json
          summary: string
          title: string
          trust_score?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          deep_content?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          reactions?: Json | null
          sources?: Json
          summary?: string
          title?: string
          trust_score?: string | null
        }
        Relationships: []
      }
      media: {
        Row: {
          created_at: string
          duration_sec: number | null
          extracted_kind: string | null
          extracted_meta: Json | null
          extracted_status: string | null
          extracted_text: string | null
          height: number | null
          id: string
          mime: string
          owner_id: string
          thumbnail_url: string | null
          type: string
          url: string
          width: number | null
        }
        Insert: {
          created_at?: string
          duration_sec?: number | null
          extracted_kind?: string | null
          extracted_meta?: Json | null
          extracted_status?: string | null
          extracted_text?: string | null
          height?: number | null
          id?: string
          mime: string
          owner_id: string
          thumbnail_url?: string | null
          type: string
          url: string
          width?: number | null
        }
        Update: {
          created_at?: string
          duration_sec?: number | null
          extracted_kind?: string | null
          extracted_meta?: Json | null
          extracted_status?: string | null
          extracted_text?: string | null
          height?: number | null
          id?: string
          mime?: string
          owner_id?: string
          thumbnail_url?: string | null
          type?: string
          url?: string
          width?: number | null
        }
        Relationships: []
      }
      media_comment_reactions: {
        Row: {
          created_at: string | null
          id: string
          media_comment_id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          media_comment_id: string
          reaction_type?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          media_comment_id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_comment_reactions_media_comment_id_fkey"
            columns: ["media_comment_id"]
            isOneToOne: false
            referencedRelation: "media_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      media_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string | null
          id: string
          level: number
          media_id: string
          parent_id: string | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string | null
          id?: string
          level?: number
          media_id: string
          parent_id?: string | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string | null
          id?: string
          level?: number
          media_id?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_comments_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "media_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      media_reactions: {
        Row: {
          created_at: string | null
          id: string
          media_id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          media_id: string
          reaction_type?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          media_id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_reactions_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      message_deletions: {
        Row: {
          deleted_at: string
          message_id: string
          user_id: string
        }
        Insert: {
          deleted_at?: string
          message_id: string
          user_id: string
        }
        Update: {
          deleted_at?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_deletions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_media: {
        Row: {
          created_at: string
          id: string
          media_id: string
          message_id: string
          order_idx: number
        }
        Insert: {
          created_at?: string
          id?: string
          media_id: string
          message_id: string
          order_idx?: number
        }
        Update: {
          created_at?: string
          id?: string
          media_id?: string
          message_id?: string
          order_idx?: number
        }
        Relationships: [
          {
            foreignKeyName: "message_media_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_media_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string | null
          id: string
          message_id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message_id: string
          reaction_type?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message_id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_threads: {
        Row: {
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          link_url: string | null
          sender_id: string
          thread_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          link_url?: string | null
          sender_id: string
          thread_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          link_url?: string | null
          sender_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string
          comment_id: string | null
          created_at: string | null
          id: string
          message_id: string | null
          post_id: string | null
          read: boolean | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id: string
          comment_id?: string | null
          created_at?: string | null
          id?: string
          message_id?: string | null
          post_id?: string | null
          read?: boolean | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string
          comment_id?: string | null
          created_at?: string | null
          id?: string
          message_id?: string | null
          post_id?: string | null
          read?: boolean | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_gate_attempts: {
        Row: {
          answers: Json
          completion_time_ms: number | null
          created_at: string | null
          expires_at: string | null
          gate_type: string
          id: string
          passed: boolean
          post_id: string | null
          provider: string | null
          score: number
          source_url: string | null
          user_id: string
        }
        Insert: {
          answers: Json
          completion_time_ms?: number | null
          created_at?: string | null
          expires_at?: string | null
          gate_type: string
          id?: string
          passed: boolean
          post_id?: string | null
          provider?: string | null
          score: number
          source_url?: string | null
          user_id: string
        }
        Update: {
          answers?: Json
          completion_time_ms?: number | null
          created_at?: string | null
          expires_at?: string | null
          gate_type?: string
          id?: string
          passed?: boolean
          post_id?: string | null
          provider?: string | null
          score?: number
          source_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_gate_attempts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_media: {
        Row: {
          created_at: string
          id: string
          media_id: string
          order_idx: number
          post_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          media_id: string
          order_idx?: number
          post_id: string
        }
        Update: {
          created_at?: string
          id?: string
          media_id?: string
          order_idx?: number
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_media_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_qa: {
        Row: {
          content_hash: string | null
          correct_answers: Json
          generated_at: string | null
          generated_from: string | null
          id: string
          post_id: string | null
          questions: Json
          source_url: string | null
          test_mode: string | null
          transcript: string | null
          transcript_source: string | null
          updated_at: string | null
        }
        Insert: {
          content_hash?: string | null
          correct_answers: Json
          generated_at?: string | null
          generated_from?: string | null
          id?: string
          post_id?: string | null
          questions: Json
          source_url?: string | null
          test_mode?: string | null
          transcript?: string | null
          transcript_source?: string | null
          updated_at?: string | null
        }
        Update: {
          content_hash?: string | null
          correct_answers?: Json
          generated_at?: string | null
          generated_from?: string | null
          id?: string
          post_id?: string | null
          questions?: Json
          source_url?: string | null
          test_mode?: string | null
          transcript?: string | null
          transcript_source?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_qa_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_qa_answers: {
        Row: {
          correct_answers: Json
          created_at: string
          id: string
        }
        Insert: {
          correct_answers: Json
          created_at?: string
          id: string
        }
        Update: {
          correct_answers?: Json
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_qa_answers_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "post_qa_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      post_qa_questions: {
        Row: {
          content_hash: string | null
          expires_at: string | null
          generated_at: string | null
          generated_from: string | null
          id: string
          owner_id: string
          post_id: string | null
          questions: Json
          source_url: string | null
          test_mode: string | null
        }
        Insert: {
          content_hash?: string | null
          expires_at?: string | null
          generated_at?: string | null
          generated_from?: string | null
          id?: string
          owner_id: string
          post_id?: string | null
          questions: Json
          source_url?: string | null
          test_mode?: string | null
        }
        Update: {
          content_hash?: string | null
          expires_at?: string | null
          generated_at?: string | null
          generated_from?: string | null
          id?: string
          owner_id?: string
          post_id?: string | null
          questions?: Json
          source_url?: string | null
          test_mode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_qa_questions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_topics: {
        Row: {
          confidence: number
          created_at: string
          macro_category: string | null
          post_id: string
          topic_id: string
          topic_label: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          macro_category?: string | null
          post_id: string
          topic_id: string
          topic_label: string
        }
        Update: {
          confidence?: number
          created_at?: string
          macro_category?: string | null
          post_id?: string
          topic_id?: string
          topic_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_topics_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          article_content: string | null
          author_id: string
          category: string | null
          content: string
          created_at: string | null
          embed_html: string | null
          full_article: string | null
          id: string
          is_intent: boolean
          preview_img: string | null
          quoted_post_id: string | null
          shared_title: string | null
          shared_url: string | null
          shares_count: number | null
          sources: Json | null
          stance: string | null
          topic_tag: string | null
          transcript: string | null
          transcript_source: string | null
          trust_level: string | null
          verified_by: string | null
        }
        Insert: {
          article_content?: string | null
          author_id: string
          category?: string | null
          content: string
          created_at?: string | null
          embed_html?: string | null
          full_article?: string | null
          id?: string
          is_intent?: boolean
          preview_img?: string | null
          quoted_post_id?: string | null
          shared_title?: string | null
          shared_url?: string | null
          shares_count?: number | null
          sources?: Json | null
          stance?: string | null
          topic_tag?: string | null
          transcript?: string | null
          transcript_source?: string | null
          trust_level?: string | null
          verified_by?: string | null
        }
        Update: {
          article_content?: string | null
          author_id?: string
          category?: string | null
          content?: string
          created_at?: string | null
          embed_html?: string | null
          full_article?: string | null
          id?: string
          is_intent?: boolean
          preview_img?: string | null
          quoted_post_id?: string | null
          shared_title?: string | null
          shared_url?: string | null
          shares_count?: number | null
          sources?: Json | null
          stance?: string | null
          topic_tag?: string | null
          transcript?: string | null
          transcript_source?: string | null
          trust_level?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_quoted_post_id_fkey"
            columns: ["quoted_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cognitive_density: Json | null
          cognitive_tracking_enabled: boolean | null
          created_at: string | null
          date_of_birth: string
          editorial_notifications_enabled: boolean | null
          full_name: string | null
          id: string
          last_seen_at: string | null
          notifications_comments_enabled: boolean | null
          notifications_follows_enabled: boolean | null
          notifications_likes_enabled: boolean | null
          notifications_mentions_enabled: boolean | null
          notifications_messages_enabled: boolean | null
          notifications_reshares_enabled: boolean | null
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          cognitive_density?: Json | null
          cognitive_tracking_enabled?: boolean | null
          created_at?: string | null
          date_of_birth: string
          editorial_notifications_enabled?: boolean | null
          full_name?: string | null
          id: string
          last_seen_at?: string | null
          notifications_comments_enabled?: boolean | null
          notifications_follows_enabled?: boolean | null
          notifications_likes_enabled?: boolean | null
          notifications_mentions_enabled?: boolean | null
          notifications_messages_enabled?: boolean | null
          notifications_reshares_enabled?: boolean | null
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          cognitive_density?: Json | null
          cognitive_tracking_enabled?: boolean | null
          created_at?: string | null
          date_of_birth?: string
          editorial_notifications_enabled?: boolean | null
          full_name?: string | null
          id?: string
          last_seen_at?: string | null
          notifications_comments_enabled?: boolean | null
          notifications_follows_enabled?: boolean | null
          notifications_likes_enabled?: boolean | null
          notifications_mentions_enabled?: boolean | null
          notifications_messages_enabled?: boolean | null
          notifications_reshares_enabled?: boolean | null
          username?: string
        }
        Relationships: []
      }
      publish_idempotency: {
        Row: {
          created_at: string
          id: string
          key: string
          post_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          post_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          post_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      qa_submit_attempts: {
        Row: {
          attempt_count: number
          id: string
          last_attempt_at: string
          qa_id: string
          user_id: string
          window_start: string
        }
        Insert: {
          attempt_count?: number
          id?: string
          last_attempt_at?: string
          qa_id: string
          user_id: string
          window_start?: string
        }
        Update: {
          attempt_count?: number
          id?: string
          last_attempt_at?: string
          qa_id?: string
          user_id?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_submit_attempts_qa_id_fkey"
            columns: ["qa_id"]
            isOneToOne: false
            referencedRelation: "post_qa_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          correct_index: number
          id: string
          options: Json
          order_index: number
          post_id: string
          question_text: string
        }
        Insert: {
          correct_index: number
          id?: string
          options: Json
          order_index: number
          post_id: string
          question_text: string
        }
        Update: {
          correct_index?: number
          id?: string
          options?: Json
          order_index?: number
          post_id?: string
          question_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      reactions: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          reaction_type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          reaction_type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          reaction_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_participants: {
        Row: {
          id: string
          joined_at: string
          last_read_at: string | null
          thread_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          last_read_at?: string | null
          thread_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          last_read_at?: string | null
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_participants_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trending_topics_cache: {
        Row: {
          generated_at: string
          id: number
          input_snapshot: Json
          min_clusters: number
          payload: Json
          sample_size: number
          valid_until: string
          window_hours: number
        }
        Insert: {
          generated_at?: string
          id?: number
          input_snapshot: Json
          min_clusters?: number
          payload: Json
          sample_size?: number
          valid_until: string
          window_hours?: number
        }
        Update: {
          generated_at?: string
          id?: number
          input_snapshot?: Json
          min_clusters?: number
          payload?: Json
          sample_size?: number
          valid_until?: string
          window_hours?: number
        }
        Relationships: []
      }
      trust_scores: {
        Row: {
          band: string
          calculated_at: string
          expires_at: string
          id: string
          reasons: Json
          score: number
          source_url: string
        }
        Insert: {
          band: string
          calculated_at?: string
          expires_at?: string
          id?: string
          reasons: Json
          score: number
          source_url: string
        }
        Update: {
          band?: string
          calculated_at?: string
          expires_at?: string
          id?: string
          reasons?: Json
          score?: number
          source_url?: string
        }
        Relationships: []
      }
      user_consents: {
        Row: {
          accepted_privacy: boolean
          accepted_terms: boolean
          ads_opt_in_at: string | null
          ads_personalization_opt_in: boolean
          consent_version: string
          created_at: string
          id: string
          privacy_accepted_at: string | null
          terms_accepted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_privacy?: boolean
          accepted_terms?: boolean
          ads_opt_in_at?: string | null
          ads_personalization_opt_in?: boolean
          consent_version?: string
          created_at?: string
          id?: string
          privacy_accepted_at?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_privacy?: boolean
          accepted_terms?: boolean
          ads_opt_in_at?: string | null
          ads_personalization_opt_in?: boolean
          consent_version?: string
          created_at?: string
          id?: string
          privacy_accepted_at?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      youtube_transcripts_cache: {
        Row: {
          cached_at: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          language: string | null
          source: string
          transcript: string
          video_id: string
        }
        Insert: {
          cached_at?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          language?: string | null
          source: string
          transcript: string
          video_id: string
        }
        Update: {
          cached_at?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          language?: string | null
          source?: string
          transcript?: string
          video_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          full_name: string | null
          id: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      create_or_get_thread: {
        Args: { participant_ids: string[] }
        Returns: string
      }
      extract_mentions: {
        Args: { content: string }
        Returns: {
          username: string
        }[]
      }
      get_share_counts: {
        Args: { shared_urls: string[] }
        Returns: {
          count: number
          shared_url: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_post_shares: {
        Args: { target_post_id: string }
        Returns: undefined
      }
      is_valid_username: { Args: { username: string }; Returns: boolean }
      update_last_seen: { Args: never; Returns: undefined }
      user_can_react_to_message: {
        Args: { _message_id: string; _user_id: string }
        Returns: boolean
      }
      user_is_thread_participant: {
        Args: { check_thread_id: string; check_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
