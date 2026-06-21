// /badge/[key] — détail d'un badge OU d'un titre de réputation.
// Description / comment l'obtenir / nb de détenteurs / classement des détenteurs.
// Données dérivées du moteur reputation.ts (0 nouvelle table).

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getHolders } from "@/lib/data/reputation";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function BadgeDetailPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const holders = await getHolders(key);
  if (!holders) notFound();

  const { kind, meta, userIds } = holders;
  const secret = kind === "badge" && "secret" in meta && meta.secret;

  // Noms des détenteurs.
  let names: { id: string; name: string }[] = [];
  if (userIds.length) {
    const supabase = createAdminClient();
    const { data } = await supabase.from("users").select("id, display_name, name").in("id", userIds);
    names = (data ?? []).map((u: { id: string; display_name: string | null; name: string | null }) => ({
      id: u.id, name: (u.display_name ?? u.name ?? "Joueur").trim() || "Joueur",
    })).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }

  const exclusive = kind === "title" && "exclusive" in meta && meta.exclusive;
  const howTo = secret ? "🔒 Condition gardée secrète — à toi de la découvrir." : meta.description;

  return (
    <div className="min-h-screen bg-canal-black">
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-canal-black/95 backdrop-blur border-b border-canal-gray-light">
        <Link href="/leaderboard" className="flex items-center gap-1.5 text-canal-gray-muted hover:text-white text-sm font-bold">
          <ArrowLeft size={16} /> Classement
        </Link>
      </div>

      <div className="px-4 py-5 max-w-xl mx-auto space-y-4">
        {/* En-tête badge/titre */}
        <div className="canal-card flex items-center gap-4 border border-canal-yellow/30 bg-gradient-to-br from-canal-yellow/10 to-transparent">
          <span className="text-5xl shrink-0">{meta.emoji}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-black text-white">{meta.label}</h1>
              <span className="text-[9px] font-black uppercase tracking-wider text-canal-black bg-canal-yellow rounded px-1.5 py-0.5">
                {kind === "title" ? "Titre" : "Badge"}
              </span>
              {(exclusive || secret) && (
                <span className="text-[9px] font-black uppercase tracking-wider text-canal-yellow border border-canal-yellow/40 rounded px-1.5 py-0.5">
                  {secret ? "Secret" : "Exclusif"}
                </span>
              )}
            </div>
            <p className="text-sm text-canal-gray-muted mt-1">{howTo}</p>
          </div>
        </div>

        {/* Détenteurs */}
        <div className="canal-card space-y-3">
          <div className="flex items-baseline justify-between">
            <p className="text-canal-yellow font-bold text-xs uppercase tracking-wider">Détenteurs</p>
            <span className="text-sm font-black text-white">{names.length}</span>
          </div>
          {names.length === 0 ? (
            <p className="text-center text-canal-gray-muted text-sm py-6">
              Personne ne l&apos;a encore débloqué. Sois le premier !
            </p>
          ) : (
            <div className="space-y-1.5">
              {names.map((u, i) => (
                <Link
                  key={u.id}
                  href={`/joueur/${u.id}`}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl bg-canal-gray-mid hover:bg-canal-gray-light transition-colors"
                >
                  <span className="w-6 text-center text-xs font-black text-canal-gray-muted tabular-nums">{i + 1}</span>
                  <span className="flex-1 min-w-0 truncate text-sm font-bold text-white">{u.name}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
