"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkRoster } from "@/lib/scoring";
import type { Team } from "@/lib/types";

export async function saveRoster(teamIds: number[]): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  // Hard-stop on lock — RLS also enforces, this is the friendly error.
  const { data: settings } = await supabase.from("pool_settings").select("status").single();
  if (settings?.status === "locked") return { ok: false, error: "Pool is locked." };

  // Re-validate server-side against the canonical teams table.
  const { data: teams, error: teamsErr } = await supabase
    .from("teams")
    .select("id, name, code, flag, tier, price, group_letter, confederation, fifa_rank")
    .in("id", teamIds);
  if (teamsErr) return { ok: false, error: teamsErr.message };
  if (!teams || teams.length !== teamIds.length) return { ok: false, error: "Unknown team in roster." };

  const legality = checkRoster(teams as Team[]);
  if (!legality.ok) return { ok: false, error: legality.errors.join(" ") };

  // Upsert entry (one per profile).
  const { data: existing } = await supabase
    .from("entries")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  let entryId: string;
  if (existing) {
    entryId = existing.id;
    // Touch updated_at by issuing an update.
    await supabase.from("entries").update({}).eq("id", entryId);
  } else {
    const { data: created, error: createErr } = await supabase
      .from("entries")
      .insert({ profile_id: user.id })
      .select("id")
      .single();
    if (createErr || !created) return { ok: false, error: createErr?.message ?? "Could not create entry" };
    entryId = created.id;
  }

  // Replace picks atomically: delete then insert.
  const { error: delErr } = await supabase.from("entry_picks").delete().eq("entry_id", entryId);
  if (delErr) return { ok: false, error: delErr.message };

  const { error: insErr } = await supabase
    .from("entry_picks")
    .insert(teamIds.map((team_id) => ({ entry_id: entryId, team_id })));
  if (insErr) return { ok: false, error: insErr.message };

  revalidatePath("/draft");
  return { ok: true };
}

export async function ensureEntry(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
}
