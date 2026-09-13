/**
 * Shape of the database as the client sees it.
 *
 * Written by hand to match `supabase/migrations`, so that queries come back
 * typed instead of `any`. If the schema changes, change this file in the same
 * commit.
 */

export interface Database {
  public: {
    Tables: {
      topics: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          estimated_minutes: number;
          completed_minutes: number;
          priority: number;
          deadline: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          estimated_minutes: number;
          completed_minutes?: number;
          priority?: number;
          deadline?: string | null;
          status?: string;
        };
        Update: {
          title?: string;
          estimated_minutes?: number;
          completed_minutes?: number;
          priority?: number;
          deadline?: string | null;
          status?: string;
        };
        Relationships: [];
      };
      availability: {
        Row: {
          user_id: string;
          weekday: number;
          minutes: number;
        };
        Insert: {
          user_id: string;
          weekday: number;
          minutes: number;
        };
        Update: {
          minutes?: number;
        };
        Relationships: [];
      };
      plans: {
        Row: {
          id: string;
          user_id: string;
          week_start: string;
          generated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          week_start: string;
          generated_at?: string;
        };
        Update: {
          generated_at?: string;
        };
        Relationships: [];
      };
      sessions: {
        Row: {
          id: string;
          user_id: string;
          plan_id: string;
          topic_id: string;
          scheduled_date: string;
          minutes: number;
          status: "planned" | "done" | "skipped";
          manual: boolean;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_id: string;
          topic_id: string;
          scheduled_date: string;
          minutes: number;
          status?: "planned" | "done" | "skipped";
          manual?: boolean;
          completed_at?: string | null;
        };
        Update: {
          status?: "planned" | "done" | "skipped";
          manual?: boolean;
          completed_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      set_session_status: {
        Args: { p_session_id: string; p_status: string };
        Returns: Database["public"]["Tables"]["sessions"]["Row"];
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}
