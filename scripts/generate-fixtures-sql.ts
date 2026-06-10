// Parses fixtures-2026.md and emits supabase/fixtures.sql:
//   - UPDATE kickoff/venue for the 72 group matches (matched by unordered team pair)
//   - UPDATE kickoff/venue for the 32 KO placeholders (matched by slot)
// All times are ET (UTC-4 in June/July) → emitted as UTC ISO strings.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const md = readFileSync(resolve(__dirname, "..", "fixtures-2026.md"), "utf-8");

const NAME_TO_CODE: Record<string, string> = {
  "Mexico": "MEX",
  "South Korea": "KOR",
  "Czech Republic": "CZE",
  "South Africa": "RSA",
  "Canada": "CAN",
  "Bosnia & Herzegovina": "BIH",
  "Qatar": "QAT",
  "Switzerland": "SUI",
  "Brazil": "BRA",
  "Morocco": "MAR",
  "Haiti": "HAI",
  "Scotland": "SCO",
  "USA": "USA",
  "Paraguay": "PAR",
  "Australia": "AUS",
  "Türkiye": "TUR",
  "Germany": "GER",
  "Ivory Coast": "CIV",
  "Ecuador": "ECU",
  "Curaçao": "CUW",
  "Netherlands": "NED",
  "Japan": "JPN",
  "Sweden": "SWE",
  "Tunisia": "TUN",
  "Belgium": "BEL",
  "Egypt": "EGY",
  "Iran": "IRN",
  "New Zealand": "NZL",
  "Spain": "ESP",
  "Cape Verde": "CPV",
  "Saudi Arabia": "KSA",
  "Uruguay": "URU",
  "France": "FRA",
  "Senegal": "SEN",
  "Iraq": "IRQ",
  "Norway": "NOR",
  "Argentina": "ARG",
  "Algeria": "ALG",
  "Austria": "AUT",
  "Jordan": "JOR",
  "Portugal": "POR",
  "DR Congo": "COD",
  "Uzbekistan": "UZB",
  "Colombia": "COL",
  "England": "ENG",
  "Croatia": "CRO",
  "Ghana": "GHA",
  "Panama": "PAN",
};

const MONTHS: Record<string, number> = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

// Parse "Thu 11 Jun" → { day: 11, month: 6 }, assuming year 2026.
function parseDate(s: string): { y: number; m: number; d: number } {
  const parts = s.trim().split(/\s+/);
  // ["Thu", "11", "Jun"]
  const day = parseInt(parts[1], 10);
  const month = MONTHS[parts[2]];
  return { y: 2026, m: month, d: day };
}

// Parse "3:00 pm" / "12:00 pm" / "10:00 am" → { h: 0-23, min: 0-59 }
function parseTime(s: string): { h: number; min: number } {
  const m = s.trim().toLowerCase().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
  if (!m) throw new Error(`Bad time: ${s}`);
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const isPm = m[3] === "pm";
  if (h === 12) h = isPm ? 12 : 0;
  else if (isPm) h += 12;
  return { h, min };
}

// ET in June/July is EDT = UTC-4. Add 4h to get UTC.
function toUtcIso(date: { y: number; m: number; d: number }, time: { h: number; min: number }): string {
  const local = new Date(Date.UTC(date.y, date.m - 1, date.d, time.h + 4, time.min, 0));
  return local.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function escSql(s: string): string {
  return s.replace(/'/g, "''");
}

interface GroupFixture {
  date: string;
  match: string;
  group: string;
  venue: string;
  et: string;
}

function parseTableRows(section: string): string[][] {
  const lines = section.split("\n");
  const rows: string[][] = [];
  for (const line of lines) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 2) continue;
    if (cells[0].startsWith("---") || /^date$/i.test(cells[0])) continue;
    rows.push(cells);
  }
  return rows;
}

function extractSection(start: string, end?: string): string {
  const idx = md.indexOf(start);
  if (idx === -1) throw new Error(`Missing section ${start}`);
  const tail = md.slice(idx);
  if (!end) return tail;
  // Search after the start marker so we don't match it as the terminator.
  const endIdx = tail.indexOf(end, start.length);
  if (endIdx === -1) return tail;
  return tail.slice(0, endIdx);
}

const groupFixtures: GroupFixture[] = [];
for (const md of ["Matchday 1", "Matchday 2", "Matchday 3"]) {
  const section = extractSection(`### ${md}`, "###");
  for (const cells of parseTableRows(section)) {
    if (cells.length < 5) continue;
    const [date, match, group, venue, et] = cells;
    groupFixtures.push({ date, match, group, venue, et });
  }
}

interface KoFixture {
  slot: string;
  date: string;
  venue: string;
  et?: string;
}
const koFixtures: KoFixture[] = [];

// R32 — Match | Date | Fixture | Venue (no ET)
{
  const section = extractSection("### Round of 32", "### Round of 16");
  for (const cells of parseTableRows(section)) {
    if (cells.length < 4) continue;
    const [slot, date, , venue] = cells;
    if (!/^R32-M\d+$/.test(slot)) continue;
    koFixtures.push({ slot, date, venue: venue === "TBD" ? "" : venue });
  }
}
// R16
{
  const section = extractSection("### Round of 16", "### Quarter-Finals");
  for (const cells of parseTableRows(section)) {
    if (cells.length < 4) continue;
    const [slot, date, , venue] = cells;
    if (!/^R16-M\d+$/.test(slot)) continue;
    koFixtures.push({ slot, date, venue });
  }
}
// QF
{
  const section = extractSection("### Quarter-Finals", "### Semi-Finals");
  for (const cells of parseTableRows(section)) {
    if (cells.length < 4) continue;
    const [slot, date, , venue] = cells;
    if (!/^QF-\d+$/.test(slot)) continue;
    koFixtures.push({ slot, date, venue });
  }
}
// SF
{
  const section = extractSection("### Semi-Finals", "### Third-Place");
  for (const cells of parseTableRows(section)) {
    if (cells.length < 4) continue;
    const [slot, date, , venue] = cells;
    if (!/^SF-\d+$/.test(slot)) continue;
    koFixtures.push({ slot, date, venue });
  }
}
// 3P + Final (the section uses **bold** markup for Final; the table row exists)
{
  const section = extractSection("### Third-Place Play-Off & Final");
  for (const cells of parseTableRows(section)) {
    if (cells.length < 4) continue;
    const [slot, date, , venue, et] = cells;
    const cleaned = slot.replace(/\*/g, "").trim();
    let outSlot: string;
    if (/^3rd Place$/i.test(cleaned)) outSlot = "3P";
    else if (/^Final$/i.test(cleaned)) outSlot = "F";
    else continue;
    const cleanDate = date.replace(/\*/g, "").trim();
    const cleanVenue = venue.replace(/\*/g, "").trim();
    const cleanEt = (et ?? "").replace(/\*/g, "").trim();
    koFixtures.push({ slot: outSlot, date: cleanDate, venue: cleanVenue, et: cleanEt });
  }
}

// --- Emit SQL ---------------------------------------------------------
const lines: string[] = [];
lines.push("-- Auto-generated from fixtures-2026.md. Idempotent: re-runnable.");
lines.push("-- Run AFTER schema.sql and seed.sql.");
lines.push("-- All kickoff times are ET (EDT, UTC-4 during June/July) converted to UTC.");
lines.push("-- R32/R16/QF/SF times default to 12:00 ET (just to anchor the date); refine in Admin.");
lines.push("");
lines.push("begin;");
lines.push("");

// Group matches
lines.push("-- ===== Group matches =====");
let groupCount = 0;
for (const f of groupFixtures) {
  const teamNames = f.match.split(" vs ").map((s) => s.trim());
  if (teamNames.length !== 2) {
    console.warn(`Skipping malformed fixture row: ${f.match}`);
    continue;
  }
  const code1 = NAME_TO_CODE[teamNames[0]];
  const code2 = NAME_TO_CODE[teamNames[1]];
  if (!code1 || !code2) {
    console.warn(`Unknown team in: ${f.match}`);
    continue;
  }
  const d = parseDate(f.date);
  const t = parseTime(f.et);
  const iso = toUtcIso(d, t);
  lines.push(
    `update public.matches set kickoff = '${iso}', venue = '${escSql(f.venue)}' where stage = 'group' and group_letter = '${f.group}' and (` +
      `(home_team_id = (select id from public.teams where code='${code1}') and away_team_id = (select id from public.teams where code='${code2}')) or ` +
      `(home_team_id = (select id from public.teams where code='${code2}') and away_team_id = (select id from public.teams where code='${code1}'))` +
      `);`,
  );
  groupCount++;
}
lines.push("");

// KO matches
lines.push("-- ===== Knockout placeholders =====");
let koCount = 0;
for (const k of koFixtures) {
  const d = parseDate(k.date);
  const t = k.et ? parseTime(k.et) : { h: 12, min: 0 };
  const iso = toUtcIso(d, t);
  const dbSlot = k.slot
    .replace(/^R32-M/, "R32-")
    .replace(/^R16-M/, "R16-");
  const venueSet = k.venue ? `, venue = '${escSql(k.venue)}'` : "";
  lines.push(
    `update public.matches set kickoff = '${iso}'${venueSet} where slot = '${dbSlot}';`,
  );
  koCount++;
}
lines.push("");
lines.push("commit;");
lines.push("");
lines.push(`-- Group updates: ${groupCount} of 72`);
lines.push(`-- KO updates:    ${koCount} of 32`);

writeFileSync(resolve(__dirname, "..", "supabase", "fixtures.sql"), lines.join("\n"));
console.log(`Wrote supabase/fixtures.sql  (group: ${groupCount}/72, ko: ${koCount}/32)`);
