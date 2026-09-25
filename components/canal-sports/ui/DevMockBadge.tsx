// DevMockBadge — marqueur visuel obligatoire pour toute donnée factice.
//
// Règle du squelette CANAL Sports : aucune donnée métier inventée ne doit
// pouvoir être confondue avec une vraie donnée. Ce badge n'est rendu qu'en
// dehors de production (NODE_ENV !== "production") ; en production, un
// composant qui n'a pas de vraie donnée doit utiliser <EmptyState /> et
// jamais de mock.

export function DevMockBadge() {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-canal-red/60 bg-canal-red/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-canal-red">
      Dev / Mock
    </span>
  );
}
