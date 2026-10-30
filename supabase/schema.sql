-- Team Feedback Loop — schema + row level security
-- Run this in the Supabase dashboard: SQL Editor → New query → Run.

create table if not exists feedback (
  id         uuid        primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  content    text        not null check (char_length(trim(content)) between 1 and 500),
  category   text        not null check (category in ('Culture', 'Workflow', 'Technical', 'Other')),
  upvotes    integer     not null default 0 check (upvotes >= 0)
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
