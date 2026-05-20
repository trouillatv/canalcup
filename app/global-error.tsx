"use client";

// Error boundary GLOBAL — capture aussi les erreurs du root layout
// (TopBar/BottomNav). Doit définir <html> et <body>. Affiche le VRAI
// message d'erreur (utile en mobile où les devtools sont peu pratiques).

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body
        style={{
          backgroundColor: "#0D0B08",
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
          padding: 24,
          minHeight: "100vh",
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <h1 style={{ color: "#F8D200", fontSize: 22, fontWeight: 900 }}>
            ⚠️ Application Canal Cup — erreur
          </h1>
          <p style={{ color: "#aaa", fontSize: 13, marginTop: 8 }}>
            Une erreur a stoppé l&apos;app. Copie le message ci-dessous et envoie-le pour qu&apos;on corrige.
          </p>
          <pre
            style={{
              marginTop: 16,
              padding: 12,
              background: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: 8,
              fontSize: 12,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              color: "#ff8080",
            }}
          >
{error?.name ? `${error.name}: ` : ""}{error?.message || "Erreur inconnue"}
{error?.digest ? `\n[digest ${error.digest}]` : ""}
{error?.stack ? `\n\n${error.stack.split("\n").slice(0, 6).join("\n")}` : ""}
          </pre>
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <button
              onClick={reset}
              style={{
                background: "#F8D200",
                color: "#0D0B08",
                border: 0,
                padding: "10px 16px",
                borderRadius: 8,
                fontWeight: 900,
                fontSize: 14,
              }}
            >
              Recharger
            </button>
            <a
              href="/"
              style={{
                background: "transparent",
                color: "#aaa",
                padding: "10px 16px",
                border: "1px solid #333",
                borderRadius: 8,
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              Retour accueil
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
