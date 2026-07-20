"use client";

// Arbre de la phase finale du baby-foot (4 qualifiés) — élément CENTRAL de la
// page : quand le tournoi atteint les demies, c'est ce que les gens viennent
// voir, avant même le classement.
//
// Deux états, volontairement rendus par le MÊME arbre pour que le passage de
// l'un à l'autre ne déplace rien à l'écran :
//   · PROJECTION — les demies ne sont pas encore générées. On projette le Top 4
//     courant seedé 1v4 / 2v3, exactement comme le fait generate_ko. Tant que
//     le championnat n'est pas fini, ce tableau bouge à chaque résultat : c'est
//     l'intérêt, mais il est explicitement badgé « Projection ».
//   · RÉEL — dès que les matchs existent en base, ce sont eux qui font foi et
//     la projection disparaît complètement.
//
// La finale et la petite finale n'ont pas d'adversaires tant que les demies ne
// sont pas jouées (entry_*_id NULL en base, libellés « à venir ») : on affiche
// des emplacements en attente plutôt que de les masquer, pour que la forme de
// l'arbre soit lisible dès le départ.
//
// Responsive : colonnes côte à côte + connecteurs tracés à partir de `md`,
// empilement vertical en dessous (les connecteurs n'auraient aucun sens sur un
// écran étroit, ils sont masqués et non redessinés).

import { useState } from "react";

interface ClassRow {
  rank: number; team_id: string; label: string;
  played: number; qualified: boolean; forfeited: boolean;
}
interface PublicMatch {
  id: string; phase: string | null; round: string | null;
  status: string; score_a: number | null; score_b: number | null;
  labelA: string; labelB: string;
  entryA?: string | null; entryB?: string | null;
  starts_at?: string | null; table_no?: number | null;
}
interface Photo {
  id: string; match_id: string | null; photo_url: string;
  caption: string | null; author_name: string;
}

/** Un côté d'affiche : nom + score éventuel. */
type Side = { label: string; score: number | null; seed?: number };
type Tie = {
  key: string; title: string; a: Side | null; b: Side | null;
  finished: boolean; live: boolean;
  startsAt: string | null; tableNo: number | null;
  matchId: string | null;
};

const PENDING = new Set(["à venir", "a venir", "", "—"]);
const isPending = (label: string | null | undefined) =>
  !label || PENDING.has(label.trim().toLowerCase());

// Fuseau Nouvelle-Calédonie : les horaires sont saisis pour l'événement sur
// place, les afficher dans le fuseau du navigateur décalerait tout.
const TZ = "Pacific/Noumea";
function dateLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const day = d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: TZ });
  return day.charAt(0).toUpperCase() + day.slice(1);
}
function timeLabel(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
}

function fromMatch(m: PublicMatch, title: string): Tie {
  const finished = m.status === "finished";
  const live = m.status === "live";
  return {
    key: m.id,
    title,
    // Un score ne s'affiche que s'il existe : en live il est significatif, en
    // « upcoming » il n'y en a pas.
    a: isPending(m.labelA) ? null : { label: m.labelA, score: finished || live ? m.score_a : null },
    b: isPending(m.labelB) ? null : { label: m.labelB, score: finished || live ? m.score_b : null },
    finished,
    live,
    startsAt: m.starts_at ?? null,
    tableNo: m.table_no ?? null,
    matchId: m.id,
  };
}

/** Emplacement vide, en attente des qualifiés. */
function emptyTie(key: string, title: string): Tie {
  return { key, title, a: null, b: null, finished: false, live: false, startsAt: null, tableNo: null, matchId: null };
}

function StatusBadge({ tie }: { tie: Tie }) {
  if (tie.live) {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wide rounded px-1.5 py-0.5 bg-red-500 text-white">
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse-slow" />
        Live
      </span>
    );
  }
  if (tie.finished) {
    return (
      <span className="text-[9px] font-black uppercase tracking-wide rounded px-1.5 py-0.5 bg-canal-gray-mid text-canal-gray-muted">
        Terminé
      </span>
    );
  }
  return null;
}

function Team({ side, winner, dimmed }: { side: Side | null; winner: boolean; dimmed: boolean }) {
  if (!side) {
    return (
      <div className="flex items-center px-2.5 py-1.5 text-canal-gray-muted italic text-[11px]">
        <span className="truncate">à déterminer</span>
      </div>
    );
  }
  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs transition-colors ${
        winner
          ? "text-canal-yellow font-black bg-canal-yellow/10"
          : dimmed
            ? "text-canal-gray-muted font-bold"
            : "text-white font-bold"
      }`}
    >
      {side.seed != null && (
        <span className="text-[9px] text-canal-gray-muted tabular-nums shrink-0 w-3">{side.seed}</span>
      )}
      <span className="truncate flex-1">{side.label}</span>
      {winner && <span className="text-[10px] shrink-0">✓</span>}
      {side.score != null && <span className="tabular-nums shrink-0 text-sm">{side.score}</span>}
    </div>
  );
}

function MatchCard({
  tie,
  photos,
  accent,
}: {
  tie: Tie;
  photos: Photo[];
  accent?: boolean;
}) {
  const [open, setOpen] = useState(false);

  // Le vainqueur n'est surligné que sur un match TERMINÉ : pendant le match, un
  // score momentané ne doit pas désigner un gagnant.
  const aWins = tie.finished && (tie.a?.score ?? -1) > (tie.b?.score ?? -1);
  const bWins = tie.finished && (tie.b?.score ?? -1) > (tie.a?.score ?? -1);

  const matchPhotos = tie.matchId ? photos.filter((p) => p.match_id === tie.matchId) : [];
  // Rien à déplier tant que le match n'a ni horaire, ni table, ni photo.
  const hasDetail = Boolean(tie.startsAt || tie.tableNo != null || matchPhotos.length > 0);

  return (
    <div
      className={`rounded-lg border overflow-hidden ${
        accent ? "border-canal-yellow/60 bg-canal-yellow/5" : "border-canal-gray-mid bg-canal-gray-dark/40"
      }`}
    >
      <div className="flex items-center justify-between gap-2 px-2.5 pt-1.5">
        <p className="text-[9px] uppercase font-bold text-canal-gray-muted truncate">{tie.title}</p>
        <StatusBadge tie={tie} />
      </div>

      <div className="divide-y divide-canal-gray-mid mt-1">
        <Team side={tie.a} winner={aWins} dimmed={bWins} />
        <Team side={tie.b} winner={bWins} dimmed={aWins} />
      </div>

      {(tie.startsAt || tie.tableNo != null) && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] text-canal-gray-muted border-t border-canal-gray-mid">
          {tie.startsAt && <span>{dateLabel(tie.startsAt)}</span>}
          {tie.startsAt && <span className="tabular-nums">{timeLabel(tie.startsAt)}</span>}
          {tie.tableNo != null && (
            <span className="ml-auto font-black text-canal-black bg-canal-yellow rounded px-1.5">
              Table {tie.tableNo}
            </span>
          )}
        </div>
      )}

      {hasDetail && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="w-full text-[10px] font-bold uppercase tracking-wide text-canal-gray-muted hover:text-canal-yellow py-1 border-t border-canal-gray-mid transition-colors"
          >
            Voir le match {open ? "▴" : "▾"}
          </button>

          {open && (
            <div className="px-2.5 py-2 border-t border-canal-gray-mid bg-canal-black/30 space-y-1.5 animate-fade-in">
              <dl className="text-[10px] space-y-0.5">
                {tie.startsAt && (
                  <div className="flex gap-2">
                    <dt className="text-canal-gray-muted w-12 shrink-0">Date</dt>
                    <dd className="text-white">{dateLabel(tie.startsAt)} · {timeLabel(tie.startsAt)}</dd>
                  </div>
                )}
                {tie.tableNo != null && (
                  <div className="flex gap-2">
                    <dt className="text-canal-gray-muted w-12 shrink-0">Terrain</dt>
                    <dd className="text-white">Table {tie.tableNo}</dd>
                  </div>
                )}
                <div className="flex gap-2">
                  <dt className="text-canal-gray-muted w-12 shrink-0">Binômes</dt>
                  <dd className="text-white">
                    {tie.a?.label ?? "à déterminer"} · {tie.b?.label ?? "à déterminer"}
                  </dd>
                </div>
              </dl>

              {matchPhotos.length > 0 && (
                <div>
                  <p className="text-[10px] text-canal-gray-muted mb-1">
                    📸 {matchPhotos.length} photo{matchPhotos.length > 1 ? "s" : ""}
                  </p>
                  <div className="flex gap-1 overflow-x-auto">
                    {matchPhotos.map((p) => (
                      <img
                        key={p.id}
                        src={p.photo_url}
                        alt={p.caption ?? `Photo par ${p.author_name}`}
                        className="h-14 w-14 object-cover rounded shrink-0"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function KnockoutBracket({
  classement,
  matches,
  photos = [],
  podium = [],
  tournamentFinished = false,
}: {
  classement: ClassRow[];
  matches: PublicMatch[];
  photos?: Photo[];
  podium?: { rank: number; label: string; points: number }[];
  tournamentFinished?: boolean;
}) {
  const byPhase = (ph: string) => matches.filter((m) => m.phase === ph);
  const semis = byPhase("semi");
  const final = byPhase("final")[0] ?? null;
  const third = byPhase("third")[0] ?? null;

  // Projection : même règle que generate_ko (Top 4 seedé 1v4 / 2v3). Les
  // forfaits sont exclus — ils sont triés en bas du classement et ne peuvent
  // pas être qualifiés.
  const top4 = classement.filter((r) => !r.forfeited).slice(0, 4);
  const projected = semis.length === 0 && top4.length >= 4;

  const semiTies: Tie[] = semis.length
    ? semis.map((m, i) => fromMatch(m, `Demi-finale ${i + 1}`))
    : projected
      ? [
          [top4[0], top4[3]],
          [top4[1], top4[2]],
        ].map((p, i) => ({
          ...emptyTie(`prov-${i}`, `Demi-finale ${i + 1}`),
          a: { label: p[0].label, score: null, seed: p[0].rank },
          b: { label: p[1].label, score: null, seed: p[1].rank },
        }))
      : [];

  // Rien à montrer tant qu'aucun match n'est joué : un arbre entièrement vide
  // n'apprend rien et occuperait la moitié de l'écran pour rien.
  if (!semiTies.length && !final && !third) return null;

  const finalTie = final ? fromMatch(final, "Finale") : emptyTie("f", "Finale");
  const thirdTie = third ? fromMatch(third, "Petite finale") : emptyTie("t", "Petite finale");

  const champion = podium.find((p) => p.rank === 1) ?? null;

  return (
    <section className="space-y-3">
      <h2 className="text-base font-black uppercase text-canal-yellow flex items-center gap-2">
        🏆 Phase finale
        {projected && (
          <span className="text-[9px] font-black uppercase tracking-wide text-canal-black bg-canal-gray-muted rounded px-1.5 py-0.5">
            Projection
          </span>
        )}
      </h2>

      <div className="canal-card space-y-4">
        {projected && (
          <p className="text-[11px] text-canal-gray-muted leading-snug">
            Projection du Top 4 actuel (1 vs 4, 2 vs 3). Le tableau change à chaque résultat
            tant que le championnat n&apos;est pas terminé.
          </p>
        )}

        {/* Arbre principal. Sous `md` : simple pile verticale, connecteurs
            masqués. À partir de `md` : demies | connecteurs | finale. */}
        <div className="flex flex-col md:grid md:grid-cols-[1fr_2rem_1fr] md:items-center gap-3 md:gap-0">
          {/* Colonne demies */}
          <div className="flex flex-col justify-around gap-3 md:gap-6">
            {semiTies.length
              ? semiTies.map((t) => <MatchCard key={t.key} tie={t} photos={photos} />)
              : [
                  <MatchCard key="s1" tie={emptyTie("s1", "Demi-finale 1")} photos={photos} />,
                  <MatchCard key="s2" tie={emptyTie("s2", "Demi-finale 2")} photos={photos} />,
                ]}
          </div>

          {/* Connecteurs : deux traits qui se rejoignent vers la finale.
              Purement décoratifs, donc masqués aux lecteurs d'écran et sur
              mobile où l'arbre est linéaire. */}
          <div className="hidden md:flex w-8 self-stretch flex-col justify-center" aria-hidden="true">
            <div className="relative h-1/2">
              <div className="absolute left-0 top-0 w-1/2 border-t border-canal-gray-mid" />
              <div className="absolute left-0 bottom-0 w-1/2 border-b border-canal-gray-mid" />
              <div className="absolute left-1/2 top-0 bottom-0 border-l border-canal-gray-mid" />
              <div className="absolute left-1/2 top-1/2 w-1/2 border-t border-canal-gray-mid" />
            </div>
          </div>

          {/* Colonne finale + champion */}
          <div className="flex flex-col justify-center gap-2">
            <MatchCard tie={finalTie} photos={photos} accent />
            {champion && (
              <div className="rounded-lg bg-canal-yellow text-canal-black px-3 py-2 text-center animate-slide-up">
                <p className="text-[9px] font-black uppercase tracking-wide opacity-70">Champion</p>
                <p className="text-sm font-black truncate">🥇 {champion.label}</p>
              </div>
            )}
          </div>
        </div>

        {/* Petite finale — hors de l'arbre : elle ne mène nulle part. */}
        <div className="pt-3 border-t border-canal-gray-mid">
          <p className="text-[10px] uppercase font-bold text-canal-gray-muted mb-1.5">
            🥉 Petite finale · 3e place
          </p>
          <div className="md:max-w-sm">
            <MatchCard tie={thirdTie} photos={photos} />
          </div>
        </div>

        {/* Podium — seulement quand le tournoi est CLOS : afficher un podium
            partiel en cours de route laisserait croire que c'est joué. */}
        {tournamentFinished && podium.length > 0 && (
          <div className="pt-3 border-t border-canal-gray-mid">
            <p className="text-[10px] uppercase font-bold text-canal-gray-muted mb-1.5">Podium</p>
            <div className="grid grid-cols-3 gap-1.5">
              {podium
                .slice()
                .sort((a, b) => a.rank - b.rank)
                .map((p, i) => (
                  <div
                    key={p.rank}
                    className={`rounded-lg px-2 py-2 text-center animate-slide-up ${
                      p.rank === 1
                        ? "bg-canal-yellow text-canal-black"
                        : "bg-canal-gray-dark/60 text-white border border-canal-gray-mid"
                    }`}
                    // Léger décalage : les 3 marches apparaissent l'une après
                    // l'autre plutôt que d'un bloc.
                    style={{ animationDelay: `${i * 120}ms`, animationFillMode: "backwards" }}
                  >
                    <p className="text-lg leading-none">{["🥇", "🥈", "🥉"][p.rank - 1]}</p>
                    <p className="text-[11px] font-black truncate mt-0.5">{p.label}</p>
                    <p
                      className={`text-[10px] tabular-nums ${
                        p.rank === 1 ? "opacity-70" : "text-canal-gray-muted"
                      }`}
                    >
                      {p.points} pts
                    </p>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
