import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !publishableKey) {
  throw new Error(
    'Missing Supabase credentials. Copy .env.example to .env.local and fill it in.',
  )
}

// Passing <Database> is the whole reason TypeScript is worth it here: table names,
// column names, and rpc arguments are now checked against the real schema, and
// .select() return types are inferred from the columns you ask for.
export const supabase = createClient<Database>(url, publishableKey, {
  auth: { persistSession: false },
})
