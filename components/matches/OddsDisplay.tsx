import type { MatchOdds } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

interface OddsDisplayProps {
  odds: MatchOdds;
  teamA: string;
  teamB: string;
  selected?: "A" | "DRAW" | "B";
  compact?: boolean;
}

function OddPill({
  label,
  value,
  active,
  compact,
}: {
  label: string;
  value: number;
  active?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-lg border transition-colors",
        compact ? "px-2 py-1" : "px-3 py-1.5",
        active
          ? "border-canal-yellow bg-canal-yellow/10"
          : "border-canal-gray-light bg-canal-gray-mid"
      )}
    >
      <span
        className={cn(
          "font-black tabular-nums",
          compact ? "text-sm" : "text-base",
          active ? "text-canal-yellow" : "text-white"
        )}
      >
        {value.toFixed(2)}
      </span>
      <span className={cn("text-canal-gray-muted leading-tight", compact ? "text-[10px]" : "text-xs")}>
        {label}
      </span>
    </div>
  );
}

export function OddsDisplay({ odds, teamA, teamB, selected, compact }: OddsDisplayProps) {
  return (
    <div className="w-full">
      {!compact && (
        <p className="text-xs text-canal-gray-muted text-center mb-1.5 uppercase tracking-wider font-semibold">
          Cotes indicatives
        </p>
      )}
      <div className="flex gap-2 justify-center">
        <OddPill
          label={compact ? teamA.slice(0, 3) : teamA}
          value={odds.odds_a}
          active={selected === "A"}
          compact={compact}
        />
        <OddPill
          label="Nul"
          value={odds.odds_draw}
          active={selected === "DRAW"}
          compact={compact}
        />
        <OddPill
          label={compact ? teamB.slice(0, 3) : teamB}
          value={odds.odds_b}
          active={selected === "B"}
          compact={compact}
        />
      </div>
    </div>
  );
}
