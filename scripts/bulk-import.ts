// Bulk-create players from a CSV: `phone, full_name [, entry_name]`.
//
//   npm run bulk-import -- path/to/players.csv
//
// Uses the Supabase admin API with the service-role key. Auto-generates
// temp passwords, creates pre-confirmed accounts (no SMS sent), inserts
// profiles rows, and prints the phone → temp-password list for invites.

import { createClient, type User } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import "dotenv/config";
import { normalizePhone, identifierForPhone, USE_PHONE_PROVIDER } from "../lib/phone.js";

const csvPath = process.argv[2];
if (!csvPath) {
  console.error("Usage: npm run bulk-import -- path/to/players.csv");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supa = createClient(url, key, { auth: { persistSession: false } });

type Row = { phone: string; full_name: string; entry_name?: string };

function parseCsv(text: string): Row[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  // Optional header row
  const first = lines[0].toLowerCase();
  const startIdx = first.includes("phone") && first.includes("name") ? 1 : 0;
  const rows: Row[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const parts = lines[i].split(",").map((p) => p.trim());
    if (parts.length < 2) {
      console.warn(`Skipping malformed line ${i + 1}: ${lines[i]}`);
      continue;
    }
    rows.push({ phone: parts[0], full_name: parts[1], entry_name: parts[2] || undefined });
  }
  return rows;
}

function genPassword(): string {
  // Word-friendly: 10 char base32-ish. Short enough to type, random enough.
  return randomBytes(8).toString("base64url").slice(0, 10);
}

async function importOne(row: Row): Promise<{ phone: string; password: string; status: string }> {
  const e164 = normalizePhone(row.phone);
  const ident = identifierForPhone(e164);
  const password = genPassword();

  const createPayload =
    ident.kind === "phone"
      ? { phone: ident.phone, password, phone_confirm: true as const, user_metadata: { full_name: row.full_name } }
      : { email: ident.email, password, email_confirm: true as const, user_metadata: { full_name: row.full_name } };

  const { data, error } = await supa.auth.admin.createUser(createPayload);

  let user: User | null = data?.user ?? null;
  if (error) {
    const msg = (error.message || "").toLowerCase();
    if (msg.includes("already") || msg.includes("registered")) {
      // Already exists — look it up by phone via listUsers (paginated).
      user = await findUserByPhone(e164);
      if (!user) {
        return { phone: e164, password: "", status: `exists but not found: ${error.message}` };
      }
      return { phone: e164, password: "", status: "already existed (skipped)" };
    }
    return { phone: e164, password: "", status: `error: ${error.message}` };
  }

  if (!user) return { phone: e164, password: "", status: "no user returned" };

  const { error: profErr } = await supa.from("profiles").upsert(
    {
      id: user.id,
      phone: e164,
      full_name: row.full_name,
      entry_name: row.entry_name ?? null,
      onboarded: false,
    },
    { onConflict: "id" },
  );
  if (profErr) return { phone: e164, password, status: `profile error: ${profErr.message}` };

  return { phone: e164, password, status: "created" };
}

async function findUserByPhone(e164: string): Promise<User | null> {
  // Supabase admin.listUsers is paginated (default 50/page). 16 players → trivially one page.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supa.auth.admin.listUsers({ page, perPage: 100 });
    if (error) return null;
    const u = data.users.find((u) => u.phone === e164.replace("+", "") || u.phone === e164);
    if (u) return u;
    if (data.users.length < 100) break;
  }
  return null;
}

async function main() {
  const text = readFileSync(csvPath, "utf-8");
  const rows = parseCsv(text);
  if (rows.length === 0) {
    console.error("No rows parsed from CSV.");
    process.exit(1);
  }
  console.log(
    `Importing ${rows.length} players (auth identifier: ${USE_PHONE_PROVIDER ? "phone" : "synthesized email"})…\n`,
  );

  const results: Array<{ phone: string; password: string; status: string; name: string }> = [];
  for (const r of rows) {
    const res = await importOne(r);
    results.push({ ...res, name: r.full_name });
    console.log(`  ${res.phone}  ${res.status}${res.password ? "  →  " + res.password : ""}`);
  }

  console.log("\n--- Invite list (copy/paste) ---");
  for (const r of results.filter((r) => r.password)) {
    console.log(`${r.name}\t${r.phone}\t${r.password}`);
  }
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
