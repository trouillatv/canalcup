import type { Reputation } from "@/lib/data/reputation";
import { cn } from "@/lib/utils";

// Section Réputation (titre + badges) — présentationnel, rendu serveur.
export function ReputationSection({ reputation }: { reputation: Reputation }) {
  const { title, badges } = reputation;
  const earned = badges.filter((b) => b.earned).length;

  return (
    <div className="canal-card space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="text-canal-yellow font-bold text-xs uppercase tracking-wider">Réputation</p>
        <span className="text-xs text-canal-gray-muted">{earned}/{badges.length} badges</span>
      </div>

      {title && (
        <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-canal-yellow/15 to-transparent border border-canal-yellow/30 px-4 py-3">
          <span className="text-3xl shrink-0">{title.emoji}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-lg font-black text-white truncate">{title.label}</p>
              {title.exclusive && (
                <span className="text-[9px] font-black uppercase tracking-wider text-canal-black bg-canal-yellow rounded px-1.5 py-0.5 shrink-0">Exclusif</span>
              )}
            </div>
            <p className="text-xs text-canal-gray-muted leading-snug">{title.description}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {badges.map((b) => (
          <div
            key={b.key}
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-3 py-2 border",
              b.earned
                ? "bg-canal-gray-mid border-canal-yellow/30"
                : "bg-canal-gray-mid/40 border-canal-gray-light/30"
            )}
          >
            <span className={cn("text-xl shrink-0", !b.earned && "grayscale opacity-40")}>{b.emoji}</span>
            <div className="min-w-0 flex-1">
              <p className={cn("text-[11px] font-black leading-tight truncate", b.earned ? "text-white" : "text-canal-gray-muted")}>{b.label}</p>
              {b.earned ? (
                <p className="text-[10px] text-canal-yellow font-bold">Débloqué ✓</p>
              ) : (
                <>
                  <p className="text-[10px] text-canal-gray-muted truncate">{b.current}/{b.target}</p>
                  <div className="h-1 rounded-full bg-canal-gray-light/30 overflow-hidden mt-0.5">
                    <div className="h-full rounded-full bg-canal-gray-light" style={{ width: `${Math.round((b.current / b.target) * 100)}%` }} />
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
