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
import { TeamCaptainPanel } from "@/components/teams/TeamCaptainPanel";
import { UserCircle2, Trophy, Users2, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/");

  const { data: profile } = await supabase
    .from("users")
    .select(
      "id, name, display_name, user_slug, email, service_id, football_level, team_id, team:teams(id, name)"
    )
    .eq("auth_id", authUser.id)
    .single();
  if (!profile) redirect("/onboarding");

  const { data: services } = await supabase
    .from("services")
    .select("*")
    .order("name");

  // Mes participations de groupe (phase 2.C). On lit via la table de
  // jointure → entry → challenge + tous les co-participants. Filtre
  // client-side : on n'affiche que les groupes (>1 participant) ; les
  // entries solo n'ont pas leur place dans "Mes groupes par activité".
  const { data: myParticipationsRaw } = await supabase
    .from("challenge_entry_participants")
    .select(
      `entry:challenge_entries(
        id, status, points_awarded, title,
        challenge:challenges(id, title, emoji, allows_group),
        members:challenge_entry_participants(
          user_id,
          user:users(id, display_name, name)
        )
      )`
    )
    .eq("user_id", profile.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const myGroups: any[] = ((myParticipationsRaw ?? []) as any[])
    .map((row) => row.entry)
    .filter((e) => e && (e.members?.length ?? 0) > 1);

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

      {/* Panneau Captain — visible UNIQUEMENT pour les créateurs d'équipe.
          Affiche les équipes créées, le code/lien d'invitation à partager,
          le nb de places restantes, et les demandes pending à valider. */}
      <TeamCaptainPanel />

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

      {/* Groupes par activité (phase 2.C) */}
      <section className="canal-card">
        <p className="text-xs text-canal-yellow font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Users2 size={14} /> Mes groupes par activité
        </p>
        {myGroups.length === 0 ? (
          <p className="text-canal-gray-muted text-sm italic">
            Pas (encore) de groupe. Quand tu participeras à une animation
            collective, tu verras ici tes co-équipiers et le statut de la
            participation.
          </p>
        ) : (
          <div className="space-y-2">
            {myGroups.map((g) => {
              const others = (g.members ?? []).filter(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (m: any) => m.user_id !== profile.id
              );
              const statusLabel =
                g.status === "approved"
                  ? "Validé"
                  : g.status === "pending"
                    ? "En attente"
                    : "Masqué";
              const statusCls =
                g.status === "approved"
                  ? "text-green-400 bg-green-900/30"
                  : g.status === "pending"
                    ? "text-canal-yellow bg-canal-yellow/10"
                    : "text-canal-gray-muted bg-canal-gray-mid";
              return (
                <div
                  key={g.id}
                  className="bg-canal-gray-mid rounded-xl px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-white text-sm flex items-center gap-1.5 truncate">
                      <span className="text-base">{g.challenge?.emoji ?? "🎉"}</span>
                      <span className="truncate">
                        {g.challenge?.title ?? "Activité"}
                      </span>
                    </p>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 ${statusCls}`}
                    >
                      {statusLabel}
                    </span>
                  </div>
                  {g.title && (
                    <p className="text-xs text-canal-gray-muted truncate mt-0.5">
                      {g.title}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    <span className="text-[11px] text-canal-gray-muted mr-1">
                      Avec
                    </span>
                    {others.length === 0 ? (
                      <span className="text-[11px] italic text-canal-gray-muted">
                        — seul pour l&apos;instant
                      </span>
                    ) : (
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      others.map((m: any) => (
                        <span
                          key={m.user_id}
                          className="text-[11px] bg-canal-gray text-white px-1.5 py-0.5 rounded-full"
                        >
                          {m.user?.display_name ?? m.user?.name ?? "?"}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-[11px] text-canal-gray-muted italic mt-3">
          Rappel : le total d&apos;une participation de groupe est divisé à
          parts égales entre les membres ; chacun crédite son équipe Canal
          Cup.
        </p>
      </section>
    </div>
  );
}
