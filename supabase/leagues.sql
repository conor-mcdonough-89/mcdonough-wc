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

-- Atomically create a league and add the caller as the first member.
-- SECURITY DEFINER so the create path doesn't depend on RLS at all — we
-- enforce identity ourselves via auth.uid().
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
