import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) redirect("/draft");

  return (
    <div>
      <h1 className="text-2xl font-semibold">Admin</h1>
      <p className="mt-2 text-sm text-neutral-600">Coming next.</p>
    </div>
  );
}
