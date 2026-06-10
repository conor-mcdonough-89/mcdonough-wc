"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function OnboardingForm({
  initialFullName,
  initialEntryName,
}: {
  initialFullName: string;
  initialEntryName: string;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialFullName);
  const [entryName, setEntryName] = useState(initialEntryName);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    if (!fullName.trim()) return setError("Full name is required.");
    if (!entryName.trim()) return setError("Entry name is required.");

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error: pwErr } = await supabase.auth.updateUser({ password });
      if (pwErr) throw pwErr;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const { error: profErr } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          entry_name: entryName.trim(),
          onboarded: true,
        })
        .eq("id", user.id);
      if (profErr) throw profErr;

      router.push("/draft");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not complete setup");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <label className="block">
        <span className="text-sm font-medium">Full name</span>
        <input
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Entry name (shown on leaderboard)</span>
        <input
          required
          value={entryName}
          onChange={(e) => setEntryName(e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">New password</span>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Confirm password</span>
        <input
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
        />
      </label>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-pitch-600 px-4 py-2 font-medium text-white hover:bg-pitch-700 disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Save & continue"}
      </button>
    </form>
  );
}
