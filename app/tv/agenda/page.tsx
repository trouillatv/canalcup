// Écran TV "Prochainement sur Canal Cup" — agenda des temps forts à venir,
// avec l'épreuve déguisement (Journée Supporters) en tête d'affiche.
// Contenu curé ici (facile à éditer avant de l'afficher sur la TV).

export const dynamic = "force-dynamic";

interface AgendaItem {
  emoji: string;
  title: string;
  when: string;
  desc: string;
}

const UPCOMING: AgendaItem[] = [
  {
    emoji: "🥁",
    title: "Phase de groupes — la suite",
    when: "Toute la semaine",
    desc: "Les pronos continuent. Chaque match compte pour le classement.",
  },
  {
    emoji: "🃏",
    title: "Jokers ouverts à tous",
    when: "Maintenant",
    desc: "Casino, Carton Rouge, Brouillard… 1 de chaque par binôme. Ne les laissez pas dormir !",
  },
];

export default function TvAgendaPage() {
  return (
    <div className="w-full min-h-screen bg-canal-black text-white overflow-hidden flex flex-col p-8">
      <header className="flex items-center justify-between mb-8">
        <h1 className="canal-headline text-6xl tracking-tight">
          PROCHAINEMENT <span className="text-canal-yellow">SUR CANAL CUP</span>
        </h1>
        <p className="text-2xl text-canal-gray-muted">Tenez-vous prêts 👀</p>
      </header>

      {/* Tête d'affiche : Journée Supporters / épreuve déguisement */}
      <section className="rounded-3xl border-4 border-canal-yellow bg-gradient-to-br from-canal-yellow/15 to-transparent p-10 mb-8 flex items-center gap-10">
        <div className="text-[10rem] leading-none shrink-0">📣</div>
        <div className="min-w-0">
          <p className="text-3xl text-canal-yellow font-black uppercase tracking-wider mb-2">Nouvelle épreuve · à venir</p>
          <h2 className="canal-headline text-7xl mb-4">La Journée Supporters 🎉</h2>
          <p className="text-3xl text-white/90 leading-snug">
            Sortez les <span className="text-canal-yellow font-bold">maillots</span>, les
            <span className="text-canal-yellow font-bold"> drapeaux</span>, le
            <span className="text-canal-yellow font-bold"> maquillage</span> et la
            <span className="text-canal-yellow font-bold"> déco de bureau</span> :
            chaque binôme poste SA photo de supporters déguisés.
          </p>
          <p className="text-2xl text-canal-gray-muted mt-4">
            +10 pts pour participer · vote de tous · podium <span className="text-white font-bold">+40 / +30 / +20</span>.
          </p>
        </div>
      </section>

      {/* Autres temps forts */}
      <div className="grid grid-cols-2 gap-6 flex-1 min-h-0">
        {UPCOMING.map((it, i) => (
          <section key={i} className="canal-card bg-canal-gray-dark/40 flex items-start gap-5 p-6">
            <div className="text-7xl shrink-0">{it.emoji}</div>
            <div className="min-w-0">
              <p className="text-xl text-canal-yellow font-bold uppercase">{it.when}</p>
              <h3 className="text-4xl font-black mb-1">{it.title}</h3>
              <p className="text-2xl text-white/80 leading-snug">{it.desc}</p>
            </div>
          </section>
        ))}
      </div>

      <footer className="mt-8 text-center text-3xl text-canal-yellow font-bold">
        Préparez vos déguisements… le meilleur supporter gagne&nbsp;! 📸
      </footer>
    </div>
  );
}
