"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { signupPlayer } from "./actions";

export default function SignupPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [entryName, setEntryName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) return setError("Passwords don't match.");

    setSubmitting(true);
    try {
      const res = await signupPlayer({ phone, password, full_name: fullName, entry_name: entryName });
      if (!res.ok || !res.signin_identifier) {
        setError(res.error ?? "Could not create account.");
        return;
      }
      const supabase = createClient();
      const { error: signInErr } =
        res.signin_identifier.kind === "phone"
          ? await supabase.auth.signInWithPassword({ phone: res.signin_identifier.phone, password })
          : await supabase.auth.signInWithPassword({ email: res.signin_identifier.email, password });
      if (signInErr) {
        setError(`Account created, but sign-in failed: ${signInErr.message}. Try the sign-in page.`);
        return;
      }
      router.push("/draft");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Signup failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-10">
      <div className="mb-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="McDonough crest" className="mx-auto h-10 w-10 object-contain" />
        <h1 className="mt-2 text-2xl font-semibold">Create your account</h1>
        <p className="mt-1 text-sm text-neutral-600">For the McDonough World Cup Pool.</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Phone" value={phone} onChange={setPhone} type="tel" placeholder="2039796229" autoComplete="tel" />
        <Field label="Full name" value={fullName} onChange={setFullName} autoComplete="name" />
        <Field
          label="Entry name (shown on leaderboard)"
          value={entryName}
          onChange={setEntryName}
        />
        <Field label="Password" value={password} onChange={setPassword} type="password" autoComplete="new-password" />
        <Field label="Confirm password" value={confirm} onChange={setConfirm} type="password" autoComplete="new-password" />
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-pitch-600 px-4 py-2 font-medium text-white hover:bg-pitch-700 disabled:opacity-50"
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="mt-4 text-center text-xs text-neutral-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-pitch-700 hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder, autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        type={type}
        required
        placeholder={placeholder}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 focus:border-pitch-500 focus:outline-none focus:ring-1 focus:ring-pitch-500"
      />
    </label>
  );
}
