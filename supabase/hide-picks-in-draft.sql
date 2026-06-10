-- Hide other players' picks while the pool is in draft.
-- Idempotent: drops and recreates the SELECT policy on entry_picks.

drop policy if exists entry_picks_select on public.entry_picks;
create policy entry_picks_select on public.entry_picks for select to authenticated
  using (
    not public.pool_is_draft()
    or exists (
      select 1 from public.entries e
      where e.id = entry_picks.entry_id and e.profile_id = auth.uid()
    )
  );
