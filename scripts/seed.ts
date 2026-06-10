// Seeds teams + group fixtures + KO placeholders into Supabase using the
// service-role key. Idempotent: safe to re-run.
//
//   npm run seed
//
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedPath = resolve(__dirname, "..", "teams-seed.json");
const seed = JSON.parse(readFileSync(seedPath, "utf-8"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supa = createClient(url, key, { auth: { persistSession: false } });

type SeedTeam = {
  name: string;
  code: string;
  flag: string;
  tier: "S" | "A" | "B" | "C" | "D";
  price: number;
  group: string;
  confederation: string;
  fifa_rank_PLACEHOLDER: number;
  group_opponents: string[];
};

async function upsertTeams() {
  const rows = (seed.teams as SeedTeam[]).map((t) => ({
    name: t.name,
    code: t.code,
    flag: t.flag,
    tier: t.tier,
    price: t.price,
    group_letter: t.group,
    confederation: t.confederation,
    fifa_rank: t.fifa_rank_PLACEHOLDER,
  }));
  const { error } = await supa.from("teams").upsert(rows, { onConflict: "code" });
  if (error) throw error;
  console.log(`✓ teams upserted (${rows.length})`);
}

async function teamIdByCode(): Promise<Map<string, number>> {
  const { data, error } = await supa.from("teams").select("id, code");
  if (error) throw error;
  return new Map(data.map((r) => [r.code, r.id]));
}

// Generate the 6 unique pairings within each group (round-robin: each team
// plays the other three exactly once → 4C2 = 6 matches per group, ×12 = 72).
function groupPairings(): Array<{ group: string; home: string; away: string }> {
  const byGroup = new Map<string, SeedTeam[]>();
  for (const t of seed.teams as SeedTeam[]) {
    if (!byGroup.has(t.group)) byGroup.set(t.group, []);
    byGroup.get(t.group)!.push(t);
  }
  const out: Array<{ group: string; home: string; away: string }> = [];
  for (const [g, teams] of byGroup) {
    teams.sort((a, b) => a.code.localeCompare(b.code));
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        out.push({ group: g, home: teams[i].code, away: teams[j].code });
      }
    }
  }
  return out;
}

async function seedGroupMatches() {
  const codeToId = await teamIdByCode();
  const pairings = groupPairings();
  // Delete-then-insert is simplest for idempotency given no natural unique key.
  // We only delete rows that are still scheduled (no scores yet) to avoid wiping admin data.
  await supa.from("matches").delete().eq("stage", "group").eq("status", "scheduled").is("home_score", null);
  const rows = pairings.map((p) => ({
    stage: "group" as const,
    group_letter: p.group,
    home_team_id: codeToId.get(p.home)!,
    away_team_id: codeToId.get(p.away)!,
    status: "scheduled" as const,
  }));
  const { error } = await supa.from("matches").insert(rows);
  if (error) throw error;
  console.log(`✓ group matches inserted (${rows.length})`);
}

async function seedKnockoutPlaceholders() {
  // Delete existing empty placeholders before re-inserting.
  await supa
    .from("matches")
    .delete()
    .neq("stage", "group")
    .eq("status", "scheduled")
    .is("home_team_id", null)
    .is("away_team_id", null);

  const ko: Array<{ stage: "R32" | "R16" | "QF" | "SF" | "F" | "3P"; slot: string }> = [];
  for (let i = 1; i <= 16; i++) ko.push({ stage: "R32", slot: `R32-${i}` });
  for (let i = 1; i <= 8; i++) ko.push({ stage: "R16", slot: `R16-${i}` });
  for (let i = 1; i <= 4; i++) ko.push({ stage: "QF", slot: `QF-${i}` });
  for (let i = 1; i <= 2; i++) ko.push({ stage: "SF", slot: `SF-${i}` });
  ko.push({ stage: "3P", slot: "3P" });
  ko.push({ stage: "F", slot: "F" });

  const { error } = await supa.from("matches").insert(
    ko.map((k) => ({ stage: k.stage, slot: k.slot, status: "scheduled" as const })),
  );
  if (error) throw error;
  console.log(`✓ knockout placeholders inserted (${ko.length})`);
}

async function seedAdvancementRows() {
  const { data, error } = await supa.from("teams").select("id");
  if (error) throw error;
  const rows = data.map((t) => ({ team_id: t.id, result: "none" as const }));
  const { error: e2 } = await supa.from("team_advancement").upsert(rows, { onConflict: "team_id" });
  if (e2) throw e2;
  console.log(`✓ team_advancement seeded (${rows.length})`);
}

async function main() {
  await upsertTeams();
  await seedAdvancementRows();
  await seedGroupMatches();
  await seedKnockoutPlaceholders();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
