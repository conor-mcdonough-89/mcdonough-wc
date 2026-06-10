"use server";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone, identifierForPhone, isValidE164 } from "@/lib/phone";

export interface SignupInput {
  phone: string;
  password: string;
  full_name: string;
  entry_name: string;
}

export interface SignupResult {
  ok: boolean;
  error?: string;
  // The synthesized email or phone the user can sign in with — passed back so
  // the client can immediately sign in without re-deriving it.
  signin_identifier?: { kind: "phone"; phone: string } | { kind: "email"; email: string };
}

export async function signupPlayer(input: SignupInput): Promise<SignupResult> {
  const full_name = input.full_name.trim();
  const entry_name = input.entry_name.trim();
  if (!full_name) return { ok: false, error: "Full name is required." };
  if (!entry_name) return { ok: false, error: "Entry name is required." };
  if (!input.password || input.password.length < 8)
    return { ok: false, error: "Password must be at least 8 characters." };

  let e164: string;
  try {
    e164 = normalizePhone(input.phone);
    if (!isValidE164(e164)) throw new Error("invalid format");
  } catch (e) {
    return { ok: false, error: `Phone number is invalid: ${e instanceof Error ? e.message : "?"}` };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { ok: false, error: `Server misconfigured: ${e instanceof Error ? e.message : "?"}` };
  }

  const ident = identifierForPhone(e164);
  const createPayload =
    ident.kind === "phone"
      ? { phone: ident.phone, password: input.password, phone_confirm: true as const, user_metadata: { full_name } }
      : { email: ident.email, password: input.password, email_confirm: true as const, user_metadata: { full_name } };

  const { data, error } = await admin.auth.admin.createUser(createPayload);
  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      return { ok: false, error: "An account with that phone number already exists. Sign in instead." };
    }
    return { ok: false, error: error.message };
  }
  if (!data.user) return { ok: false, error: "Account not created. Try again." };

  // Self-signup: user is already 'onboarded' since they chose their name + password.
  const { error: profErr } = await admin.from("profiles").upsert(
    {
      id: data.user.id,
      phone: e164,
      full_name,
      entry_name,
      onboarded: true,
    },
    { onConflict: "id" },
  );
  if (profErr) return { ok: false, error: `profile error: ${profErr.message}` };

  return {
    ok: true,
    signin_identifier:
      ident.kind === "phone" ? { kind: "phone", phone: ident.phone } : { kind: "email", email: ident.email },
  };
}

// Salt to make the temp password generator available to client code that
// wants to suggest something. Not currently used by the signup page; kept
// here so all auth-adjacent helpers live together.
export async function suggestPassword(): Promise<string> {
  return randomBytes(8).toString("base64url").slice(0, 10);
}
