// `as const` plus a derived union rather than a TS enum: tsconfig.app.json sets
// `erasableSyntaxOnly`, so enums are a compile error. The union is better here
// anyway — it stays a plain array at runtime for v-for.
export const CATEGORIES = ['Culture', 'Workflow', 'Technical', 'Other'] as const

export type Category = (typeof CATEGORIES)[number]

export const MAX_CONTENT_LENGTH = 500

export const CATEGORY_STYLES: Record<Category, string> = {
  Culture: 'bg-violet-100 text-violet-700',
  Workflow: 'bg-sky-100 text-sky-700',
  Technical: 'bg-emerald-100 text-emerald-700',
  Other: 'bg-slate-100 text-slate-600',
}

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value)
}
