import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Client Canal Cup — LECTURE SEULE.
//
// Réservé aux scripts d'audit/import explicitement identifiés (voir
// scripts/legacy-audit/*). AUCUNE route de l'application ne doit importer
// ce module : CANAL Sports ne dépend jamais de Canal Cup au runtime.
//
// Garde-fou technique (pas seulement une convention) :
//   - refuse de s'instancier si LEGACY_CANALCUP_SUPABASE_URL pointe vers le
//     même projet que NEXT_PUBLIC_SUPABASE_URL (voir assertDistinctSupabaseProjects
//     dans ./guard, appelé aussi au démarrage via instrumentation.ts) ;
//   - bloque insert/update/upsert/delete/rpc/storage au niveau du client,
//     même si un service_role key legacy est fourni.

const MUTATING_QUERY_METHODS = ["insert", "update", "upsert", "delete"] as const;

function legacyBlocked(operation: string): never {
  throw new Error(
    `[legacy-guard] Opération "${operation}" bloquée sur le client Canal Cup (lecture seule). ` +
      "Ce client ne doit jamais écrire — voir lib/supabase/legacy.ts."
  );
}

export function createLegacyReadOnlyClient() {
  assertDistinctSupabaseProjects();

  const url = process.env.LEGACY_CANALCUP_SUPABASE_URL;
  const key =
    process.env.LEGACY_CANALCUP_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.LEGACY_CANALCUP_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "[legacy-guard] LEGACY_CANALCUP_SUPABASE_URL / LEGACY_CANALCUP_SUPABASE_ANON_KEY " +
        "(ou _SERVICE_ROLE_KEY) manquants — client Canal Cup indisponible."
    );
  }

  // eslint-disable-next-line no-console
  console.warn(
    `[legacy-guard] Ouverture d'un client Canal Cup en LECTURE SEULE (${projectRef(url)}). ` +
      "Réservé aux scripts d'audit/import — jamais aux routes applicatives."
  );

  const client = createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === "from") {
        return (table: string) => {
          const queryBuilder = target.from(table);
          return new Proxy(queryBuilder, {
            get(qbTarget, qbProp, qbReceiver) {
              if (typeof qbProp === "string" && (MUTATING_QUERY_METHODS as readonly string[]).includes(qbProp)) {
                return () => legacyBlocked(qbProp);
              }
              return Reflect.get(qbTarget, qbProp, qbReceiver);
            },
          });
        };
      }
      if (prop === "rpc") {
        return () => legacyBlocked("rpc");
      }
      if (prop === "storage") {
        return legacyBlocked("storage");
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

export function projectRef(supabaseUrl: string): string {
  try {
    return new URL(supabaseUrl).hostname.split(".")[0];
  } catch {
    return supabaseUrl;
  }
}

// Exporté séparément (pas seulement appelé dans createLegacyReadOnlyClient)
// pour pouvoir être vérifié une seule fois au démarrage du process, via
// instrumentation.ts — voir point 6 de l'architecture Supabase P2.
export function assertDistinctSupabaseProjects() {
  const mainUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const legacyUrl = process.env.LEGACY_CANALCUP_SUPABASE_URL;
  if (!mainUrl || !legacyUrl) return; // rien à comparer, pas notre rôle de valider la présence ici
  if (projectRef(mainUrl) === projectRef(legacyUrl)) {
    throw new Error(
      "[legacy-guard] NEXT_PUBLIC_SUPABASE_URL et LEGACY_CANALCUP_SUPABASE_URL pointent vers " +
        `le même projet Supabase (${projectRef(mainUrl)}). CANAL Sports (read/write) et Canal Cup ` +
        "(read-only) doivent être deux projets distincts — vérifie .env.local."
    );
  }
}
