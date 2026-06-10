// Single helper that owns the phone → auth-identifier mapping.
// If the phone provider can't be enabled in Supabase, switch USE_PHONE_PROVIDER to false
// and accounts will be created with synthesized emails `${digits}@mcdpool.local` instead.
// The UX stays phone-only either way.

export const USE_PHONE_PROVIDER = false;

export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (input.trim().startsWith("+")) return `+${digits}`;
  throw new Error(`Cannot normalize phone "${input}" to E.164`);
}

export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}

export type AuthIdentifier =
  | { kind: "phone"; phone: string }
  | { kind: "email"; email: string; phone: string };

export function identifierForPhone(e164: string): AuthIdentifier {
  if (USE_PHONE_PROVIDER) return { kind: "phone", phone: e164 };
  const digits = e164.replace(/\D/g, "");
  return { kind: "email", email: `${digits}@mcdpool.local`, phone: e164 };
}
