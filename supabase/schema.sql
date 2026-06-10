-- McDonough World Cup Pool — full schema + RLS.
-- Idempotent: safe to re-run. Paste into Supabase SQL editor.

-- =====================================================================
-- Enums
-- =====================================================================
do $$ begin
  create type stage_t as enum ('group','R32','R16','QF','SF','F','3P');
exception when duplicate_object then null; end $$;

do $$ begin
  create type match_status_t as enum ('scheduled','final');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tier_t as enum ('S','A','B','C','D');
exception when duplicate_object then null; end $$;

do $$ begin
  create type advancement_t as enum ('group_winner','runner_up','best_third','none');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pool_status_t as enum ('draft','locked');
exception when duplicate_object then null; end $$;

-- =====================================================================
-- Tables
-- =====================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text unique not null,
  entry_name text,
  full_name text,
  is_admin boolean not null default false,
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id serial primary key,
  name text not null,
  code text unique not null,
  flag text not null,
  tier tier_t not null,
  price int not null,
  group_letter text not null check (group_letter ~ '^[A-L]$'),
  confederation text not null,
  fifa_rank int
);

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entry_picks (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  team_id int not null references public.teams(id) on delete restrict,
  unique (entry_id, team_id)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  stage stage_t not null,
  group_letter text check (group_letter ~ '^[A-L]$'),
  kickoff timestamptz,
  venue text,
  home_team_id int references public.teams(id),
  away_team_id int references public.teams(id),
  home_score int,
  away_score int,
  went_to_penalties boolean not null default false,
  penalty_winner_team_id int references public.teams(id),
  status match_status_t not null default 'scheduled',
  -- For KO placeholders, a short label like 'R32-1' to give a slot an identity.
  slot text,
  created_at timestamptz not null default now()
);

create table if not exists public.team_advancement (
  team_id int primary key references public.teams(id) on delete cascade,
  result advancement_t not null default 'none'
);

create table if not exists public.pool_settings (
  id int primary key default 1 check (id = 1),
  status pool_status_t not null default 'draft',
  invite_code text,
  final_bonus int not null default 8
);

insert into public.pool_settings (id, status) values (1, 'draft')
on conflict (id) do nothing;

-- =====================================================================
-- Helpers
-- =====================================================================
create or replace function public.is_admin(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = uid), false);
$$;

create or replace function public.pool_is_draft() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select status = 'draft' from public.pool_settings where id = 1), true);
$$;

-- updated_at trigger for entries
create or replace function public.touch_entries_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_entries_updated_at on public.entries;
create trigger trg_entries_updated_at before update on public.entries
for each row execute function public.touch_entries_updated_at();

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.entries enable row level security;
alter table public.entry_picks enable row level security;
alter table public.matches enable row level security;
alter table public.team_advancement enable row level security;
alter table public.pool_settings enable row level security;

-- Profiles: any authenticated user can read all profiles (needed for the
-- leaderboard / scoring page to show entry + full names). A user can update
-- their own profile (used by onboarding). Admins can update anyone.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Teams: readable by any authenticated user. Only admins write.
drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams for select to authenticated using (true);

drop policy if exists teams_admin_write on public.teams;
create policy teams_admin_write on public.teams for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Entries: readable by all authenticated users. User can insert/update/delete
-- only their own entry, and only while pool is in draft.
drop policy if exists entries_select on public.entries;
create policy entries_select on public.entries for select to authenticated using (true);

drop policy if exists entries_insert_self on public.entries;
create policy entries_insert_self on public.entries for insert to authenticated
  with check (profile_id = auth.uid() and public.pool_is_draft());

drop policy if exists entries_update_self on public.entries;
create policy entries_update_self on public.entries for update to authenticated
  using (profile_id = auth.uid() and public.pool_is_draft())
  with check (profile_id = auth.uid() and public.pool_is_draft());

drop policy if exists entries_delete_self on public.entries;
create policy entries_delete_self on public.entries for delete to authenticated
  using (profile_id = auth.uid() and public.pool_is_draft());

drop policy if exists entries_admin_all on public.entries;
create policy entries_admin_all on public.entries for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Entry picks: readable by all once the pool locks; until then only the
-- owner can see their own picks. Mutations are owner-only during draft.
drop policy if exists entry_picks_select on public.entry_picks;
create policy entry_picks_select on public.entry_picks for select to authenticated
  using (
    not public.pool_is_draft()
    or exists (
      select 1 from public.entries e
      where e.id = entry_picks.entry_id and e.profile_id = auth.uid()
    )
  );

drop policy if exists entry_picks_insert_self on public.entry_picks;
create policy entry_picks_insert_self on public.entry_picks for insert to authenticated
  with check (
    public.pool_is_draft() and
    exists (select 1 from public.entries e where e.id = entry_id and e.profile_id = auth.uid())
  );

drop policy if exists entry_picks_delete_self on public.entry_picks;
create policy entry_picks_delete_self on public.entry_picks for delete to authenticated
  using (
    public.pool_is_draft() and
    exists (select 1 from public.entries e where e.id = entry_id and e.profile_id = auth.uid())
  );

drop policy if exists entry_picks_admin_all on public.entry_picks;
create policy entry_picks_admin_all on public.entry_picks for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Matches: read by all authenticated, write by admin only.
drop policy if exists matches_select on public.matches;
create policy matches_select on public.matches for select to authenticated using (true);

drop policy if exists matches_admin_write on public.matches;
create policy matches_admin_write on public.matches for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Team advancement: read by all, write by admin only.
drop policy if exists adv_select on public.team_advancement;
create policy adv_select on public.team_advancement for select to authenticated using (true);

drop policy if exists adv_admin_write on public.team_advancement;
create policy adv_admin_write on public.team_advancement for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Pool settings: read by all, write by admin only.
drop policy if exists settings_select on public.pool_settings;
create policy settings_select on public.pool_settings for select to authenticated using (true);

drop policy if exists settings_admin_write on public.pool_settings;
create policy settings_admin_write on public.pool_settings for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- =====================================================================
-- Indexes
-- =====================================================================
create index if not exists idx_matches_stage on public.matches(stage);
create index if not exists idx_matches_group on public.matches(group_letter);
create index if not exists idx_matches_status on public.matches(status);
create index if not exists idx_entry_picks_entry on public.entry_picks(entry_id);
create index if not exists idx_entry_picks_team on public.entry_picks(team_id);
create index if not exists idx_teams_group on public.teams(group_letter);
-- Leagues: invite-code-joined sub-groupings inside the pool.
-- Idempotent: safe to re-run.

-- ===== Tables =====
create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.league_members (
  league_id uuid not null references public.leagues(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (league_id, profile_id)
);
create index if not exists idx_league_members_profile on public.league_members (profile_id);

-- ===== Helper functions =====
create or replace function public.is_league_member(p_league_id uuid, p_user_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.league_members
    where league_id = p_league_id and profile_id = p_user_id
  );
$$;

-- Resolves an invite code to a league id without exposing the leagues table
-- to non-members. The join server action calls this then inserts a membership row.
create or replace function public.lookup_league_by_code(p_code text)
returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.leagues where invite_code = p_code;
$$;

create or replace function public.create_league(p_name text, p_code text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Name required'; end if;
  if coalesce(trim(p_code), '') = '' then raise exception 'Code required'; end if;

  insert into public.leagues (name, invite_code, created_by)
  values (trim(p_name), upper(trim(p_code)), v_user)
  returning id into v_id;

  insert into public.league_members (league_id, profile_id)
  values (v_id, v_user);

  return v_id;
end $$;

-- ===== RLS =====
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;

drop policy if exists leagues_select on public.leagues;
create policy leagues_select on public.leagues for select to authenticated
  using (public.is_league_member(id, auth.uid()));

drop policy if exists leagues_insert on public.leagues;
create policy leagues_insert on public.leagues for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists leagues_update_creator on public.leagues;
create policy leagues_update_creator on public.leagues for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());

drop policy if exists leagues_delete_creator on public.leagues;
create policy leagues_delete_creator on public.leagues for delete to authenticated
  using (created_by = auth.uid());

drop policy if exists league_members_select on public.league_members;
create policy league_members_select on public.league_members for select to authenticated
  using (public.is_league_member(league_id, auth.uid()));

drop policy if exists league_members_insert_self on public.league_members;
create policy league_members_insert_self on public.league_members for insert to authenticated
  with check (profile_id = auth.uid());

drop policy if exists league_members_delete_self on public.league_members;
create policy league_members_delete_self on public.league_members for delete to authenticated
  using (profile_id = auth.uid());
