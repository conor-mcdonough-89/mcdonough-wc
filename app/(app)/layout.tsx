import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./sign-out";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, entry_name, full_name, is_admin, onboarded")
    .eq("id", user.id)
    .single();

  if (!profile) {
    // No profile row — something went wrong during provisioning. Bail to login.
    redirect("/login");
  }

  if (!profile.onboarded) redirect("/onboarding");

  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="McDonough crest" className="h-6 w-6 object-contain" />
            <span className="hidden sm:inline">McDonough World Cup Pool</span>
            <span className="sm:hidden">McD WC Pool</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <NavLink href="/draft">Draft</NavLink>
            <NavLink href="/scoring">Scoring</NavLink>
            <NavLink href="/leaderboard">Leaderboard</NavLink>
            <NavLink href="/rules">Rules</NavLink>
            {profile.is_admin && <NavLink href="/admin">Admin</NavLink>}
            <SignOutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-1.5 text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
    >
      {children}
    </Link>
  );
}
