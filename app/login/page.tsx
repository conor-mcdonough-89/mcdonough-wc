"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { normalizePhone, identifierForPhone } from "@/lib/phone";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const e164 = normalizePhone(phone);
      const ident = identifierForPhone(e164);
      const supabase = createClient();
      const { error } =
        ident.kind === "phone"
          ? await supabase.auth.signInWithPassword({ phone: ident.phone, password })
          : await supabase.auth.signInWithPassword({ email: ident.email, password });
      if (error) throw error;
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <div className="mb-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="McDonough crest" className="mx-auto h-10 w-10 object-contain" />
        <h1 className="mt-2 text-2xl font-semibold">McDonough World Cup Pool</h1>
        <p className="mt-1 text-sm text-neutral-600">Sign in with your phone and password.</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Phone</span>
          <input
            type="tel"
            required
            autoComplete="tel"
            placeholder="2039796229"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 focus:border-pitch-500 focus:outline-none focus:ring-1 focus:ring-pitch-500"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Password</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 focus:border-pitch-500 focus:outline-none focus:ring-1 focus:ring-pitch-500"
          />
        </label>
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-pitch-600 px-4 py-2 font-medium text-white hover:bg-pitch-700 disabled:opacity-50"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-center text-xs text-neutral-500">
          Accounts are pre-created by the commissioner. Lost your password? Text Conor.
        </p>
      </form>
    </main>
  );
}
