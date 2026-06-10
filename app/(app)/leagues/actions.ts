"use server";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import type { League } from "@/lib/types";

// Alphabet avoids confusable glyphs.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateCode(len = 6): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

export async function createLeague(
  name: string,
): Promise<{ ok: true; league: League } | { ok: false; error: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name is required." };
  if (trimmed.length > 60) return { ok: false, error: "Name is too long." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Atomic create + first-member insert via SECURITY DEFINER function. Retry
  // on the off-chance of a unique-code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const { data: leagueId, error } = await supabase.rpc("create_league", {
      p_name: trimmed,
      p_code: code,
    });
    if (!error && leagueId) {
      revalidatePath("/draft");
      revalidatePath("/leaderboard");
      return {
        ok: true,
        league: {
          id: leagueId as unknown as string,
          name: trimmed,
          invite_code: code,
          created_by: user.id,
          created_at: new Date().toISOString(),
        },
      };
    }
    if (error && !/duplicate|unique/i.test(error.message)) {
      return { ok: false, error: error.message };
    }
  }
  return { ok: false, error: "Could not generate a unique code. Try again." };
}

export async function joinLeague(
  code: string,
): Promise<{ ok: true; league: { id: string; name: string } } | { ok: false; error: string }> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { ok: false, error: "Code is required." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data, error } = await supabase.rpc("join_league", { p_code: normalized });
  if (error) return { ok: false, error: error.message };

  // RPC returns SETOF (id, name) — supabase-js gives us an array.
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id) return { ok: false, error: "No league found for that code." };

  revalidatePath("/draft");
  revalidatePath("/leaderboard");
  return { ok: true, league: { id: row.id as string, name: (row.name as string) ?? "" } };
}

export async function leaveLeague(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("league_members")
    .delete()
    .eq("league_id", id)
    .eq("profile_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/draft");
  revalidatePath("/leaderboard");
  return { ok: true };
}
