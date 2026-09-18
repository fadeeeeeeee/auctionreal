-- Run this in the Supabase SQL editor (Project -> SQL Editor -> New query).

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  category text not null,
  host_name text not null,
  guest_name text,
  host_user_id uuid references auth.users(id) on delete set null,
  guest_user_id uuid references auth.users(id) on delete set null,
  settings jsonb not null,
  rosters jsonb not null,
  spent jsonb not null,
  finished_at timestamptz not null default now()
);

alter table public.games enable row level security;

-- Anyone who played in the game (host or guest) can read it back.
create policy "players can read their games"
  on public.games for select
  using (auth.uid() = host_user_id or auth.uid() = guest_user_id);

-- Inserts happen via the server's service-role key (api/room-state.js / api/room-action.js),
-- so no public insert policy is needed.
