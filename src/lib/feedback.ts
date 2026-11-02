import { supabase } from './supabase';
import type { Category } from './constants';
import type { Database } from '../types/database';
import { generateDisplayName } from './identity';

export type Feedback = Database['public']['Tables']['feedback']['Row'];

/** One page of rows plus the total row count matching the filter. */
export type Page<T> = {
  rows: T[];
  total: number;
};

export type FetchFeedbackParams = {
  categories?: Category[];
  /** 1-based, so it matches the page number shown in the UI. */
  pageIndex?: number;
  pageSize?: number;
};

const COLUMNS = 'id, created_at, content, category, upvotes, display_name' as const;

// supabase-js resolves with { data, error } instead of throwing, so every call here
// normalises to "throw on failure" and lets the components handle it in one place.
//
// Note these are `async`/`await` rather than `.then(unwrap)`: a Supabase query
// builder is only PromiseLike (it has .then but no .catch/.finally), so returning
// `builder.then(...)` does not satisfy a `Promise<T>` return type. Awaiting it gives
// you a real promise.
function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

export async function fetchFeedback({
  categories = [],
  pageIndex = 1,
  pageSize = 10,
}: FetchFeedbackParams = {}): Promise<Page<Feedback>> {
  // .range() is inclusive on both ends, unlike Array.slice.
  const from = (pageIndex - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('feedback')
    // { count: 'exact' } makes PostgREST return the total row count alongside the
    // page, so the UI can show "of N" and compute the last page. It costs a COUNT
    // on every request; 'estimated' is cheaper if the table ever gets large.
    .select(COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  // Filtering in Postgres rather than in the browser, so the payload stays small
  // as the wall grows. The count above respects this filter too.
  if (categories.length) query = query.in('category', categories);

  const result = await query;
  const rows = unwrap(result);

  return { rows, total: result.count ?? 0 };
}

export async function submitFeedback({
  content,
  category,
}: {
  content: string;
  category: Category;
}): Promise<Feedback> {
  const result = await supabase
    .from('feedback')
    // The name is generated here rather than passed in, so no caller can choose
    // one. It is per-post decoration, not an identity the user controls.
    .insert({ content: content.trim(), category, display_name: generateDisplayName() })
    .select(COLUMNS)
    .single();

  return unwrap(result);
}

// Both call SECURITY DEFINER functions from schema.sql and return the new count.
export async function upvoteFeedback(id: string): Promise<number> {
  return unwrap(await supabase.rpc('upvote_feedback', { feedback_id: id }));
}

export async function removeUpvoteFeedback(id: string): Promise<number> {
  return unwrap(await supabase.rpc('remove_upvote_feedback', { feedback_id: id }));
}

/** Picks the right direction, so components do not branch on it themselves. */
export function setUpvote(id: string, voted: boolean): Promise<number> {
  return voted ? upvoteFeedback(id) : removeUpvoteFeedback(id);
}
