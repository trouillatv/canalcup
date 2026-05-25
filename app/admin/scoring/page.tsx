// /admin/scoring — vue (lecture seule) du score d'équipe.
//
// MODÈLE POINTS BRUTS (2026-05) : le score d'équipe = babyfoot + animations,
// à leur valeur brute. Pronostics et quiz sont PERSONNELS (hors score équipe),
// votes = social. Il n'y a plus de pondération à calibrer (l'ancien dry-run de
// poids est supprimé). Cette page sert juste à vérifier les totaux courants.
//
// Protégée par app/admin/layout.tsx → requireRole("admin").

import { createClient } from "@/lib/supabase/server";
import { computeTeamScores } from "@/lib/data/teams";

export const dynamic = "force-dynamic";

export default async function AdminScoringPage() {
  const supabase = await createClient();
  const { data: teamsRaw } = await supabase.from("teams").select("id, name");
  const teams = teamsRaw ?? [];
  const agg = await computeTeamScores(supabase, teams.map((t) => t.id));

  const rows = teams
    .map((t) => {
      const b = agg.get(t.id);
      return {
        id: t.id,
        name: t.name as string,
        babyfoot: b?.babyRaw ?? 0,
        animations: b?.animRaw ?? 0,
        total: b?.total ?? 0,
        // indicatif (perso, hors score équipe)
        pronos: (b?.predRaw ?? 0) + (b?.bonusRaw ?? 0),
        quiz: b?.quizRaw ?? 0,
      };
    })
    .sort((a, b) => b.total - a.total);

  return (
    <div className="px-4 py-4 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="canal-headline text-2xl">Score d&apos;équipe</h1>
        <p className="text-canal-gray-muted text-sm mt-1">
          Modèle points bruts : <span className="text-white font-bold">babyfoot + animations</span>.
          Pronostics et quiz sont personnels (hors score d&apos;équipe).
        </p>
      </div>

      <div className="canal-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-canal-gray-muted text-xs">
              <th className="text-left font-bold py-1">Équipe</th>
              <th className="text-right font-bold py-1 w-16">Baby</th>
              <th className="text-right font-bold py-1 w-16">Anim</th>
              <th className="text-right font-bold py-1 w-16 text-canal-yellow">Total</th>
              <th className="text-right font-bold py-1 w-20">Perso*</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-canal-gray-light">
                <td className="py-2 text-white font-bold truncate">{r.name}</td>
                <td className="py-2 text-right tabular-nums">{r.babyfoot}</td>
                <td className="py-2 text-right tabular-nums">{r.animations}</td>
                <td className="py-2 text-right tabular-nums font-black text-canal-yellow">{r.total}</td>
                <td className="py-2 text-right tabular-nums text-canal-gray-muted">{r.pronos + r.quiz}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-canal-gray-muted">Aucune équipe.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-canal-gray-muted">
        * Perso = cumul pronostics + quiz des membres, affiché à titre indicatif —
        ne compte pas dans le score d&apos;équipe.
      </p>
    </div>
  );
}
