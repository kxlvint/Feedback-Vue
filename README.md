# Team Feedback Loop

An anonymous feedback wall for a team: post a note under a category, read everyone
else's, upvote the ones you agree with. Built for the "Team Feedback Loop" take-home
(`Take home challenge - FSD.pdf`).

Anonymity is the product, not a feature of it — there is no account, no login, and
nothing stored that links a post to a person. Every decision below follows from that.

## Stack

|          |                                                           |
| -------- | --------------------------------------------------------- |
| Frontend | Vue 3 (`<script setup>`, TypeScript), Vite                |
| Data     | Supabase (Postgres + PostgREST + Realtime)                |
| Styling  | Tailwind CSS v4                                           |
| State    | Pinia (persisted), `vue-hooks-plus` for request lifecycle |
| Lists    | `vue-virtual-scroller` (`DynamicScroller`)                |

## Running it locally

Needs Node 20.19+ or 22.12+ (Vite 8 requirement).

```bash
npm install
cp .env.example .env.local     # then fill in the two values
npm run dev
```

The two environment variables come from the Supabase dashboard under
**Project Settings → API Keys**:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxx
```

Then create the schema: open **SQL Editor → New query** in the dashboard, paste
[`supabase/schema.sql`](supabase/schema.sql), and run it. That script creates the
table, its indexes, row level security policies, and the two upvote functions, and
registers the table for Realtime.

Run it once: the table, index, and functions use `if not exists` / `or replace`, but
the two `create policy` statements and the `alter publication` at the end will error
if they already exist.

| script              | what it does                     |
| ------------------- | -------------------------------- |
| `npm run dev`       | dev server                       |
| `npm run build`     | typecheck, then production build |
| `npm run typecheck` | `vue-tsc --noEmit`               |
| `npm run format`    | Prettier over the repo           |

## Database schema

One table, `feedback`:

| column         | type          | notes                                                            |
| -------------- | ------------- | ---------------------------------------------------------------- |
| `id`           | `uuid`        | primary key, `gen_random_uuid()`                                 |
| `created_at`   | `timestamptz` | `now()`; the wall sorts on this, descending                      |
| `content`      | `text`        | `check (char_length(trim(content)) between 1 and 500)`           |
| `category`     | `text`        | `check (category in ('Culture','Workflow','Technical','Other'))` |
| `upvotes`      | `integer`     | `not null default 0`, `check (upvotes >= 0)`                     |
| `display_name` | `text`        | nullable; a per-post pseudonym like "Purple Otter"               |

Plus `create index feedback_created_at_idx on feedback (created_at desc)`, which
covers both the sort and the category filter's scan.

**`display_name` is per post, never per person.** Two posts by the same visitor get
unrelated names, so the name carries no information about authorship. A stable
pseudonym would let someone's posts be grouped together, which defeats the point. The
avatar is derived from the name in the browser (DiceBear, keyed on the name as seed),
so there is no avatar column — nothing to store, and the art style can change later
without migrating data.

### Row level security

RLS is on, with deliberately narrow policies:

```sql
create policy "public can read feedback"   on feedback for select to anon using (true);
create policy "public can submit feedback" on feedback for insert to anon with check (true);
-- no update policy, and no delete policy
```

Reading is open because the table stores nothing identifying — anonymity comes from
never capturing an author, not from hiding rows. There is deliberately **no** update
or delete policy, so RLS denies both and submitted feedback is immutable from the
browser.

Upvoting still has to mutate a row, so rather than granting a blanket `UPDATE` policy
— which would also let anyone rewrite someone's content — it goes through two narrow
`SECURITY DEFINER` functions:

```sql
upvote_feedback(feedback_id uuid)         -- upvotes = upvotes + 1
remove_upvote_feedback(feedback_id uuid)  -- upvotes = greatest(upvotes - 1, 0)
```

They run as their owner, bypassing RLS, but the only statement either can run is a
±1 on one column. Two fixed-direction functions rather than one taking a delta:
a delta parameter would let a caller set the count to anything, which is the exact
hole the functions exist to close.

## What's implemented

Against the brief's MVP:

- **Submit feedback** — 500-character limit enforced in the UI _and_ as a Postgres
  check constraint, with a live character counter. Category is required (no default),
  chosen through a typeahead combobox.
- **The wall** — reverse-chronological feed, paged as you scroll.
- **Upvoting** — one vote per visitor, toggleable, optimistic in the UI with the
  server count as the authority.
- **Filtering** — multi-select category pills, filtered in Postgres via `.in()`
  rather than in the browser, so the payload does not grow with the wall.

Beyond the brief: **live updates over a WebSocket** (below), paged loading with a
virtualised list, and a back-to-top control.

### Live updates over a WebSocket

New posts appear without a refresh. Supabase Realtime is the transport, and the chain
is worth spelling out because it explains the one SQL line that is easy to miss:

```
INSERT into feedback
  -> Postgres WAL (write-ahead log)
  -> logical replication slot, filtered by the `supabase_realtime` publication
  -> Realtime server: re-checks RLS per subscriber, then fans out
  -> one WebSocket per client -> the .on() callback, with the row as JSON
```

A table is invisible to Realtime until it is a member of that publication, which is
why `schema.sql` ends with:

```sql
alter publication supabase_realtime add table feedback;
```

The `select` policy above is what then authorizes delivery — Realtime re-checks RLS
per subscriber, so a table with no read policy produces a channel that connects and
then stays silent.

**Arriving rows are buffered, not spliced in.** They go into a `pendingRows` array
and surface as a sticky "Show 3 new posts" pill; merging happens when the reader asks
for it. Inserting rows above someone mid-sentence moves the text they are reading,
and with a virtualised list it also forces a re-measure mid-scroll. Clicking the pill
merges and scrolls to the top of the wall.

Two details that are easy to get wrong:

- **Your own post arrives twice** — once from the insert's response, once over the
  channel — and the channel is usually faster, since the insert response is a second
  round trip. Both paths dedupe by `id`, and the submit path also clears its row from
  the buffer, or the pill would offer you your own post and then merge a duplicate.
- **A dropped connection loses events silently.** Realtime is at-most-once, not a
  durable queue, so it complements the initial fetch rather than replacing
  reconciliation.

## Trade-offs

### PostgREST puts the table itself on the public internet

This is the decision I'd flag hardest, and it is inherent to the "client library talks
straight to the database" model the brief asks for. There is no server of mine in
between, so there is no layer where a request can be validated — the REST API _is_
the table, and RLS is the only gate.

Concretely, in this project:

- **The API key ships in the client bundle and goes out on every request** (`apikey`
  and `Authorization` headers). That part is by design — a publishable key identifies
  the project, not a user, and it is useless without a policy that permits what you
  are attempting. It is still worth naming, because it means _the key is not a
  security control_: everything rests on RLS being right. Confusing it with the
  `service_role` key, which bypasses RLS, turns the same architecture into a full
  database compromise.
- **Table and column names are public knowledge.** They are in the shipped JavaScript
  (`from('feedback')`, the column list), so an attacker never has to guess the shape
  of the schema. Obscurity is not available as a defence here, which is fine as long
  as you do not accidentally rely on it.
- **RLS authorises the insert but constrains no columns.** `with check (true)` checks
  nothing, and PostgREST accepts any column the role may write — so a direct `POST`
  could set `created_at`, `upvotes` and `id`, none of which the UI exposes. I found
  this by probing my own project, and confirmed it: the request returned `201` with
  all three values persisted.

  `created_at` was the damaging one. The wall is ordered `created_at desc` and there
  is deliberately no delete policy, so a post dated in the far future pinned itself to
  the top of the feed permanently, unremovable from the browser.

  Fixed with column privileges, which is the gate that actually applies here —
  `with check` can test a row's _values_ but not which _columns_ the caller supplied:

  ```sql
  revoke insert on feedback from anon;
  grant insert (content, category, display_name) on feedback to anon;
  ```

  `display_name` stays writable because the client generates it, which leaves one
  residue: a caller can still choose a name, so the per-post unlinkability is a
  property of my JavaScript rather than of the API. Closing that means generating the
  name in Postgres — a `before insert` trigger that overwrites whatever was sent — and
  dropping the column from the grant. I left it client-side rather than duplicate the
  generator in plpgsql, a trade I'd revisit if the name mattered for more than
  decoration.

The general lesson is the one the upvote path already follows: narrow
`SECURITY DEFINER` functions instead of table-level write permissions, so the API
exposes an _operation_ rather than a _table_. Column privileges are a narrower patch
on the same problem.

### Offset pagination, and what it costs

Pages are fetched with `.range()`. Simple, and it gives an exact total for free — but
offsets shift when a row is prepended, so a later page can return a row the list
already holds. That forced dedupe by `id` on append, and an `isEnd` rule that compares
the request's offset against the server count rather than counting rows in the list.
Keyset pagination (`created_at < oldest_loaded`) would remove all of that, because a
cursor anchored to a row does not care what gets added above it. It is the change I'd
make first.

### Virtual scrolling earns nothing at this size

`DynamicScroller` recycles DOM nodes and measures each row, which is correct for cards
whose height depends on their content — but it costs ~45 kB of JavaScript to render a
few dozen rows. At this scale a plain `v-for` would be smaller and simpler. It is here
because the wall is the thing expected to grow without bound, and because a scroller
that measures variable heights is the part that is annoying to retrofit later.

### One vote per visitor is as good as it gets without identity

The brief asks for one vote per session/user. With no login, "per user" can only mean
"per visitor", so votes are kept in `localStorage` via a persisted Pinia store. That
survives a reload, which is what makes the limit hold in practice. Someone who clears
site data or opens a private window can vote again. That is unavoidable without
identity, and worth stating rather than pretending otherwise.
