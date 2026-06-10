import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DraftBoard from "./board";
import type { Team } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DraftPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: teams }, { data: settings }, { data: entry }] = await Promise.all([
    supabase.from("teams").select("*").order("tier").order("fifa_rank", { nullsFirst: false }),
    supabase.from("pool_settings").select("status").single(),
    supabase
      .from("entries")
      .select("id, entry_picks(team_id)")
      .eq("profile_id", user.id)
      .maybeSingle(),
  ]);

  const initialPicks: number[] =
    (entry as { entry_picks?: { team_id: number }[] } | null)?.entry_picks?.map((p) => p.team_id) ?? [];

  return (
    <DraftBoard
      teams={(teams as Team[]) ?? []}
      initialPicks={initialPicks}
      locked={settings?.status === "locked"}
    />
  );
}
