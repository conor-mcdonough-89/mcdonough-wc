"use server";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { createClient as createServer } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone, identifierForPhone, isValidE164 } from "@/lib/phone";
import { computeAdvancement } from "@/lib/scoring";
import type { Match, Team, TeamAdvancement, AdvancementResult, PoolStatus } from "@/lib/types";

async function requireAdmin() {
  const supabase = await createServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) throw new Error("Forbidden");
  return { supabase, user };
}

// --- Lock toggle --------------------------------------------------------
export async function setPoolStatus(status: PoolStatus): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const { error } = await admin.from("pool_settings").update({ status }).eq("id", 1);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin");
    revalidatePath("/draft");
    revalidatePath("/leaderboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function setFinalBonus(value: number): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    if (!Number.isInteger(value) || value < 0 || value > 100) return { ok: false, error: "Invalid value" };
    const admin = createAdminClient();
    const { error } = await admin.from("pool_settings").update({ final_bonus: value }).eq("id", 1);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

// --- Add players --------------------------------------------------------
export interface AddPlayerInput {
  phone: string;
  full_name: string;
  entry_name?: string;
}
export interface AddPlayerResult {
  phone: string;
  name: string;
  status: string;
  password?: string;
}

export async function addPlayers(rows: AddPlayerInput[]): Promise<AddPlayerResult[]> {
  try {
    await requireAdmin();
  } catch (e) {
    return rows.map((r) => ({
      phone: r.phone,
      name: r.full_name,
      status: `forbidden: ${e instanceof Error ? e.message : "not admin"}`,
    }));
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return rows.map((r) => ({
      phone: r.phone,
      name: r.full_name,
      status: `config error: ${e instanceof Error ? e.message : "no admin client"}`,
    }));
  }

  const out: AddPlayerResult[] = [];

  for (const row of rows) {
    let e164: string;
    try {
      e164 = normalizePhone(row.phone);
      if (!isValidE164(e164)) throw new Error("invalid E.164");
    } catch (err) {
      out.push({ phone: row.phone, name: row.full_name, status: `bad phone: ${err instanceof Error ? err.message : "?"}` });
      continue;
    }

    const password = randomBytes(8).toString("base64url").slice(0, 10);
    const ident = identifierForPhone(e164);
    const createPayload =
      ident.kind === "phone"
        ? { phone: ident.phone, password, phone_confirm: true as const, user_metadata: { full_name: row.full_name } }
        : { email: ident.email, password, email_confirm: true as const, user_metadata: { full_name: row.full_name } };

    const { data, error } = await admin.auth.admin.createUser(createPayload);
    if (error) {
      out.push({ phone: e164, name: row.full_name, status: error.message });
      continue;
    }
    const user = data.user;
    if (!user) {
      out.push({ phone: e164, name: row.full_name, status: "no user returned" });
      continue;
    }

    const { error: profErr } = await admin.from("profiles").upsert(
      {
        id: user.id,
        phone: e164,
        full_name: row.full_name,
        entry_name: row.entry_name ?? null,
        onboarded: false,
      },
      { onConflict: "id" },
    );
    if (profErr) {
      out.push({ phone: e164, name: row.full_name, status: `profile error: ${profErr.message}` });
      continue;
    }
    out.push({ phone: e164, name: row.full_name, status: "created", password });
  }

  revalidatePath("/admin");
  return out;
}

// --- Edit team price / tier / rank -------------------------------------
export async function updateTeam(
  id: number,
  patch: { price?: number; tier?: Team["tier"]; fifa_rank?: number | null },
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const { error } = await admin.from("teams").update(patch).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin");
    revalidatePath("/draft");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

// --- Match result -------------------------------------------------------
export interface MatchPatch {
  home_team_id?: number | null;
  away_team_id?: number | null;
  home_score?: number | null;
  away_score?: number | null;
  went_to_penalties?: boolean;
  penalty_winner_team_id?: number | null;
  status?: "scheduled" | "final";
  kickoff?: string | null;
  venue?: string | null;
}

export async function updateMatch(id: string, patch: MatchPatch): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const { error } = await admin.from("matches").update(patch).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin");
    revalidatePath("/scoring");
    revalidatePath("/leaderboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

// --- Team advancement ---------------------------------------------------
export async function setAdvancement(
  teamId: number,
  result: AdvancementResult,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const { error } = await admin
      .from("team_advancement")
      .upsert({ team_id: teamId, result }, { onConflict: "team_id" });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin");
    revalidatePath("/leaderboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

// Recompute advancement from final group matches (overwrites any prior values).
export async function recomputeAdvancement(): Promise<{ ok: boolean; error?: string; updated?: number }> {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const [{ data: teams }, { data: matches }] = await Promise.all([
      admin.from("teams").select("*"),
      admin.from("matches").select("*").eq("stage", "group"),
    ]);
    const map = computeAdvancement((teams as Team[]) ?? [], (matches as Match[]) ?? []);
    const rows = Array.from(map.entries()).map(([team_id, result]) => ({ team_id, result }));
    const { error } = await admin.from("team_advancement").upsert(rows, { onConflict: "team_id" });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin");
    revalidatePath("/leaderboard");
    return { ok: true, updated: rows.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

// Re-exported for symmetry — scoring is computed on read (no cached state),
// so this just busts the relevant route caches.
export async function recomputeScores(): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    revalidatePath("/scoring");
    revalidatePath("/leaderboard");
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

// Used by the lookup-friendly UI of the advancement section.
export async function fetchAdvancementSnapshot(): Promise<{
  teams: Team[];
  current: TeamAdvancement[];
  suggested: Record<number, AdvancementResult>;
}> {
  await requireAdmin();
  const admin = createAdminClient();
  const [{ data: teams }, { data: matches }, { data: adv }] = await Promise.all([
    admin.from("teams").select("*"),
    admin.from("matches").select("*").eq("stage", "group"),
    admin.from("team_advancement").select("*"),
  ]);
  const suggested = computeAdvancement((teams as Team[]) ?? [], (matches as Match[]) ?? []);
  return {
    teams: (teams as Team[]) ?? [],
    current: (adv as TeamAdvancement[]) ?? [],
    suggested: Object.fromEntries(suggested),
  };
}
