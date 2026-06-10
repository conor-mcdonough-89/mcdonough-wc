// Re-tier teams per the user's revised assignment. Pricing stays at v2:
// S=43, A=29, B=17, C=9, D=4. Updates teams-seed.json in place and emits
// supabase/tiers-v3.sql for migrating an existing project.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedPath = resolve(__dirname, "..", "teams-seed.json");
const seed = JSON.parse(readFileSync(seedPath, "utf-8"));

const NAME_TO_CODE: Record<string, string> = {
  "Spain": "ESP", "France": "FRA", "England": "ENG",
  "Portugal": "POR", "Brazil": "BRA", "Argentina": "ARG", "Germany": "GER", "Netherlands": "NED", "Belgium": "BEL",
  "Norway": "NOR", "Colombia": "COL", "Japan": "JPN", "Morocco": "MAR", "Mexico": "MEX", "USA": "USA",
  "Uruguay": "URU", "Croatia": "CRO", "Switzerland": "SUI", "Türkiye": "TUR", "Ecuador": "ECU", "Austria": "AUT",
  "Ivory Coast": "CIV", "Sweden": "SWE", "Canada": "CAN", "Senegal": "SEN", "Scotland": "SCO", "Paraguay": "PAR",
  "Algeria": "ALG", "Egypt": "EGY", "Czechia": "CZE", "Ghana": "GHA", "Bosnia & Herzegovina": "BIH", "South Korea": "KOR",
  "Iran": "IRN", "Tunisia": "TUN", "Australia": "AUS", "DR Congo": "COD", "Cape Verde": "CPV", "Uzbekistan": "UZB",
  "Panama": "PAN", "Haiti": "HAI", "Curaçao": "CUW", "Iraq": "IRQ", "Jordan": "JOR", "Qatar": "QAT",
  "Saudi Arabia": "KSA", "New Zealand": "NZL", "South Africa": "RSA",
};

const NEW_TIERS: Record<"S" | "A" | "B" | "C" | "D", string[]> = {
  S: ["Spain", "France", "England"],
  A: ["Portugal", "Brazil", "Argentina", "Germany", "Netherlands", "Belgium"],
  B: ["Norway", "Colombia", "Japan", "Morocco", "Mexico", "USA", "Uruguay", "Croatia", "Switzerland", "Türkiye", "Ecuador", "Austria"],
  C: ["Ivory Coast", "Sweden", "Canada", "Senegal", "Scotland", "Paraguay", "Algeria", "Egypt", "Czechia", "Ghana", "Bosnia & Herzegovina", "South Korea"],
  D: ["Iran", "Tunisia", "Australia", "DR Congo", "Cape Verde", "Uzbekistan", "Panama", "Haiti", "Curaçao", "Iraq", "Jordan", "Qatar", "Saudi Arabia", "New Zealand", "South Africa"],
};

const PRICES = { S: 43, A: 29, B: 17, C: 9, D: 4 } as const;

// Validate: counts and total coverage.
const counts = Object.fromEntries(Object.entries(NEW_TIERS).map(([k, v]) => [k, v.length]));
const total = Object.values(counts).reduce((a, b) => a + b, 0);
if (total !== 48) throw new Error(`Expected 48 teams, got ${total}`);

const codeToTier = new Map<string, "S" | "A" | "B" | "C" | "D">();
for (const [tier, names] of Object.entries(NEW_TIERS) as [keyof typeof NEW_TIERS, string[]][]) {
  for (const n of names) {
    const code = NAME_TO_CODE[n];
    if (!code) throw new Error(`Unmapped team name: ${n}`);
    if (codeToTier.has(code)) throw new Error(`Duplicate: ${n}`);
    codeToTier.set(code, tier);
  }
}

// Apply to seed.
let updated = 0;
type Team = { name: string; code: string; tier: string; price: number };
for (const t of seed.teams as Team[]) {
  const newTier = codeToTier.get(t.code);
  if (!newTier) throw new Error(`Team ${t.code} not in new tier list`);
  if (t.tier !== newTier || t.price !== PRICES[newTier]) {
    t.tier = newTier;
    t.price = PRICES[newTier];
    updated++;
  }
}
seed.tier_prices = PRICES;
writeFileSync(seedPath, JSON.stringify(seed, null, 2) + "\n");
console.log(`Updated ${updated} teams in teams-seed.json`);

// Emit a migration SQL for an existing Supabase project.
const lines: string[] = [];
lines.push("-- Re-tier teams per the v3 tier assignment. Idempotent.");
lines.push("-- Pricing unchanged from rulebook v2: S=43, A=29, B=17, C=9, D=4.");
lines.push("");
lines.push("begin;");
for (const [code, tier] of codeToTier) {
  lines.push(`update public.teams set tier = '${tier}', price = ${PRICES[tier]} where code = '${code}';`);
}
lines.push("commit;");
lines.push("");

writeFileSync(resolve(__dirname, "..", "supabase", "tiers-v3.sql"), lines.join("\n"));
console.log(`Wrote supabase/tiers-v3.sql (${codeToTier.size} updates)`);
