// Garde-fou de démarrage — architecture Supabase P2 (voir
// docs/supabase-architecture-p2.md). S'exécute une fois au boot du
// serveur Next.js (Node.js runtime uniquement) : le process refuse de
// démarrer si la base CANAL Sports (read/write) et la base legacy Canal
// Cup (read-only) pointent vers le même projet Supabase.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { assertDistinctSupabaseProjects } = await import("@/lib/supabase/legacy");
  assertDistinctSupabaseProjects();
}
