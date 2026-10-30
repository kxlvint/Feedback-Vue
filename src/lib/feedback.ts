import { supabase } from './supabase'
import type { Category } from './constants'
import type { Database } from '../types/database'

export type Feedback = Database['public']['Tables']['feedback']['Row']

/** One page of rows plus the total row count matching the filter. */
export type Page<T> = {
  rows: T[]
  total: number
}

export type FetchFeedbackParams = {
  category?: Category | null
  /** 1-based, so it matches the page number shown in the UI. */
  pageIndex?: number
  pageSize?: number
}

const COLUMNS = 'id, created_at, content, category, upvotes' as const

// supabase-js resolves with { data, error } instead of throwing, so every call here
// normalises to "throw on failure" and lets the components handle it in one place.
//
// Note these are `async`/`await` rather than `.then(unwrap)`: a Supabase query
// builder is only PromiseLike (it has .then but no .catch/.finally), so returning
// `builder.then(...)` does not satisfy a `Promise<T>` return type. Awaiting it gives
// you a real promise.
function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message)
  return result.data as T
}

export async function fetchFeedback({
  category,
  pageIndex = 1,
  pageSize = 10,
}: FetchFeedbackParams = {}): Promise<Page<Feedback>> {
  // .range() is inclusive on both ends, unlike Array.slice.
  const from = (pageIndex - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('feedback')
    // { count: 'exact' } makes PostgREST return the total row count alongside the
    // page, so the UI can show "of N" and compute the last page. It costs a COUNT
    // on every request; 'estimated' is cheaper if the table ever gets large.
    .select(COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  // Filtering in Postgres rather than in the browser, so the payload stays small
  // as the wall grows. The count above respects this filter too.
  if (category) query = query.eq('category', category)

  const result = await query
  const rows = unwrap(result)

  return { rows, total: result.count ?? 0 }
}

export async function submitFeedback(
  { content, category }: { content: string; category: Category },
): Promise<Feedback> {
  const result = await supabase
    .from('feedback')
    .insert({ content: content.trim(), category })
    .select(COLUMNS)
    .single()

  return unwrap(result)
}

// Calls the SECURITY DEFINER function from schema.sql and returns the new count.
export async function upvoteFeedback(id: string): Promise<number> {
  return unwrap(await supabase.rpc('upvote_feedback', { feedback_id: id }))
}
