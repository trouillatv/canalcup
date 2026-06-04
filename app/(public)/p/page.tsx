// Route group (public) — squelette de la version grand public Canal+.
//
// AUCUN développement actif tant que la CdM 2026 interne n'est pas
// livrée et que la version publique n'a pas été validée produit
// post-tournoi. Cette page placeholder existe pour :
//   1. Matérialiser la séparation route group (internal) vs (public).
//   2. Empêcher le scope creep accidentel : si quelqu'un ajoute du
//      code public dans (internal)/* par erreur, la convention est
//      visible (« la version publique vit ici, pas ailleurs »).
//   3. Permettre un test de route /p/ dès maintenant sans casser rien.
//
// Voir docs/PUBLIC_VERSION_ARCHITECTURE.md pour le plan complet.

export const metadata = {
  title: "Canal Cup — Bientôt pour tous les abonnés Canal+",
  description: "La version publique de Canal Cup arrive bientôt.",
};

export default function PublicPlaceholderPage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#0D0B08",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "system-ui, sans-serif",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 420 }}>
        <div style={{ marginBottom: 16 }}>
          <span style={{ color: "#F8D200", fontWeight: 900, fontSize: 28, letterSpacing: -1 }}>
            CANAL
          </span>{" "}
          <span style={{ fontWeight: 900, fontSize: 28, letterSpacing: -1 }}>CUP</span>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>
          Bientôt pour tous les abonnés Canal+
        </h1>
        <p style={{ color: "#aaa", fontSize: 14, lineHeight: 1.5 }}>
          La version publique arrive après la Coupe du Monde 2026.
          Pronostics, agenda, classement Nouvelle-Calédonie, ligues
          privées entre amis. Pas de spam, pas de social, juste l&apos;essentiel.
        </p>
        <p style={{ color: "#666", fontSize: 11, marginTop: 24 }}>
          En cours de préparation — 2026-05-21
        </p>
      </div>
    </main>
  );
}
