import { createAdminClient } from "@/lib/supabase/admin";
import { callGemini } from "@/services/ai/gemini";
import type { ModerationFlaggedItem, ModerationRiskLevel } from "@/lib/supabase/types";

type SocialSample = {
  source: "feed" | "vestiaire";
  id: string;
  author: string | null;
  channel: string | null;
  body: string;
  created_at: string;
};

type ModerationAiResult = {
  risk_level: ModerationRiskLevel;
  summary: string;
  recommendation: string;
  flagged_items: ModerationFlaggedItem[];
};

const LOCAL_RISK_TERMS = [
  "nul",
  "nulle",
  "debile",
  "débile",
  "con",
  "idiot",
  "interdire",
  "ferme",
  "ta gueule",
];

function fallbackModeration(samples: SocialSample[]): ModerationAiResult {
  const flagged = samples
    .filter((item) => LOCAL_RISK_TERMS.some((term) => item.body.toLowerCase().includes(term)))
    .slice(0, 8)
    .map((item) => ({
      source: item.source,
      id: item.id,
      author: item.author,
      channel: item.channel,
      excerpt: item.body.slice(0, 220),
      reason: "Terme potentiellement agressif detecte par filtre local.",
    }));

  const riskLevel: ModerationRiskLevel = flagged.length >= 3 ? "medium" : flagged.length > 0 ? "low" : "low";
  return {
    risk_level: riskLevel,
    summary:
      flagged.length > 0
        ? `${flagged.length} message(s) meritent une verification admin.`
        : "Aucun signal faible notable dans les messages analyses.",
    recommendation:
      flagged.length > 0
        ? "Verifier le contexte avant action. Privilegier un rappel leger si le chambrage devient personnel."
        : "Aucune action recommandee.",
    flagged_items: flagged,
  };
}

function buildPrompt(samples: SocialSample[]) {
  const compact = samples.map((item) => ({
    source: item.source,
    id: item.id,
    author: item.author,
    channel: item.channel,
    text: item.body.slice(0, 500),
    created_at: item.created_at,
  }));

  return `
Tu es l'assistant de moderation interne de Canal Cup, animation d'entreprise Canal+.
Tu n'interviens jamais publiquement. Tu aides seulement les admins a reperer les derapages.

Analyse ces messages des dernieres 24h :
${JSON.stringify(compact)}

Classe le risque :
- low : chambrage normal, rien d'inquietant
- medium : ton limite, personne ciblee, rappel utile
- high : insulte claire, harcelement, discrimination, menace ou ciblage repete

Reponds uniquement en JSON valide :
{
  "risk_level": "low|medium|high",
  "summary": "resume court pour admin",
  "recommendation": "action conseillee",
  "flagged_items": [
    {
      "source": "feed|vestiaire",
      "id": "id exact",
      "author": "auteur",
      "channel": "salon ou null",
      "excerpt": "extrait court",
      "reason": "pourquoi verifier"
    }
  ]
}
`;
}

export async function generateModerationReport() {
  const admin = createAdminClient();
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - 24 * 60 * 60_000);

  const [feedRes, vestiaireRes] = await Promise.all([
    admin
      .from("feed_posts")
      .select("id, display_name, email, body, created_at")
      .eq("status", "visible")
      .gte("created_at", windowStart.toISOString())
      .order("created_at", { ascending: false })
      .limit(120),
    admin
      .from("vestiaire_messages")
      .select("id, display_name, email, body, created_at, channel:vestiaire_channels(title)")
      .eq("status", "visible")
      .gte("created_at", windowStart.toISOString())
      .order("created_at", { ascending: false })
      .limit(180),
  ]);

  if (feedRes.error) throw new Error(feedRes.error.message);
  if (vestiaireRes.error) throw new Error(vestiaireRes.error.message);

  const feedSamples: SocialSample[] = (feedRes.data ?? []).map((item) => ({
    source: "feed",
    id: item.id,
    author: item.display_name ?? item.email ?? null,
    channel: "Fil d'actualite",
    body: item.body,
    created_at: item.created_at,
  }));

  const vestiaireSamples: SocialSample[] = (vestiaireRes.data ?? []).map((item) => ({
    source: "vestiaire",
    id: item.id,
    author: item.display_name ?? item.email ?? null,
    channel: (item.channel as { title?: string } | null)?.title ?? null,
    body: item.body,
    created_at: item.created_at,
  }));

  const samples = [...feedSamples, ...vestiaireSamples];
  const result =
    samples.length === 0
      ? {
          risk_level: "low" as const,
          summary: "Aucun message a analyser sur les dernieres 24h.",
          recommendation: "Aucune action recommandee.",
          flagged_items: [],
        }
      : await callGemini<ModerationAiResult>(buildPrompt(samples))
          .then((r) => r.data)
          .catch(() => fallbackModeration(samples));

  const { data, error } = await admin
    .from("moderation_reports")
    .insert({
      window_start: windowStart.toISOString(),
      window_end: windowEnd.toISOString(),
      risk_level: result.risk_level,
      summary: result.summary,
      recommendation: result.recommendation,
      flagged_items: result.flagged_items ?? [],
      status: "new",
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}
