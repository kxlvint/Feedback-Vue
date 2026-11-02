import { createAvatar } from '@dicebear/core';
import { funEmoji } from '@dicebear/collection';
import { animals, colors, uniqueNamesGenerator } from 'unique-names-generator';

/**
 * A display name like "Purple Otter", generated fresh for each post.
 *
 * Colours and animals only — deliberately not the `adjectives` dictionary, which
 * contains emotional words ("Grieving", "Bewildered", "Shrill"). Attributing a
 * complaint to "Grieving Orca" reads as editorial comment on the feedback.
 *
 * Per POST, never per person: two submissions by the same visitor get unrelated
 * names, so the name carries no information about authorship. A stable pseudonym
 * would let someone's posts be grouped together, which defeats the point.
 */
export function generateDisplayName(): string {
  return uniqueNamesGenerator({
    dictionaries: [colors, animals],
    separator: ' ',
    style: 'capital',
    length: 2,
  });
}

// Generating an SVG is not free, and the wall re-renders on every filter change and
// refetch. Names repeat across renders, so cache by name.
const avatarCache = new Map<string, string>();

/**
 * A data-URI avatar derived from the name. Deterministic: the same name always
 * produces the same character, which is why no avatar needs storing.
 */
export function avatarFor(name: string | null): string {
  const seed = name ?? 'anonymous';

  const cached = avatarCache.get(seed);
  if (cached) return cached;

  // Only `seed` is passed. The DiceBear advisory patched in 9.4.3 concerned
  // unescaped `rotate` / `fontSize` options, which this never sets.
  const uri = createAvatar(funEmoji, { seed, radius: 50 }).toDataUri();

  avatarCache.set(seed, uri);
  return uri;
}

/** Shown for rows created before display_name existed. */
export const FALLBACK_NAME = 'Anonymous';
