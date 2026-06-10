import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DraftBoard from "./board";
import LeaguesBar, { type LeagueRow } from "./leagues-bar";
import type { Team } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DraftPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: teams }, { data: settings }, { data: entry }, { data: memberships }] = await Promise.all([
    supabase.from("teams").select("*").order("tier").order("fifa_rank", { nullsFirst: false }),
    supabase.from("pool_settings").select("status").single(),
    supabase
      .from("entries")
      .select("id, entry_picks(team_id)")
      .eq("profile_id", user.id)
      .maybeSingle(),
    supabase
      .from("league_members")
      .select("league_id, leagues(id, name, invite_code)")
      .eq("profile_id", user.id),
  ]);

  const initialPicks: number[] =
    (entry as { entry_picks?: { team_id: number }[] } | null)?.entry_picks?.map((p) => p.team_id) ?? [];

  // Get member counts for each of the user's leagues. RLS lets them see other
  // members of leagues they're in.
  const leagueIds = ((memberships as { league_id: string; leagues: { id: string; name: string; invite_code: string } | null }[] | null) ?? [])
    .map((m) => m.league_id);

  let memberCounts = new Map<string, number>();
  if (leagueIds.length > 0) {
    const { data: countRows } = await supabase
      .from("league_members")
      .select("league_id")
      .in("league_id", leagueIds);
    memberCounts = (countRows ?? []).reduce((m, r) => {
      m.set(r.league_id as string, (m.get(r.league_id as string) ?? 0) + 1);
      return m;
    }, new Map<string, number>());
  }

  const leagues: LeagueRow[] = ((memberships as { league_id: string; leagues: { id: string; name: string; invite_code: string } | null }[] | null) ?? [])
    .filter((m) => m.leagues)
    .map((m) => ({
      id: m.leagues!.id,
      name: m.leagues!.name,
      invite_code: m.leagues!.invite_code,
      member_count: memberCounts.get(m.league_id) ?? 1,
    }));

  return (
    <>
      <LeaguesBar initialLeagues={leagues} />
      <DraftBoard
        teams={(teams as Team[]) ?? []}
        initialPicks={initialPicks}
        locked={settings?.status === "locked"}
      />
    </>
  );
}
