import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(resolve(__dirname, "..", "teams-seed.json"), "utf-8"));

type SeedTeam = {
  name: string; code: string; flag: string;
  tier: "S"|"A"|"B"|"C"|"D";
  price: number; group: string; confederation: string;
  fifa_rank_PLACEHOLDER: number; group_opponents: string[];
};

const esc = (s: string) => s.replace(/'/g, "''");

const lines: string[] = [];
lines.push("-- Auto-generated from teams-seed.json. Idempotent: safe to re-run.");
lines.push("-- Run AFTER schema.sql.");
lines.push("");

// Teams: upsert
lines.push("-- ===== Teams =====");
lines.push("insert into public.teams (name, code, flag, tier, price, group_letter, confederation, fifa_rank) values");
const teamRows = (seed.teams as SeedTeam[]).map((t) =>
  `  ('${esc(t.name)}', '${t.code}', '${t.flag}', '${t.tier}', ${t.price}, '${t.group}', '${t.confederation}', ${t.fifa_rank_PLACEHOLDER})`,
);
lines.push(teamRows.join(",\n") + "\non conflict (code) do update set\n  name = excluded.name,\n  flag = excluded.flag,\n  tier = excluded.tier,\n  price = excluded.price,\n  group_letter = excluded.group_letter,\n  confederation = excluded.confederation,\n  fifa_rank = excluded.fifa_rank;");
lines.push("");

// team_advancement seed for every team
lines.push("-- ===== team_advancement (defaults) =====");
lines.push("insert into public.team_advancement (team_id, result)");
lines.push("select id, 'none' from public.teams");
lines.push("on conflict (team_id) do nothing;");
lines.push("");

// Group matches: delete-then-insert (only scheduled, no scores)
lines.push("-- ===== Group matches (72) =====");
lines.push("delete from public.matches where stage = 'group' and status = 'scheduled' and home_score is null;");
lines.push("");

const byGroup = new Map<string, SeedTeam[]>();
for (const t of seed.teams as SeedTeam[]) {
  if (!byGroup.has(t.group)) byGroup.set(t.group, []);
  byGroup.get(t.group)!.push(t);
}
const pairings: Array<{ group: string; home: string; away: string }> = [];
for (const [g, ts] of byGroup) {
  ts.sort((a, b) => a.code.localeCompare(b.code));
  for (let i = 0; i < ts.length; i++)
    for (let j = i + 1; j < ts.length; j++)
      pairings.push({ group: g, home: ts[i].code, away: ts[j].code });
}

lines.push("insert into public.matches (stage, group_letter, home_team_id, away_team_id, status) values");
const matchRows = pairings.map(
  (p) =>
    `  ('group', '${p.group}', (select id from public.teams where code='${p.home}'), (select id from public.teams where code='${p.away}'), 'scheduled')`,
);
lines.push(matchRows.join(",\n") + ";");
lines.push("");

// KO placeholders
lines.push("-- ===== Knockout placeholders (32) =====");
lines.push("delete from public.matches where stage <> 'group' and status = 'scheduled' and home_team_id is null and away_team_id is null;");
lines.push("");
const ko: Array<{ stage: string; slot: string }> = [];
for (let i = 1; i <= 16; i++) ko.push({ stage: "R32", slot: `R32-${i}` });
for (let i = 1; i <= 8; i++) ko.push({ stage: "R16", slot: `R16-${i}` });
for (let i = 1; i <= 4; i++) ko.push({ stage: "QF", slot: `QF-${i}` });
for (let i = 1; i <= 2; i++) ko.push({ stage: "SF", slot: `SF-${i}` });
ko.push({ stage: "3P", slot: "3P" });
ko.push({ stage: "F", slot: "F" });

lines.push("insert into public.matches (stage, slot, status) values");
lines.push(ko.map((k) => `  ('${k.stage}', '${k.slot}', 'scheduled')`).join(",\n") + ";");
lines.push("");

writeFileSync(resolve(__dirname, "..", "supabase", "seed.sql"), lines.join("\n"));
console.log("Wrote supabase/seed.sql");
