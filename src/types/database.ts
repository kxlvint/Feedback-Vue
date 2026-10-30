// Shape of the Postgres schema in supabase/schema.sql.
//
// Hand-written to match what the Supabase CLI emits, so you can replace this file
// wholesale once your project is up:
//
//   npx supabase login
//   npx supabase gen types typescript --project-id <your-ref> > src/types/database.ts
//
// Worth doing before you submit — a generated file proves the types match the real
// database rather than your memory of it.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      feedback: {
        Row: {
          id: string
          created_at: string
          content: string
          category: string
          upvotes: number
        }
        Insert: {
          id?: string
          created_at?: string
          content: string
          category: string
          upvotes?: number
        }
        Update: {
          id?: string
          created_at?: string
          content?: string
          category?: string
          upvotes?: number
        }
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: {
      upvote_feedback: {
        Args: { feedback_id: string }
        Returns: number
      }
    }
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}
