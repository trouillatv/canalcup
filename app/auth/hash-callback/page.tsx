"use client";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function HashCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const supabase = createClient();

    async function handleAuth() {
      const code = searchParams.get("code");
      const token_hash = searchParams.get("token_hash");
      const type = (searchParams.get("type") ?? "magiclink") as "magiclink";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let session: any = null;

      if (token_hash) {
        // PKCE admin-generated link: Supabase sends token_hash + type
        const { data, error } = await supabase.auth.verifyOtp({ token_hash, type });
        if (!error) session = data.session;
      } else if (code) {
        // PKCE code (regular flow)
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) session = data.session;
      } else {
        // Implicit flow: tokens in hash fragment (#access_token=...&refresh_token=...)
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");
        if (access_token && refresh_token) {
          const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (!error) session = data.session;
        }
      }

      if (!session?.user?.email) {
        router.replace("/?error=auth_failed");
        return;
      }

      const { data: allowed } = await supabase
        .from("allowlist_users")
        .select("is_active")
        .eq("email", session.user.email)
        .single();

      if (!allowed?.is_active) {
        await supabase.auth.signOut();
        router.replace("/?error=not_allowed");
        return;
      }

      router.replace("/");
    }

    handleAuth();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-canal-black flex flex-col items-center justify-center gap-4">
      <div className="w-8 h-8 border-2 border-canal-yellow border-t-transparent rounded-full animate-spin" />
      <p className="text-canal-gray-muted text-sm">Connexion en cours…</p>
    </div>
  );
}

export default function HashCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-canal-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-canal-yellow border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <HashCallback />
    </Suspense>
  );
}
