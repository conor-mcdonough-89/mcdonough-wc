import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OnboardingForm from "./form";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, entry_name, onboarded")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");
  if (profile.onboarded) redirect("/draft");

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold">Welcome 👋</h1>
      <p className="mt-2 text-sm text-neutral-600">
        One-time setup. Set a new password and confirm your entry name.
      </p>
      <OnboardingForm
        initialFullName={profile.full_name ?? ""}
        initialEntryName={profile.entry_name ?? ""}
      />
    </main>
  );
}
