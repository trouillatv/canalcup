// /profile — page utilisateur (phase 1).
//
// Édition perso : nom, nom de pronostic, service, niveau foot.
// Read-only : email (édition via flux Supabase à part — commit dédié si
// jamais demandé), équipe Canal Cup (changement = levier admin, pivot
// scoring).
// Rappel pédagogique : pronostics PERSONNELS, pas de groupe dessus.
// Section "Mes groupes par activité" = placeholder phase 2.
//
// Protégée par middleware (auth + profile_completed). La contrainte DB
// users_profile_complete_chk garantit que les champs requis restent
// renseignés tant que profile_completed=true.

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProfileEditForm } from "@/components/profile/ProfileEditForm";
import { UserCircle2, Trophy, Users2, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/");

  const { data: profile } = await supabase
    .from("users")
    .select(
      "id, name, display_name, user_slug, email, service_id, football_level, team_id, team:teams(id, name, color)"
    )
    .eq("auth_id", authUser.id)
    .single();
  if (!profile) redirect("/onboarding");

  const { data: services } = await supabase
    .from("services")
    .select("*")
    .order("name");

  return (
    <div className="px-4 py-4 space-y-5 max-w-md mx-auto">
      <header>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-canal-yellow flex items-center justify-center">
            <span className="text-canal-black font-black text-xl">
              {(profile.display_name ?? profile.name ?? profile.email ?? "?")[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="canal-headline text-2xl truncate">
              {profile.display_name ?? profile.name ?? "Mon profil"}
            </h1>
            <p className="text-canal-gray-muted text-xs truncate">
              {profile.user_slug ? `/u/${profile.user_slug}` : "—"} · {profile.email}
            </p>
          </div>
        </div>
      </header>

      {/* Édition perso */}
      <section className="canal-card space-y-1">
        <p className="text-xs text-canal-yellow font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <UserCircle2 size={14} /> Mes infos
        </p>
        <ProfileEditForm profile={profile} services={services ?? []} />
      </section>

      {/* Équipe Canal Cup — read-only */}
      <section className="canal-card">
        <p className="text-xs text-canal-yellow font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Trophy size={14} /> Mon équipe Canal Cup
        </p>
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(profile as any).team ? (
            <>
              <span
                className="w-3 h-3 rounded-full border border-white/20 shrink-0"
                /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                style={{ backgroundColor: (profile as any).team.color ?? "#888" }}
              />
              <Link
                /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                href={`/teams/${(profile as any).team.id}`}
                className="font-bold text-white hover:text-canal-yellow transition-colors flex-1 truncate"
              >
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(profile as any).team.name}
              </Link>
            </>
          ) : (
            <span className="text-canal-gray-muted text-sm italic">Pas d&apos;équipe</span>
          )}
        </div>
        <p className="text-[11px] text-canal-gray-muted mt-2">
          Changer d&apos;équipe = contacter un admin (impact direct sur le
          classement).
        </p>
      </section>

      {/* Rappel pédagogique */}
      <section className="canal-card border border-canal-yellow/30 bg-canal-yellow/5">
        <p className="text-xs text-canal-yellow font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
          <Sparkles size={14} /> Pronostics personnels
        </p>
        <p className="text-xs text-canal-gray-muted leading-relaxed">
          Tes pronostics sont <span className="text-white font-bold">à toi</span>{" "}
          — pas de groupe au-dessus. Tes points pronos alimentent ton équipe Canal
          Cup, mais tes stats perso (séries, scores exacts) restent
          individuelles.
        </p>
      </section>

      {/* Groupes par activité — placeholder phase 2 */}
      <section className="canal-card">
        <p className="text-xs text-canal-yellow font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Users2 size={14} /> Mes groupes par activité
        </p>
        <p className="text-canal-gray-muted text-sm italic">
          À venir. Certaines activités sont en solo, d&apos;autres en groupe — tu
          verras ici tes groupes et les autres membres. Pour l&apos;instant, seule
          ton équipe Canal Cup compte au classement.
        </p>
      </section>
    </div>
  );
}
