-- Team Feedback Loop — schema + row level security
-- Run this in the Supabase dashboard: SQL Editor → New query → Run.

create table if not exists feedback (
  id         uuid        primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  content    text        not null check (char_length(trim(content)) between 1 and 500),
  category   text        not null check (category in ('Culture', 'Workflow', 'Technical', 'Other')),
  upvotes    integer     not null default 0 check (upvotes >= 0),

  -- A per-POST display identity, generated fresh at submit time. Not per person:
  -- two posts by the same visitor share nothing, so this stays decorative and
  -- carries no information about authorship. Nullable because rows created before
  -- these columns existed have no identity, and inventing one would be fake data.
  -- No avatar column: the avatar is generated in the browser with display_name as
  -- the DiceBear seed, so it is deterministic from this one value. Nothing to store,
  -- and the art style can change later without migrating data.
  display_name text check (display_name is null or char_length(display_name) between 1 and 60)
);

-- The wall is sorted by recency and filtered by category; this covers both.
create index if not exists feedback_created_at_idx on feedback (created_at desc);

alter table feedback enable row level security;

-- Anyone may read the wall. Safe because the table stores nothing identifying:
-- anonymity comes from never capturing an author, not from hiding rows.
create policy "public can read feedback"
  on feedback for select
  to anon
  using (true);

create policy "public can submit feedback"
  on feedback for insert
  to anon
  with check (true);

-- Deliberately NO update or delete policy. Without one, RLS denies both,
-- so submitted feedback is immutable from the browser.

-- Upvoting still needs to mutate a row, though. Rather than granting a blanket
-- UPDATE policy -- which would also let anyone rewrite someone's content or set
-- upvotes to 9000 -- expose a single narrow operation. SECURITY DEFINER runs the
-- function as its owner, bypassing RLS, but the only statement it can ever run
-- is a +1 to one column.
create or replace function upvote_feedback(feedback_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  update feedback
     set upvotes = upvotes + 1
   where id = feedback_id
  returning upvotes into new_count;

  if new_count is null then
    raise exception 'feedback % not found', feedback_id;
  end if;

  return new_count;
end;
$$;

revoke all on function upvote_feedback(uuid) from public;
grant execute on function upvote_feedback(uuid) to anon;

-- Removing an upvote is the mirror of adding one, and needs the same treatment:
-- a narrow SECURITY DEFINER function rather than an UPDATE policy.
--
-- Note `greatest(upvotes - 1, 0)`: the table has `check (upvotes >= 0)`, so a bare
-- `upvotes - 1` on a zero row would raise a constraint violation. Clamping keeps the
-- call idempotent at the floor instead of erroring.
--
-- Deliberately NOT a single function taking a delta parameter: that would let a
-- caller pass any number and set the count to whatever they liked, which is the
-- exact hole the function exists to close. Two fixed-direction functions instead.
create or replace function remove_upvote_feedback(feedback_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  update feedback
     set upvotes = greatest(upvotes - 1, 0)
   where id = feedback_id
  returning upvotes into new_count;

  if new_count is null then
    raise exception 'feedback % not found', feedback_id;
  end if;

  return new_count;
end;
$$;

revoke all on function remove_upvote_feedback(uuid) from public;
grant execute on function remove_upvote_feedback(uuid) to anon;

alter publication supabase_realtime add table feedback;
