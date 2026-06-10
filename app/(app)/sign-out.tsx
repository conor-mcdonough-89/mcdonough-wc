"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await createClient().auth.signOut();
        router.push("/login");
        router.refresh();
      }}
      className="ml-2 rounded-md px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-800"
    >
      Sign out
    </button>
  );
}
