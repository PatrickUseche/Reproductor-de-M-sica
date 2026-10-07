create table if not exists public.user_playlists (
  user_id uuid primary key references auth.users (id) on delete cascade,
  playlist_data jsonb not null default '{"songs": [], "currentSongId": null}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_playlists enable row level security;

create policy "Users can read their own playlist"
  on public.user_playlists for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own playlist"
  on public.user_playlists for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own playlist"
  on public.user_playlists for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);