-- Run these in the Supabase SQL editor AFTER creating a table,
-- if you decide to use Supabase instead of / alongside the Django backend.
-- Replace `your_table` with your actual table name.

-- 1. Turn on RLS (if "Enable automatic RLS" wasn't on when the table was made)
alter table your_table enable row level security;

-- 2. Simplest option for a hackathon demo: any authenticated user can do anything.
-- Fast to set up, fine for a demo, not what you'd ship to real users.
create policy "Allow all for authenticated users"
on your_table
for all
to authenticated
using (true)
with check (true);

-- 3. Slightly safer option: users can only read/write their own rows.
-- Requires a `user_id uuid references auth.users(id)` column on the table.
create policy "Users manage their own rows"
on your_table
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 4. Public read, authenticated write (good for e.g. a public feed/listing).
create policy "Public can read"
on your_table
for select
to anon, authenticated
using (true);

create policy "Authenticated users can insert"
on your_table
for insert
to authenticated
with check (true);
