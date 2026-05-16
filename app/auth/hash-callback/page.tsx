"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Handles magic links generated server-side (admin generateLink).
// Supabase redirects here with hash tokens (#access_token=...) instead of ?code=.
// The browser Supabase client detects the hash and fires SIGNED_IN.
export default function HashCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event !== "SIGNED_IN" || !session?.user?.email) return;

        const email = session.user.email;

        const { data: allowed } = await supabase
          .from("allowlist_users")
          .select("is_active")
          .eq("email", email)
          .single();

        if (!allowed?.is_active) {
          await supabase.auth.signOut();
          router.replace("/login?error=not_allowed");
          return;
        }

        router.replace("/");
      }
    );

    const timeout = setTimeout(() => {
      router.replace("/login?error=auth_failed");
    }, 10000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-canal-black flex flex-col items-center justify-center gap-4">
      <div className="w-8 h-8 border-2 border-canal-yellow border-t-transparent rounded-full animate-spin" />
      <p className="text-canal-gray-muted text-sm">Connexion en cours…</p>
    </div>
  );
}
