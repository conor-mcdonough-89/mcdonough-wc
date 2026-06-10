import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Match, Team, TeamAdvancement, PoolSettings } from "@/lib/types";
import AdminClient from "./client";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) redirect("/draft");

  const [{ data: settings }, { data: teams }, { data: matches }, { data: adv }, { data: entries }, { data: profiles }] =
    await Promise.all([
      supabase.from("pool_settings").select("*").single(),
      supabase.from("teams").select("*").order("tier").order("fifa_rank", { nullsFirst: false }),
      supabase
        .from("matches")
        .select("*")
        .order("stage")
        .order("kickoff", { nullsFirst: false }),
      supabase.from("team_advancement").select("*"),
      supabase.from("entries").select("id, profile_id, entry_picks(team_id)"),
      supabase.from("profiles").select("id, phone, full_name, entry_name, is_admin, onboarded"),
    ]);

  return (
    <AdminClient
      settings={settings as PoolSettings}
      teams={(teams as Team[]) ?? []}
      matches={(matches as Match[]) ?? []}
      advancement={(adv as TeamAdvancement[]) ?? []}
      entries={
        (entries as { id: string; profile_id: string; entry_picks: { team_id: number }[] }[] | null) ?? []
      }
      profiles={
        (profiles as {
          id: string;
          phone: string;
          full_name: string | null;
          entry_name: string | null;
          is_admin: boolean;
          onboarded: boolean;
        }[] | null) ?? []
      }
    />
  );
}
