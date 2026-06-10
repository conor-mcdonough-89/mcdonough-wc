import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Match, Team, TeamAdvancement } from "@/lib/types";
import {
  scoreEntry,
  pointsForTeamInMatch,
  advancementMapFromRows,
} from "@/lib/scoring";
import ScoringClient from "./client";

export const dynamic = "force-dynamic";

export default async function ScoringPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: matches }, { data: teams }, { data: settings }, { data: adv }, { data: myEntry }] =
    await Promise.all([
      supabase
        .from("matches")
        .select("*")
        .order("stage")
        .order("kickoff", { nullsFirst: false }),
      supabase.from("teams").select("*"),
      supabase.from("pool_settings").select("final_bonus").single(),
      supabase.from("team_advancement").select("*"),
      supabase
        .from("entries")
        .select("id, entry_picks(team_id)")
        .eq("profile_id", user.id)
        .maybeSingle(),
    ]);

  const matchList = (matches as Match[]) ?? [];
  const teamList = (teams as Team[]) ?? [];
  const finalBase = settings?.final_bonus ?? 8;
  const myTeamIds: number[] =
    (myEntry as { entry_picks?: { team_id: number }[] } | null)?.entry_picks?.map((p) => p.team_id) ?? [];

  const advMap = advancementMapFromRows((adv as TeamAdvancement[]) ?? []);

  // Pre-compute my points per match (server-side; cheap).
  const pointsByMatch: Record<string, number> = {};
  for (const m of matchList) {
    let pts = 0;
    for (const id of myTeamIds) {
      if (m.home_team_id === id || m.away_team_id === id) {
        pts += pointsForTeamInMatch(id, m, finalBase);
      }
    }
    pointsByMatch[m.id] = pts;
  }

  const myScore = scoreEntry(myTeamIds, matchList, advMap, finalBase);

  return (
    <ScoringClient
      matches={matchList}
      teams={teamList}
      myTeamIds={myTeamIds}
      pointsByMatch={pointsByMatch}
      myTotal={myScore.total}
    />
  );
}
