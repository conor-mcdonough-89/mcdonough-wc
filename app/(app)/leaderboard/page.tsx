import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Match, Team, TeamAdvancement } from "@/lib/types";
import {
  scoreEntry,
  compareEntryScores,
  advancementMapFromRows,
  type EntryScore,
} from "@/lib/scoring";
import LeaderboardClient, { type LeaderboardRow, type LeagueScope } from "./client";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: matches },
    { data: teams },
    { data: settings },
    { data: adv },
    { data: entries },
    { data: profiles },
  ] = await Promise.all([
    supabase.from("matches").select("*"),
    supabase.from("teams").select("*"),
    supabase.from("pool_settings").select("final_bonus, status").single(),
    supabase.from("team_advancement").select("*"),
    supabase.from("entries").select("id, profile_id, entry_picks(team_id)"),
    supabase.from("profiles").select("id, entry_name, full_name"),
  ]);

  const matchList = (matches as Match[]) ?? [];
  const teamList = (teams as Team[]) ?? [];
  const finalBase = settings?.final_bonus ?? 8;
  const advMap = advancementMapFromRows((adv as TeamAdvancement[]) ?? []);
  const profileById = new Map(
    (profiles as { id: string; entry_name: string | null; full_name: string | null }[] | null ?? [])
      .map((p) => [p.id, p]),
  );

  const rows: LeaderboardRow[] = ((entries as
    | { id: string; profile_id: string; entry_picks: { team_id: number }[] }[]
    | null) ?? []).map((e) => {
    const teamIds = e.entry_picks.map((p) => p.team_id);
    const score: EntryScore = scoreEntry(teamIds, matchList, advMap, finalBase);
    const profile = profileById.get(e.profile_id);
    return {
      entry_id: e.id,
      profile_id: e.profile_id,
      entry_name: profile?.entry_name ?? "(unnamed)",
      full_name: profile?.full_name ?? "",
      team_ids: teamIds,
      score,
    };
  });

  rows.sort((a, b) => compareEntryScores(a.score, b.score));

  const locked = settings?.status === "locked";

  // Leagues the user is a member of, with the full member list for each so the
  // client can filter rows without further round-trips. RLS lets the user see
  // all members of leagues they belong to.
  const { data: myMemberships } = await supabase
    .from("league_members")
    .select("league_id, leagues(id, name)")
    .eq("profile_id", user.id);

  const myLeagueIds = ((myMemberships as { league_id: string }[] | null) ?? []).map((m) => m.league_id);

  let leagueScopes: LeagueScope[] = [];
  if (myLeagueIds.length > 0) {
    const { data: allMembers } = await supabase
      .from("league_members")
      .select("league_id, profile_id")
      .in("league_id", myLeagueIds);
    const membersByLeague = new Map<string, string[]>();
    for (const m of (allMembers as { league_id: string; profile_id: string }[] | null) ?? []) {
      if (!membersByLeague.has(m.league_id)) membersByLeague.set(m.league_id, []);
      membersByLeague.get(m.league_id)!.push(m.profile_id);
    }
    leagueScopes = ((myMemberships as { league_id: string; leagues: { id: string; name: string } | null }[] | null) ?? [])
      .filter((m) => m.leagues)
      .map((m) => ({
        id: m.leagues!.id,
        name: m.leagues!.name,
        member_ids: membersByLeague.get(m.league_id) ?? [],
      }));
  }

  return (
    <LeaderboardClient
      rows={rows}
      teams={teamList}
      currentUserId={user.id}
      locked={locked}
      leagues={leagueScopes}
    />
  );
}
