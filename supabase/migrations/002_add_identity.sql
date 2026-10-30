-- Adds a per-post display name.
--
-- IMPORTANT: this is per POST, not per person. A fresh name is generated at submit
-- time, so two posts by the same visitor share nothing. That keeps the identity
-- purely decorative — it carries no information about who wrote it. A stable
-- per-visitor pseudonym would make a person's posts correlatable, which is exactly
-- what this app promises not to do.
--
-- There is no avatar column: the avatar is generated in the browser with
-- display_name as the DiceBear seed, so it is deterministic from this one value.
--
-- Run this in the Supabase dashboard: SQL Editor -> New query -> Run.

-- Nullable on purpose: rows that predate this migration have no name, and
-- backfilling them with generated ones would invent data. The UI falls back instead.
alter table feedback
  add column if not exists display_name text
    check (display_name is null or char_length(display_name) between 1 and 60);
