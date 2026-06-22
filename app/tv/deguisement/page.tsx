// Écran TV teaser — l'épreuve DÉGUISEMENT (Journée Supporters) démarre DEMAIN.
// Affiché aujourd'hui pour créer l'attente (page visible, photos demain).
// Texte curé ici, facile à éditer avant diffusion.

export const dynamic = "force-dynamic";

export default function TvDeguisementTeaserPage() {
  return (
    <div className="w-full min-h-screen bg-canal-black text-white overflow-hidden flex flex-col items-center justify-center p-10 text-center relative">
      {/* Badge "demain" clignotant */}
      <div className="absolute top-10 right-10 px-6 py-3 rounded-full bg-canal-yellow text-canal-black text-3xl font-black uppercase tracking-widest animate-pulse">
        ⏳ Demain
      </div>

      <p className="text-3xl md:text-4xl text-canal-yellow font-black uppercase tracking-[0.3em] mb-4">
        Journée Supporters
      </p>

      <h1 className="canal-headline text-7xl md:text-9xl leading-none mb-6">
        L&apos;ÉPREUVE <span className="text-canal-yellow">DÉGUISEMENT</span>
      </h1>

      <p className="text-4xl md:text-5xl font-black mb-10">
        ça commence <span className="text-canal-yellow">demain</span> ! 📸
      </p>

      <div className="text-[9rem] md:text-[12rem] leading-none mb-10">🎭🧣🥁</div>

      <p className="text-3xl md:text-4xl text-white/90 leading-snug max-w-5xl">
        Sortez les <span className="text-canal-yellow font-bold">maillots</span>, les{" "}
        <span className="text-canal-yellow font-bold">drapeaux</span>, le{" "}
        <span className="text-canal-yellow font-bold">maquillage</span> et la{" "}
        <span className="text-canal-yellow font-bold">déco de bureau</span>.
      </p>
      <p className="text-3xl md:text-4xl text-white/90 leading-snug max-w-5xl mt-4">
        Chaque binôme poste <span className="font-bold">SA</span> photo de supporters déguisés.
      </p>

      <div className="flex items-center gap-10 mt-12 text-2xl md:text-3xl">
        <span className="text-canal-gray-muted">📸 <span className="text-white font-bold">+10 pts</span> pour participer</span>
        <span className="text-canal-gray-muted">🗳️ vote de tous</span>
        <span className="text-canal-gray-muted">🏆 podium <span className="text-white font-bold">+40 / +30 / +20</span></span>
      </div>

      <footer className="mt-14 text-3xl md:text-4xl text-canal-yellow font-black uppercase tracking-wider">
        Préparez vos plus beaux déguisements… 👀
      </footer>
    </div>
  );
}
